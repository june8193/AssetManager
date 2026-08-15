import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from src.backend.models import Transaction, Asset, ExchangeRate, HistoricalPrice
from src.backend.services.price_service import price_service
from src.backend.services.ledger_engine import LedgerEngine

async def get_portfolio_status(db: Session, date_str: Optional[str] = None) -> Dict[str, Any]:
    """지정된 과거/현재 일자의 자산 보유 현황(예수금 및 보유 주식 목록)을 정확하게 조회합니다.

    Args:
        db (Session): 데이터베이스 세션
        date_str (Optional[str]): 조회 기준일 (Format: YYYY-MM-DD). 생략 시 오늘 날짜.

    Returns:
        Dict[str, Any]: 포트폴리오 요약 및 보유 내역 데이터
    """
    # 1. 기준일 결정
    if date_str:
        target_date = datetime.date.fromisoformat(date_str)
    else:
        target_date = datetime.date.today()

    # 2. LedgerEngine을 통해 특정 시점의 보유 주식 수량 및 예수금 잔액 일괄 조회
    state = LedgerEngine.get_positions(db, as_of=target_date)
    active_holdings = state.holdings
    cash_balances = state.cash_balances

    assets = db.query(Asset).all()

    # 3. 기준일 기준의 최근 환율 조회 (1차 폴백: 기준일 이하의 가장 최근 환율)
    rate_record = (
        db.query(ExchangeRate)
        .filter(ExchangeRate.date <= target_date)
        .order_by(ExchangeRate.date.desc(), ExchangeRate.id.desc())
        .first()
    )
    # 환율 데이터가 전혀 없을 경우 기본값으로 1350.0 설정
    exchange_rate = rate_record.rate if rate_record else 1350.0

    # 5. 각 보유 주식의 가격(종가/현재가) 계산
    today = datetime.date.today()
    holdings_list = []
    
    for ticker, qty in active_holdings.items():
        # 종목 마스터 정보 가져오기
        asset = next((a for a in assets if a.ticker == ticker), None)
        if not asset:
            continue

        price = 0.0
        
        # 5-1. 장중 오늘 가격 실시간 조회 (오늘이면서 장중인 경우 캐시하지 않음)
        is_today = (target_date == today)
        is_market_open = False
        if asset.country == "KR":
            is_market_open = price_service.is_kr_market_open()
        elif asset.country == "US":
            is_market_open = price_service.is_us_market_open()

        if is_today and is_market_open:
            try:
                if asset.country == "KR":
                    res = await price_service.get_kr_prices([ticker], force_update=True)
                    if res and res[0]["current_price"] > 0:
                        price = res[0]["current_price"]
                else:
                    res = await price_service.get_us_prices([ticker], force_update=True)
                    if res and res[0]["current_price"] > 0:
                        price = res[0]["current_price"]
            except Exception as e:
                print(f"[WARNING] 장중 실시간 가격 조회 실패: {e}")

        # 5-2. 장외/과거 날짜인 경우 또는 실시간 조회 실패 시
        if price == 0.0:
            # A. DB에서 당일 가격 확인
            db_price = (
                db.query(HistoricalPrice)
                .filter(HistoricalPrice.ticker == ticker, HistoricalPrice.price_date == target_date)
                .first()
            )
            if db_price:
                price = db_price.close_price
            else:
                # B. 외부 API를 통해 당일 가격 동적 조회 시도 (단, 평일인 경우에만 오류 방지를 위해 조회 권장)
                clean_dt = target_date.strftime("%Y%m%d")
                fetched_price = 0.0
                try:
                    if asset.country == "KR":
                        fetched_price = await price_service.get_kr_historical_price(ticker, clean_dt)
                    else:
                        fetched_price = await price_service.get_us_historical_price(ticker, clean_dt)
                except Exception as e:
                    print(f"[WARNING] 외부 API 과거 가격 조회 실패: {e}")

                if fetched_price > 0.0:
                    # 당일 조회에 성공했으므로 DB 캐시에 저장
                    price = fetched_price
                    stmt = sqlite_insert(HistoricalPrice).values(
                        ticker=ticker,
                        price_date=target_date,
                        close_price=price
                    )
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["ticker", "price_date"],
                        set_={"close_price": price}
                    )
                    db.execute(stmt)
                    db.commit()
                else:
                    # C. 당일 조회가 실패했다면 (실제 휴장일인 경우), 직전 거래일의 최근 종가를 가져와 사용
                    fallback_record = (
                        db.query(HistoricalPrice)
                        .filter(HistoricalPrice.ticker == ticker, HistoricalPrice.price_date < target_date)
                        .order_by(HistoricalPrice.price_date.desc())
                        .first()
                    )
                    price = fallback_record.close_price if fallback_record else 0.0

        # 평가액 계산
        valuation = qty * price
        valuation_krw = valuation
        if asset.country == "US":
            valuation_krw = valuation * exchange_rate

        holdings_list.append({
            "ticker": ticker,
            "name": asset.name,
            "major_category": asset.major_category,
            "sub_category": asset.sub_category,
            "country": asset.country,
            "quantity": qty,
            "current_price": price,
            "valuation": valuation,
            "valuation_krw": valuation_krw
        })

    # 6. 총 자산 평가액 계산 (예수금 원화 환산 + 주식 원화 평가액 합산)
    total_valuation_krw = (
        cash_balances["KRW"]
        + (cash_balances["USD"] * exchange_rate)
        + sum(h["valuation_krw"] for h in holdings_list)
    )

    return {
        "total_valuation_krw": total_valuation_krw,
        "cash_balances": cash_balances,
        "exchange_rate": exchange_rate,
        "holdings": holdings_list
    }
