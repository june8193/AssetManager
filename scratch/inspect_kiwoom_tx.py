import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import datetime
import json
import httpx
from src.kiwoom.auth import KiwoomAuthManager

sys.stdout.reconfigure(encoding="utf-8")

async def main():
    auth_mgr = KiwoomAuthManager()
    base_url = auth_mgr.base_url or "https://api.kiwoom.com"
    
    print(f"Base URL: {base_url}")
    print(f"Accounts in config: {list(auth_mgr.accounts_config.keys())}")
    
    for acc_name in auth_mgr.accounts_config:
        print(f"\n================ 계좌: {acc_name} ================")
        token = await auth_mgr.get_valid_token(acc_name)
        
        async with httpx.AsyncClient() as client:
            # 1. 해외 체결내역 (ust21510) - 20260824, 20260825, 20260826, 생략(당일)
            for dt in ["20260824", "20260825", "20260826", None]:
                url = f"{base_url}/api/us/acnt"
                headers = {
                    "Content-Type": "application/json;charset=UTF-8",
                    "api-id": "ust21510",
                    "authorization": f"Bearer {token}"
                }
                payload = {
                    "qry_tp": "0",
                    "sell_tp": "0"
                }
                if dt:
                    payload["ord_dt"] = dt
                
                resp = await client.post(url, headers=headers, json=payload, timeout=15)
                res_data = resp.json()
                print(f"--- ust21510 (target_date={dt}) ---")
                print(f"return_code: {res_data.get('return_code')}, return_msg: {res_data.get('return_msg')}")
                result_list = res_data.get("result_list", [])
                print(f"result_list 건수: {len(result_list)}")
                for item in result_list:
                    print("UST Item:", json.dumps(item, ensure_ascii=False))

            # 2. 종합거래내역 (kt00015) - 20260820 ~ 20260829
            url = f"{base_url}/api/dostk/acnt"
            headers = {
                "Content-Type": "application/json;charset=UTF-8",
                "api-id": "kt00015",
                "authorization": f"Bearer {token}"
            }
            payload = {
                "strt_dt": "20260820",
                "end_dt": "20260829",
                "tp": "0",
                "gds_tp": "0",
                "dmst_stex_tp": "%",
                "qry_sort_tp": "2"
            }
            resp = await client.post(url, headers=headers, json=payload, timeout=15)
            res_data = resp.json()
            print(f"\n--- kt00015 (20260820 ~ 20260829) ---")
            print(f"return_code: {res_data.get('return_code')}, return_msg: {res_data.get('return_msg')}")
            ledger_arr = res_data.get("trst_ovrl_trde_prps_array", [])
            print(f"trst_ovrl_trde_prps_array 건수: {len(ledger_arr)}")
            for item in ledger_arr:
                print("Ledger:", json.dumps(item, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
