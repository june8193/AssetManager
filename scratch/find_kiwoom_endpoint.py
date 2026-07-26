import asyncio
import json
import requests
from src.kiwoom.auth import KiwoomAuthManager
from src.kiwoom.api import KiwoomAPI

async def test_exchange_precise():
    auth = KiwoomAuthManager()
    token = await auth.get_valid_token()
    api = KiwoomAPI()
    base_url = api.base_url
    
    url = f"{base_url}/api/us/exchange"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": "ust31301",
        "authorization": f"Bearer {token}"
    }

    # exch_tp 테스트 (1, 2, 0 등)
    for exch_val in ["1", "2", "0"]:
        data = {
            "sell_crnc_code": "USD",
            "buy_crnc_code": "KRW",
            "exch_tp": exch_val
        }
        res = requests.post(url, headers=headers, json=data, timeout=5)
        print(f"[exch_tp={exch_val}] Status: {res.status_code}, Res: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_exchange_precise())
