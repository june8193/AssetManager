# test_api_e2e.py
# SGOV 추가 및 대시보드 API 실시간 갱신 E2E 검증용 스크립트

import requests
import json

BASE_URL = "http://localhost:8000"

def run_e2e():
    print("--- E2E API 검증 시작 ---")
    
    # 1. 사용자 조회
    users_resp = requests.get(f"{BASE_URL}/api/db/users")
    users = users_resp.json()
    if not users:
        print("사용자가 없습니다. 테스트를 진행할 수 없습니다.")
        return
    user_id = users[0]['id']
    print(f"1. 사용자 확인: ID={user_id}, Name={users[0]['name']}")

    # 2. 계좌 조회 또는 생성
    accounts_resp = requests.get(f"{BASE_URL}/api/db/accounts")
    accounts = accounts_resp.json()
    
    # 활성 brokerage 계좌 찾기
    brokerage_acc = None
    for acc in accounts:
        if acc['account_type'] == 'BROKERAGE' and acc['is_active']:
            brokerage_acc = acc
            break
            
    if not brokerage_acc:
        # 없으면 새로 생성
        acc_data = {
            "user_id": user_id,
            "name": "E2E 테스트 계좌",
            "provider": "E2E 증권",
            "alias": "E2E 테스트용",
            "account_type": "BROKERAGE",
            "is_active": True
        }
        create_acc_resp = requests.post(f"{BASE_URL}/api/db/accounts", json=acc_data)
        brokerage_acc = create_acc_resp.json()
        print("2. 새 증권 계좌를 생성했습니다:", brokerage_acc)
    else:
        print(f"2. 기존 증권 계좌 사용: ID={brokerage_acc['id']}, Name={brokerage_acc['name']}")

    account_id = brokerage_acc['id']

    # 3. SGOV 자산(Asset) 존재 여부 확인 및 생성
    assets_resp = requests.get(f"{BASE_URL}/api/db/assets")
    assets = assets_resp.json()
    
    sgov_asset = None
    for asset in assets:
        if asset['ticker'] == 'SGOV':
            sgov_asset = asset
            break
            
    if not sgov_asset:
        asset_data = {
            "ticker": "SGOV",
            "name": "iShares 0-3 Month Treasury Bond ETF",
            "major_category": "채권",
            "sub_category": "미국단기채",
            "country": "US"
        }
        create_asset_resp = requests.post(f"{BASE_URL}/api/db/assets", json=asset_data)
        if create_asset_resp.status_code == 200:
            sgov_asset = create_asset_resp.json()
            print("3. SGOV 자산을 등록했습니다:", sgov_asset)
        else:
            print("SGOV 자산 등록 실패:", create_asset_resp.text)
            return
    else:
        print(f"3. SGOV 자산이 이미 존재합니다: ID={sgov_asset['id']}")

    asset_id = sgov_asset['id']

    # 4. SGOV 매수 거래(Transaction) 등록
    # 기존에 동일 거래가 있는지 조회
    txs_resp = requests.get(f"{BASE_URL}/api/db/transactions")
    txs = txs_resp.json()
    
    has_sgov_tx = False
    for tx in txs:
        if tx['account_id'] == account_id and tx['asset_id'] == asset_id:
            has_sgov_tx = True
            break
            
    if not has_sgov_tx:
        tx_data = {
            "account_id": account_id,
            "asset_id": asset_id,
            "transaction_date": "2026-06-01",
            "type": "BUY",
            "quantity": 10.0,
            "price": 100.4,
            "total_amount": 1004.0,
            "currency": "USD",
            "exchange_rate": 1350.0,
            "memo": "E2E 테스트 SGOV 매수"
        }
        create_tx_resp = requests.post(f"{BASE_URL}/api/db/transactions", json=tx_data)
        if create_tx_resp.status_code == 200:
            print("4. SGOV 매수 거래를 등록했습니다:", create_tx_resp.json())
        else:
            print("SGOV 매수 거래 등록 실패:", create_tx_resp.text)
            return
    else:
        print("4. SGOV 매수 거래가 이미 존재합니다.")

    # 5. 대시보드 API 호출 및 주가 갱신 확인
    print("5. 대시보드 요약 정보 조회 (force_update=True)")
    dashboard_resp = requests.get(f"{BASE_URL}/api/dashboard/summary?force_update=true")
    if dashboard_resp.status_code == 200:
        dashboard_data = dashboard_resp.json()
        
        # SGOV 자산 찾기
        sgov_valuation = None
        for acc in dashboard_data.get('accounts', []):
            if acc['id'] == account_id:
                for asset in acc.get('assets', []):
                    if asset['ticker'] == 'SGOV':
                        sgov_valuation = asset
                        break
        
        if sgov_valuation:
            print("\n================ SUCCESS ================")
            print("SGOV 주가 및 평가액 조회 성공!")
            print(f"수량: {sgov_valuation['quantity']}")
            print(f"현재가: {sgov_valuation['price']} USD")
            print(f"원화 평가액: {sgov_valuation['valuation_krw']} KRW")
            print("=========================================")
            
            # 주가가 0보다 큰지 확인
            if sgov_valuation['price'] > 0:
                print("E2E 검증 통과: SGOV 주가가 0보다 크고 정상적으로 갱신되었습니다.")
            else:
                print("E2E 검증 실패: SGOV 주가가 0.0으로 업데이트 되었습니다.")
        else:
            print("대시보드 계좌 보유 자산 목록에서 SGOV를 찾을 수 없습니다.")
    else:
        print("대시보드 API 호출 실패:", dashboard_resp.text)

if __name__ == "__main__":
    run_e2e()
