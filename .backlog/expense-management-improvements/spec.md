# 지출관리 개선 사양서 (Expense Management Improvements Spec)

Status: ready-for-agent

## Problem Statement

현재 지출관리 시스템은 다음과 같은 사용자 불편과 설계상 불일치가 존재합니다:

1. **결제수단 자동 감지의 불확실성**: 명세서 업로드 시 결제수단 '자동 감지' 기능이 부정확하거나 의도치 않은 결제수단으로 연결될 위험이 있어, 사용자가 직접 확실한 결제수단을 지정하고자 합니다.
2. **비밀번호 관리 정책의 혼선 및 보안상 중복**: 명세서 복호화 비밀번호가 설정 파일(`settings.toml`), 데이터베이스(결제수단 테이블), 업로드 모달 입력창 3곳에 산재해 있습니다. 저장된 기본값을 사용하는 것인지, 매번 입력하는 것인지 동작이 불분명하며 민감한 비밀번호가 설정 파일 및 DB에 평문 저장되는 보안 우려가 있습니다.
3. **단일 카테고리 분류의 한계**: 현재는 단일 카테고리(식비, 쇼핑, 문화 등)만 지원하여, '구독료(넷플릭스/유튜브)'나 '모임회비'처럼 지출의 소비 종류와 지출의 특성(정기 구독, 회비 등)이 동시에 존재하는 거래를 유연하게 관리하거나 집계하기 어렵습니다.

## Solution

1. **결제수단 필수 명시 선택**: 업로드 화면에서 결제수단 자동 감지 옵션을 완전히 제거하고, 사용자가 등록된 결제수단을 명시적으로 선택해야만 파싱이 가능하도록 변경합니다. 백엔드 API 역시 결제수단 ID를 필수 매개변수로 요구합니다.
2. **비밀번호 저장 완전 제거 및 1회성 입력 단순화**: 설정 파일 및 결제수단 DB에서 비밀번호 저장 기능을 모두 삭제합니다. 암호화된 명세서(보안 HTML 등) 복호화가 필요할 때만 업로드 모달에서 일회성으로 직접 입력받아 처리하도록 정책을 단순화하고 보안을 강화합니다.
3. **카테고리 2분할 (독립 2-축 구조 구축)**:
   - **1차 카테고리 (지출 종류 - 필수)**: 식비/카페, 쇼핑, 주거/통신, 교통/차량, 문화/여가, 의료/건강, 금융/보험, 생활/기타 등 기존 분류 체계 유지.
   - **2차 카테고리 (지출 특성/태그 - 선택)**: '구독료', '모임회비'를 초기 기본 항목으로 제공하고, 사용자가 자유롭게 추가/수정/삭제 가능한 마스터 관리 체계를 신설합니다.
   - 거래 내역 및 대시보드에서 2차 카테고리 태그 뱃지 표시, 인라인 수정, 특성별 필터링 및 요약 집계를 제공합니다.

## User Stories

1. As a user, I want to explicitly select a payment method from the dropdown before uploading a statement, so that my expenses are never attributed to the wrong payment method by auto-detection.
2. As a user, I want the statement parsing button to be disabled until a payment method is chosen, so that I cannot accidentally submit an incomplete upload form.
3. As a user, I want the backend API to reject preview parsing requests lacking a valid payment method ID, so that invalid or ambiguous transactions are never generated.
4. As a user, I want my financial statement passwords to not be stored in configuration files or databases, so that my personal security credentials remain safe and private.
5. As a user, I want payment method management UI and API to not ask for or store passwords, so that setting up payment methods is simple and secure.
6. As a user, I want an optional one-time password input field in the upload modal, so that I can decrypt password-protected statements on demand without saving the password anywhere.
7. As a user, I want to classify expenses by their core consumption type (Primary Category: food, shopping, telecom, etc.), so that I can monitor standard living costs accurately.
8. As a user, I want to optionally attach a secondary characteristic tag (Secondary Category: subscription fee, group dues, etc.) to any expense, so that I can track recurring fixed costs or shared social expenses regardless of the consumption type.
9. As a user, I want two default secondary categories ('구독료', '모임회비') pre-populated in the system, so that I can immediately start categorizing subscriptions and club dues.
10. As a user, I want to add, edit, and delete secondary categories via the category management modal, so that I can customize my characteristic tags over time.
11. As a user, I want to assign both primary and secondary categories to each transaction in the upload preview table, so that imported transactions are properly labeled before committing.
12. As a user, I want to view secondary category tags alongside primary category badges in the main expense ledger table, so that I can identify subscriptions and dues at a glance.
13. As a user, I want to edit secondary categories inline directly within the expense ledger table, so that I can update tags without re-uploading statements.
14. As a user, I want to filter expense records by secondary categories (e.g., 'All', '구독료 only', '모임회비 only') on the dashboard, so that I can focus on specific types of spending.
15. As a user, I want to see summary totals for secondary categories (such as total monthly subscription costs) on the dashboard, so that I can evaluate recurring financial commitments quickly.

## Implementation Decisions

### 1. 결제수단 선택 및 자동 감지 제거
- 업로드 미리보기 요청 인터페이스에서 결제수단 식별자(ID)를 필수 필드로 전환.
- 파서 서비스 및 라우터에서 파일 내용이나 계좌번호 기반으로 결제수단을 추론하던 기존 매칭 로직을 제거.
- 클라이언트 업로드 모달의 결제수단 드롭다운에서 '자동 감지' 옵션을 제거하고 플레이스홀더('결제수단 선택 필수')로 대체. 결제수단 미선택 시 파싱 요청 차단.

### 2. 복호화 비밀번호 관리 정책 개편
- 시스템 설정 파일 스키마에서 지출 복호화 기본 비밀번호 필드 제거.
- 결제수단 데이터 모델 및 스키마에서 기본 비밀번호 속성 제거.
- 결제수단 관리 사용자 인터페이스의 폼 및 테이블에서 비밀번호 입력/표시 항목 제거.
- 업로드 미리보기 처리 시 오직 클라이언트가 요청으로 전달한 비밀번호 문자열만을 사용하여 명세서 복호화를 수행하도록 수정.

### 3. 카테고리 2분할 모델 (독립 2-축 구조)
- **2차 카테고리 마스터 데이터 모델 (`ExpenseSubCategory`) 신설**:
  - 속성: 고유 식별자, 이름, 색상/스타일 태그, 기본값 여부, 생성일시.
  - 시스템 초기화 시 '구독료', '모임회비' 2개 항목을 기본 등록.
- **지출 원장 모델 (`Expense`) 확장**:
  - `sub_category_id` (외래키, Nullable) 속성 추가.
- **카테고리 관리 인터페이스 개선**:
  - 카테고리 모달 내 탭 전환을 통해 '1차 카테고리(지출 종류)'와 '2차 카테고리(지출 특성)'를 독립적으로 CRUD 관리.
- **업로드 미리보기 및 원장 인터페이스 반영**:
  - 미리보기 테이블 및 거래 원장 테이블에 2차 카테고리 선택 컬럼 추가.
  - 대시보드 통계 응답 스키마에 2차 카테고리별 합계 집계 항목 추가 및 필터 컴포넌트 연동.

## Testing Decisions

### What makes a good test
- 내부 구현 세부사항(특정 함수 호출 등)이 아닌 외부 노출 인터페이스(REST API 엔드포인트 응답 및 컴포넌트 사용자 인터랙션)의 동작을 검증합니다.
- 결제수단 미선택 시 올바른 4xx 유효성 검증 에러 및 버튼 비활성화 확인.
- 비밀번호 미입력/입력 시 복호화 분기 검증.
- 1차/2차 카테고리 연동 CRUD 및 거래 원장 반영 여부 검증.

### Modules to be tested
- **백엔드 API 테스트 (`pytest`)**:
  - 결제수단 필수 파라미터 유효성 검사 및 업로드 미리보기 엔드포인트.
  - 비밀번호 제거에 따른 결제수단 CRUD 엔드포인트 정상 동작.
  - 2차 카테고리 CRUD 엔드포인트 및 지출 원장 커밋/수정 시 2차 카테고리 저장/조회 검증.
  - 2차 카테고리 필터링 및 통계 집계 API 검증.
- **프론트엔드 컴포넌트 테스트 (`Vitest` + React Testing Library)**:
  - 명세서 업로드 모달: 결제수단 미선택 시 파싱 비활성화 및 선택 후 파싱 호출 검증.
  - 결제수단 관리 모달: 비밀번호 필드가 노출되지 않고 정상 CRUD 수행 검증.
  - 카테고리 관리 모달: 1차/2차 카테고리 탭 전환 및 2차 카테고리 추가/수정/삭제 검증.
  - 지출 원장 및 대시보드: 2차 카테고리 뱃지 렌더링 및 필터링 동작 검증.

### Prior art
- `tests/test_expenses.py` (지출 API 통합 테스트)
- `src/frontend/src/components/ExpenseUploadModal.test.jsx`
- `src/frontend/src/components/PaymentMethodsModal.test.jsx`
- `src/frontend/src/components/ExpenseCategoriesModal.test.jsx`
- `src/frontend/src/pages/ExpensesPage.test.jsx`

## Out of Scope

- 카카오뱅크/현대카드 외의 신규 금융기관/카드사 명세서 파서 추가.
- 머신러닝/AI 기반 2차 카테고리 자동 분류 모델 구축 (현재는 수동 선택 또는 간단한 키워드 매칭 규칙 수준만 지원).
- 모바일 전용 반응형 레이아웃 전면 개편.

## Further Notes

- 기존에 `payment_methods` 테이블에 남아있는 `default_password` 컬럼은 마이그레이션 스크립트를 통해 안전하게 정리하거나 호환성을 위해 모델에서 제외합니다.
- 현재 `expenses` 테이블 데이터 건수는 0건이므로 스키마 변경에 따른 기존 거래 데이터 유실 위험 없이 안전하게 적용 가능합니다.
