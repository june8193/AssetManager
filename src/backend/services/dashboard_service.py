from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Account, Asset, Transaction, ExchangeRate, AccountSnapshot
import yfinance as yf
from typing import Dict, List, Any
import datetime
import asyncio
from ...kiwoom.api import KiwoomAPI
from ...kiwoom.auth import KiwoomAuthManager

class DashboardService:
    """자산 현황 및 대시보드 데이터를 계산하는 서비스 클래스입니다."""

    def __init__(self, db: Session):
        self.db = db
        self.kiwoom_api = KiwoomAPI()
        self.kiwoom_auth = KiwoomAuthManager()

    def get_yearly_stats(self) -> List[Dict[str, Any]]:
        """연도별 활성 계좌의 자산 현황 통계를 계산합니다."""
        # 1. 활성 계좌의 거래 내역만 가져오기
        transactions = (
            self.db.query(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .filter(Account.is_active == True)
            .all()
        )
        
        # 2. 연도별 추가액(Net Contribution) 계산
        # 추가액 = (DEPOSIT + INITIAL_BALANCE) - WITHDRAW
        yearly_contribution = {} # year -> amount
        for tx in transactions:
            year = tx.transaction_date.year
            if year not in yearly_contribution:
                yearly_contribution[year] = 0.0
            
            if tx.type in ['DEPOSIT', 'INITIAL_BALANCE']:
                yearly_contribution[year] += tx.total_amount
            elif tx.type == 'WITHDRAW':
                yearly_contribution[year] -= tx.total_amount

        # 3. 활성 계좌의 스냅샷만 가져오기 및 연도별 기말 자산 계산
        snapshots = (
            self.db.query(AccountSnapshot)
            .join(Account, AccountSnapshot.account_id == Account.id)
            .filter(Account.is_active == True)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )
        
        # 연도별로 스냅샷 그룹화: year -> date -> account_id -> valuation
        yearly_snapshots = {} 
        for s in snapshots:
            y = s.snapshot_date.year
            if y not in yearly_snapshots:
                yearly_snapshots[y] = {}
            
            d = s.snapshot_date
            if d not in yearly_snapshots[y]:
                yearly_snapshots[y][d] = {}
            
            yearly_snapshots[y][d][s.account_id] = s.total_valuation

        # 연도별 기말 자산 (그 연도의 마지막 날짜의 모든 활성 계좌 합계)
        yearly_assets = {} # year -> total_valuation
        for y, dates in yearly_snapshots.items():
            last_date = max(dates.keys())
            yearly_assets[y] = sum(dates[last_date].values())

        # 4. 종합 통계 계산
        years = sorted(list(set(list(yearly_contribution.keys()) + list(yearly_assets.keys()))))
        results = []
        
        prev_assets = 0.0
        for y in years:
            assets = yearly_assets.get(y, prev_assets)
            contribution = yearly_contribution.get(y, 0.0)
            
            increase = assets - prev_assets
            profit = increase - contribution
            
            # ROI = 수익 / (기초 자산 + 추가액)
            # 기초 자산 + 추가액이 0이면 ROI는 0
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
            
            prev_assets = assets
            
        return results

    def get_holdings(self) -> List[Dict[str, Any]]:
        """모든 활성 계좌의 자산별 보유량을 계산합니다."""
        # 활성 계좌의 트랜잭션만 가져와서 (계좌, 자산) 별로 합산
        # INITIAL_BALANCE, BUY, DEPOSIT 는 +, SELL, WITHDRAW 는 -
        
        transactions = (
            self.db.query(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .filter(Account.is_active == True)
            .all()
        )
        holdings = {} # (account_id, asset_id) -> quantity

        for tx in transactions:
            key = (tx.account_id, tx.asset_id)
            if key not in holdings:
                holdings[key] = 0.0
            
            if tx.type in ['BUY', 'DEPOSIT', 'INITIAL_BALANCE', 'DIVIDEND', 'INTEREST']:
                holdings[key] += tx.quantity
            elif tx.type in ['SELL', 'WITHDRAW']:
                holdings[key] -= tx.quantity
        
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

    async def get_current_prices(self, tickers: List[str]) -> Dict[str, float]:
        """주어진 티커 리스트의 현재가를 조회합니다."""
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
                
        # 2. 국내 주식 가격 조회 (키움 API Bulk 요청)
        if kr_tickers:
            try:
                token = await self.kiwoom_auth.get_valid_token()
                # 한 번에 최대 몇개까지 가능한지 테스트가 필요하지만 일단 50개 단위로 끊어서 요청 (보수적 접근)
                batch_size = 50 
                for i in range(0, len(kr_tickers), batch_size):
                    batch = kr_tickers[i:i + batch_size]
                    res = self.kiwoom_api.get_bulk_stock_info(token, batch)
                    
                    if res and res.get("return_code") == 0:
                        outputs = res.get("atn_stk_infr", [])
                        for out in outputs:
                            t = out.get("stk_cd")
                            # 현재가 필드명: cur_prc (부호 포함 문자열로 옴)
                            price_val = out.get("cur_prc", "0")
                            if isinstance(price_val, str):
                                # 부호(+, -) 제거 후 숫자로 변환
                                price_val = price_val.strip("+-")
                            prices[t] = float(price_val)
                    else:
                        print(f"키움 API Bulk 조회 실패 (batch {i}): {res.get('return_msg') if res else '응답 없음'}")

            except Exception as e:
                print(f"국내 주식 주가 조회 중 오류 발생: {e}")

        # 3. 해외 주식 가격 조회 (yfinance)
        if other_tickers:
            formatted_other = []
            ticker_map = {} # formatted -> original
            
            for t in other_tickers:
                # yfinance 용 포맷 변환 (국내 주식이 여기에 포함될 수 있으므로 다시 체크)
                if t.isdigit() and len(t) == 6:
                    ft = f"{t}.KS" # yfinance 보조용
                    formatted_other.append(ft)
                    ticker_map[ft] = t
                else:
                    formatted_other.append(t)
                    ticker_map[t] = t

            try:
                # 비동기 환경에서 yfinance download는 블로킹이 발생할 수 있으므로 thread pool 사용 권장
                # 여기서는 일단 직접 호출
                data = yf.download(formatted_other, period="1d", interval="1m", progress=False)
                
                if not data.empty:
                    if len(formatted_other) == 1:
                        last_price = data['Close'].iloc[-1]
                        prices[ticker_map[formatted_other[0]]] = float(last_price)
                    else:
                        for ft in formatted_other:
                            try:
                                last_price = data['Close'][ft].dropna().iloc[-1]
                                prices[ticker_map[ft]] = float(last_price)
                            except Exception:
                                if ticker_map[ft] not in prices:
                                    prices[ticker_map[ft]] = 0.0
            except Exception as e:
                print(f"yfinance 가격 조회 중 오류 발생: {e}")
                for t in other_tickers:
                    if t not in prices:
                        prices[t] = 0.0
        
        # 모든 쿼리 티커에 대해 가격 보장 (조회 실패 시 0.0)
        for t in query_tickers:
            if t not in prices:
                prices[t] = 0.0
                    
        return prices


    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """대시보드 요약 데이터를 생성합니다."""
        holdings = self.get_holdings()
        exchange_info = self.get_latest_exchange_rate()
        usd_rate = exchange_info['rate']
        
        # 보유 자산들의 유니크 티커 목록
        tickers = list(set([h['asset'].ticker for h in holdings]))
        prices = await self.get_current_prices(tickers)
        
        account_summaries = {} # account_id -> {account_info, total_valuation_krw}
        category_summaries = {} # category_name -> total_valuation_krw
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
                "country": asset.country
            })
            
            # 카테고리별 합산
            cat = asset.major_category
            if cat not in category_summaries:
                category_summaries[cat] = 0.0
            category_summaries[cat] += valuation_krw
            
            # 총계 합산
            total_valuation_krw += valuation_krw
            
        return {
            "accounts": sorted(list(account_summaries.values()), key=lambda x: x['total_valuation_krw'], reverse=True),
            "categories": [{"category": k, "value_krw": v} for k, v in category_summaries.items()],
            "total_valuation_krw": total_valuation_krw,
            "exchange_rate": exchange_info
        }
