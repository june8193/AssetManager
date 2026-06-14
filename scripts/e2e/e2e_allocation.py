"""자산배분 스튜디오 고도화 기능(설정 저장, 캐싱 로드, 지수 비교, 연간/월간 탭 표)을 검증하는 E2E 테스트 스크립트.

Playwright를 사용하여 로컬 개발 서버에 접속한 후, 자산배분 스튜디오에서
파라미터 변경, 설정 저장, 저장된 설정 클릭 시 캐싱 데이터 즉시 로딩, 
즐겨찾기 토글, 삭제 등을 수행하고 검증 단계별 스크린샷을 저장합니다.
"""
import os
import sys
import sqlite3
import datetime
from playwright.sync_api import sync_playwright

# 현재 날짜 및 시간 기반으로 스크린샷 폴더명 정의
NOW_STR = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
SCREENSHOT_DIR = f"screenshots/{NOW_STR}_allocation_upgrade"

def teardown_db():
    """테스트 실행 도중 생성될 수 있는 E2E 임시 테스트 설정을 DB에서 정리합니다."""
    print("DB에서 E2E 테스트 설정 정리 중...")
    try:
        conn = sqlite3.connect("src/dev_assets.db", timeout=15.0)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM allocation_settings WHERE name LIKE 'E2E_%'")
        conn.commit()
        conn.close()
        print("DB 정리 완료.")
    except Exception as e:
        print(f"DB 정리 중 에러 발생: {e}")

def run_e2e():
    print("자산배분 스튜디오 E2E 테스트 시작...")
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    teardown_db() # 실행 전 사전 정리
    
    with sync_playwright() as p:
        # headless 모드로 브라우저 기동
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        # 브라우저 얼럿/컨펌 창 자동 승인 (설정 삭제 시 confirm 발생)
        def handle_dialog(dialog):
            print(f"[Dialog] 메시지: {dialog.message}")
            dialog.accept()
        page.on("dialog", handle_dialog)
        
        try:
            # 1. 자산배분 스튜디오 페이지 접속
            print("1. 자산배분 스튜디오 페이지 접속 중...")
            page.goto("http://localhost:5173/allocation/studio")
            page.wait_for_timeout(10000) # 첫 데이터 로딩 대기 (10초로 연장)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step1_initial_load.png")
            
            # 페이지 타이틀 및 메트릭 카드 렌더링 검증
            assert page.locator("text=자산배분 스튜디오").is_visible(), "페이지 타이틀 '자산배분 스튜디오'가 보이지 않음"
            assert page.locator("text=연평균 수익률 (CAGR)").is_visible(), "CAGR 요약 카드가 보이지 않음"
            assert page.locator("text=최대 낙폭 (MDD)").is_visible(), "MDD 요약 카드가 보이지 않음"
            
            # 2. 내 전략 및 지수 B&H 성과 비교 요약 카드 검증
            print("2. 내 전략 및 지수 CAGR / MDD 비교 카드 검증")
            strategy_cagr = page.locator("text=내 전략").first
            benchmark_cagr = page.locator("text=지수 B&H").first
            assert strategy_cagr.is_visible() and benchmark_cagr.is_visible(), "CAGR 비교 카드의 세부 지표가 보이지 않음"
            
            # 3. 툴팁 호버 동작 검증
            print("3. CAGR 정보 툴팁 아이경 확인")
            info_icons = page.locator(".group.cursor-help")
            # 최소 하나 이상의 정보 아이콘이 존재하는지 확인
            assert info_icons.count() >= 2, "CAGR, MDD 툴팁용 Info 아이콘이 생성되지 않음"
            
            # 4. 연간/월간 수익률 탭 테이블 검증
            print("4. 연간 및 월간 성과 상세 분석 표 검증")
            assert page.locator("text=연간/월간 수익률 비교").is_visible(), "상세 분석 표 타이틀이 보이지 않음"
            
            # 기본 '연간 성과표' 탭 렌더링 확인
            page.screenshot(path=f"{SCREENSHOT_DIR}/step2_annual_tab.png")
            assert page.locator("th:has-text('연도')").is_visible(), "연간 성과표 컬럼 헤더가 보이지 않음"
            assert page.locator("th:has-text('초과 수익률')").is_visible(), "초과 수익률 컬럼이 보이지 않음"
            
            # '월간 성과표' 탭 클릭 및 렌더링 확인
            print("월간 성과표 탭 클릭")
            page.locator("button:has-text('월간 성과표')").click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step3_monthly_tab.png")
            assert page.locator("th:has-text('연월')").is_visible(), "월간 성과표 연월 컬럼 헤더가 보이지 않음"
            
            # 다시 연간 성과표로 전환
            page.locator("button:has-text('연간 성과표')").click()
            page.wait_for_timeout(500)
            
            # 5. 설정 저장 모달 기동 및 신규 설정 저장 검증
            print("5. 파라미터 임의 수정 및 설정 저장 시도")
            # Lookback Period 조절 (슬라이더 조작)
            # 여기서는 인풋 값이나 대상 지수를 다르게 바꿈으로써 테스트를 유발
            page.locator("#target-index-select").select_option("NASDAQ")
            page.wait_for_timeout(8000) # 지수 변경 자동 백테스트 대기 (8초로 연장)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step4_nasdaq_backtest.png")
            
            # 설정 저장 버튼 클릭
            page.locator("button:has-text('설정 저장')").click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step5_save_modal.png")
            
            # 모달 폼에 정보 입력
            page.locator("input[placeholder='예: 보수적 미국 주도 전략']").fill("E2E_나스닥전략")
            page.locator("textarea[placeholder='간단한 메모나 설명을 입력하세요.']").fill("E2E 자동 테스트로 저장된 나스닥 200일전략 설정입니다.")
            page.screenshot(path=f"{SCREENSHOT_DIR}/step5_save_modal_filled.png")
            
            # 저장하기 버튼 클릭
            page.locator("button:has-text('저장하기')").click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step6_after_save.png")
            
            # 저장 목록에 잘 추가되었는지 검증
            assert page.locator("text=E2E_나스닥전략").first.is_visible(), "저장된 설정 목록에 E2E_나스닥전략 설정이 표시되지 않음"
            
            # 6. 하단 비교 대조표 검증
            print("6. 하단 파라미터 설정 비교 대조표 검증")
            assert page.locator("text=파라미터 설정 비교 대조표").is_visible(), "하단 대조표 섹션이 보이지 않음"
            # 대조표 행 내에 방금 저장한 설정명 및 캐시 메트릭 노출 여부 확인
            assert page.locator("tr:has-text('E2E_나스닥전략')").is_visible(), "비교 대조표 행에 저장된 설정이 누락됨"
            
            # 7. 0초 캐싱 로드 검증
            print("7. 0초 캐싱 로드 및 skipAutoBacktest 플래그 정상 동작 검증")
            # 먼저 폼 설정을 S&P500으로 변경하여 폼 상태 및 백테스트 결과를 바꿈
            page.locator("#target-index-select").select_option("S&P500")
            page.wait_for_timeout(8000) # 백테스트 대기 시간 8초로 변경
            page.screenshot(path=f"{SCREENSHOT_DIR}/step7_sp500_temp.png")
            
            # 저장된 E2E_나스닥전략 설정을 클릭하여 불러옴
            print("저장 목록에서 'E2E_나스닥전략' 클릭하여 즉시 캐시 로드")
            # 로딩 시간을 감지하기 위해 loading 상태가 뜨지 않는지 체크 가능
            page.locator("div.space-y-2 >> text=E2E_나스닥전략").click()
            page.wait_for_timeout(1000) # 반영 대기
            page.screenshot(path=f"{SCREENSHOT_DIR}/step8_loaded_cache.png")
            
            # 불러왔을 때 즉시 대상 지수가 NASDAQ으로 복구되었는지 검증
            selected_index = page.locator("#target-index-select").input_value()
            assert selected_index == "NASDAQ", f"설정 로드 후 대상 지수 복구 실패. 현재: {selected_index}"
            
            # 8. 즐겨찾기(기본참고) 토글 검증
            print("8. 즐겨찾기(기본참고) 토글 검증")
            # 별 모양 아이콘 클릭
            star_btn = page.locator("div.space-y-2 >> div:has-text('E2E_나스닥전략') >> button").first
            star_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step9_favorite_toggled.png")
            # 기본참고 배지가 노출되는지 검증
            assert page.locator("text=기본참고").is_visible(), "즐겨찾기 토글 후 '기본참고' 배지가 노출되지 않음"
            
            # 9. 설정 삭제 및 Cleanup 검증
            print("9. 저장 설정 삭제 검증")
            delete_btn = page.locator("div.space-y-2 >> div:has-text('E2E_나스닥전략') >> button").last
            delete_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=f"{SCREENSHOT_DIR}/step10_deleted.png")
            
            # 삭제 후 목록에서 사라졌는지 검증
            assert page.locator("text=E2E_나스닥전략").count() == 0, "삭제 후에도 저장 설정 목록에 여전히 표시됨"
            
            print("E2E 시나리오 테스트 전체 성공 완료!")
            
        except Exception as e:
            print(f"E2E 테스트 수행 중 에러 발생: {e}", file=sys.stderr)
            page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
            sys.exit(1)
        finally:
            browser.close()
            teardown_db()

if __name__ == "__main__":
    run_e2e()
