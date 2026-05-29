import datetime
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.database import SessionLocal
from src.backend.models import HistoricalPrice

def main():
    db = SessionLocal()
    try:
        start_date = datetime.date(2026, 1, 1)
        end_date = datetime.date.today()
        
        # DB에 저장된 ^KS11 가격을 봅니다.
        prices = (
            db.query(HistoricalPrice)
            .filter(
                HistoricalPrice.ticker == "^KS11",
                HistoricalPrice.price_date >= start_date,
                HistoricalPrice.price_date <= end_date
            )
            .order_by(HistoricalPrice.price_date.desc())
            .all()
        )
        
        print(f"Total prices count for ^KS11: {len(prices)}")
        print("Last 10 records for ^KS11 in DB:")
        for p in prices[:10]:
            print(f"  Date: {p.price_date}, Close: {p.close_price}")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
