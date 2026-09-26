# 지출 관리 카테고리 단일화 및 검토 프로세스 개편 사양서 (Expense Category Unification Spec)

Status: ready-for-agent

## Problem Statement

현재 지출 관리 시스템은 1차 카테고리(지출 종류: 식비, 쇼핑 등)와 2차 카테고리(지출 특성: 구독료, 모임회비 등)를 2중으로 운영하고 있으나, 사용자 관점에서 다음과 같은 불편과 문제가 발생하고 있습니다:

1. **불필요한 2중 카테고리 관리 복잡도**: 지출 거래를 입력하거나 명세서를 검토할 때 1차 카테고리와 2차 카테고리를 각각 선택해야 하므로 입력 피로도가 높고, '구독료'나 '모임회비' 또한 하나의 지출 카테고리로 관리하면 충분하므로 굳이 2중으로 나눌 필요성이 없습니다.
2. **불완전하고 혼란스러운 자동 감지**: 명세서 업로드 시 가맹점명 기반 키워드로 카테고리를 추측하거나 카드대금을 자동 제외하는 로직이 완벽하지 않아, 사용자가 의도하지 않은 카테고리로 자동 지정되거나 오분류되는 문제가 있습니다.
3. **미분류 거래 누락 위험**: 명세서 업로드 시 카테고리가 미분류된 상태로 무심코 '저장' 버튼을 누르면, 미분류 지출 데이터가 그대로 원장에 기록되어 통계가 왜곡될 위험이 있습니다.
4. **통계 제외 거래에 대한 불필요한 카테고리 선택**: 카드대금이나 타행이체처럼 통계에서 제외할 거래임에도 카테고리 선택 드롭다운이 활성화되어 있어 불필요한 입력을 유도하거나 혼선을 줍니다.

## Solution

1. **단일 카테고리 체계로 전면 일원화**:
   - 2차 카테고리(특성/태그) 마스터 및 관련 체계를 완전히 폐지합니다.
   - 기존 2차 카테고리 항목('구독료', '모임회비')을 단일 카테고리 마스터 테이블의 정규 카테고리로 통합하여, 하나의 카테고리 선택만으로 모든 지출을 관리합니다.
2. **100% 사용자 명시적 검토 기반 업로드 프로세스**:
   - 명세서 업로드 시 모든 키워드 기반 카테고리 자동 추천 및 카드대금 자동 제외 처리를 완전히 제거합니다.
   - 업로드 직후 모든 거래는 초기값으로 **카테고리 '미분류(선택 안 됨)'**, **통계 상태 '통계 반영(미체크)'**으로 노출되어 사용자가 거래를 직접 눈으로 확인하고 결정하도록 합니다.
3. **통계 제외 거래 카테고리 비활성화**:
   - 사용자가 '통계 제외' 체크박스를 체크한 행은 카테고리 선택 드롭다운이 자동으로 `disabled`되어 불필요한 카테고리 입력을 방지합니다.
4. **미분류 거래 DB 저장 원천 차단**:
   - 통계에 반영되는 유효 지출 중 카테고리가 '미분류'인 거래가 1건이라도 남아있으면 '확정 및 저장' 버튼이 비활성화되며 안내 경고가 표시됩니다.
   - 백엔드 커밋 API에서도 미분류 항목이 존재할 경우 `400 Bad Request` 에러를 반환하여 잘못된 저장을 철저히 방어합니다.
5. **대시보드 및 원장 사용자 인터페이스 단순화**:
   - 카테고리 관리 모달에서 탭 UI를 제거하고 단일 카테고리 목록(추가/수정/삭제) 화면으로 단순화합니다.
   - 대시보드 상단의 '지출 특성 요약(구독료 등)' 배너, 2차 카테고리 필터, 원장 테이블의 2차 카테고리 열을 모두 제거하여 화면을 직관적으로 정돈합니다.

## User Stories

1. As a user, I want a single unified expense category system, so that I don't have to classify every expense twice into primary and secondary categories.
2. As a user, I want '구독료' and '모임회비' to be regular categories in the category list, so that I can categorize recurring subscriptions and club dues directly without needing a separate tag system.
3. As a user, I want the category management modal to present a single list without tabs, so that I can easily create, edit, and delete expense categories in one place.
4. As a user, I want uploaded statement transactions to start with an unclassified category state, so that I am never misled by incorrect automated guesses.
5. As a user, I want uploaded statement transactions to default to included in statistics (unchecked for exclusion), so that I can consciously verify and check card payment exclusions myself.
6. As a user, I want the category dropdown to be disabled whenever a transaction is marked as excluded, so that I do not waste effort categorizing transactions that won't be counted in my spending stats.
7. As a user, I want the category dropdown to become enabled again if I uncheck exclusion on a transaction, so that I can assign a category if it was previously excluded by mistake.
8. As a user, I want the 'Commit and Save' button in the upload modal to be disabled if any included transaction remains unclassified, so that I cannot accidentally commit incomplete transactions to my ledger.
9. As a user, I want a clear warning banner showing the exact count of unclassified transactions, so that I immediately know how many items still need my review.
10. As a user, I want the 'Commit and Save' button to become enabled only after every included transaction has an assigned category, so that I have complete confidence in the integrity of my ledger.
11. As a user, I want the backend API to strictly reject commit payloads containing unclassified included transactions, so that direct API calls or unexpected UI glitches cannot corrupt my database.
12. As a user, I want the expense ledger table to have a single category column without secondary category badges or dropdowns, so that the table layout is clean, compact, and easy to read.
13. As a user, I want the category dropdown in the ledger table to be disabled for excluded transactions, so that ledger editing adheres to the same rules as the upload flow.
14. As a user, I want the dashboard filter toolbar to have only a single category filter dropdown, so that filtering transactions by spending category is straightforward.
15. As a user, I want spending on '구독료' and '모임회비' to appear naturally within the main category donut chart and breakdown legend, so that all category distributions can be analyzed together in one comprehensive chart.
16. As a user, I want the redundant secondary category summary banner removed from the dashboard header, so that vertical space is conserved for primary financial metrics and trends.
17. As a user, I want existing default categories plus '구독료' and '모임회비' to be safely preserved during database updates, so that no previous categorization work is lost.

## Implementation Decisions

### 1. 카테고리 데이터 모델 및 스키마 일원화
- **2차 카테고리 체계 폐지**:
  - 2차 카테고리 마스터 엔티티(`ExpenseSubCategory`)를 완전히 삭제합니다.
  - 지출 원장 엔티티(`Expense`)에서 2차 카테고리 외래키(`sub_category_id`) 및 연관 관계를 제거합니다.
- **카테고리 마스터 기본값 확장**:
  - 기본 카테고리 목록(식비/카페, 쇼핑, 주거/통신, 교통/차량, 문화/여가, 의료/건강, 금융/보험, 생활/기타)에 '구독료'(#8B5CF6), '모임회비'(#EC4899)를 기본 카테고리로 편입합니다.
- **API 스키마 정돈**:
  - 요청/응답 스키마에서 2차 카테고리 관련 필드(`sub_category_id`, `sub_category_name`, `sub_category_color`, `sub_category`)를 모두 제거합니다.
  - 통계 응답 스키마에서 2차 카테고리 집계(`sub_category_breakdown`) 필드를 제거합니다.

### 2. 백엔드 API 라우터 및 검증 로직 개편
- **2차 카테고리 전용 엔드포인트 삭제**:
  - 2차 카테고리 CRUD 엔드포인트(`/api/expenses/sub-categories*`)를 완전히 제거합니다.
- **업로드 미리보기 로직 단순화 (`POST /api/expenses/upload-preview`)**:
  - 가맹점명 및 적요 기반의 카테고리 자동 추론(키워드 매칭) 로직을 전면 제거합니다.
  - 카드대금, 타행이체 등 키워드 기반의 통계 제외 자동 감지 로직을 전면 제거합니다.
  - 반환되는 모든 거래의 `category_id`는 `None`(미분류), `is_excluded`는 `False`(통계 반영 기본)로 고정합니다.
- **거래 커밋 유효성 검증 (`POST /api/expenses/commit`)**:
  - 페이로드 내 항목 중 `not item.is_excluded`이면서 `item.category_id`가 지정되지 않은 항목(`None` 또는 `<= 0`)이 1건이라도 존재하면 즉시 `400 Bad Request` 예외를 발생시키고 저장 트랜잭션을 중단합니다.
- **거래 목록 및 통계 API (`GET /api/expenses`, `GET /api/expenses/stats`)**:
  - `sub_category_id` 필터 매개변수를 제거하고 단일 `category_id` 필터만 유지합니다.

### 3. 프론트엔드 컴포넌트 및 인터랙션 단순화
- **카테고리 관리 모달 (`ExpenseCategoriesModal`)**:
  - 1차/2차 탭 네비게이션을 제거하고 단일 카테고리 목록 관리 UI로 변경합니다.
- **명세서 업로드 모달 (`ExpenseUploadModal`)**:
  - 미리보기 테이블에서 2차 카테고리 열을 제거합니다.
  - 각 거래의 '통계 제외' 체크박스가 체크되면 카테고리 셀렉트를 `disabled` 처리합니다.
  - 통계 반영 거래 중 `category_id`가 선택되지 않은 건수를 실시간 계산하여, 미분류 건수가 0이 아닐 경우 '확정 및 저장' 버튼을 `disabled` 처리하고 경고 문구를 표시합니다.
- **지출 메인 대시보드 (`ExpensesPage`)**:
  - 상단 KPI 영역 하단의 '지출 특성 요약(구독료 등)' 배너를 제거합니다.
  - 필터 툴바에서 2차 카테고리 필터 드롭다운을 제거합니다.
  - 거래 원장 테이블에서 2차 카테고리 태그 뱃지 및 인라인 셀렉트 열을 제거합니다.
  - 원장 테이블에서도 `is_excluded`가 참인 거래는 카테고리 셀렉트를 `disabled` 처리합니다.
- **API 클라이언트 서비스 (`expenseService`)**:
  - 2차 카테고리 관련 API 호출 메서드를 정리합니다.

## Testing Decisions

### What makes a good test
- 내부 구현 세부사항(내부 헬퍼 함수나 컴포넌트 내부 상태 등)이 아닌, 외부로 노출된 인터페이스(HTTP API 요청/응답 결과, 사용자가 브라우저에서 수행하는 인터랙션 및 화면 렌더링)의 동작을 블랙박스 관점에서 검증합니다.
- 변경 전후의 데이터 정합성이 완벽히 유지되는지 확인합니다.

### Modules to be tested
1. **백엔드 API 테스트 (`pytest`)**:
   - `POST /api/expenses/upload-preview`: 명세서 파일 업로드 시 모든 거래가 `category_id=None`, `is_excluded=False`로 반환되는지 검증.
   - `POST /api/expenses/commit`:
     - 미분류 유효 지출이 포함된 경우 400 Bad Request 실패 응답 검증.
     - 통계 제외 항목은 카테고리가 없어도 저장 성공 검증.
     - 모든 유효 지출에 카테고리가 지정되었을 때 정상 200 저장 성공 검증.
   - `GET /api/expenses/categories`: 단일 카테고리 마스터('구독료', '모임회비' 포함) CRUD 동작 검증.
   - `GET /api/expenses/stats`: 통계 응답 스키마가 단일 카테고리 집계만 깔끔하게 반환하는지 검증.
2. **프론트엔드 컴포넌트 테스트 (`Vitest` + React Testing Library)**:
   - `ExpenseCategoriesModal.test.jsx`: 탭 없이 단일 카테고리 목록 표시 및 추가/수정/삭제 인터랙션 검증.
   - `ExpenseUploadModal.test.jsx`:
     - 미분류 거래 존재 시 확정 버튼 비활성화 및 안내 배너 노출 검증.
     - 통계 제외 체크 시 해당 행의 카테고리 셀렉트 비활성화 검증.
     - 모든 유효 거래 카테고리 선택 후 확정 버튼 활성화 및 커밋 호출 검증.
   - `ExpensesPage.test.jsx`: 2차 카테고리 배너/필터/컬럼이 제거된 상태에서 원장 조회 및 단일 카테고리 필터링 정상 동작 검증.
3. **E2E 통합 검증**:
   - 실제 브라우저 환경에서 명세서 업로드 $\rightarrow$ 통계 제외 체크 및 카테고리 지정 $\rightarrow$ 미분류 차단 확인 $\rightarrow$ 저장 확정 $\rightarrow$ 대시보드 및 원장 반영 확인.

### Prior art
- `tests/test_expense_upload_flow.py` (명세서 업로드 및 커밋 흐름 테스트)
- `tests/test_expense_schema_and_masters.py` (마스터 스키마 및 CRUD 테스트)
- `src/frontend/src/components/ExpenseUploadModal.test.jsx` (업로드 모달 유효성 및 상태 테스트)
- `src/frontend/src/components/ExpenseCategoriesModal.test.jsx` (카테고리 모달 인터랙션 테스트)
- `src/frontend/src/pages/ExpensesPage.test.jsx` (대시보드 메인 페이지 렌더링 및 필터 테스트)

## Out of Scope

- 카카오뱅크 및 현대카드 외의 신규 금융기관/카드사 명세서 파서 추가.
- 카테고리 자동 추천을 위한 머신러닝/AI 분류 엔진 도입.
- 가계부 예산 설정 및 예산 대비 초과 지출 알림 기능.

## Further Notes

- 데이터베이스 수정 전 반드시 `settings.toml`의 백업 경로에 안전 백업을 생성하고 작업을 진행합니다.
- 기존 개발 및 테스트 데이터베이스에 불필요해진 `expense_sub_categories` 테이블 및 관련 컬럼은 안전하게 정리합니다.
