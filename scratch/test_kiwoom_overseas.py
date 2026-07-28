# -*- coding: utf-8 -*-
import asyncio
import json
import httpx
from src.kiwoom.auth import KiwoomAuthManager

async def dump_27_execution_detail():
    auth_manager = KiwoomAuthManager()
    base_url = auth_manager.base_url or "https://api.kiwoom.com"
    token = await auth_manager.get_valid_token('5526-9093')
    
    url = f"{base_url}/api/us/acnt"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": "ust21510",
        "authorization": f"Bearer {token}"
    }
    
    payload = {
        "qry_tp": "0",
        "sell_tp": "0",
        "ord_dt": "20260727"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload, timeout=10)
        data = res.json()
        print("=== 2026-07-27 키움 실제 해외체결 응답 원본 ===")
        print(json.dumps(data, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(dump_27_execution_detail())
