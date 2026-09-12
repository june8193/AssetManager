# -*- coding: utf-8 -*-
"""키움증권 5526-9093 계좌의 최근 거래내역(kt00015)을 직접 조회하여 환전 내역을 확인하는 스크립트입니다."""

import asyncio
import json
import httpx
from src.kiwoom.auth import KiwoomAuthManager


async def main():
    account_name = "5526-9093"
    auth_manager = KiwoomAuthManager()
    base_url = auth_manager.base_url or "https://api.kiwoom.com"

    print(f"[{account_name}] 토큰 발급 중...")
    token = await auth_manager.get_valid_token(account_name)
    print(f"토큰 발급 완료: {token[:10]}...")

    start_dt = "20260906"
    end_dt = "20260912"

    url = f"{base_url}/api/dostk/acnt"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": "kt00015",
        "authorization": f"Bearer {token}",
    }
    payload = {
        "strt_dt": start_dt,
        "end_dt": end_dt,
        "tp": "0",             # 전체
        "gds_tp": "0",         # 전체
        "dmst_stex_tp": "%",   # 전체
        "qry_sort_tp": "2",     # 과거거래순
    }

    print(f"\n[kt00015 종합거래내역 요청] 기간: {start_dt} ~ {end_dt}")
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload, timeout=20)
        print(f"HTTP Status: {resp.status_code}")
        data = resp.json()

        print(f"return_code: {data.get('return_code')}, return_msg: {data.get('return_msg')}")
        
        entries = data.get("trst_ovrl_trde_prps_array", [])
        print(f"총 반환된 원장 내역 수: {len(entries)}건\n")

        for idx, item in enumerate(entries, 1):
            dt = item.get("trde_dt")
            rmrk = item.get("rmrk_nm")
            kind = item.get("trde_kind_nm")
            io_tp = item.get("io_tp_nm")
            stk_nm = item.get("stk_nm")
            trde_amt = item.get("trde_amt")
            fc_trde_amt = item.get("fc_trde_amt")
            trde_unit = item.get("trde_unit")
            seq = item.get("seq") or item.get("trde_no")
            print(f"[{idx}] 일자: {dt} | 적요: {rmrk} | 거래종류: {kind} | 입출구분: {io_tp} | 종목: {stk_nm} | 원화금액: {trde_amt} | 외화금액: {fc_trde_amt} | 환율/단가: {trde_unit} | 번호: {seq}")
            print(f"    전체 데이터: {json.dumps(item, ensure_ascii=False)}")


if __name__ == "__main__":
    asyncio.run(main())
