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

def _parse_traded_at(
    date_obj_or_str: datetime.date | datetime.datetime | str,
    time_str: str | None = None
) -> str:
    """날짜 객체/문자열과 체결 시각 문자열을 조합하여 YYYY-MM-DD HH:MM 또는 YYYY-MM-DD 포맷을 반환합니다.

    Args:
        date_obj_or_str (datetime.date | datetime.datetime | str): 거래일자 객체 또는 YYYYMMDD/YYYY-MM-DD 문자열
        time_str (str | None, optional): 체결시각 문자열 (예: "143015", "93000", "1430"). 기본값 None.

    Returns:
        str: 포맷팅된 거래일시 문자열 (예: "2026-08-03 14:30" 또는 "2026-08-03")
    """
    if isinstance(date_obj_or_str, (datetime.date, datetime.datetime)):
        formatted_date = date_obj_or_str.strftime("%Y-%m-%d")
    else:
        raw_date_str = str(date_obj_or_str).replace("-", "").strip()
        if len(raw_date_str) == 8:
            formatted_date = f"{raw_date_str[:4]}-{raw_date_str[4:6]}-{raw_date_str[6:8]}"
        else:
            formatted_date = str(date_obj_or_str)

    if time_str:
        raw_time_str = str(time_str).strip().replace(":", "")
        if raw_time_str:
            if len(raw_time_str) == 5:
                raw_time_str = raw_time_str.zfill(6)
            elif len(raw_time_str) == 3:
                raw_time_str = raw_time_str.zfill(4)
            if len(raw_time_str) >= 4:
                hour_str = raw_time_str[:2]
                minute_str = raw_time_str[2:4]
                if hour_str != "00" or minute_str != "00":
                    return f"{formatted_date} {hour_str}:{minute_str}"
    return formatted_date

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

        async with httpx.AsyncClient() as http_client:
            for account in accounts:
                if isinstance(self.auth_manager.accounts_config, dict) and self.auth_manager.accounts_config:
                    if account.name not in self.auth_manager.accounts_config:
                        logger.info(f"계좌 {account.name}은(는) settings.toml에 설정 정보가 없어 자동동기화 대상에서 제외(스킵)합니다.")
                        continue

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
                        domestic_executions = await self._fetch_domestic_executions(token, client=http_client)
                        for exe in domestic_executions:
                            ext_id = exe.get("ord_no") or exe.get("cntr_no")
                            tm_str = exe.get("cntr_tm") or exe.get("trde_tm") or exe.get("ord_tm")
                            raw_transactions.append({
                                "date": datetime.date.today(),
                                "traded_at": _parse_traded_at(datetime.date.today(), tm_str),
                                "ticker": exe.get("stk_cd"),
                                "name": exe.get("stk_nm"),
                                "type": "BUY" if "매수" in exe.get("io_tp_nm", "") else "SELL",
                                "quantity": _safe_float(exe.get("cntr_qty")),
                                "price": _safe_float(exe.get("cntr_pric")),
                                "currency": "KRW",
                                "external_id": str(ext_id) if ext_id else None,
                                "memo": f"키움 자동저장 (체결)"
                            })

                        overseas_executions = await self._fetch_overseas_executions(token, target_date=today_str, client=http_client)
                        for exe in overseas_executions:
                            qty = _safe_float(exe.get("cntr_qty"))
                            if qty <= 0:
                                continue
                            slby_nm = exe.get("slby_tp_nm") or exe.get("io_tp_nm") or ""
                            slby_tp = str(exe.get("slby_tp", ""))
                            is_buy = "매수" in slby_nm or slby_tp == "2"
                            price_val = _safe_float(exe.get("cntr_uv") or exe.get("cntr_pric"))
                            ext_id = exe.get("ord_no") or exe.get("cntr_no")
                            tm_str = exe.get("cntr_tm") or exe.get("trde_tm") or exe.get("ord_tm")

                            raw_transactions.append({
                                "date": datetime.date.today(),
                                "traded_at": _parse_traded_at(datetime.date.today(), tm_str),
                                "ticker": exe.get("stk_cd"),
                                "name": exe.get("frgn_stk_nm") or exe.get("stk_nm"),
                                "type": "BUY" if is_buy else "SELL",
                                "quantity": qty,
                                "price": price_val,
                                "currency": "USD",
                                "external_id": str(ext_id) if ext_id else None,
                                "memo": f"키움 자동저장 (해외체결)"
                            })

                        daily_ledger = await self._fetch_comprehensive_ledger(token, today_str, today_str, client=http_client)
                        raw_transactions.extend(self._parse_ledger_entries(daily_ledger, is_retroactive=False))
                    else:
                        ledger_data = await self._fetch_comprehensive_ledger(token, start_date_str, today_str, client=http_client)
                        raw_transactions.extend(self._parse_ledger_entries(ledger_data, is_retroactive=True))

                        for d in range(days):
                            dt_obj = datetime.date.today() - datetime.timedelta(days=d)
                            dt_str = dt_obj.strftime("%Y%m%d")
                            overseas_exes = await self._fetch_overseas_executions(token, target_date=dt_str, client=http_client)
                            for exe in overseas_exes:
                                qty = _safe_float(exe.get("cntr_qty"))
                                if qty <= 0:
                                    continue
                                slby_nm = exe.get("slby_tp_nm") or exe.get("io_tp_nm") or ""
                                slby_tp = str(exe.get("slby_tp", ""))
                                is_buy = "매수" in slby_nm or slby_tp == "2"
                                price_val = _safe_float(exe.get("cntr_uv") or exe.get("cntr_pric"))
                                ext_id = exe.get("ord_no") or exe.get("cntr_no")
                                tm_str = exe.get("cntr_tm") or exe.get("trde_tm") or exe.get("ord_tm")

                                raw_transactions.append({
                                    "date": dt_obj,
                                    "traded_at": _parse_traded_at(dt_obj, tm_str),
                                    "ticker": exe.get("stk_cd"),
                                    "name": exe.get("frgn_stk_nm") or exe.get("stk_nm"),
                                    "type": "BUY" if is_buy else "SELL",
                                    "quantity": qty,
                                    "price": price_val,
                                    "total_amount": qty * price_val,
                                    "currency": "USD",
                                    "external_id": str(ext_id) if ext_id else None,
                                    "memo": f"키움 자동저장 (해외체결 소급)"
                                })

                    # DB 적재 및 검증 처리
                    success_count = 0
                    for tx_data in raw_transactions:
                        if tx_data["type"] == "EXCHANGE":
                            if self._sync_exchange_transaction(db, account, tx_data, unregistered_list, synced_list):
                                success_count += 1
                            continue

                        ticker = normalize_ticker(tx_data.get("ticker"))
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
                                "total_amount": tx_data.get("total_amount", tx_data["price"]),
                                "currency": tx_data.get("currency", "USD" if asset and asset.country == "US" else "KRW"),
                                "traded_at": tx_data.get("traded_at")
                            })
                            logger.warning(f"미등록 자산 발견으로 저장 생략: {ticker} ({tx_data['name']})")
                            continue

                        if asset.country == "US" and tx_data["type"] not in ["TAX"]:
                            tx_data["currency"] = "USD"

                        total_amt = tx_data.get("total_amount")
                        if total_amt is None:
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
                        manual_candidates = db.query(Transaction).filter(
                            Transaction.account_id == account.id,
                            Transaction.asset_id == asset.id,
                            Transaction.transaction_date == tx_data["date"],
                            Transaction.type == tx_data["type"],
                            Transaction.source == "MANUAL",
                            Transaction.external_id.is_(None)
                        ).all()

                        manual_tx = next(
                            (
                                m for m in manual_candidates
                                if m.quantity == tx_data["quantity"]
                                and m.price == tx_data["price"]
                                and m.total_amount == total_amt
                            ),
                            None
                        )

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
                                "is_manual_matched": True,
                                "traded_at": tx_data.get("traded_at")
                            })
                            logger.info(f"기존 수동 거래와 키움 체결 매칭 완료: {asset.name} ({ext_id})")
                            continue

                        # 3) external_id도 없고 수동 거래 매칭 대상도 없는 경우: 단순 중복 체크
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
                            "is_manual_matched": False,
                            "traded_at": tx_data.get("traded_at")
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

    def _sync_exchange_transaction(
        self,
        db: Session,
        account: Account,
        tx_data: dict,
        unregistered_list: list,
        synced_list: list
    ) -> bool:
        """개별 환전(EXCHANGE) 트랜잭션의 유효성 검증, 중복 검사 및 DB 저장을 처리합니다.

        Args:
            db (Session): SQLAlchemy 세션
            account (Account): 동기화 대상 계좌
            tx_data (dict): 파싱된 환전 거래 딕셔너리
            unregistered_list (list): 미등록 자산 목록 누적 리스트
            synced_list (list): 동기화 성공 내역 누적 리스트

        Returns:
            bool: 신규 적재 또는 기존 수동 거래 매칭 성공 여부
        """
        source_ticker = normalize_ticker(tx_data.get("source_ticker"))
        target_ticker = normalize_ticker(tx_data.get("target_ticker"))
        source_asset = db.query(Asset).filter(Asset.ticker == source_ticker).first()
        target_asset = db.query(Asset).filter(Asset.ticker == target_ticker).first()

        if not source_asset or not target_asset:
            missing_name = source_ticker if not source_asset else target_ticker
            unregistered_list.append({
                "ticker": missing_name,
                "name": tx_data.get("name", "환전 예수금"),
                "type": "EXCHANGE",
                "quantity": tx_data["quantity"],
                "price": tx_data["price"],
                "total_amount": tx_data["total_amount"],
                "currency": tx_data["currency"],
                "traded_at": tx_data.get("traded_at")
            })
            logger.warning(f"환전 필수 현금 자산 미등록으로 저장 생략: {source_ticker} -> {target_ticker}")
            return False

        ext_id = tx_data.get("external_id")

        # 1) 동일 거래번호(external_id) 중복 체크
        if ext_id:
            exists_by_ext_id = db.query(Transaction).filter(
                Transaction.account_id == account.id,
                Transaction.type == "EXCHANGE",
                Transaction.external_id == ext_id
            ).first()
            if exists_by_ext_id:
                logger.info(f"이미 존재(환전 거래번호 중복)하여 저장 스킵: {ext_id}")
                return False

        # 2) 수동 입력 환전 거래 중 1:1 매칭 가능한 건 찾기
        manual_candidates = db.query(Transaction).filter(
            Transaction.account_id == account.id,
            Transaction.asset_id == source_asset.id,
            Transaction.target_asset_id == target_asset.id,
            Transaction.transaction_date == tx_data["date"],
            Transaction.type == "EXCHANGE",
            Transaction.source == "MANUAL",
            Transaction.external_id.is_(None)
        ).all()

        manual_tx = next(
            (
                m for m in manual_candidates
                if abs(m.total_amount - tx_data["total_amount"]) < 10.0
                or abs(m.quantity - tx_data["quantity"]) < 0.01
            ),
            None
        )

        if manual_tx:
            manual_tx.external_id = ext_id
            manual_tx.source = "AUTO_KIWOOM"
            synced_list.append({
                "type": "EXCHANGE",
                "asset_name": f"{source_asset.name} ➔ {target_asset.name}",
                "quantity": tx_data["quantity"],
                "price": tx_data["price"],
                "total_amount": tx_data["total_amount"],
                "currency": tx_data["currency"],
                "is_manual_matched": True,
                "traded_at": tx_data.get("traded_at")
            })
            logger.info(f"기존 수동 환전 거래와 키움 체결 매칭 완료: {ext_id}")
            return True

        # 3) external_id 없고 수동 매칭 대상도 없는 경우 단순 중복 체크
        if not ext_id:
            exists_legacy = db.query(Transaction).filter(
                Transaction.account_id == account.id,
                Transaction.asset_id == source_asset.id,
                Transaction.target_asset_id == target_asset.id,
                Transaction.transaction_date == tx_data["date"],
                Transaction.type == "EXCHANGE",
                Transaction.quantity == tx_data["quantity"],
                Transaction.total_amount == tx_data["total_amount"]
            ).first()
            if exists_legacy:
                logger.info(f"이미 존재하는 환전 거래로 저장 스킵: {tx_data['date']}")
                return False

        # 4) 신규 환전 거래 생성
        new_tx = Transaction(
            account_id=account.id,
            asset_id=source_asset.id,
            target_asset_id=target_asset.id,
            transaction_date=tx_data["date"],
            type="EXCHANGE",
            quantity=tx_data["quantity"],
            price=tx_data["price"],
            total_amount=tx_data["total_amount"],
            currency=tx_data["currency"],
            exchange_rate=tx_data.get("exchange_rate"),
            memo=tx_data["memo"],
            source="AUTO_KIWOOM",
            external_id=ext_id
        )
        db.add(new_tx)
        synced_list.append({
            "type": "EXCHANGE",
            "asset_name": f"{source_asset.name} ➔ {target_asset.name}",
            "quantity": tx_data["quantity"],
            "price": tx_data["price"],
            "total_amount": tx_data["total_amount"],
            "currency": tx_data["currency"],
            "is_manual_matched": False,
            "traded_at": tx_data.get("traded_at")
        })
        return True

    def _parse_ledger_entries(self, ledger_entries: list, is_retroactive: bool = False) -> list:
        """종합거래내역(kt00015) 응답 리스트에서 배당금, 배당세, 소급매매 및 환전(정산 합산) 거래를 파싱합니다.

        Args:
            ledger_entries (list): kt00015 API 응답 trst_ovrl_trde_prps_array 리스트
            is_retroactive (bool): 소급 조회 여부 (소급일 때만 장내매수/매도 파싱)

        Returns:
            list: 정제된 raw_transaction 딕셔너리 리스트
        """
        raw_txs = []
        # 1. 일자별 환전정산 차액 맵 구축: {일자: 원화_차액} (입금은 차감 음수, 출금은 가산 양수)
        settlements = {}
        for tx in ledger_entries:
            rmrk = tx.get("rmrk_nm", "")
            if any(k in rmrk for k in ["환전정산", "정산입금", "정산출금"]):
                dt_str = tx.get("trde_dt")
                if not dt_str:
                    continue
                trde_dt = datetime.datetime.strptime(dt_str, "%Y%m%d").date()
                amt = _safe_float(tx.get("trde_amt") or tx.get("exct_amt"))
                io_tp_nm = tx.get("io_tp_nm", "")
                is_deposit = "입금" in io_tp_nm or "입금" in rmrk
                diff = -amt if is_deposit else amt
                settlements[trde_dt] = settlements.get(trde_dt, 0.0) + diff

        # 2. 거래 항목별 파싱
        for tx in ledger_entries:
            rmrk = tx.get("rmrk_nm", "")
            trde_kind = tx.get("trde_kind_nm", "")
            io_tp_nm = tx.get("io_tp_nm", "")
            ext_id = tx.get("seq") or tx.get("trde_no")
            dt_str = tx.get("trde_dt")
            if not dt_str:
                continue
            trde_dt = datetime.datetime.strptime(dt_str, "%Y%m%d").date()
            tm_str = tx.get("trde_tm") or tx.get("cntr_tm")
            stk_cd = tx.get("stk_cd")

            # A. 배당금 (환전/정산 키워드 제외)
            if "배당금" in rmrk and not any(k in rmrk for k in ["환전", "정산"]):
                fc_amt = _safe_float(tx.get("fc_exct_amt") or tx.get("fc_trde_amt"))
                div_amt = fc_amt if fc_amt > 0 else _safe_float(tx.get("trde_amt"))
                memo_str = "키움 자동저장 (소급 배당금)" if is_retroactive else "키움 자동저장 (배당금)"
                raw_txs.append({
                    "date": trde_dt,
                    "traded_at": _parse_traded_at(trde_dt, tm_str),
                    "ticker": stk_cd,
                    "name": tx.get("stk_nm", "배당금 입금"),
                    "type": "INTEREST",
                    "quantity": 0.0,
                    "price": 0.0,
                    "total_amount": div_amt,
                    "currency": tx.get("crnc_cd") or "KRW",
                    "external_id": str(ext_id) if ext_id else None,
                    "memo": memo_str
                })

            # B. 배당세
            elif any(t_word in rmrk for t_word in ["배당세", "해외배당세출금", "원천징수"]):
                tax_amt = _safe_float(tx.get("trde_amt") or tx.get("fc_trde_amt") or tx.get("fc_exct_amt"))
                raw_txs.append({
                    "date": trde_dt,
                    "traded_at": _parse_traded_at(trde_dt, tm_str),
                    "ticker": stk_cd,
                    "name": tx.get("stk_nm", "해외배당세"),
                    "type": "TAX",
                    "quantity": 0.0,
                    "price": 0.0,
                    "total_amount": tax_amt,
                    "currency": tx.get("crnc_cd") or "KRW",
                    "external_id": str(ext_id) if ext_id else None,
                    "memo": "키움 자동저장 (해외배당세)"
                })

            # C. 환전 거래 (정산 거래 및 배당 제외)
            elif (
                trde_kind == "환전" or any(w in rmrk for w in ["외화매수", "외화매도", "환전", "원화주문"])
            ) and not any(w in rmrk for w in ["환전정산", "정산입금", "정산출금", "배당"]):
                raw_krw_amt = _safe_float(tx.get("trde_amt") or tx.get("exct_amt"))
                fc_amt = _safe_float(tx.get("fc_trde_amt") or tx.get("fc_exct_amt"))
                unit_rate_str = str(tx.get("trde_unit", "0")).replace(",", "").strip()
                unit_rate = _safe_float(unit_rate_str)

                # 해당 일자의 정산 차액 1회 소비 (동일 일자 복수 환전 시 중복 가산 방지)
                settlement_diff = settlements.pop(trde_dt, 0.0)
                final_krw_amt = raw_krw_amt + settlement_diff
                final_rate = (final_krw_amt / fc_amt) if fc_amt > 0 else unit_rate

                is_sell_foreign = "외화매도" in rmrk or "외화매도" in io_tp_nm

                if not is_sell_foreign:
                    # 원화 -> 외화 (외화 매수 환전)
                    source_ticker, target_ticker = "KRW", "USD"
                    tot_amt, qty = final_krw_amt, fc_amt
                    curr = "KRW"
                    name_str = "외화매수환전 (KRW ➔ USD)"
                else:
                    # 외화 -> 원화 (외화 매도 환전)
                    source_ticker, target_ticker = "USD", "KRW"
                    tot_amt, qty = fc_amt, final_krw_amt
                    curr = "USD"
                    name_str = "외화매도환전 (USD ➔ KRW)"

                raw_txs.append({
                    "date": trde_dt,
                    "traded_at": _parse_traded_at(trde_dt, tm_str),
                    "type": "EXCHANGE",
                    "source_ticker": source_ticker,
                    "target_ticker": target_ticker,
                    "name": name_str,
                    "quantity": qty,
                    "price": final_rate,
                    "total_amount": tot_amt,
                    "currency": curr,
                    "exchange_rate": final_rate,
                    "external_id": str(ext_id) if ext_id else None,
                    "memo": "키움 자동저장 (환전)"
                })

            # D. 소급 주식 매매
            elif is_retroactive and any(m in rmrk for m in ["장내매수", "장내매도", "매매", "매수", "매도"]):
                cntr_dt_str = tx.get("cntr_dt") or tx.get("trde_dt")
                cntr_date = datetime.datetime.strptime(cntr_dt_str, "%Y%m%d").date()
                qty = _safe_float(tx.get("trde_qty_jwa_cnt"))
                trde_amt = _safe_float(tx.get("trde_amt"))
                price = trde_amt / qty if qty > 0 else 0

                raw_txs.append({
                    "date": cntr_date,
                    "traded_at": _parse_traded_at(cntr_date, tm_str),
                    "ticker": stk_cd,
                    "name": tx.get("stk_nm"),
                    "type": "BUY" if "매수" in rmrk else "SELL",
                    "quantity": qty,
                    "price": price,
                    "total_amount": trde_amt,
                    "currency": "KRW",
                    "external_id": str(ext_id) if ext_id else None,
                    "memo": "키움 자동저장 (소급 매매)"
                })

        return raw_txs

    async def _post_api(
        self,
        url: str,
        headers: dict,
        payload: dict,
        client: httpx.AsyncClient | None = None
    ) -> dict:
        """키움 API POST 요청을 수행하고 JSON 결과를 반환하는 공통 헬퍼 메서드입니다.

        Args:
            url (str): API 엔드포인트 URL
            headers (dict): 요청 헤더
            payload (dict): 요청 바디 (JSON)
            client (httpx.AsyncClient | None, optional): 재사용할 HTTP 클라이언트. 기본값 None.

        Returns:
            dict: 파싱된 JSON 응답 딕셔너리
        """
        if client is not None:
            response = await client.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            return response.json()

        async with httpx.AsyncClient() as new_client:
            response = await new_client.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            return response.json()

    async def _fetch_domestic_executions(self, token: str, client: httpx.AsyncClient | None = None) -> list:
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
        data = await self._post_api(url, headers=headers, payload=payload, client=client)
        if data.get("return_code") in [0, "0"]:
            return data.get("cntr", [])
        return []

    async def _fetch_overseas_executions(
        self,
        token: str,
        target_date: str | None = None,
        client: httpx.AsyncClient | None = None
    ) -> list:
        """미국 주식 체결 내역을 조회합니다 (ust21510).
        
        Args:
            token (str): Bearer 인증 토큰
            target_date (str | None, optional): 조회일자 (YYYYMMDD 형식). 생략 시 당일 체결 조회.
            client (httpx.AsyncClient | None, optional): 재사용할 HTTP 비동기 클라이언트
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

        data = await self._post_api(url, headers=headers, payload=payload, client=client)
        if data.get("return_code") in [0, "0"]:
            return data.get("result_list", [])
        return []

    async def _fetch_comprehensive_ledger(
        self,
        token: str,
        start_dt: str,
        end_dt: str,
        client: httpx.AsyncClient | None = None
    ) -> list:
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

        data = await self._post_api(url, headers=headers, payload=payload, client=client)
        if data.get("return_code") in [0, "0"]:
            return data.get("trst_ovrl_trde_prps_array", [])
        return []
