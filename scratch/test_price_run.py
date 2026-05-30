import asyncio
from src.backend.services.price_service import price_service

async def main():
    print("Testing KR Prices (005930, 000660):")
    kr_res = await price_service.get_kr_prices(["005930", "000660"], force_update=True)
    print("KR Result:", kr_res)

    print("\nTesting US Prices (GOOGL, AAPL):")
    us_res = await price_service.get_us_prices(["GOOGL", "AAPL"], force_update=True)
    print("US Result:", us_res)

if __name__ == "__main__":
    asyncio.run(main())
