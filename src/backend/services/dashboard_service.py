from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Account, Asset, Transaction, ExchangeRate
import yfinance as yf
from typing import Dict, List, Any
import datetime

class DashboardService:
    """자산 현황 및 대시보드 데이터를 계산하는 서비스 클래스입니다."""

    def __init__(self, db: Session):
        self.db = db

    def get_holdings(self) -> List[Dict[str, Any]]:
        """모든 계좌의 자산별 보유량을 계산합니다."""
        # 모든 트랜잭션을 가져와서 (계좌, 자산) 별로 합산
        # INITIAL_BALANCE, BUY, DEPOSIT 는 +, SELL, WITHDRAW 는 -
        
        transactions = self.db.query(Transaction).all()
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

        # yfinance를 위해 티커 변환 (국내 주식은 .KS 또는 .KQ 필요)
        # 여기서는 단순화를 위해 국내 6자리 숫자는 .KS로 가정 (실제로는 시장 구분 필요하나 마스터 정보에 포함됨)
        formatted_tickers = []
        ticker_map = {} # formatted -> original
        
        for t in query_tickers:
            if t.isdigit() and len(t) == 6:
                # 국내 주식 (코스피/코스닥 구분이 필요하지만 여기서는 .KS / .KQ 정보를 Asset 모델에서 가져올 수 있음)
                # 일단 Asset 마스터를 다시 조회하여 국가가 KR이면 .KS를 붙여 시도
                asset = self.db.query(Asset).filter(Asset.ticker == t).first()
                ft = t
                if asset and asset.country == 'KR':
                    # TODO: 마켓 구분이 있으면 더 정확함. 일단 .KS로 시도
                    ft = f"{t}.KS"
                formatted_tickers.append(ft)
                ticker_map[ft] = t
            else:
                formatted_tickers.append(t)
                ticker_map[t] = t

        try:
            # yfinance는 동기 함수이므로 루프 내에서 처리하거나 thread pool 사용 권장
            # 일단 소량의 종목이므로 직접 호출
            data = yf.download(formatted_tickers, period="1d", interval="1m", progress=False)
            
            if not data.empty:
                if len(formatted_tickers) == 1:
                    # 단일 종목인 경우 DataFrame 구조가 다름
                    last_price = data['Close'].iloc[-1]
                    prices[ticker_map[formatted_tickers[0]]] = float(last_price)
                else:
                    for ft in formatted_tickers:
                        try:
                            last_price = data['Close'][ft].dropna().iloc[-1]
                            prices[ticker_map[ft]] = float(last_price)
                        except Exception:
                            prices[ticker_map[ft]] = 0.0
        except Exception as e:
            print(f"가격 조회 중 오류 발생: {e}")
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
