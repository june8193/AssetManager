import os
import sys
import sqlite3
from playwright.sync_api import sync_playwright

def setup_db():
    print("DB에 테스트용 계좌 생성 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()
    
    # 기존 데이터 삭제
    cursor.execute("DELETE FROM accounts WHERE id IN (991, 992)")
    cursor.execute("DELETE FROM transactions WHERE account_id IN (991, 992)")
    cursor.execute("DELETE FROM account_snapshots WHERE account_id IN (991, 992)")
    
    # 테스트 계좌 삽입
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (991, 1, '증권 계좌 1', '미래에셋', 'KB증권별칭', 'BROKERAGE', 1)
    """)
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (992, 1, '은행 계좌 1', '국민은행', '국민은행별칭', 'BANK', 1)
    """)
    conn.commit()
    conn.close()

def teardown_db():
    print("DB 테스트 데이터 정리 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM accounts WHERE id IN (991, 992)")
    cursor.execute("DELETE FROM transactions WHERE account_id IN (991, 992)")
    cursor.execute("DELETE FROM account_snapshots WHERE account_id IN (991, 992)")
    conn.commit()
    conn.close()

def run_e2e():
    setup_db()
    print("E2E 테스트 시작...")
    os.makedirs("screenshots", exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        # 얼럿/컨펌 다이얼로그 자동 승인 및 로깅
        def handle_dialog(dialog):
            print(f"[Dialog] 메시지: {dialog.message}")
            dialog.accept()
        page.on("dialog", handle_dialog)
        
        try:
            # 1. 스냅샷 생성 페이지 접속
            print("1. 스냅샷 생성 페이지 접속 중...")
            page.goto("http://localhost:5173/db/snapshots/new")
            page.wait_for_timeout(2000)
            page.screenshot(path="screenshots/step1_initial.png")
            
            # 1단계 기본 정보 입력
            print("2. 1단계: 기본 정보 입력 및 증권 계좌 선택")
            exchange_rate_input = page.locator("input[placeholder='예: 1350.5']")
            exchange_rate_input.fill("1350.5")
            
            # '증권 계좌 1' ( alias: 'KB증권별칭' ) 행 클릭
            page.locator("tr:has-text('KB증권별칭')").first.click()
            page.screenshot(path="screenshots/step1_filled.png")
            
            # 다음 버튼 클릭
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            
            # 2단계 증권사 상세 입력
            print("3. 2단계: 증권사 상세 입력 및 천단위 쉼표 검증")
            page.screenshot(path="screenshots/step2_initial.png")
            
            # 원화 잔액 필드 입력 (id: krw-balance-991)
            krw_input = page.locator("input[id^='krw-balance-']")
            krw_input.fill("1000000")
            krw_val = krw_input.input_value()
            print(f"원화 잔액 입력값: {krw_val}")
            assert krw_val == "1,000,000", f"원화 잔액 천단위 쉼표 오류: {krw_val}"
            
            # 달러 잔액 필드 입력 (id: usd-balance-991)
            usd_input = page.locator("input[id^='usd-balance-']")
            usd_input.fill("5000.5")
            usd_val = usd_input.input_value()
            print(f"달러 잔액 입력값: {usd_val}")
            assert usd_val == "5,000.5", f"달러 잔액 천단위 쉼표 오류: {usd_val}"
            
            # 정산 결과 계산하기 클릭
            page.locator("button:has-text('정산 결과 계산하기')").click()
            page.wait_for_timeout(2500)
            page.screenshot(path="screenshots/step2_calculated.png")
            
            # 이 결과로 확정 클릭
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(500)
            
            # 다음 클릭
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            
            # 3단계 은행 계좌 선택
            print("4. 3단계: 은행 계좌 선택")
            page.screenshot(path="screenshots/step3_initial.png")
            page.locator("tr:has-text('국민은행별칭')").first.click()
            page.screenshot(path="screenshots/step3_filled.png")
            
            # 다음 클릭
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            
            # 4단계 은행 상세 입력
            print("5. 4단계: 은행 상세 입력 및 예상 잔액 계산 상세 검증")
            page.screenshot(path="screenshots/step4_initial.png")
            
            # 예상 잔액 계산하기 클릭
            page.locator("button:has-text('예상 잔액 계산하기')").click()
            page.wait_for_timeout(2500)
            page.screenshot(path="screenshots/step4_calculated.png")
            
            # 집계 데이터 표시 검증
            assert page.locator("text=기간 총 입금").is_visible(), "기간 총 입금 텍스트가 보이지 않음"
            assert page.locator("text=기간 총 출금").is_visible(), "기간 총 출금 텍스트가 보이지 않음"
            assert page.locator("text=이자 합계").is_visible(), "이자 합계 텍스트가 보이지 않음"
            assert page.locator("text=세금 합계").is_visible(), "세금 합계 텍스트가 보이지 않음"
            
            # 실제 최종 잔액에 값 입력하여 천단위 쉼표 검증
            final_input = page.locator("input[id^='total-valuation-']")
            final_input.fill("3000500")
            final_val = final_input.input_value()
            print(f"은행 최종 잔액 입력값: {final_val}")
            assert final_val == "3,000,500", f"은행 최종 잔액 쉼표 오류: {final_val}"
            
            # 이 결과로 확정 클릭
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(500)
            
            # 다음 클릭
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            
            # 5단계 최종 확인
            print("6. 5단계: 최종 확인 및 저장")
            page.screenshot(path="screenshots/step5_initial.png")
            
            # 은행 계좌 요약에 입금액과 이자/기타 정보가 요약 표시되는지 검증
            # 5단계에는 여러 '입금:' 텍스트가 있으므로 .first를 사용하여 단일 요소를 검증합니다.
            assert page.locator("text=입금:").first.is_visible(), "5단계 최종 확인에 은행 입금 요약이 보이지 않음"
            
            # 저장하기 클릭
            print("저장하기 클릭...")
            page.locator("button:has-text('저장하기')").click()
            page.wait_for_timeout(2000)
            page.screenshot(path="screenshots/step5_saved.png")
            
            print("E2E 테스트 성공 완료!")
            
        except Exception as e:
            print(f"E2E 테스트 에러 발생: {e}", file=sys.stderr)
            page.screenshot(path="screenshots/error_state.png")
            sys.exit(1)
        finally:
            browser.close()
            teardown_db()

if __name__ == "__main__":
    run_e2e()
