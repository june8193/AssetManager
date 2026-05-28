import os
import sys
import sqlite3
from playwright.sync_api import sync_playwright

# 스크린샷 저장 하위 디렉토리 정의
SCREENSHOT_DIR = "screenshots/20260528_120400_snapshot_wizard_confirm"

def setup_db():
    """테스트용 가상 데이터베이스 계좌 생성.
    
    E2E 검증을 위해 2개의 증권 계좌와 2개의 은행 계좌를 생성하여
    계좌 간 이동 및 확정 유지를 원활하게 테스트할 수 있도록 합니다.
    """
    print("DB에 테스트용 계좌 생성 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()
    
    # 기존 테스트 데이터 삭제
    cursor.execute("DELETE FROM accounts WHERE id IN (991, 992, 993, 994)")
    cursor.execute("DELETE FROM transactions WHERE account_id IN (991, 992, 993, 994)")
    cursor.execute("DELETE FROM account_snapshots WHERE account_id IN (991, 992, 993, 994)")
    
    # 2개의 증권 계좌와 2개의 은행 계좌 추가
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (991, 1, '증권 계좌 1', '미래에셋', 'KB증권별칭', 'BROKERAGE', 1)
    """)
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (993, 1, '증권 계좌 2', '한국투자', '한투증권별칭', 'BROKERAGE', 1)
    """)
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (992, 1, '은행 계좌 1', '국민은행', '국민은행별칭', 'BANK', 1)
    """)
    cursor.execute("""
        INSERT INTO accounts (id, user_id, name, provider, alias, account_type, is_active)
        VALUES (994, 1, '은행 계좌 2', '신한은행', '신한은행별칭', 'BANK', 1)
    """)
    
    conn.commit()
    conn.close()

def teardown_db():
    """테스트용 가상 데이터베이스 계좌 정리."""
    print("DB 테스트 데이터 정리 중...")
    conn = sqlite3.connect("src/dev_assets.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM accounts WHERE id IN (991, 992, 993, 994)")
    cursor.execute("DELETE FROM transactions WHERE account_id IN (991, 992, 993, 994)")
    cursor.execute("DELETE FROM account_snapshots WHERE account_id IN (991, 992, 993, 994)")
    conn.commit()
    conn.close()

def run_e2e():
    """Playwright를 이용한 신규 스냅샷 생성 마법사 확정 UI 통합 E2E 테스트."""
    setup_db()
    print("E2E 테스트 시작...")
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
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
            page.screenshot(path=f"{SCREENSHOT_DIR}/step1_initial.png")
            
            # 1단계 기본 정보 입력
            print("2. 1단계: 기본 정보 입력 및 증권 계좌 2개 선택")
            exchange_rate_input = page.locator("input[placeholder='예: 1350.5']")
            exchange_rate_input.fill("1350.5")
            
            # '증권 계좌 1' 및 '증권 계좌 2' 행 선택
            page.locator("tr:has-text('KB증권별칭')").first.click()
            page.locator("tr:has-text('한투증권별칭')").first.click()
            page.screenshot(path=f"{SCREENSHOT_DIR}/step1_filled.png")
            
            # 다음 버튼 클릭
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            
            # 2단계 증권사 상세 입력 (첫 번째 계좌: KB증권별칭)
            print("3. 2단계: 첫 번째 증권사 상세 입력 (KB증권별칭)")
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_brokerage1_initial.png")
            
            # 원화 잔액 필드 입력 (id: krw-balance-991)
            krw_input = page.locator("input[id^='krw-balance-']")
            krw_input.fill("1000000")
            
            # 달러 잔액 필드 입력 (id: usd-balance-991)
            usd_input = page.locator("input[id^='usd-balance-']")
            usd_input.fill("5000.5")
            
            # 정산 결과 계산하기 클릭
            page.locator("button:has-text('정산 결과 계산하기')").click()
            page.wait_for_timeout(2500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_brokerage1_calculated.png")
            
            # 이 결과로 확정 클릭
            print("첫 번째 증권계좌 정산결과 확정 클릭")
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(1000)
            
            # 확정 시 자동으로 두 번째 계좌(한투증권별칭)로 전환되어야 함
            print("4. 두 번째 증권사 상세 입력으로 자동 이동 확인 (한투증권별칭)")
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_brokerage2_initial.png")
            
            # 한투증권별칭 계좌 정보 입력 및 계산
            krw_input2 = page.locator("input[id^='krw-balance-']")
            krw_input2.fill("500000")
            page.locator("button:has-text('정산 결과 계산하기')").click()
            page.wait_for_timeout(2500)
            
            # 이 결과로 확정 클릭
            print("두 번째 증권계좌 정산결과 확정 클릭")
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_brokerage2_confirmed.png")
            
            # --- 이전/다음 계좌 이동 시 확정 상태 유지 검증 ---
            print("5. 이전 버튼 클릭하여 첫 번째 증권계좌로 복귀 및 확정 상태 유지 검증")
            page.locator("button:has-text('이전')").click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_brokerage1_returned.png")
            
            # 요약 카드가 제대로 표시되는지 검증
            assert page.locator("text=정산 결과 확정 완료").is_visible(), "이전 계좌 복귀 시 확정 요약 카드가 보이지 않음"
            assert page.locator("text=수정하기").is_visible(), "이전 계좌 복귀 시 수정하기 버튼이 보이지 않음"
            assert page.locator("text=1,000,000원").first.is_visible(), "확정된 원화 예수금 요약값이 보이지 않음"
            
            # 수정하기 버튼 클릭 시 폼이 다시 복구되는지 검증
            print("첫 번째 증권계좌 수정하기 버튼 클릭")
            page.locator("button:has-text('수정하기')").click()
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_brokerage1_edit.png")
            
            # 원화 잔액 폼이 다시 활성화되는지 검증
            assert page.locator("input[id^='krw-balance-']").is_visible(), "수정하기 클릭 후 잔액 입력 필드가 복구되지 않음"
            
            # 다시 확정
            print("첫 번째 증권계좌 재확정")
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(1000)
            
            # 다음 클릭하여 Step 3로 이동 (두 증권계좌 모두 확정되었으므로 Step 3로 진행 가능)
            print("6. 3단계: 은행 계좌 선택으로 이동")
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step3_initial.png")
            
            # 은행 계좌 2개 모두 선택
            page.locator("tr:has-text('국민은행별칭')").first.click()
            page.locator("tr:has-text('신한은행별칭')").first.click()
            page.screenshot(path=f"{SCREENSHOT_DIR}/step3_filled.png")
            
            # 다음 클릭
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            
            # 4단계 은행 상세 입력 (첫 번째 은행: 국민은행별칭)
            print("7. 4단계: 첫 번째 은행 상세 입력 (국민은행별칭)")
            page.screenshot(path=f"{SCREENSHOT_DIR}/step4_bank1_initial.png")
            
            # 예상 잔액 계산하기 클릭
            page.locator("button:has-text('예상 잔액 계산하기')").click()
            page.wait_for_timeout(2500)
            
            # 최종 잔액 입력
            final_input1 = page.locator("input[id^='total-valuation-']")
            final_input1.fill("3000500")
            
            # 이 결과로 확정 클릭
            print("첫 번째 은행계좌 정산결과 확정 클릭")
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(1000)
            
            # 두 번째 은행(신한은행별칭)으로 자동 이동 확인
            print("8. 두 번째 은행사 상세 입력으로 자동 이동 확인 (신한은행별칭)")
            page.screenshot(path=f"{SCREENSHOT_DIR}/step4_bank2_initial.png")
            
            # 두 번째 은행 잔고 계산 및 확정
            page.locator("button:has-text('예상 잔액 계산하기')").click()
            page.wait_for_timeout(2500)
            final_input2 = page.locator("input[id^='total-valuation-']")
            final_input2.fill("1500000")
            
            print("두 번째 은행계좌 정산결과 확정 클릭")
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step4_bank2_confirmed.png")
            
            # --- 은행 계좌 이전 이동 및 확정 상태 유지 검증 ---
            print("9. 이전 버튼 클릭하여 첫 번째 은행계좌로 복귀 및 확정 상태 유지 검증")
            page.locator("button:has-text('이전')").click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step4_bank1_returned.png")
            
            # 은행 요약 카드 검증
            assert page.locator("text=정산 결과 확정 완료").is_visible(), "이전 은행 복귀 시 확정 요약 카드가 보이지 않음"
            assert page.locator("text=수정하기").is_visible(), "이전 은행 복귀 시 수정하기 버튼이 보이지 않음"
            assert page.locator("text=3,000,500원").first.is_visible(), "확정된 최종 잔액 요약값이 보이지 않음"
            
            # 수정하기 클릭 및 복구 검증
            print("첫 번째 은행계좌 수정하기 버튼 클릭")
            page.locator("button:has-text('수정하기')").click()
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step4_bank1_edit.png")
            
            assert page.locator("input[id^='total-valuation-']").is_visible(), "수정하기 클릭 후 최종 잔액 입력 필드가 복구되지 않음"
            
            # 다시 확정
            print("첫 번째 은행계좌 재확정")
            page.locator("button:has-text('이 결과로 확정')").click()
            page.wait_for_timeout(1000)
            
            # 다음 클릭하여 Step 5로 이동
            print("10. 5단계: 최종 확인 및 저장 단계로 이동")
            page.locator("button:has-text('다음')").click()
            page.wait_for_timeout(1500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step5_initial.png")
            
            # 저장하기 클릭
            print("저장하기 클릭...")
            page.locator("button:has-text('저장하기')").click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step5_saved.png")
            
            print("E2E 테스트 성공 완료!")
            
        except Exception as e:
            print(f"E2E 테스트 에러 발생: {e}", file=sys.stderr)
            page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
            sys.exit(1)
        finally:
            browser.close()
            teardown_db()

if __name__ == "__main__":
    run_e2e()
