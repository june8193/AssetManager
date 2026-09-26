# Feature Spec: 지출 모니터링 메뉴 신설 및 명세서(현대카드/카카오뱅크) 자동 복호화·등록

Status: ready-for-agent

## Problem Statement

현재 AssetManager는 주식, 계좌 스냅샷, 환율, 벤치마크 등 투자 자산 관리 기능에 집중되어 있어, 일상적인 '소비 및 지출(현대카드 명세서, 카카오뱅크 통장 거래내역)'을 추적하고 모니터링할 수 있는 전용 메뉴가 없습니다.

또한 카드사 명세서(현대카드 보안메일 HTML)와 은행 거래내역(카카오뱅크 통장 엑셀)은 개인정보 보호를 위해 생년월일 비밀번호로 암호화되어 있어, 사용자가 매월 수작업으로 암호를 풀고 데이터를 일일이 옮겨 적는 데 큰 번거로움과 시간 낭비가 발생합니다.

더불어 통장에서 카드대금이 출금되는 내역과 개별 카드 승인 내역이 혼재될 경우 소비 금액이 이중 집계(Double counting)되는 왜곡이 발생할 수 있으며, 현재 본인(장준)의 금융 내역뿐만 아니라 향후 배우자(성은)의 카드/통장 및 지역화폐 내역까지 포괄하여 가구 전체 및 소유주별로 소비를 종합 관리할 수 있는 체계적인 데이터 모델과 사용자 인터페이스가 부재한 상태입니다.

## Solution

1. **사이드바 독립 '지출 관리' 대메뉴 신설 (`/expenses`)**
   - 데스크톱 웹 환경에서 투자 관리와 자연스럽게 연계되면서도 독립적인 전용 지출 모니터링 대시보드 및 원장 관리 화면을 제공합니다.

2. **암호화 명세서(현대카드 HTML / 카카오뱅크 XLSX) 원클릭 드래그앤드롭 복호화 파서 구축**
   - 웹 업로드 모달에서 드래그앤드롭으로 파일을 업로드하면, 사전 설정된 비밀번호(생년월일 6자리)로 자동 복호화하여 거래 데이터를 즉시 추출합니다.
   - 현대카드 VestMail 보안 HTML 및 카카오뱅크 암호화 엑셀을 안전하게 파싱합니다.

3. **결제수단 마스터 (`payment_methods`) 및 다중 소유주(장준, 성은) 지원**
   - 소유주(`장준`, `성은`), 금융기관(`현대카드`, `카카오뱅크`, `지역화폐` 등), 별칭, 계좌/카드 식별번호(`account_number`), 기본 비밀번호를 사용자가 직접 등록/수정/삭제할 수 있는 관리 기능을 제공합니다.
   - 파일 업로드 시 명세서의 고객명과 식별번호를 기반으로 등록된 결제수단에 자동 매칭합니다.

4. **업로드 검토 & 해당 월 데이터 통째로 덮어쓰기(대체) 정책**
   - 파일 업로드 직후 즉시 DB에 넣지 않고, 파싱된 거래 목록을 프리뷰 화면에서 검토할 수 있도록 합니다.
   - 각 거래건별로 카테고리를 지정하고, 통장 내 카드대금 출금건 등은 '통계 제외' 체크박스로 이중 집계를 방지합니다.
   - 동일한 청구월/기간의 명세서를 재업로드할 경우 기존 해당 월 데이터를 통째로 덮어써서 중복 적재 걱정 없이 언제든 최신 명세서로 갱신할 수 있도록 합니다.

5. **사용자 정의 카테고리 관리 (CRUD)**
   - 데스크톱 웹 상에서 사용자가 지출 카테고리(식비, 쇼핑, 주거/통신 등)를 자유롭게 추가, 색상 변경, 수정, 삭제할 수 있도록 지원합니다.

6. **지출 모니터링 대시보드 및 상세 원장 시각화**
   - 상단 소유주 탭(`전체보기`, `장준`, `성은`)을 통해 소유주별 지출을 즉시 필터링합니다.
   - 당월 총지출, 전월 대비 증감율, 최근 6~12개월 월별 지출 추이 바차트, 카테고리별 비중 도넛차트, 결제수단별 지출 비중 카드를 제공합니다.
   - 기간·소유주·결제기관·카테고리 필터 및 검색이 가능한 상세 거래 목록 테이블을 제공하며, 인라인 카테고리 변경, 통계 제외 토글, 개별 삭제가 가능하도록 합니다.

## User Stories

1. As a user, I want a dedicated '지출 관리' menu in the sidebar, so that I can easily navigate to my expense dashboard without cluttering my investment portfolio screens.
2. As a user, I want to see my household's monthly total spending and month-over-month growth rate at the top of the expense dashboard, so that I immediately know our current burn rate.
3. As a user, I want to filter my dashboard and expense records by owner ('전체', '장준', '성은') using tabs, so that I can analyze individual vs household total spending.
4. As a user, I want to drag and drop an encrypted Hyundai Card statement HTML file into the upload modal, so that I don't have to manually open or decrypt the file myself.
5. As a user, I want to drag and drop an encrypted Kakao Bank transaction XLSX file into the upload modal, so that I can import bank transactions without manual copy-pasting.
6. As a user, I want my configured default password (e.g. 950811) to automatically decrypt uploaded statements, so that I don't need to type the password every time.
7. As a user, I want to override or type a different password in the upload modal if needed, so that I can decrypt statements with alternative credentials.
8. As a user, I want to manage payment methods (owner, institution, alias, account number, default password) in a dedicated management modal, so that I can register new bank accounts, credit cards, or local currency cards for myself or my spouse.
9. As a user, I want uploaded statements to automatically match registered payment methods by owner name and account/card identifier, so that I don't have to manually pick the card or bank each time.
10. As a user, I want to preview all extracted transactions in a review modal before saving to the database, so that I can verify amounts, dates, and merchants.
11. As a user, I want to assign categories to each transaction in the upload review modal, so that my expenses are properly categorized from day one.
12. As a user, I want to check or uncheck a '통계 제외' (exclude from stats) checkbox for transactions like credit card bill payments or internal transfers, so that double counting does not distort my spending metrics.
13. As a user, I want re-uploading a statement for an existing billing month to completely overwrite (replace) that month's existing records for that payment method, so that I never have duplicate or partial records.
14. As a user, I want to add, edit, or delete expense categories (with custom names and colors) from a category management modal, so that I can tailor the classification system to my family's needs.
15. As a user, I want to view a monthly spending trend bar chart over the past 6 to 12 months, so that I can identify seasonal spikes or trends in our spending.
16. As a user, I want to see a category spending breakdown donut chart with colored legends, so that I can quickly see what percentage of our budget goes to groceries, dining out, utilities, or shopping.
17. As a user, I want to see summary cards broken down by payment method, so that I know how much was charged to Hyundai Card versus debited from Kakao Bank.
18. As a user, I want a comprehensive transaction table with search, month filter, category filter, and payment method filter, so that I can find specific purchases easily.
19. As a user, I want to change a transaction's category or toggle its '통계 제외' flag inline in the transaction table, so that I can correct mistakes without re-uploading.
20. As a user, I want to delete individual transactions directly from the table, so that I can remove erroneous entries.

## Implementation Decisions

### 1. Database Schema Isolation
기존 투자 자산 관리(주식, 환율, 스냅샷, 거래원장)의 정합성을 보장하기 위해 투자 거래 테이블(`transactions`)과 완전히 분리된 3개의 신규 테이블을 구축합니다.

- **`payment_methods` (결제수단 마스터)**:
  소유주(`owner`), 금융기관(`institution`), 별칭(`alias`), 계좌/카드 식별번호(`account_number`), 기본 복호화 비밀번호(`default_password`), 활성 여부(`is_active`)를 관리합니다.
- **`expense_categories` (지출 카테고리)**:
  카테고리명(`name`), 차트 표시 색상(`color`), 기본 여부(`is_default`)를 관리합니다.
  초기 시드: 식비/카페, 쇼핑, 주거/통신, 교통/차량, 문화/여가, 의료/건강, 금융/보험, 생활/기타.
- **`expenses` (지출 거래 원장)**:
  거래일시(`transaction_date`), 정산년월(`year_month`), 가맹점/내용(`merchant`), 금액(`amount`), 결제수단 FK(`payment_method_id`), 소유주(`owner`), 금융사(`institution`), 카테고리 FK(`category_id`), 통계 제외 여부(`is_excluded`), 메모(`memo`), 출처 파일명(`source_file`).

### 2. Decryption & Parsing Pipeline
- **카카오뱅크 엑셀 파서**:
  - `msoffcrypto-tool`을 사용하여 메모리 내(`io.BytesIO`)에서 비밀번호를 통해 복호화합니다.
  - `openpyxl`을 통해 '카카오뱅크 거래내역' 시트의 거래일시, 구분(출금/입금), 거래금액, 거래구분, 내용(가맹점/수취인), 메모 필드를 추출합니다.
  - 출금건은 양수 지출 금액으로 변환합니다.
- **현대카드 명세서 파서**:
  - 현대카드 보안메일 HTML(YettieSoft VestMail)의 암호화 스크립트와 청크 배열을 추출합니다.
  - 내장 Node.js VM 샌드박스를 통해 비밀번호로 메모리 복호화를 수행하고 결합된 UTF-8 HTML을 얻습니다.
  - BeautifulSoup을 통해 청구년월, 이용일자, 가맹점명, 이용금액 테이블 행을 추출합니다.
- **설정 파일 연동**:
  - `settings.toml`에 `[expenses]` 섹션을 추가하여 전역 기본 비밀번호를 설정할 수 있도록 지원합니다.

### 3. Upload, Review, and Overwrite Policy
- **2단계 업로드 플로우**:
  1. `POST /api/expenses/upload-preview`: 파일을 업로드하면 DB에 저장하지 않고 파싱된 레코드 목록과 감지된 결제수단, 청구월(`year_month`)을 프론트엔드에 반환합니다.
  2. `POST /api/expenses/commit`: 사용자가 프리뷰 화면에서 카테고리와 통계 제외 플래그를 조정한 후 '등록'을 누르면 해당 년월(`year_month`) 및 결제수단(`payment_method_id`)에 해당하는 기존 데이터를 삭제하고 새 데이터로 통째로 덮어씁니다(Overwrite).

### 4. API Endpoints
- 결제수단 관리: `GET`, `POST`, `PUT`, `DELETE /api/expenses/payment-methods`
- 카테고리 관리: `GET`, `POST`, `PUT`, `DELETE /api/expenses/categories`
- 업로드 미리보기: `POST /api/expenses/upload-preview`
- 확정 등록(덮어쓰기): `POST /api/expenses/commit`
- 지출 목록 조회: `GET /api/expenses` (쿼리: `year_month`, `owner`, `category_id`, `institution`, `is_excluded`, `search`)
- 지출 통계 집계: `GET /api/expenses/stats` (월별 추이, 카테고리별 비중, 소유주별/결제수단별 합계)
- 거래 수정/삭제: `PATCH /api/expenses/{id}`, `DELETE /api/expenses/{id}`

### 5. Frontend UI & UX Architecture
- **사이드바**: 사이드바 메뉴에 `지출 관리` (`/expenses`, 아이콘: `Receipt` 또는 `CreditCard`) 추가.
- **소유주 탭**: 최상단에 `[전체보기 / 장준 / 성은]` 탭 버튼 그룹을 배치하여 전체 통계 및 소유주별 독립 통계를 토글.
- **대시보드 위젯**:
  - KPI 카드 (당월 총 지출, 전월 대비 증감율, 결제수단별 요약)
  - Recharts 기반 월별 지출 추이 바차트 및 카테고리 도넛 차트
- **모달 컴포넌트**:
  - `ExpenseUploadModal`: 파일 Drag & Drop, 비밀번호 입력, 파싱 프리뷰 테이블(카테고리 선택 및 통계제외 토글), 덮어쓰기 확인 후 저장.
  - `PaymentMethodModal`: 소유주, 금융사, 별칭, 계좌번호, 기본비밀번호 CRUD.
  - `CategoryManageModal`: 카테고리명, 색상 팔레트 선택기, CRUD.
- **상세 거래 테이블 (`ExpenseTable`)**:
  - 년월 필터, 카테고리 필터, 결제기관 필터, 검색 인풋.
  - 인라인 카테고리 변경, 통계 제외 토글, 삭제 액션.

## Testing Decisions

- **좋은 테스트 원칙**:
  - 내부 구현 세부사항이 아닌 사용자 관점의 외부 동작(입력 파일 복호화 성공 여부, 올바른 데이터 추출, API 응답 무결성, 덮어쓰기 정합성, UI 필터링 동작)을 검증합니다.
- **백엔드 테스트 접점 (`tests/test_expense_*.py`)**:
  - 파서 단위/통합 테스트 (`test_expense_parser.py`):
    - 카카오뱅크 암호화 엑셀 복호화 및 데이터 파싱 정합성 검증.
    - 현대카드 보안 HTML 복호화 및 테이블 파싱 정합성 검증.
  - API 통합 테스트 (`test_expense_api.py`):
    - 결제수단 및 카테고리 CRUD 엔드포인트 검증.
    - 업로드 프리뷰 -> 커밋(덮어쓰기) 시 기존 데이터 대체 및 통계 계산 무결성 검증.
    - 소유주별 필터링 조회 검증.
- **프론트엔드 테스트 접점 (`src/frontend/src/pages/ExpensesPage.test.jsx`)**:
  - 사이드바 네비게이션 및 지출 관리 화면 정상 마운트 검증.
  - 소유주 탭 전환 시 필터링 동작 검증.
  - 모달 열기/닫기 및 컴포넌트 렌더링 검증.
- **E2E 브라우저 검증**:
  - 개발 서버(`uv run scripts/dev.py`) 구동 후 `http://localhost:5173/expenses`에 접속하여 실제 파일 업로드, 복호화, 검토, 등록 및 대시보드 렌더링 확인.

## Out of Scope

- AI 1차 자동 분류 추천 기능 (사용자 요청에 따라 이번 1차 구현에서 제외하고 추후 검토).
- 모바일 전용 페이지(`MobileExpensesPage`) 별도 분기 화면 (데스크톱 웹 화면 우선 개발).
- 구글 드라이브 폴더 자동 스캔/스케줄러 수집 (웹 UI Drag & Drop 업로드 방식만 지원).
- 기존 투자 거래 원장(`transactions`)과의 통합.

## Further Notes

- 모든 파이썬 스크립트 실행은 `uv`를 사용하며, 기존 운영 DB 보호를 위해 반드시 격리된 테스트 환경에서 테스트를 수행합니다.
- 복호화 파서 및 마이그레이션 실행 전 DB 백업 규칙을 철저히 준수합니다.
