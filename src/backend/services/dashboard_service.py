from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Account, Asset, Transaction, ExchangeRate, AccountSnapshot, HistoricalPrice
import yfinance as yf
from typing import Dict, List, Any
import datetime
import asyncio
import pytz
import time
from fastapi.concurrency import run_in_threadpool
from ...kiwoom.api import KiwoomAPI
from ...kiwoom.auth import KiwoomAuthManager

class DashboardService:
    """자산 현황 및 대시보드 데이터를 계산하는 서비스 클래스입니다."""

    def __init__(self, db: Session):
        self.db = db
        self.kiwoom_api = KiwoomAPI()
        self.kiwoom_auth = KiwoomAuthManager()

    def is_us_market_open(self) -> bool:
        """현재 뉴욕 현지 시각을 기준으로 미국 주식 시장이 개장 중인지 판별합니다.

        뉴욕 동부 표준시(US/Eastern)를 기준으로 평일(월~금) 09:30 ~ 16:00 사이인 경우 장중으로 봅니다.
        """
        eastern_tz = pytz.timezone('US/Eastern')
        now_est = datetime.datetime.now(eastern_tz)
        if now_est.weekday() >= 5:
            return False
        market_open = now_est.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now_est.replace(hour=16, minute=0, second=0, microsecond=0)
        return market_open <= now_est <= market_close

    def is_kr_market_open(self) -> bool:
        """현재 한국 시각을 기준으로 한국 주식 시장이 개장 중인지 판별합니다.

        한국 표준시(Asia/Seoul)를 기준으로 평일(월~금) 09:00 ~ 15:30 사이인 경우 장중으로 봅니다.
        """
        seoul_tz = pytz.timezone('Asia/Seoul')
        now_kst = datetime.datetime.now(seoul_tz)
        if now_kst.weekday() >= 5:
            return False
        market_open = now_kst.replace(hour=9, minute=0, second=0, microsecond=0)
        market_close = now_kst.replace(hour=15, minute=30, second=0, microsecond=0)
        return market_open <= now_kst <= market_close

    def get_yearly_stats(self) -> List[Dict[str, Any]]:
        """연도별 자산 현황 통계를 계산하여 최신순으로 반환합니다.
        
        역사적 통계 데이터이므로 현재 계좌의 활성 여부와 관계없이 모든 데이터를 포함합니다.
        결과는 최신 연도가 가장 앞에 오도록(내림차순) 정렬되어 반환됩니다.
        순 추가액(Contribution)은 해당 연도의 모든 스냅샷에 기록된 period_deposit의 합계로 계산합니다.
        """
        # 1. 모든 스냅샷 가져오기 및 연도별 합계 계산
        snapshots = (
            self.db.query(AccountSnapshot)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )
        
        if not snapshots:
            return []

        # 연도별 날짜별 평가액 및 추가액 합산
        yearly_date_valuations = {} # year -> snapshot_date -> total_valuation
        yearly_date_deposits = {} # year -> snapshot_date -> total_period_deposit
        
        for s in snapshots:
            y = s.snapshot_date.year
            d = s.snapshot_date
            
            if y not in yearly_date_valuations:
                yearly_date_valuations[y] = {}
                yearly_date_deposits[y] = {}
            if d not in yearly_date_valuations[y]:
                yearly_date_valuations[y][d] = 0.0
                yearly_date_deposits[y][d] = 0.0
            
            yearly_date_valuations[y][d] += s.total_valuation
            yearly_date_deposits[y][d] += s.period_deposit

        # 연도별 기말 자산 및 연간 총 추가액 결정
        yearly_assets = {} # year -> total_valuation
        yearly_contributions = {} # year -> total_period_deposit
        for y, date_vals in yearly_date_valuations.items():
            if date_vals:
                latest_date = max(date_vals.keys())
                yearly_assets[y] = date_vals[latest_date]
                yearly_contributions[y] = sum(yearly_date_deposits[y].values())

        # 2. 종합 통계 계산
        years = sorted(list(yearly_assets.keys()))
        results = []
        
        prev_year_end_assets = 0.0
        
        for i, y in enumerate(years):
            assets = yearly_assets[y]
            contribution = yearly_contributions.get(y, 0.0)
            
            # 기초 자산(prev_assets) 결정
            if i == 0:
                # 최초 기록 연도인 경우
                sorted_dates = sorted(yearly_date_valuations[y].keys())
                if len(sorted_dates) > 1:
                    # 기록이 여러 날짜에 걸쳐 있으면, 첫 날의 (평가액 - 입금액)을 기초 자산으로 간주
                    # 이는 기록 시작 시점 이전에 이미 보유하고 있던 자산을 의미함
                    first_date = sorted_dates[0]
                    prev_assets = yearly_date_valuations[y][first_date] - yearly_date_deposits[y][first_date]
                else:
                    # 기록이 해당 연도에 하루뿐이면, 0원에서 시작하여 해당 금액을 모두 성과/입금으로 간주
                    prev_assets = 0.0
            else:
                # 이후 연도는 전년도 기말 자산을 기초 자산으로 사용
                prev_assets = prev_year_end_assets
            
            increase = assets - prev_assets
            profit = increase - contribution
            
            # ROI = 수익 / (기초 자산 + 추가액)
            base = prev_assets + contribution
            roi = (profit / base * 100) if base != 0 else 0.0
            
            results.append({
                "year": y,
                "contribution": contribution,
                "profit": profit,
                "roi": round(roi, 2),
                "assets": assets,
                "increase": increase
            })
            
            prev_year_end_assets = assets
            
        results.reverse()
        return results

    def get_daily_stats(self, start_date: datetime.date | None = None, end_date: datetime.date | None = None, all_data: bool = False) -> List[Dict[str, Any]]:
        """일자별 자산 현황 통계를 계산하여 최신순으로 반환합니다.
        
        역사적 통계 데이터이므로 현재 계좌의 활성 여부와 관계없이 모든 데이터를 포함합니다.
        결과는 최신 일자가 가장 앞에 오도록(내림차순) 정렬되어 반환됩니다.
        """
        query = self.db.query(AccountSnapshot)
        
        if not all_data:
            if not end_date:
                end_date = datetime.date.today()
            if not start_date:
                start_date = end_date - datetime.timedelta(days=30)
            
            query = query.filter(
                AccountSnapshot.snapshot_date >= start_date,
                AccountSnapshot.snapshot_date <= end_date
            )
            
        snapshots = query.order_by(AccountSnapshot.snapshot_date.asc()).all()
        
        if not snapshots:
            return []

        # 날짜별 평가액 및 추가액 합산
        date_valuations = {} # snapshot_date -> total_valuation
        date_deposits = {} # snapshot_date -> total_period_deposit
        
        for s in snapshots:
            d = s.snapshot_date
            if d not in date_valuations:
                date_valuations[d] = 0.0
                date_deposits[d] = 0.0
            
            date_valuations[d] += s.total_valuation
            date_deposits[d] += s.period_deposit

        sorted_dates = sorted(list(date_valuations.keys()))
        results = []
        
        prev_assets = 0.0
        sorted_dates_assets = 0.0
        
        for i, d in enumerate(sorted_dates):
            assets = date_valuations[d]
            contribution = date_deposits.get(d, 0.0)
            
            # 기초 자산(prev_assets) 결정
            if i == 0:
                # 최초 기록 일자인 경우
                prev_assets = assets - contribution
            else:
                # 이후 일자는 직전 스냅샷 일자의 자산 평가액을 기초 자산으로 사용
                prev_assets = sorted_dates_assets
                
            increase = assets - prev_assets
            profit = increase - contribution
            
            # ROI = 수익 / (기초 자산 + 추가액)
            base = prev_assets + contribution
            roi = (profit / base * 100) if base != 0 else 0.0
            
            results.append({
                "date": d,
                "contribution": contribution,
                "profit": profit,
                "roi": round(roi, 2),
                "assets": assets,
                "increase": increase
            })
            
            sorted_dates_assets = assets
            
        results.reverse()
        return results

    def get_holdings(self) -> List[Dict[str, Any]]:
        """모든 활성 계좌의 자산별 보유량을 계산합니다.
        
        대시보드의 '계좌별 현황' 등 현재 보유 자산을 보여주는 기능에서 사용되며,
        사용자 요청에 따라 비활성(is_active=False) 계좌는 제외됩니다.
        """
        # 활성 계좌의 트랜잭션만 가져와서 (계좌, 자산) 별로 합산
        transactions = (
            self.db.query(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .filter(Account.is_active == True)
            .all()
        )
        # 현금 자산 ID 매핑 구축 (KRW, USD)
        cash_assets = self.db.query(Asset).filter(Asset.ticker.in_(['KRW', 'USD'])).all()
        ticker_to_asset_id = {asset.ticker: asset.id for asset in cash_assets}
        
        holdings = {} # (account_id, asset_id) -> quantity

        for tx in transactions:
            # (1) 원래 자산의 수량 증감 처리
            key = (tx.account_id, tx.asset_id)
            if key not in holdings:
                holdings[key] = 0.0
            
            if tx.type == 'EXCHANGE':
                holdings[key] -= tx.total_amount
                if tx.target_asset_id:
                    target_key = (tx.account_id, tx.target_asset_id)
                    if target_key not in holdings:
                        holdings[target_key] = 0.0
                    holdings[target_key] += tx.quantity
            elif tx.type in ['BUY', 'DEPOSIT', 'INITIAL_BALANCE', 'INTEREST', 'CASH_ADJUSTMENT']:
                holdings[key] += tx.quantity
            elif tx.type in ['SELL', 'WITHDRAW', 'TAX']:
                holdings[key] -= tx.quantity

            # (2) 현금 자산에 대한 상대적 증감 동적 반영
            if tx.type != 'EXCHANGE':
                cash_asset_id = ticker_to_asset_id.get(tx.currency)
                if cash_asset_id and tx.asset_id != cash_asset_id:
                    cash_key = (tx.account_id, cash_asset_id)
                    if cash_key not in holdings:
                        holdings[cash_key] = 0.0
                    
                    if tx.type in ['BUY', 'TAX']:
                        holdings[cash_key] -= tx.total_amount
                    elif tx.type in ['SELL', 'INTEREST']:
                        holdings[cash_key] += tx.total_amount
        
        # 결과 정리
        results = []
        for (acc_id, asset_id), qty in holdings.items():
            if qty == 0:
                continue
            
            # 이미 활성 계좌만 필터링했으므로 Account 조회 시 is_active 필터는 유지하되 
            # 트랜잭션에서 이미 필터링되었으므로 성능이 향상됨
            account = self.db.query(Account).filter(Account.id == acc_id).first()
            asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
            
            if not account or not asset:
                continue
                
            results.append({
                "account": account,
                "asset": asset,
                "quantity": qty
            })
            
        return results

    def get_latest_exchange_rate(self) -> Dict[str, Any]:
        """최신 환율 정보를 가져옵니다."""
        rate_obj = self.db.query(ExchangeRate).order_by(ExchangeRate.date.desc(), ExchangeRate.created_at.desc()).first()
        if rate_obj:
            return {
                "rate": rate_obj.rate,
                "date": rate_obj.date,
                "created_at": rate_obj.created_at,
                "currency": rate_obj.currency
            }
        return {
            "rate": 1350.0, # 기본값
            "date": datetime.date.today(),
            "created_at": datetime.datetime.now(),
            "currency": "USD"
        }

    async def get_current_prices(self, tickers: List[str], force_update: bool = False) -> Dict[str, float]:
        """주어진 티커 리스트의 현재가를 조회합니다."""
        t_start = time.time()
        if not tickers:
            return {}
            
        prices = {}
        # KRW, USD 자산은 가격이 1임
        for t in tickers:
            if t in ['KRW', 'USD']:
                prices[t] = 1.0
        
        # 조회가 필요한 티커 필터링
        query_tickers = [t for t in tickers if t not in ['KRW', 'USD']]
        if not query_tickers:
            return prices

        # 1. 국내 주식(KR)과 해외 주식 분류
        kr_tickers = []
        other_tickers = []
        
        for t in query_tickers:
            asset = self.db.query(Asset).filter(Asset.ticker == t).first()
            if asset and asset.country == 'KR':
                kr_tickers.append(t)
            else:
                other_tickers.append(t)
        
        t_classify = time.time()
                
        # 2. 국내 주식 가격 조회 (키움 API Bulk 요청)
        if kr_tickers:
            kr_market_open = self.is_kr_market_open()
            kr_tickers_to_fetch = []

            for t in kr_tickers:
                db_price = (
                    self.db.query(HistoricalPrice)
                    .filter(
                        HistoricalPrice.ticker == t,
                        HistoricalPrice.close_price > 0.0,
                        HistoricalPrice.price_date <= datetime.date.today()
                    )
                    .order_by(HistoricalPrice.price_date.desc())
                    .first()
                )

                if not force_update and not kr_market_open and db_price:
                    prices[t] = db_price.close_price
                else:
                    kr_tickers_to_fetch.append(t)

            if kr_tickers_to_fetch:
                try:
                    token = await self.kiwoom_auth.get_valid_token()
                    batch_size = 50 
                    for i in range(0, len(kr_tickers_to_fetch), batch_size):
                        batch = kr_tickers_to_fetch[i:i + batch_size]
                        res = self.kiwoom_api.get_bulk_stock_info(token, batch)
                        
                        if res and res.get("return_code") == 0:
                            outputs = res.get("atn_stk_infr", [])
                            for out in outputs:
                                t = out.get("stk_cd")
                                price_val = out.get("cur_prc", "0")
                                if isinstance(price_val, str):
                                    price_val = price_val.strip("+-")
                                price_float = float(price_val)
                                prices[t] = price_float

                                # 장외 시간(장마감 이후 최종 종가)인 경우에만 DB 캐시에 저장
                                if not kr_market_open and price_float > 0.0:
                                    today = datetime.date.today()
                                    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                                    stmt = sqlite_insert(HistoricalPrice).values(
                                        ticker=t,
                                        price_date=today,
                                        close_price=price_float
                                    )
                                    stmt = stmt.on_conflict_do_update(
                                        index_elements=['ticker', 'price_date'],
                                        set_={'close_price': price_float}
                                    )
                                    self.db.execute(stmt)
                            
                            if not kr_market_open:
                                self.db.commit()
                        else:
                            print(f"[WARNING] 키움 API Bulk 조회 실패 (batch {i}): {res.get('return_msg') if res else '응답 없음'}")

                except Exception as e:
                    print(f"[WARNING] 국내 주식 주가 조회 중 오류 발생: {e}")

        t_fetch_us_start = time.time()
        # 3. 해외 주식 가격 조회 (yfinance)
        if other_tickers:
            market_open = self.is_us_market_open()
            tickers_to_fetch = []

            for t in other_tickers:
                # DB 캐시에서 가장 최신의 가격 정보 조회
                db_price = (
                    self.db.query(HistoricalPrice)
                    .filter(
                        HistoricalPrice.ticker == t,
                        HistoricalPrice.close_price > 0.0,
                        HistoricalPrice.price_date <= datetime.date.today()
                    )
                    .order_by(HistoricalPrice.price_date.desc())
                    .first()
                )

                # 장외 시간(market_open == False)이고 강제 업데이트가 아니며 DB 캐시가 존재하면 즉시 재사용
                if not force_update and not market_open and db_price:
                    prices[t] = db_price.close_price
                else:
                    tickers_to_fetch.append(t)

            if tickers_to_fetch:
                formatted_other = []
                ticker_map = {} # formatted -> original
                
                for t in tickers_to_fetch:
                    if t.isdigit() and len(t) == 6:
                        ft = f"{t}.KS"
                        formatted_other.append(ft)
                        ticker_map[ft] = t
                    else:
                        formatted_other.append(t)
                        ticker_map[t] = t

                try:
                    # yfinance download는 블로킹이므로 threadpool에서 실행
                    data = await run_in_threadpool(
                        yf.download,
                        formatted_other,
                        period="1d",
                        interval="1m",
                        progress=False
                    )
                    
                    if not data.empty:
                        for ft in formatted_other:
                            orig_t = ticker_map[ft]
                            try:
                                import pandas as pd
                                close_data = data['Close']
                                if isinstance(close_data, pd.DataFrame):
                                    if ft in close_data.columns:
                                        series = close_data[ft]
                                    else:
                                        series = close_data.iloc[:, 0]
                                else:
                                    series = close_data
                                
                                last_price = float(series.dropna().iloc[-1])
                                
                                prices[orig_t] = last_price
                                
                                # 장외 시간(장마감 이후 최종 종가)인 경우에만 DB 캐시에 저장
                                if not market_open:
                                    today = datetime.date.today()
                                    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                                    stmt = sqlite_insert(HistoricalPrice).values(
                                        ticker=orig_t,
                                        price_date=today,
                                        close_price=last_price
                                    )
                                    stmt = stmt.on_conflict_do_update(
                                        index_elements=['ticker', 'price_date'],
                                        set_={'close_price': last_price}
                                    )
                                    self.db.execute(stmt)
                            except Exception:
                                if orig_t not in prices:
                                    prices[orig_t] = 0.0
                        
                        if not market_open:
                            self.db.commit()
                except Exception as e:
                    print(f"yfinance 가격 조회 및 캐싱 중 오류 발생: {e}")
                    for t in tickers_to_fetch:
                        if t not in prices:
                            prices[t] = 0.0
        
        t_end = time.time()
        print(f"[TIMER] [get_current_prices] classification: {t_classify-t_start:.4f}s, domestic(kiwoom): {t_fetch_us_start-t_classify:.4f}s, foreign(yfinance): {t_end-t_fetch_us_start:.4f}s")
        
        # 모든 쿼리 티커에 대해 가격 보장 (조회 실패 시 0.0)
        for t in query_tickers:
            if t not in prices:
                prices[t] = 0.0
                    
        return prices


    async def get_dashboard_summary(self, force_update: bool = False) -> Dict[str, Any]:
        """대시보드 요약 데이터를 생성합니다.

        모든 활성 계좌의 보유 자산을 합산하고, 실시간 가격 및 환율을 적용하여
        계좌별, 카테고리별 자산 현황을 계산합니다.

        Returns:
            Dict[str, Any]: 대시보드 데이터 딕셔너리
                - accounts (List[Dict]): 계좌별 요약 리스트 (평가액 내림차순)
                    - id, name, provider, alias, total_valuation_krw
                    - assets (List[Dict]): 해당 계좌의 보유 자산 목록
                        - name, ticker, quantity, price, valuation_krw, country, category, sub_category
                - categories (List[Dict]): 카테고리별 합계 리스트
                    - category, value_krw
                - total_valuation_krw (float): 총 평가액
                - exchange_rate (Dict): 적용 환율 정보
        """
        holdings = self.get_holdings()
        exchange_info = self.get_latest_exchange_rate()
        usd_rate = exchange_info['rate']
        
        # 보유 자산들의 유니크 티커 목록
        tickers = list(set([h['asset'].ticker for h in holdings]))
        prices = await self.get_current_prices(tickers, force_update=force_update)
        
        account_summaries = {} # account_id -> {account_info, total_valuation_krw}
        category_summaries = {} # major_category -> {"value_krw": float, "sub_categories": {sub_category: float}}
        total_valuation_krw = 0.0
        
        for h in holdings:
            acc = h['account']
            asset = h['asset']
            qty = h['quantity']
            price = prices.get(asset.ticker, 0.0)
            
            # 평가액 계산 (해당 자산의 통화 기준)
            valuation = qty * price
            
            # 원화 환산
            valuation_krw = valuation
            if asset.country == 'US' or asset.ticker == 'USD':
                valuation_krw = valuation * usd_rate
                
            # 계좌별 합산
            if acc.id not in account_summaries:
                account_summaries[acc.id] = {
                    "id": acc.id,
                    "name": acc.name,
                    "provider": acc.provider,
                    "alias": acc.alias,
                    "total_valuation_krw": 0.0,
                    "assets": []
                }
            
            account_summaries[acc.id]["total_valuation_krw"] += valuation_krw
            account_summaries[acc.id]["assets"].append({
                "name": asset.name,
                "ticker": asset.ticker,
                "quantity": qty,
                "price": price,
                "valuation_krw": valuation_krw,
                "country": asset.country,
                "category": asset.major_category,
                "sub_category": asset.sub_category
            })
            
            # 카테고리별 합산 (대분류 & 중분류)
            cat = asset.major_category
            sub_cat = asset.sub_category
            if cat not in category_summaries:
                category_summaries[cat] = {"value_krw": 0.0, "sub_categories": {}}
            
            category_summaries[cat]["value_krw"] += valuation_krw
            
            if sub_cat not in category_summaries[cat]["sub_categories"]:
                category_summaries[cat]["sub_categories"][sub_cat] = 0.0
            category_summaries[cat]["sub_categories"][sub_cat] += valuation_krw
            
            # 총계 합산
            total_valuation_krw += valuation_krw
            
        # 결과 포맷팅 및 정렬
        formatted_categories = []
        for cat_name, data in category_summaries.items():
            sub_list = [
                {"category": sk, "value_krw": sv} 
                for sk, sv in data["sub_categories"].items()
            ]
            # 중분류 평가액 순 정렬
            sub_list.sort(key=lambda x: x["value_krw"], reverse=True)
            
            formatted_categories.append({
                "category": cat_name,
                "value_krw": data["value_krw"],
                "sub_categories": sub_list
            })
            
        # 대분류 평가액 순 정렬
        formatted_categories.sort(key=lambda x: x["value_krw"], reverse=True)

        # 누적 성과 통계 계산
        yearly_stats = self.get_yearly_stats()
        
        total_contribution = 0.0
        initial_base_asset = 0.0
        total_profit = 0.0
        cumulative_roi = 0.0
        contribution_ratio = 100.0
        profit_ratio = 0.0
        
        if yearly_stats:
            # 1) 총 추가액 (스냅샷 상의 입금 합계)
            total_contribution = sum(y['contribution'] for y in yearly_stats)
            
            # 2) 최초 기초 자산 (가장 과거 연도의 prev_assets)
            # prev_assets = assets - contribution - profit
            oldest_year_stat = yearly_stats[-1] # 내림차순 정렬이므로 마지막 요소가 가장 과거
            initial_base_asset = oldest_year_stat['assets'] - oldest_year_stat['contribution'] - oldest_year_stat['profit']
            
            # 3) 실시간 누적 수익금 = 실시간 평가자산 - 누적 추가액 - 최초 기초 자산
            total_profit = total_valuation_krw - total_contribution - initial_base_asset
            
            # 4) 누적 수익률 = (누적 수익금 / (최초 기초 자산 + 누적 추가액) * 100)
            denominator = initial_base_asset + total_contribution
            if denominator != 0:
                cumulative_roi = (total_profit / denominator) * 100
                
            # 5) 원금 비율 / 수익 비율 계산 (손실 시 방어 로직 적용)
            if total_valuation_krw > 0:
                if total_profit >= 0:
                    contribution_ratio = (initial_base_asset + total_contribution) / total_valuation_krw * 100
                    profit_ratio = total_profit / total_valuation_krw * 100
                else:
                    contribution_ratio = 100.0
                    profit_ratio = 0.0
            else:
                contribution_ratio = 100.0
                profit_ratio = 0.0

        # 최신 주가 업데이트 날짜/시간 조회
        latest_price_date_val = self.db.query(func.max(HistoricalPrice.updated_at)).scalar()
        if not latest_price_date_val:
            latest_price_date_val = self.db.query(func.max(HistoricalPrice.price_date)).scalar()
        
        if latest_price_date_val:
            if isinstance(latest_price_date_val, datetime.datetime):
                latest_price_date_str = latest_price_date_val.strftime("%Y-%m-%d %H:%M")
            else:
                latest_price_date_str = latest_price_date_val.isoformat()
        else:
            latest_price_date_str = "최근 데이터 없음"

        return {
            "accounts": sorted(list(account_summaries.values()), key=lambda x: x['total_valuation_krw'], reverse=True),
            "categories": formatted_categories,
            "total_valuation_krw": total_valuation_krw,
            "exchange_rate": exchange_info,
            "total_contribution": total_contribution,
            "initial_base_asset": initial_base_asset,
            "total_profit": total_profit,
            "cumulative_roi": round(cumulative_roi, 2),
            "contribution_ratio": round(contribution_ratio, 2),
            "profit_ratio": round(profit_ratio, 2),
            "latest_price_date": latest_price_date_str
        }

    def get_snapshots(self, start_date: datetime.date | None = None, end_date: datetime.date | None = None, all_data: bool = False) -> Dict[str, Any]:
        """시계열 자산 추이 데이터를 가져옵니다.
        
        Returns:
            Dict[str, Any]: {
                "history": [
                    {"date": "2024-01-01", "total": 1000.0, "acc_1": 500.0, ...},
                    ...
                ],
                "accounts": [{"id": 1, "name": "계좌1"}, ...]
            }
        """
        query = self.db.query(AccountSnapshot)
        
        if not all_data:
            if not end_date:
                end_date = datetime.date.today()
            if not start_date:
                start_date = end_date - datetime.timedelta(days=30)
            
            query = query.filter(
                AccountSnapshot.snapshot_date >= start_date,
                AccountSnapshot.snapshot_date <= end_date
            )
            
        snapshots = query.order_by(AccountSnapshot.snapshot_date.asc()).all()
        
        accounts = self.db.query(Account).all()
        
        # 날짜별로 그룹화
        history_map = {} # date_str -> { "date": date_str, "total": 0, "acc_1": val, ... }
        
        for s in snapshots:
            date_str = s.snapshot_date.isoformat()
            if date_str not in history_map:
                history_map[date_str] = {"date": date_str, "total": 0.0}
            
            history_map[date_str]["total"] += s.total_valuation
            history_map[date_str][f"acc_{s.account_id}"] = s.total_valuation
            
        return {
            "history": sorted(list(history_map.values()), key=lambda x: x["date"]),
            "accounts": [{"id": acc.id, "name": acc.name} for acc in accounts]
        }

    def calculate_theoretical_cash(self, account_id: int, snapshot_date: datetime.date) -> Dict[str, float]:
        """지정된 계좌의 특정 일자까지의 이론상 현금 잔액(KRW, USD)을 계산합니다.
        
        공식: SUM(입금/초기잔액/배당/이자) - SUM(출금/수수료) - SUM(주식매수) + SUM(주식매도)
        단, 해당 통화의 INITIAL_BALANCE 트랜잭션이 존재하는 경우 그 날짜 이전(미만)의 거래는 계산에서 제외합니다.

        Args:
            account_id (int): 계좌 식별자
            snapshot_date (datetime.date): 기준 일자

        Returns:
            Dict[str, float]: 통화별(KRW, USD) 이론상 잔액 딕셔너리
        """
        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.account_id == account_id)
            .filter(Transaction.transaction_date <= snapshot_date)
            .all()
        )
        
        # 통화별 INITIAL_BALANCE 적용 날짜 수집
        initial_balance_dates = {}
        for tx in transactions:
            if tx.type == 'INITIAL_BALANCE':
                curr = tx.currency
                if curr not in initial_balance_dates or tx.transaction_date > initial_balance_dates[curr]:
                    initial_balance_dates[curr] = tx.transaction_date
        
        theoretical = {"KRW": 0.0, "USD": 0.0}
        
        for tx in transactions:
            currency = tx.currency
            if currency not in theoretical:
                continue # KRW, USD 외 통화는 일단 제외

            # 해당 통화의 INITIAL_BALANCE 설정 날짜 이전(미만)의 거래는 스킵
            ib_date = initial_balance_dates.get(currency)
            if ib_date and tx.transaction_date < ib_date:
                continue

            if tx.type == 'EXCHANGE':
                if tx.asset and tx.asset.ticker in theoretical:
                    theoretical[tx.asset.ticker] -= tx.total_amount
                if tx.target_asset and tx.target_asset.ticker in theoretical:
                    theoretical[tx.target_asset.ticker] += tx.quantity
            elif tx.type in ['DEPOSIT', 'INTEREST', 'CASH_ADJUSTMENT']:
                theoretical[currency] += tx.total_amount
            elif tx.type == 'INITIAL_BALANCE':
                # INITIAL_BALANCE는 자산이 현금(KRW, USD)인 경우에만 더합니다.
                if tx.asset and tx.asset.ticker in ['KRW', 'USD']:
                    theoretical[currency] += tx.total_amount
            elif tx.type in ['WITHDRAW', 'TAX']:
                theoretical[currency] -= tx.total_amount
            elif tx.type == 'BUY':
                # 주식 매수는 해당 통화 현금 감소
                theoretical[currency] -= tx.total_amount
            elif tx.type == 'SELL':
                # 주식 매도는 해당 통화 현금 증가
                theoretical[currency] += tx.total_amount
                
        return theoretical
