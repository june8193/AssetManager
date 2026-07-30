# -*- coding: utf-8 -*-
import asyncio
import json
import httpx
from src.kiwoom.auth import KiwoomAuthManager

async def test_kiwoom_29():
    auth_manager = KiwoomAuthManager()
    base_url = auth_manager.base_url or "https://api.kiwoom.com"
    
    accounts = ['5526-9093', '6066-7729']
    
    for acnt in accounts:
        print(f"\n==================== 계좌: {acnt} (20260729 조회) ====================")
        try:
            token = await auth_manager.get_valid_token(acnt)
        except Exception as e:
            print(f"토큰 발급 실패: {e}")
            continue
            
        # 1. 미국 체결 조회 (ust21510) - 20260729
        url_us = f"{base_url}/api/us/acnt"
        headers_us = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ust21510",
            "authorization": f"Bearer {token}"
        }
        payload_us = {
            "qry_tp": "0",
            "sell_tp": "0",
            "ord_dt": "20260729"
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(url_us, headers=headers_us, json=payload_us, timeout=10)
            data_us = res.json()
            print("--- ust21510 (미국 체결 조회 20260729) ---")
            print(json.dumps(data_us, ensure_ascii=False, indent=2))
            
        # 2. 종합 거래 내역 (kt00015) - 20260729
        url_ledger = f"{base_url}/api/dostk/acnt"
        headers_ledger = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "kt00015",
            "authorization": f"Bearer {token}"
        }
        payload_ledger = {
            "strt_dt": "20260729",
            "end_dt": "20260729",
            "tp": "0",
            "gds_tp": "0",
            "dmst_stex_tp": "%",
            "qry_sort_tp": "2"
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(url_ledger, headers=headers_ledger, json=payload_ledger, timeout=10)
            data_ledger = res.json()
            print("--- kt00015 (종합 거래 내역 20260729) ---")
            print(json.dumps(data_ledger, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    asyncio.run(test_kiwoom_29())
