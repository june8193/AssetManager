import asyncio
import httpx
import json
from src.kiwoom.auth import KiwoomAuthManager

async def test_kiwoom_indices():
    auth_manager = KiwoomAuthManager()
    base_url = auth_manager.base_url if auth_manager.base_url else "https://api.kiwoom.com"
    token = await auth_manager.get_valid_token()
    
    # 1. ka10101 업종코드 리스트 API 호출
    url = f"{base_url}/api/dostk/stkinfo"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": "ka10101",
        "authorization": f"Bearer {token}"
    }
    
    # payload가 필요한지 모르므로 {} 및 기타 필드 테스트
    payloads = [
        {},
        {"inds_tp": "0"},  # 지수/업종 구분 등이 있을 수 있으므로 여러가지로 시도
        {"mrkt_tp": "0"}
    ]
    
    async with httpx.AsyncClient() as client:
        # test ka20009 (업종현재가일별)
        url_sect = f"{base_url}/api/dostk/sect"
        headers_ka20009 = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ka20009",
            "authorization": f"Bearer {token}"
        }
        
        # 603 = 변동성지수, marketCode: 6
        payload_ka20009 = {
            "mrkt_tp": "6",
            "inds_cd": "603"
        }
        
        print("--- Calling ka20009 for VKOSPI ---")
        try:
            response = await client.post(url_sect, headers=headers_ka20009, json=payload_ka20009, timeout=10)
            print(f"ka20009 Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"ka20009 Return: {data.get('return_code')} - {data.get('return_msg')}")
                if data.get("return_code") == 0 or data.get("return_code") == "0":
                    daly_list = data.get("inds_cur_prc_daly_rept", [])
                    print(f"daly_list length: {len(daly_list)}")
                    if daly_list:
                        print("Sample daily data:")
                        for item in daly_list[:5]:
                            print(item)
            else:
                print(response.text)
        except Exception as e:
            print(f"ka20009 Error: {e}")
            
        # test ka20005 (업종일봉차트조회 - URL /api/dostk/chart)
        url_chart = f"{base_url}/api/dostk/chart"
        headers_ka20005 = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ka20005",
            "authorization": f"Bearer {token}"
        }
        
        # tic_scope: 1:일봉? (PDF에는 ƽ범위라고 나와서 1틱, 3틱... 이라고 적혀있지만 Request Example에 "tic_scope": "5", "base_dt": "20260202"이 있고 response로 "inds_dt_pole_qry" 일자별 데이터를 줌)
        # tic_scope에 "1" 또는 "5" 또는 다른 값을 넣어봄.
        payload_ka20005 = {
            "inds_cd": "603",
            "tic_scope": "1"  # 1일?
        }
        
        print("--- Calling ka20005 for VKOSPI ---")
        try:
            response = await client.post(url_chart, headers=headers_ka20005, json=payload_ka20005, timeout=10)
            print(f"ka20005 Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"ka20005 Return: {data.get('return_code')} - {data.get('return_msg')}")
                chart_list = data.get("inds_dt_pole_qry", [])
                print(f"chart_list length: {len(chart_list)}")
                if chart_list:
                    print("Sample chart data:")
                    for item in chart_list[:5]:
                        print(item)
            else:
                print(response.text)
        except Exception as e:
            print(f"ka20005 Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_kiwoom_indices())
