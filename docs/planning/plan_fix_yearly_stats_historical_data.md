# 작업 계획서: 연도별 현황 과거 데이터 복구 (PLAN_FIX_YEARLY_STATS_HISTORICAL_DATA)

## 1. 개요
비활성 계좌의 역사적 데이터를 연도별 현황 통계에 다시 포함시켜, 포트폴리오의 정확한 시계열 성과를 복구함.

## 2. 작업 절차

### 테스크 1: 테스트 케이스 수정 및 실패 확인 (RED)
- `tests/test_dashboard_filter.py` 내의 `test_get_yearly_stats_filters_inactive_accounts` 수정.
- 비활성 계좌의 데이터가 연도별 통계(contribution, assets)에 합산되어야 함을 기대값으로 설정 (예: 100,000 + 50,000 = 150,000).
- `pytest tests/test_dashboard_filter.py`를 실행하여 테스트 실패 확인.

### 테스크 2: 백엔드 로직 수정 (GREEN)
- `src/backend/services/dashboard_service.py` 수정.
- `get_yearly_stats` 메서드 내:
    - `Transaction` 조회 시 `Account.is_active == True` 필터 제거.
    - `AccountSnapshot` 조회 시 `Account.is_active == True` 필터 제거.
    - **기말 자산 계산 방식 개선**: 연도 내 마지막 날짜의 모든 계좌 합산 방식에서, **연도 내 각 계좌의 마지막 스냅샷 합산** 방식으로 변경.
- 수정 후 테스트 실행하여 통과 확인.

### 테스크 3: 코드 리팩토링 및 주석 보강 (REFACTOR)
- `get_holdings`와 `get_yearly_stats`의 필터링 정책 차이를 한글 주석으로 상세히 설명.
- `DashboardService`의 관련 메서드 가독성 개선.
- 전체 테스트(`tests/test_dashboard_filter.py`) 재실행 및 검증.

### 테스크 4: E2E 검증
- `dev.py`를 통해 서버 구동.
- 대시보드 페이지에 접속하여 2021~2024년 데이터가 정상적으로 표시되는지 확인.

## 3. 검증 지표
- `test_get_yearly_stats_filters_inactive_accounts` 통과.
- `test_get_holdings_filters_inactive_accounts` 통과 (계좌별 현황은 계속 필터링되어야 함).
- 대시보드 화면상 연도별 현황 데이터 복구 확인.
