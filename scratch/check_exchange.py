import asyncio
import datetime
from src.backend.database import SessionLocal
from src.backend.services.price_service import price_service

async def test_exchange():
    with SessionLocal() as db:
        today = datetime.date.today()
        print(f"Testing fetch_and_save_exchange_rate for today ({today})...")
        rate = await price_service.fetch_and_save_exchange_rate(db, today)
        print(f"Result rate: {rate}")

if __name__ == "__main__":
    asyncio.run(test_exchange())
