# 지출관리 가맹점 키워드 자동분류 규칙 사양서 (Expense Keyword Auto-Classification Rules Spec)

Status: ready-for-agent

## Problem Statement

현재 AssetManager의 지출 관리 시스템은 신용카드 및 계좌 거래 내역 명세서(엑셀, PDF 등)를 업로드할 때 다음과 같은 불편함과 한계가 존재합니다:

1. **전체 거래 수동 카테고리 지정 부담**: 명세서를 파싱하여 미리보기 화면에 띄울 때 모든 거래의 카테고리가 미분류(`None`) 상태로 초기화됩니다. 이로 인해 '쿠팡', '배달의민족', '스타벅스', '대중교통' 등 매달 반복적으로 발생하는 정형화된 가맹점 결제 내역까지 사용자가 매번 일일이 행마다 드롭다운을 열어 카테고리를 선택해야 합니다.
2. **미분류 거래 존재 시 저장 차단으로 인한 피로도**: 시스템은 데이터 무결성을 위해 카테고리가 지정되지 않은 거래가 단 1건이라도 남아있으면 저장을 원천 차단(`HTTP 400`)합니다. 따라서 한 달 치 수십~수백 건의 거래를 업로드할 때 사용자는 엄청난 반복 수작업 피로를 겪게 됩니다.
3. **카드대금 및 내부 이체 등 통계 제외 거래 수동 체크 반복**: '카드대금 결제', '선결제', '타계좌 이체' 등 생활비 지출 통계에서 제외되어야 하는 거래 역시 매번 미리보기 테이블에서 사용자가 수동으로 체크박스를 찾아 클릭해야 하므로 누락이나 오분류의 위험이 큽니다.
4. **분류 규칙 관리 기능의 부재**: 사용자가 자주 이용하는 가맹점을 특정 카테고리로 맵핑하거나 통계 제외 대상으로 등록해두고 재사용할 수 있는 규칙 마스터 관리 체계가 전혀 구현되어 있지 않습니다.

## Solution

1. **가맹점 키워드 자동분류 규칙 마스터 체계 도입**:
   - 가맹점명(`merchant`) 키워드와 적용할 카테고리(또는 통계 제외 여부)를 등록·관리하는 독립적인 규칙 데이터 모델을 구축합니다.
   - 키워드는 대소문자 구분 없이(Case-Insensitive) 가맹점명에 포함(Partial substring match)되어 있는지를 검사합니다.
   - 모든 결제수단 및 소유주에 전역(Global) 공통 적용하여 규칙 관리의 단순성과 일관성을 확보합니다.
2. **두 가지 규칙 유형 지원 (카테고리 지정 vs 통계 제외 전용)**:
   - **카테고리 자동 지정 규칙**: 키워드 매칭 시 설정된 카테고리를 거래의 카테고리로 자동 주입합니다 (`is_excluded = False`).
   - **통계 제외 자동 지정 규칙**: '카드대금', '환불' 등 생활비 통계에 포함되지 않아야 하는 거래에 대해 카테고리 설정 없이도 `is_excluded = True`를 자동으로 체크합니다.
3. **더 구체적인 키워드 우선 적용 (Longest Match Priority)**:
   - 하나의 가맹점명에 여러 규칙 키워드가 동시에 일치할 경우, 문자열 길이가 더 긴(더 구체적인) 키워드를 우선 적용합니다 (예: '쿠팡이츠' 매칭 시 '쿠팡'보다 '쿠팡이츠' 카테고리가 우선 적용). 키워드 길이가 같을 경우 최신 등록 규칙을 적용합니다.
4. **명세서 업로드 미리보기 연동 및 검토 편의성 극대화**:
   - 사용자가 명세서 파일을 업로드하고 미리보기를 요청하는 시점에 서버 파싱 파이프라인에서 자동으로 등록된 규칙들을 평가하여 카테고리 및 통계 제외 플래그를 기본값으로 채워 전달합니다.
   - 사용자는 미리보기 화면에서 자동 분류된 결과를 시각적으로 확인하고, 필요 시 특정 거래의 카테고리나 제외 여부를 자유롭게 재수정하여 최종 저장할 수 있습니다.
5. **데스크탑 지출관리 전용 모달 UI (`ExpenseRulesModal`) 제공**:
   - 지출관리 메인 페이지 상단 액션 바에 `[자동분류 규칙]` 버튼을 신설하여 결제수단 관리, 카테고리 관리와 동일한 UX 흐름의 전용 관리 모달을 제공합니다.
   - 규칙 검색, 신규 등록, 유형 선택(카테고리 분류 / 통계 제외), 수정 및 삭제 기능을 직관적인 팝업 형태로 제공합니다.
6. **기존 원장 데이터 무결성 보존**:
   - 과거 이미 DB에 확정 적재된 거래 원장 데이터는 변경하지 않고, 신규 명세서 업로드 미리보기 시점에만 규칙을 평가하여 데이터 안전성을 철저히 유지합니다.

## User Stories

1. As a desktop user, I want to open an '자동분류 규칙' management modal from the expense page action header, so that I can view and manage all my keyword mapping rules in one place.
2. As a desktop user, I want to create a new auto-classification rule with a merchant keyword and an expense category, so that transactions matching the keyword are automatically classified upon upload.
3. As a desktop user, I want to create a rule marked as '통계 제외' without picking a category, so that non-living-expense records (such as credit card payment debits or internal account transfers) are automatically excluded from spending totals.
4. As a desktop user, I want the rule keyword matching to be case-insensitive, so that keywords like 'COUPANG' or 'coupang' match regardless of how the merchant name is capitalized in the statement.
5. As a desktop user, I want the rule matching to use substring containment (partial match), so that a keyword like '쿠팡' matches variations such as '(주)쿠팡', '쿠팡페이', or '쿠팡_로켓배송'.
6. As a desktop user, I want longer (more specific) keywords to take precedence over shorter keywords, so that '쿠팡이츠' assigns the meal delivery category rather than the generic shopping category assigned to '쿠팡'.
7. As a desktop user, I want rules to be unique per keyword, so that ambiguous or conflicting duplicate rules for the exact same keyword cannot be saved.
8. As a desktop user, I want leading and trailing whitespace to be automatically trimmed from rule keywords upon saving, preventing unintended matching errors caused by accidental spaces.
9. As a desktop user, I want to search and filter through my existing rules by keyword or category name inside the rules modal, so that I can quickly locate specific rules even as the list grows large.
10. As a desktop user, I want to edit an existing rule's keyword, category, or exclusion status, so that I can update my classification preferences over time.
11. As a desktop user, I want to delete a classification rule with confirmation, so that obsolete or misconfigured rules can be cleanly removed.
12. As a desktop user, I want rules associated with a deleted category to cascade delete safely, so that foreign key integrity is preserved without leaving orphaned rules.
13. As a desktop user, I want rules to apply globally across all payment methods and owners, so that I don't have to duplicate the same rule for each card or family member.
14. As a desktop user, when I upload a statement file and generate a preview, I want matching rules to automatically populate categories and exclusion checkboxes for each transaction row, so that I don't have to manually classify dozens of recurring expenses.
15. As a desktop user, I want unclassified transactions without matching rules to remain unclassified (`category_id = None`), so that I can consciously review and categorize them before commit.
16. As a desktop user, I want to be able to freely change any auto-populated category or exclusion checkbox in the preview table before final commit, so that one-off exceptions can be handled easily.
17. As a desktop user, I want committing the preview to continue enforcing the validation that all non-excluded transactions must have a category, so that no uncategorized expenses slip into the ledger.
18. As a desktop user, I want new or updated rules to apply exclusively to subsequent statement upload previews and leave previously saved ledger transactions untouched, preserving historic transaction integrity.

## Implementation Decisions

### 1. 규칙 마스터 데이터 모델 및 스키마

- **ExpenseRule 엔티티**:
  - `id`: 정수형 고유 식별자 (PK)
  - `keyword`: 문자열, 고유 인덱스 (Unique, Index), 필수, 소문자 정규화 비교 대상
  - `category_id`: 정수형 외래키 (`expense_categories.id`, `ondelete='CASCADE'`), 통계 제외 규칙인 경우 Nullable
  - `is_excluded`: 불리언, 기본값 False, 통계 제외 규칙인 경우 True
  - `created_at`: 생성 일시
- **규칙 등록/수정 유효성 검증**:
  - `keyword`의 앞뒤 공백을 자동으로 trim하며 공백 문자열 등록 불가.
  - `is_excluded`가 False인 경우 `category_id`는 필수값이어야 함.
  - `is_excluded`가 True인 경우 `category_id`는 None으로 강제 정리.
  - 동일한 `keyword`가 이미 존재하는 경우 `HTTP 409 Conflict` 또는 `HTTP 400 Bad Request` 반환.

### 2. 백엔드 API 계약

- **`GET /api/expenses/rules`**:
  - 등록된 모든 규칙 목록 반환.
  - 응답 아이템은 규칙 ID, 키워드, 카테고리 ID, 카테고리명, 카테고리 색상, 통계 제외 여부, 등록 일시를 포함.
  - 정렬 기준: 키워드 문자열 길이 내림차순(더 긴 키워드 우선), 길이 동일 시 최신 등록일자 내림차순.
- **`POST /api/expenses/rules`**:
  - 신규 규칙 등록. 입력 페이로드 검증 후 생성된 규칙 객체 반환 (`HTTP 201 Created`).
- **`PUT /api/expenses/rules/{rule_id}`**:
  - 기존 규칙의 키워드, 카테고리, 통계 제외 여부 갱신.
- **`DELETE /api/expenses/rules/{rule_id}`**:
  - 기존 규칙 삭제. 성공 시 204 No Content 또는 성공 메시지 반환.

### 3. 명세서 업로드 미리보기 파이프라인 연동 (`upload-preview`)

- **파싱 후 규칙 자동 매칭 단계**:
  - `POST /api/expenses/upload-preview` 요청 처리 시, 파일 파서로부터 원시 거래 리스트를 수신한 직후 DB에서 활성 `ExpenseRule` 전체 목록을 정렬(길이 역순) 상태로 인출.
  - 각 거래의 `merchant` 문자열을 소문자로 변환한 뒤, 규칙 리스트를 순회하며 `rule.keyword.lower() in merchant_lower` 여부를 최초 일치(First Match) 방식으로 검사.
  - 매칭 성공 시:
    - `rule.is_excluded == True`: 해당 거래의 `is_excluded = True`, `category_id = None` 설정.
    - `rule.is_excluded == False`: 해당 거래의 `is_excluded = False`, `category_id = rule.category_id` 설정.
  - 매칭되는 규칙이 없는 경우:
    - 기본값 `is_excluded = False`, `category_id = None` 설정 (기존 동작 유지).
- **프리뷰 및 확정 커밋 무결성**:
  - 미리보기 테이블에서 사용자가 각 행의 카테고리나 제외 체크박스를 수정하면 해당 변경값이 커밋 페이로드로 전송됨.
  - `/api/expenses/commit` 단계에서는 기존과 동일하게 유효 지출(`not is_excluded`) 중 카테고리가 없는 항목이 있을 시 저장을 차단.

### 4. 프론트엔드 UI/UX 구성

- **`ExpenseRulesModal` 컴포넌트**:
  - 결제수단 및 카테고리 모달과 통일된 디자인 시스템(다크 모드 카드/테이블 스타일) 적용.
  - 상단: 모달 타이틀, 실시간 키워드 검색창, '규칙 추가' 버튼.
  - 등록/수정 폼:
    - 키워드 입력 필드 (예: '쿠팡', '스타벅스', '신한카드대금')
    - 규칙 동작 라디오/버튼 그룹: `[카테고리 자동분류]` vs `[통계 제외 처리]`
    - `[카테고리 자동분류]` 선택 시 카테고리 드롭다운 활성화 및 필수 선택.
    - `[통계 제외 처리]` 선택 시 카테고리 선택 비활성화 및 '통계 집계에서 자동 제외됩니다' 안내 문구 표시.
  - 규칙 목록 테이블:
    - 키워드 뱃지 (가맹점 포함 매칭)
    - 매칭 결과: 카테고리 태그(컬러 닷 포함) 또는 '통계 제외' 경고 뱃지
    - 등록일시 및 수정/삭제 액션 버튼
- **`ExpensesPage` 헤더 통합**:
  - 상단 액션 버튼 그룹(`[명세서 업로드]`, `[결제수단 관리]`, `[카테고리 관리]`) 옆에 `[자동분류 규칙]` 버튼 배치.
  - 클릭 시 `ExpenseRulesModal`을 오픈하고, 규칙 변경 시 업로드 모달의 최신 규칙 반영을 보장.
- **`expenseService` 프론트엔드 서비스 레이어**:
  - `getRules()`, `createRule(data)`, `updateRule(id, data)`, `deleteRule(id)` 메서드 추가.

## Testing Decisions

### Good Test Principles
- 구현 세부사항(내부 루프나 특정 변수명)이 아닌 **외부 관찰 가능한 동작(API 계약, HTTP 상태 코드, DB 영속성, UI 컴포넌트 이벤트 및 렌더링 결과)**을 검증합니다.
- 테스트 환경은 실제 운영 DB에 영향을 주지 않도록 SQLite 인메모리 세션 및 격리된 테스트 클라이언트를 사용합니다.

### Modules to Test
1. **백엔드 규칙 CRUD 및 무결성 테스트 (`tests/test_expense_rules.py`)**:
   - 규칙 등록 성공 케이스 (카테고리 지정 규칙 및 통계 제외 규칙).
   - 중복 키워드 등록 시 에러 반환 검증.
   - 키워드 공백 자동 trim 검증.
   - 규칙 수정 및 삭제 검증.
   - 카테고리 삭제 시 연관 규칙 Cascade 삭제 검증.
2. **백엔드 업로드 미리보기 매칭 테스트 (`tests/test_expense_preview_matching.py`)**:
   - 단일 키워드 매칭 시 `category_id` 자동 주입 검증.
   - 통계 제외 키워드 매칭 시 `is_excluded = True` 자동 주입 검증.
   - 키워드 길이 우선순위 검증 ('쿠팡이츠' vs '쿠팡' 공존 시 '쿠팡이츠' 가맹점에 대해 '쿠팡이츠' 카테고리가 매칭되는지 확인).
   - 대소문자 무관 매칭 검증 ('starbucks' 키워드가 'STARBUCKS 강남점'에 매칭).
   - 매칭되지 않은 가맹점은 미분류 유지 검증.
3. **프론트엔드 컴포넌트 테스트 (`ExpenseRulesModal.test.jsx`)**:
   - 규칙 목록 조회 및 테이블 렌더링.
   - 폼 입력 및 등록 API 호출 트리거.
   - 카테고리 분류 / 통계 제외 토글 동작에 따른 카테고리 필드 활성/비활성 검증.
   - 수정 모드 전환 및 삭제 핸들러 호출 검증.
4. **E2E 검증**:
   - `uv run scripts/dev.py`로 격리 개발 서버 구동.
   - 데스크탑 웹에서 `[자동분류 규칙]` 모달을 열어 규칙 생성.
   - 실제 엑셀/명세서 업로드 시 미리보기 테이블에 규칙이 적용되어 표시되는지 브라우저에서 시각적 확인 및 확정 저장 검증.

### Prior Art
- 결제수단 및 카테고리 CRUD: `tests/test_expenses.py`, `src/frontend/src/components/ExpenseCategoriesModal.jsx`
- 명세서 업로드 및 커밋 파이프라인: `tests/test_expense_commit.py`, `src/frontend/src/components/ExpenseUploadModal.jsx`

## Out of Scope

- 정규표현식(Regex) 또는 복합 조건(결제수단별/소유주별 조건 분기) 매칭 지원 (추후 필요 시 확장 검토).
- 과거 이미 저장된 기존 거래 원장에 대한 일괄 소급 분류 기능 (과거 데이터 안전성 보존을 위해 제외).
- 업로드 미리보기 테이블 내에서 바로 신규 규칙을 즉석 등록하는 원클릭 인라인 학습 UI (복잡도 최소화를 위해 상단 전용 모달에서만 관리).
- 모바일 전용 규칙 관리 UI (명세서 업로드 및 마스터 관리는 데스크탑 웹 전용으로 일원화 유지).

## Further Notes

- 키워드 매칭은 파싱된 원본 거래가 많은 경우에도 성능 저하가 없도록 메모리상에서 정렬된 규칙 리스트로 1회 순회 평가하므로 수백 건의 거래에서도 수 밀리초 내에 즉각 완료됩니다.
- 추후 규칙이 수백 개 이상으로 방대해질 경우를 대비해 `keyword` 컬럼에 DB 인덱스를 기본 부여합니다.
