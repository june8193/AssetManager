# -*- coding: utf-8 -*-
"""키움증권 REST API를 통해 거래내역 및 체결내역을 동기화하는 서비스 모듈입니다."""

import logging
import datetime
import httpx
from sqlalchemy.orm import Session
from ..models import Account, Asset, Transaction
from src.kiwoom.auth import KiwoomAuthManager

logger = logging.getLogger("KiwoomTransactionService")

class KiwoomTransactionService:
    """키움증권 계좌의 당일 체결 내역 및 배당금 입금 내역을 DB에 자동 저장하는 서비스 클래스입니다.

    이 클래스는 키움증권 REST API를 호출하여 최신 거래(매수/매도/배당) 내역을 수집하고,
    DB의 자산 정보 유효성 검증 및 중복 적재 방지 처리를 수행합니다.
    """

    def __init__(self):
        """KiwoomTransactionService 인스턴스를 초기화합니다."""
        self.auth_manager = KiwoomAuthManager()
        self.base_url = self.auth_manager.base_url if self.auth_manager.base_url else "https://api.kiwoom.com"

    async def sync_transactions(self, db: Session, days: int = 7) -> dict:
        """키움증권 Open API를 통해 거래내역 및 체결내역을 동기화하여 DB에 저장합니다.

        설정된 모든 활성화 키움증권 계좌를 루프 돌며 각각 동기화를 수행합니다.

        Args:
            db (Session): SQLAlchemy 데이터베이스 세션
            days (int): 조회할 기간 범위 (기본값 7일). 1인 경우 실시간 당일 조회를 처리합니다.

        Returns:
            dict: 동기화 결과를 담은 딕셔너리. (성공 건수, 보류 건수, 상세 내역 등)
        """
        logger.info(f"키움증권 거래내역 동기화 프로세스 시작 (조회일수: {days})...")

        # 1. DB에서 활성화된 키움증권 계좌 목록 획득
        accounts = db.query(Account).filter(Account.provider == "키움증권", Account.is_active == True).all()
        if not accounts:
            logger.error("활성화된 키움증권 계좌를 DB에서 찾을 수 없습니다.")
            return {
                "status": "error",
                "message": "활성화된 키움증권 계좌가 존재하지 않습니다."
            }

        total_success_count = 0
        synced_list = []
        unregistered_list = []

        today_str = datetime.date.today().strftime("%Y%m%d")
        start_date_str = (datetime.date.today() - datetime.timedelta(days=days - 1)).strftime("%Y%m%d")

        for account in accounts:
            logger.info(f"계좌 동기화 시작: {account.name} (ID: {account.id})")
            try:
                # 해당 계좌에 대응하는 토큰 발급
                token = await self.auth_manager.get_valid_token(account.name)
            except Exception as e:
                logger.error(f"계좌 {account.name} 인증 토큰 획득 실패 (동기화 생략): {e}")
                continue

            raw_transactions = []

            try:
                # 2. 수집 대상 데이터 수집 (당일 배치 vs 소급/수동)
                if days == 1:
                    # 당일 동기화 (체결요청 + 당일 배당금)
                    # 2-1. 국내 주식 체결 조회 (ka10076)
                    domestic_executions = await self._fetch_domestic_executions(token)
                    for exe in domestic_executions:
                        raw_transactions.append({
                            "date": datetime.date.today(),
                            "ticker": exe.get("stk_cd"),
                            "name": exe.get("stk_nm"),
                            "type": "BUY" if "매수" in exe.get("io_tp_nm", "") else "SELL",
                            "quantity": float(exe.get("cntr_qty", 0)),
                            "price": float(exe.get("cntr_pric", 0)),
                            "currency": "KRW",
                            "memo": f"키움 자동저장 (체결)"
                        })

                    # 2-2. 미국 주식 체결 조회 (ust21510)
                    overseas_executions = await self._fetch_overseas_executions(token)
                    for exe in overseas_executions:
                        raw_transactions.append({
                            "date": datetime.date.today(),
                            "ticker": exe.get("stk_cd"),
                            "name": exe.get("stk_nm"),
                            "type": "BUY" if "매수" in exe.get("io_tp_nm", "") else "SELL",
                            "quantity": float(exe.get("cntr_qty", 0)),
                            "price": float(exe.get("cntr_pric", 0)),
                            "currency": "USD",
                            "memo": f"키움 자동저장 (해외체결)"
                        })

                    # 2-3. 당일 종합거래내역 조회 (kt00015 - 배당금만 수집)
                    daily_ledger = await self._fetch_comprehensive_ledger(token, today_str, today_str)
                    for tx in daily_ledger:
                        if "배당금" in tx.get("rmrk_nm", ""):
                            raw_transactions.append({
                                "date": datetime.datetime.strptime(tx.get("trde_dt"), "%Y%m%d").date(),
                                "ticker": tx.get("stk_cd"),
                                "name": tx.get("stk_nm", "배당금 입금"),
                                "type": "INTEREST",
                                "quantity": float(tx.get("trde_qty_jwa_cnt", 0) or 0),
                                "price": float(tx.get("trde_amt", 0)),
                                "currency": "KRW",
                                "memo": f"키움 자동저장 (배당금)"
                            })
                else:
                    # 소급/수동 동기화 (최근 N일 종합거래내역 kt00015를 통한 수집)
                    ledger_data = await self._fetch_comprehensive_ledger(token, start_date_str, today_str)
                    for tx in ledger_data:
                        rmrk = tx.get("rmrk_nm", "")
                        stk_cd = tx.get("stk_cd")
                        
                        if "배당금" in rmrk:
                            raw_transactions.append({
                                "date": datetime.datetime.strptime(tx.get("trde_dt"), "%Y%m%d").date(),
                                "ticker": stk_cd,
                                "name": tx.get("stk_nm", "배당금 입금"),
                                "type": "INTEREST",
                                "quantity": float(tx.get("trde_qty_jwa_cnt", 0) or 0),
                                "price": float(tx.get("trde_amt", 0)),
                                "currency": "KRW",
                                "memo": f"키움 자동저장 (소급 배당금)"
                            })
                        elif any(m in rmrk for m in ["장내매수", "장내매도", "매매", "매수", "매도"]):
                            # 매매 내역 소급 (체결일자 cntr_dt가 존재해야 함)
                            cntr_dt_str = tx.get("cntr_dt") or tx.get("trde_dt")
                            cntr_date = datetime.datetime.strptime(cntr_dt_str, "%Y%m%d").date()
                            
                            # 원화 거래로 처리
                            raw_transactions.append({
                                "date": cntr_date,
                                "ticker": stk_cd,
                                "name": tx.get("stk_nm"),
                                "type": "BUY" if "매수" in rmrk else "SELL",
                                "quantity": float(tx.get("trde_qty_jwa_cnt", 0)),
                                "price": float(tx.get("trde_amt", 0)) / float(tx.get("trde_qty_jwa_cnt", 1)) if float(tx.get("trde_qty_jwa_cnt", 0)) > 0 else 0,
                                "currency": "KRW",
                                "memo": f"키움 자동저장 (소급 매매)"
                            })

                # 3. DB 적재 및 검증 처리
                success_count = 0
                for tx_data in raw_transactions:
                    ticker = tx_data["ticker"]
                    if not ticker:
                        continue

                    # 3-1. 자산 마스터 검증
                    asset = db.query(Asset).filter(Asset.ticker == ticker).first()
                    if not asset:
                        # 자산이 등록되지 않은 경우
                        unregistered_list.append({
                            "ticker": ticker,
                            "name": tx_data["name"],
                            "type": tx_data["type"],
                            "quantity": tx_data["quantity"],
                            "price": tx_data["price"],
                            "total_amount": tx_data["quantity"] * tx_data["price"] if tx_data["type"] in ["BUY", "SELL"] else tx_data["price"],
                            "currency": tx_data["currency"]
                        })
                        logger.warning(f"미등록 자산 발견으로 저장 생략: {ticker} ({tx_data['name']})")
                        continue

                    # 자산 국가 정보에 따라 통화 보정 (미국 주식은 항상 USD로 저장)
                    if asset.country == "US":
                        tx_data["currency"] = "USD"
                    else:
                        tx_data["currency"] = "KRW"

                    # 3-2. 중복 적재 방지 검사
                    total_amt = tx_data["quantity"] * tx_data["price"] if tx_data["type"] in ["BUY", "SELL"] else tx_data["price"]
                    
                    exists = db.query(Transaction).filter(
                        Transaction.account_id == account.id,
                        Transaction.asset_id == asset.id,
                        Transaction.transaction_date == tx_data["date"],
                        Transaction.type == tx_data["type"],
                        Transaction.quantity == tx_data["quantity"],
                        Transaction.price == tx_data["price"],
                        Transaction.total_amount == total_amt
                    ).first()

                    if exists:
                        logger.info(f"이미 존재하는 거래내역으로 저장 스킵: {asset.name} ({tx_data['date']})")
                        continue

                    # 3-3. 신규 거래내역 저장
                    new_tx = Transaction(
                        account_id=account.id,
                        asset_id=asset.id,
                        transaction_date=tx_data["date"],
                        type=tx_data["type"],
                        quantity=tx_data["quantity"],
                        price=tx_data["price"],
                        total_amount=total_amt,
                        currency=tx_data["currency"],
                        memo=tx_data["memo"]
                    )
                    db.add(new_tx)
                    success_count += 1
                    synced_list.append({
                        "type": tx_data["type"],
                        "asset_name": asset.name,
                        "quantity": tx_data["quantity"],
                        "price": tx_data["price"],
                        "total_amount": total_amt,
                        "currency": tx_data["currency"]
                    })

                if success_count > 0:
                    db.commit()
                    logger.info(f"계좌 {account.name} 동기화 성공: {success_count}건 저장 완료.")
                    total_success_count += success_count

            except Exception as e:
                db.rollback()
                logger.error(f"계좌 {account.name} 동기화 처리 중 예외 발생 (스킵): {str(e)}")
                continue

        return {
            "status": "success",
            "success_count": total_success_count,
            "pending_count": len(unregistered_list),
            "synced_transactions": synced_list,
            "unregistered_assets": unregistered_list
        }

    async def _fetch_domestic_executions(self, token: str) -> list:
        """국내 주식 당일 체결 내역을 조회합니다 (ka10076)."""
        url = f"{self.base_url}/api/dostk/acnt"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ka10076",
            "authorization": f"Bearer {token}"
        }
        payload = {
            "qry_tp": "0",   # 전체
            "sell_tp": "0",  # 전체
            "stex_tp": "0"   # 통합
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            if data.get("return_code") in [0, "0"]:
                return data.get("cntr", [])
            return []

    async def _fetch_overseas_executions(self, token: str) -> list:
        """미국 주식 당일 체결 내역을 조회합니다 (ust21510)."""
        url = f"{self.base_url}/api/us/acnt"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ust21510",
            "authorization": f"Bearer {token}"
        }
        payload = {
            "qry_tp": "0",  # 전체
            "sell_tp": "0" # 전체
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            if data.get("return_code") in [0, "0"]:
                return data.get("result_list", [])
            return []

    async def _fetch_comprehensive_ledger(self, token: str, start_dt: str, end_dt: str) -> list:
        """종합거래내역을 조회합니다 (kt00015)."""
        url = f"{self.base_url}/api/dostk/acnt"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "kt00015",
            "authorization": f"Bearer {token}"
        }
        payload = {
            "strt_dt": start_dt,
            "end_dt": end_dt,
            "tp": "0",             # 전체
            "gds_tp": "0",         # 전체
            "dmst_stex_tp": "%",   # 전체
            "qry_sort_tp": "2"     # 과거거래순
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            if data.get("return_code") in [0, "0"]:
                return data.get("trst_ovrl_trde_prps_array", [])
            return []
