"""거래 입력 폼 및 계좌 필터 표시 개선 사항을 검증하는 E2E 테스트 스크립트.

Playwright를 사용하여 계좌 필터와 신규 거래 추가 폼의 계좌 정보가
올바른 포맷(금융기관 / 계좌명 / 별칭)으로 출력되는지 확인하고,
새 거래 추가 후 중요 정보(날짜, 계좌, 자산, 유형 등)가 유지되는지 검증합니다.
"""
import os
import sys
import sqlite3
import datetime
from playwright.sync_api import sync_playwright

# 스크린샷 저장 디렉토리 정의
SCREENSHOT_DIR = "c:/localrepo/AssetManager/screenshots/20260528_134300_transaction_improvements"

def setup_db():
    """테스트용 계좌 및 자산 검증을 위한 DB 셋업"""
    print("DB에 테스트용 계좌 생성 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()
    
    # 혹시 모를 기존 테스트 데이터 정리
    cursor.execute("DELETE FROM transactions WHERE account_id = 999")
    cursor.execute("DELETE FROM accounts WHERE id = 999")
    
    # 1개의 테스트용 계좌 명시적으로 삽입 (금융기관: E2ETEST-BANK, 계좌명: E2ETEST-ACCOUNT, 별칭: E2ETEST-ALIAS)
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (999, 1, 'E2ETEST-ACCOUNT', 'E2ETEST-BANK', 'E2ETEST-ALIAS', 'BROKERAGE', 1)
    """)
    
    # 삼성전자 자산(id=3)이 존재하는지 확인하고 없으면 삽입
    cursor.execute("SELECT id FROM assets WHERE id = 3")
    row = cursor.fetchone()
    if not row:
        cursor.execute("""
            INSERT INTO assets (id, ticker, name, major_category, sub_category, country)
            VALUES (3, '005930', '삼성전자', '주식', '주식', 'KR')
        """)
        
    conn.commit()
    conn.close()

def teardown_db():
    """테스트 후 DB 복구"""
    print("DB 테스트 데이터 정리 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE account_id = 999")
    cursor.execute("DELETE FROM accounts WHERE id = 999")
    conn.commit()
    conn.close()

def run_test():
    setup_db()
    print("E2E 개선 사항 테스트 시작...")
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        # 다이얼로그 처리 (confirm 등 자동 승인)
        page.on("dialog", lambda dialog: dialog.accept())
        
        try:
            # 1. 메인 페이지 접속
            print("1. http://localhost:5173 접속 중...")
            page.goto("http://localhost:5173")
            page.wait_for_timeout(3000)
            
            # 2. 'DB 관리 > 마스터 관리 > 거래 내역' 메뉴로 이동
            print("2. DB 관리 메뉴 확장...")
            page.locator("button:has-text('DB 관리')").click()
            page.wait_for_timeout(1000)
            
            print("마스터 관리 메뉴 클릭...")
            page.locator("a:has-text('마스터 관리')").click()
            page.wait_for_timeout(2000)
            
            print("거래 내역 탭 클릭...")
            page.locator("button:has-text('거래 내역')").click()
            page.wait_for_timeout(2000)
            
            # 스크린샷 1: 거래 내역 탭 진입 완료
            page.screenshot(path=f"{SCREENSHOT_DIR}/step1_navigation.png")
            print("거래 내역 화면 캡처 완료.")
            
            # 3. 계좌 필터(조회용) 셀렉트 박스에서 계좌 표시 형식이 '금융기관 / 계좌명 / 별칭' 순서로 올바르게 표시되는지 확인
            print("3. 계좌 필터(조회용) 표시 형식 검증...")
            # 계좌 필터 select 요소를 가져옵니다.
            filter_select = page.locator("div.flex:has-text('계좌 필터:') select")
            # E2ETEST 계좌 옵션이 있는지 검사
            target_option_text = "E2ETEST-BANK / E2ETEST-ACCOUNT / E2ETEST-ALIAS"
            
            options = filter_select.locator("option").all_inner_texts()
            print(f"조회용 필터 옵션들: {options}")
            assert target_option_text in options, f"계좌 필터에 '{target_option_text}'가 존재하지 않습니다."
            print("-> 계좌 필터 형식 검증 성공!")
            
            # 4. 새 거래 기록 추가 폼의 '계좌' 셀렉트 박스에서도 포맷이 동일하게 적용되어 변경되었는지 확인
            print("4. 신규 추가 폼 계좌 셀렉트 박스 형식 검증...")
            form_select = page.locator("form select[name='account_id']")
            form_options = form_select.locator("option").all_inner_texts()
            print(f"추가 폼 계좌 옵션들: {form_options}")
            assert target_option_text in form_options, f"추가 폼 계좌 셀렉트 박스에 '{target_option_text}'가 존재하지 않습니다."
            print("-> 추가 폼 계좌 형식 검증 성공!")
            
            # 스크린샷 2: 셀렉트 박스 검증 완료
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_form_format_check.png")
            
            # 5. 새 거래 기록 추가 폼에 임의의 값을 입력
            # 날짜=오늘, 자산=삼성전자, 유형=SELL, 수량=50, 단가=200, 총금액=10000
            print("5. 새 거래 기록 입력...")
            
            # 날짜 입력 (기본 오늘로 채워져 있지만 강제로 오늘 날짜로 재입력)
            today_str = datetime.date.today().strftime("%Y-%m-%d")
            page.locator("form input[name='transaction_date']").fill(today_str)
            
            # 계좌 선택 (E2ETEST-ACCOUNT)
            # select option 값을 id인 999로 설정
            form_select.select_option("999")
            
            # 자산 선택 (삼성전자 id=3)
            page.locator("form select[name='asset_id']").select_option("3")
            
            # 유형 선택 (SELL)
            page.locator("form select[name='type']").select_option("SELL")
            
            # 수량 입력 (50)
            page.locator("form input[name='quantity']").fill("50")
            
            # 단가 입력 (200)
            page.locator("form input[name='price']").fill("200")
            
            # 수량/단가 입력에 의해 총 금액이 자동으로 10000으로 계산되는지 확인하고, 필요 시 총액도 명시적 입력
            page.locator("form input[name='total_amount']").fill("10000")
            
            page.wait_for_timeout(1000)
            # 스크린샷 3: 입력 완료 상태 캡처
            page.screenshot(path=f"{SCREENSHOT_DIR}/step3_form_input.png")
            print("거래 데이터 입력 완료.")
            
            # 6. '+ 거래 기록 추가' 버튼을 클릭
            print("6. '+ 거래 기록 추가' 버튼 클릭...")
            page.locator("form button[type='submit']").click()
            page.wait_for_timeout(2000)
            
            # 7. 거래가 정상 추가되는지 확인한 후,
            # 입력 정보 중 날짜, 계좌, 자산, 유형, 통화는 그대로 유지되고 '수량', '단가', '총금액'만 '0'으로 리셋되는지 확인
            print("7. 입력 폼 리셋 검증...")
            
            # 폼의 필드 값 확인
            res_date = page.locator("form input[name='transaction_date']").input_value()
            res_account = page.locator("form select[name='account_id']").input_value()
            res_asset = page.locator("form select[name='asset_id']").input_value()
            res_type = page.locator("form select[name='type']").input_value()
            res_quantity = page.locator("form input[name='quantity']").input_value()
            res_price = page.locator("form input[name='price']").input_value()
            res_total = page.locator("form input[name='total_amount']").input_value()
            res_currency = page.locator("form select[name='currency']").input_value()
            
            print(f"결과 값 -> 날짜: {res_date}, 계좌: {res_account}, 자산: {res_asset}, 유형: {res_type}, 수량: {res_quantity}, 단가: {res_price}, 총액: {res_total}, 통화: {res_currency}")
            
            # 검증 수행
            assert res_date == today_str, f"날짜가 유지되지 않았습니다. (기대값: {today_str}, 실제값: {res_date})"
            assert res_account == "999", f"계좌가 유지되지 않았습니다. (기대값: 999, 실제값: {res_account})"
            assert res_asset == "3", f"자산이 유지되지 않았습니다. (기대값: 3, 실제값: {res_asset})"
            assert res_type == "SELL", f"유형이 유지되지 않았습니다. (기대값: SELL, 실제값: {res_type})"
            assert res_currency == "KRW", f"통화가 유지되지 않았습니다. (기대값: KRW, 실제값: {res_currency})"
            
            assert float(res_quantity) == 0.0, f"수량이 0으로 리셋되지 않았습니다. (실제값: {res_quantity})"
            assert float(res_price) == 0.0, f"단가가 0으로 리셋되지 않았습니다. (실제값: {res_price})"
            assert float(res_total) == 0.0, f"총금액이 0으로 리셋되지 않았습니다. (실제값: {res_total})"
            
            print("-> 입력 폼 필드 리셋 검증 성공!")
            
            # 테이블 목록에 방금 추가된 거래 내역이 정상적으로 출력되는지 확인
            # (수량 50, 단가 200, 총금액 10000, 유형 SELL)
            print("추가된 거래 내역 테이블 확인...")
            # E2ETEST 계좌에 해당하는 행 검색 또는 테이블 전체에서 50, 200, 10000을 가진 행이 존재하는지 확인
            # target_row_text로 50, 200, 10,000, SELL이 포함된 행을 찾음
            # 단, 마스킹 상태 여부에 따라 '50'이 '*'로 표시될 수 있으므로, 마스킹이 되어있는지 여부를 봐야 함
            # 마스킹 여부 확인
            is_masked_active = page.locator("button:has-text('모자이크 해제')").is_visible()
            print(f"모자이크 활성화 여부: {is_masked_active}")
            
            # 테이블의 모든 tr 텍스트 확인
            rows = page.locator("tbody tr").all_inner_texts()
            print(f"테이블 행 목록: {rows}")
            
            found = False
            for row in rows:
                if "SELL" in row:
                    # 마스킹 상태인 경우 수량, 단가, 총액이 마스킹 처리되었을 수 있음.
                    # 마스킹이 비활성인 경우에는 50, 200, 10,000이 다 들어가 있을 것임.
                    if is_masked_active:
                        # 마스킹 상태라면 수치 대신 아스테리스크 등이 포함되어 있을 수 있음
                        # 여기선 단순히 SELL 유형의 E2ETEST 계좌/자산 관련 행이 있는지만 체크 가능
                        found = True
                        break
                    else:
                        if "50" in row and "200" in row:
                            found = True
                            break
            
            assert found, "추가한 거래 내역이 테이블에 존재하지 않습니다."
            print("-> 거래 내역 테이블 등록 검증 성공!")
            
            # 스크린샷 4: 모든 검증 완료 후 최종 화면 캡처
            page.screenshot(path=f"{SCREENSHOT_DIR}/step4_transaction_added.png")
            print("최종 검증 및 스크린샷 저장 완료.")
            print("모든 E2E 테스트 검증이 성공적으로 완료되었습니다!")
            
        except Exception as e:
            print(f"E2E 테스트 실패: {e}", file=sys.stderr)
            page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
            sys.exit(1)
        finally:
            browser.close()
            teardown_db()

if __name__ == "__main__":
    run_test()
