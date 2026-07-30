# -*- coding: utf-8 -*-
"""키움증권 REST API를 통해 거래내역 및 체결내역을 동기화하는 서비스 모듈입니다."""

import logging
import datetime
import re
import httpx
from sqlalchemy.orm import Session
from ..models import Account, Asset, Transaction
from src.kiwoom.auth import KiwoomAuthManager

logger = logging.getLogger("KiwoomTransactionService")

def _safe_float(val, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def normalize_ticker(ticker: str | None) -> str | None:
    """국내 주식 종목코드에 붙은 'A' 접두사(예: A000660)를 제거하여 정제합니다.

    Args:
        ticker (str | None): 정제할 티커 종목코드

    Returns:
        str | None: 정제된 6자리 숫자 종목코드 또는 원본 티커
    """
    if not ticker:
        return ticker
    return re.sub(r"^A(\d{6})$", r"\1", ticker)

class KiwoomTransactionService:
    """키움증권 계좌의 당일 체결 내역 및 배당금 입금 내역을 DB에 자동 저장하는 서비스 클래스입니다.

    이 클래원은 키움증권 REST API를 호출하여 최신 거래(매수/매도/배당) 내역을 수집하고,
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
        failed_accounts_list = []

        today_str = datetime.date.today().strftime("%Y%m%d")
        start_date_str = (datetime.date.today() - datetime.timedelta(days=days - 1)).strftime("%Y%m%d")

        for account in accounts:
            logger.info(f"계좌 동기화 시작: {account.name} (ID: {account.id})")
            try:
                # 해당 계좌에 대응하는 토큰 발급
                token = await self.auth_manager.get_valid_token(account.name)
            except Exception as e:
                logger.error(f"계좌 {account.name} 인증 토큰 획득 실패 (동기화 생략): {e}")
                failed_accounts_list.append({
                    "account_name": account.name,
                    "error": str(e)
                })
                continue

            raw_transactions = []

            try:
                # ... 데이터 수집 및 DB 저장 로직 ...
                if days == 1:
                    # 당일 동기화 (체결요청 + 당일 배당금)
                    domestic_executions = await self._fetch_domestic_executions(token)
                    for exe in domestic_executions:
                        ext_id = exe.get("ord_no") or exe.get("cntr_no")
                        raw_transactions.append({
                            "date": datetime.date.today(),
                            "ticker": exe.get("stk_cd"),
                            "name": exe.get("stk_nm"),
                            "type": "BUY" if "매수" in exe.get("io_tp_nm", "") else "SELL",
                            "quantity": _safe_float(exe.get("cntr_qty")),
                            "price": _safe_float(exe.get("cntr_pric")),
                            "currency": "KRW",
                            "external_id": str(ext_id) if ext_id else None,
                            "memo": f"키움 자동저장 (체결)"
                        })

                    overseas_executions = await self._fetch_overseas_executions(token, target_date=today_str)
                    for exe in overseas_executions:
                        qty = _safe_float(exe.get("cntr_qty"))
                        if qty <= 0:
                            continue
                        slby_nm = exe.get("slby_tp_nm") or exe.get("io_tp_nm") or ""
                        slby_tp = str(exe.get("slby_tp", ""))
                        is_buy = "매수" in slby_nm or slby_tp == "2"
                        price_val = _safe_float(exe.get("cntr_uv") or exe.get("cntr_pric"))
                        ext_id = exe.get("ord_no") or exe.get("cntr_no")

                        raw_transactions.append({
                            "date": datetime.date.today(),
                            "ticker": exe.get("stk_cd"),
                            "name": exe.get("frgn_stk_nm") or exe.get("stk_nm"),
                            "type": "BUY" if is_buy else "SELL",
                            "quantity": qty,
                            "price": price_val,
                            "currency": "USD",
                            "external_id": str(ext_id) if ext_id else None,
                            "memo": f"키움 자동저장 (해외체결)"
                        })

                    daily_ledger = await self._fetch_comprehensive_ledger(token, today_str, today_str)
                    for tx in daily_ledger:
                        if "배당금" in tx.get("rmrk_nm", ""):
                            ext_id = tx.get("seq") or tx.get("trde_no")
                            raw_transactions.append({
                                "date": datetime.datetime.strptime(tx.get("trde_dt"), "%Y%m%d").date(),
                                "ticker": tx.get("stk_cd"),
                                "name": tx.get("stk_nm", "배당금 입금"),
                                "type": "INTEREST",
                                "quantity": _safe_float(tx.get("trde_qty_jwa_cnt")),
                                "price": _safe_float(tx.get("trde_amt")),
                                "currency": "KRW",
                                "external_id": str(ext_id) if ext_id else None,
                                "memo": f"키움 자동저장 (배당금)"
                            })
                else:
                    ledger_data = await self._fetch_comprehensive_ledger(token, start_date_str, today_str)
                    for tx in ledger_data:
                        rmrk = tx.get("rmrk_nm", "")
                        stk_cd = tx.get("stk_cd")
                        ext_id = tx.get("seq") or tx.get("trde_no")
                        
                        if "배당금" in rmrk:
                            raw_transactions.append({
                                "date": datetime.datetime.strptime(tx.get("trde_dt"), "%Y%m%d").date(),
                                "ticker": stk_cd,
                                "name": tx.get("stk_nm", "배당금 입금"),
                                "type": "INTEREST",
                                "quantity": _safe_float(tx.get("trde_qty_jwa_cnt")),
                                "price": _safe_float(tx.get("trde_amt")),
                                "currency": "KRW",
                                "external_id": str(ext_id) if ext_id else None,
                                "memo": f"키움 자동저장 (소급 배당금)"
                            })
                        elif any(m in rmrk for m in ["장내매수", "장내매도", "매매", "매수", "매도"]):
                            cntr_dt_str = tx.get("cntr_dt") or tx.get("trde_dt")
                            cntr_date = datetime.datetime.strptime(cntr_dt_str, "%Y%m%d").date()
                            
                            qty = _safe_float(tx.get("trde_qty_jwa_cnt"))
                            trde_amt = _safe_float(tx.get("trde_amt"))
                            price = trde_amt / qty if qty > 0 else 0
                            
                            raw_transactions.append({
                                "date": cntr_date,
                                "ticker": stk_cd,
                                "name": tx.get("stk_nm"),
                                "type": "BUY" if "매수" in rmrk else "SELL",
                                "quantity": qty,
                                "price": price,
                                "currency": "KRW",
                                "external_id": str(ext_id) if ext_id else None,
                                "memo": f"키움 자동저장 (소급 매매)"
                            })

                    for d in range(days):
                        dt_obj = datetime.date.today() - datetime.timedelta(days=d)
                        dt_str = dt_obj.strftime("%Y%m%d")
                        overseas_exes = await self._fetch_overseas_executions(token, target_date=dt_str)
                        for exe in overseas_exes:
                            qty = _safe_float(exe.get("cntr_qty"))
                            if qty <= 0:
                                continue
                            slby_nm = exe.get("slby_tp_nm") or exe.get("io_tp_nm") or ""
                            slby_tp = str(exe.get("slby_tp", ""))
                            is_buy = "매수" in slby_nm or slby_tp == "2"
                            price_val = _safe_float(exe.get("cntr_uv") or exe.get("cntr_pric"))
                            ext_id = exe.get("ord_no") or exe.get("cntr_no")

                            raw_transactions.append({
                                "date": dt_obj,
                                "ticker": exe.get("stk_cd"),
                                "name": exe.get("frgn_stk_nm") or exe.get("stk_nm"),
                                "type": "BUY" if is_buy else "SELL",
                                "quantity": qty,
                                "price": price_val,
                                "currency": "USD",
                                "external_id": str(ext_id) if ext_id else None,
                                "memo": f"키움 자동저장 (해외체결 소급)"
                            })

                # DB 적재 및 검증 처리
                success_count = 0
                for tx_data in raw_transactions:
                    ticker = normalize_ticker(tx_data["ticker"])
                    if not ticker:
                        continue

                    asset = db.query(Asset).filter(Asset.ticker == ticker).first()
                    if not asset:
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

                    if asset.country == "US":
                        tx_data["currency"] = "USD"
                    else:
                        tx_data["currency"] = "KRW"

                    total_amt = tx_data["quantity"] * tx_data["price"] if tx_data["type"] in ["BUY", "SELL"] else tx_data["price"]
                    ext_id = tx_data.get("external_id")

                    # 1) 동일 체결번호(external_id)가 이미 DB에 존재하는 경우 -> 100% 중복 스킵
                    if ext_id:
                        exists_by_ext_id = db.query(Transaction).filter(
                            Transaction.account_id == account.id,
                            Transaction.asset_id == asset.id,
                            Transaction.external_id == ext_id
                        ).first()
                        if exists_by_ext_id:
                            logger.info(f"이미 존재(체결번호 중복)하여 저장 스킵: {asset.name} ({ext_id})")
                            continue

                    # 2) 수동 입력 거래중 1:1 매칭 가능한 건(external_id가 NULL인 MANUAL 거래) 찾기
                    manual_tx = db.query(Transaction).filter(
                        Transaction.account_id == account.id,
                        Transaction.asset_id == asset.id,
                        Transaction.transaction_date == tx_data["date"],
                        Transaction.type == tx_data["type"],
                        Transaction.quantity == tx_data["quantity"],
                        Transaction.price == tx_data["price"],
                        Transaction.total_amount == total_amt,
                        Transaction.source == "MANUAL",
                        Transaction.external_id.is_(None)
                    ).first()

                    if manual_tx:
                        manual_tx.external_id = ext_id
                        manual_tx.source = "AUTO_KIWOOM"
                        success_count += 1
                        synced_list.append({
                            "type": tx_data["type"],
                            "asset_name": asset.name,
                            "quantity": tx_data["quantity"],
                            "price": tx_data["price"],
                            "total_amount": total_amt,
                            "currency": tx_data["currency"],
                            "is_manual_matched": True
                        })
                        logger.info(f"기존 수동 거래와 키움 체결 매칭 완료: {asset.name} ({ext_id})")
                        continue

                    # 3) external_id도 없고 수동 거래 매칭 대상도 없는 경우: 단순 중복 체크 (external_id 없는 레코드 중복 방지)
                    if not ext_id:
                        exists_legacy = db.query(Transaction).filter(
                            Transaction.account_id == account.id,
                            Transaction.asset_id == asset.id,
                            Transaction.transaction_date == tx_data["date"],
                            Transaction.type == tx_data["type"],
                            Transaction.quantity == tx_data["quantity"],
                            Transaction.price == tx_data["price"],
                            Transaction.total_amount == total_amt
                        ).first()
                        if exists_legacy:
                            logger.info(f"이미 존재하는 거래내역으로 저장 스킵: {asset.name} ({tx_data['date']})")
                            continue

                    # 4) 신규 거래 적재(Insert)
                    new_tx = Transaction(
                        account_id=account.id,
                        asset_id=asset.id,
                        transaction_date=tx_data["date"],
                        type=tx_data["type"],
                        quantity=tx_data["quantity"],
                        price=tx_data["price"],
                        total_amount=total_amt,
                        currency=tx_data["currency"],
                        memo=tx_data["memo"],
                        source="AUTO_KIWOOM",
                        external_id=ext_id
                    )
                    db.add(new_tx)
                    success_count += 1
                    synced_list.append({
                        "type": tx_data["type"],
                        "asset_name": asset.name,
                        "quantity": tx_data["quantity"],
                        "price": tx_data["price"],
                        "total_amount": total_amt,
                        "currency": tx_data["currency"],
                        "is_manual_matched": False
                    })

                if success_count > 0:
                    db.commit()
                    logger.info(f"계좌 {account.name} 동기화 성공: {success_count}건 저장 완료.")
                    total_success_count += success_count

            except Exception as e:
                db.rollback()
                logger.error(f"계좌 {account.name} 동기화 처리 중 예외 발생 (스킵): {str(e)}")
                failed_accounts_list.append({
                    "account_name": account.name,
                    "error": str(e)
                })
                continue

        return {
            "status": "success",
            "success_count": total_success_count,
            "pending_count": len(unregistered_list),
            "synced_transactions": synced_list,
            "unregistered_assets": unregistered_list,
            "failed_accounts": failed_accounts_list
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

    async def _fetch_overseas_executions(self, token: str, target_date: str = None) -> list:
        """미국 주식 체결 내역을 조회합니다 (ust21510).
        
        Args:
            token (str): Bearer 인증 토큰
            target_date (str, optional): 조회일자 (YYYYMMDD 형식). 생략 시 당일 체결 조회.
        """
        url = f"{self.base_url}/api/us/acnt"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ust21510",
            "authorization": f"Bearer {token}"
        }
        payload = {
            "qry_tp": "0",  # 전체
            "sell_tp": "0"  # 전체
        }
        if target_date:
            payload["ord_dt"] = target_date
        
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
