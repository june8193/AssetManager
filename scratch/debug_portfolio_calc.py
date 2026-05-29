import datetime
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.database import SessionLocal
from src.backend.models import AccountSnapshot

def main():
    db = SessionLocal()
    try:
        start_date = datetime.date(2026, 1, 1)
        end_date = datetime.date.today()
        
        from src.backend.services.benchmark_service import BenchmarkService
        bench_service = BenchmarkService(db)
        import asyncio
        
        prices = asyncio.run(bench_service.get_historical_prices("^KS11", start_date, end_date))
        sorted_dates = sorted(list(set(p.price_date for p in prices if p.close_price > 0.0)))
        
        print(f"Sorted dates count: {len(sorted_dates)}")
        if sorted_dates:
            print(f"First sorted date: {sorted_dates[0]} (Type: {type(sorted_dates[0])})")
            print(f"Last sorted date: {sorted_dates[-1]} (Type: {type(sorted_dates[-1])})")

        snapshots = (
            db.query(AccountSnapshot)
            .filter(AccountSnapshot.snapshot_date >= start_date, AccountSnapshot.snapshot_date <= end_date)
            .order_by(AccountSnapshot.snapshot_date.asc())
            .all()
        )

        portfolio_vals = {}
        for s in snapshots:
            d = s.snapshot_date
            portfolio_vals[d] = portfolio_vals.get(d, 0.0) + s.total_valuation

        if portfolio_vals:
            first_val_key = list(portfolio_vals.keys())[0]
            print(f"Portfolio val key example: {first_val_key} (Type: {type(first_val_key)})")

        # 두 타입의 비교 가능 여부 테스트
        if sorted_dates and portfolio_vals:
            match_found = False
            for k in portfolio_vals.keys():
                for sd in sorted_dates:
                    if k == sd:
                        match_found = True
                        print(f"Match found: {k} == {sd}")
            if not match_found:
                print("WARNING: No exact date matches found between portfolio keys and sorted dates!")

    finally:
        db.close()

if __name__ == "__main__":
    main()
