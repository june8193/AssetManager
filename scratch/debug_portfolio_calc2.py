import datetime
import sys
import os
import asyncio

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.database import SessionLocal
from src.backend.models import AccountSnapshot
from src.backend.services.benchmark_service import BenchmarkService

async def async_main():
    db = SessionLocal()
    try:
        start_date = datetime.date(2026, 1, 1)
        end_date = datetime.date.today()
        tickers = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
        
        bench_service = BenchmarkService(db)
        
        # 1. 지수 데이터 수집 및 캐싱 보장
        tasks = [bench_service.get_historical_prices(t, start_date, end_date) for t in tickers]
        prices_by_ticker = {}
        results = await asyncio.gather(*tasks)
        for t, prices in zip(tickers, results):
            prices_by_ticker[t] = prices

        # 2. X축 날짜(영업일 labels) 생성
        dates_set = set()
        for prices in prices_by_ticker.values():
            for p in prices:
                if p.close_price > 0.0:
                    dates_set.add(p.price_date)
        
        sorted_dates = sorted([d for d in dates_set if start_date <= d <= end_date])
        print(f"Total sorted dates with US tickers: {len(sorted_dates)}")
        
        # 포트폴리오 자산 조회
        snapshots = (
            db.query(AccountSnapshot)
            .filter(AccountSnapshot.snapshot_date >= start_date, AccountSnapshot.snapshot_date <= end_date)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )

        portfolio_vals = {}
        portfolio_deposits = {}
        for s in snapshots:
            d = s.snapshot_date
            portfolio_vals[d] = portfolio_vals.get(d, 0.0) + s.total_valuation
            portfolio_deposits[d] = portfolio_deposits.get(d, 0.0) + s.period_deposit

        # forward fill
        portfolio_history = []
        portfolio_deposits_history = []
        
        last_known_val = 0.0
        if sorted_dates[0] in portfolio_vals:
            last_known_val = portfolio_vals[sorted_dates[0]]
        else:
            prev_snap = (
                db.query(AccountSnapshot)
                .filter(AccountSnapshot.snapshot_date < sorted_dates[0])
                .order_by(AccountSnapshot.snapshot_date.desc())
                .first()
            )
            if prev_snap:
                prev_date = prev_snap.snapshot_date
                last_known_val = sum(
                    snap.total_valuation for snap in db.query(AccountSnapshot).filter_by(snapshot_date=prev_date).all()
                )

        print(f"base_val: {last_known_val:,.2f}원")

        for d in sorted_dates:
            if d in portfolio_vals:
                last_known_val = portfolio_vals[d]
            portfolio_history.append(last_known_val)
            portfolio_deposits_history.append(portfolio_deposits.get(d, 0.0))

        # 누적 수익률 계산
        portfolio_returns = []
        base_val = portfolio_history[0]
        net_deposit = 0.0

        for i, val in enumerate(portfolio_history):
            d = sorted_dates[i]
            if i == 0:
                roi = 0.0
            else:
                net_deposit += portfolio_deposits_history[i]
                denominator = base_val + net_deposit
                if denominator != 0:
                    roi = ((val - net_deposit - base_val) / denominator) * 100
                else:
                    roi = 0.0
            portfolio_returns.append(round(roi, 2))
            
            if d in portfolio_vals:
                print(f"매칭된 스냅샷 날짜: {d} | 자산(val): {val:,.2f}원 | 당일입금: {portfolio_deposits_history[i]:,.2f}원 | 누적입금(net_deposit): {net_deposit:,.2f}원 | ROI: {roi:.2f}%")

        print(f"최종 영업일 ({sorted_dates[-1]}) ROI: {portfolio_returns[-1]:.2f}%")
        
    finally:
        db.close()

def main():
    asyncio.run(async_main())

if __name__ == "__main__":
    main()
