# 국민은행 및 신한은행 거래내역 명세서 지원 사양서 (Bank Statement PDF Support Spec)

Status: ready-for-agent

## Problem Statement

현재 AssetManager의 지출 관리 시스템은 현대카드(보안 HTML) 및 카카오뱅크(암호화 엑셀) 명세서만 지원하고 있습니다.

이로 인해 다음과 같은 사용자 문제와 한계가 발생하고 있습니다:
1. **국민은행 및 신한은행 거래내역 수기 입력 또는 누락**: 가계의 주요 생활비 및 자동이체 계좌로 사용 중인 홍성은 님의 국민은행(KB마이핏통장) 및 신한은행 입출금 계좌 거래내역을 지출 시스템에 자동으로 불러올 수 없어 지출 통계에서 누락되거나 번거로운 수작업이 필요합니다.
2. **은행 PDF 암호화 명세서 미지원**: 국민은행과 신한은행에서 내려받은 거래내역 증빙은 생년월일 6자리로 암호화된 PDF 파일 형식으로 제공되나, 기존 시스템에는 PDF 복호화 및 테이블 텍스트 추출 파서가 부재합니다.
3. **다중 월 거래내역 업로드 시 의도치 않은 기존 데이터 덮어쓰기 위험**: 신한은행 등의 거래내역 조회 PDF는 특정 단일 월이 아닌 3개월 등 다중 월(예: 6월 27일 ~ 9월 27일) 거래가 한 파일에 합쳐져 제공되는 경우가 많습니다. 기존 업로드 파이프라인은 파일에 포함된 모든 월의 기존 DB 거래를 일괄 삭제 후 덮어쓰므로, 사용자가 8월 명세서 업로드 시 6월과 7월의 기존 정리 내역이 소실될 위험이 있습니다.
4. **결제수단 오선택 및 파일 혼동 위험**: 업로드 시 선택한 결제수단의 금융기관과 업로드한 파일의 실제 기관이 일치하지 않을 경우 데이터가 오염될 수 있습니다.

## Solution

1. **국민은행 및 신한은행 암호화 PDF 명세서 복호화 및 파싱 파이프라인 신설**:
   - 순수 파이썬 PDF 라이브러리(`pypdf`)를 도입하여 생년월일 6자리 비밀번호로 보호된 PDF 문서를 복호화합니다.
   - 금융기관 자동 감지 기능을 확장하여 파일명 및 PDF 내부 메타데이터/텍스트(예: 'KB국민은행', 'KB마이핏', '신한은행', 'SHINHAN BANK')를 기반으로 국민은행과 신한은행 포맷을 자동 식별합니다.
   - 국민은행의 '거래일시 / 적요 / 보낸분·받는분 / 출금액 / 입금액 / 잔액 / 송금메모', 신한은행의 '거래일자 / 거래시간 / 적요 / 출금 / 입금 / 내용 / 잔액' 정규 테이블 구조를 정밀하게 파싱하여 표준 지출 스키마로 정규화합니다.
   - 기존 카카오뱅크와 일관된 매핑 원칙을 적용합니다: 가맹점명(`merchant`)에는 실제 거래처('내용' 또는 '보낸분/받는분'), 메모(`memo`)에는 은행 적요 및 송금메모, 원본구분(`original_type`)에는 '출금' 또는 '입금'을 보존합니다.

2. **입출금 거래의 완전한 수집 및 사용자 중심 통계 제외 제어**:
   - 지출(출금)뿐만 아니라 급여, 이자, 환급 등의 입금 거래도 누락 없이 모두 수집합니다.
   - 수집된 모든 거래는 미리보기 화면에서 직관적으로 확인 가능하며, 통계 제외(`is_excluded`) 여부는 사용자가 직접 토글하거나 사전에 정의된 자동분류 규칙을 통해 유연하게 관리합니다.

3. **업로드 대상 월(Target Year-Month) 선택 및 타 월 거래 자동 제외·경고 시스템**:
   - 명세서 업로드 모달에 '업로드 대상 월' 선택 드롭다운을 제공하며, 지출관리 화면의 현재 기준 조회 월을 기본값으로 자동 동기화합니다.
   - 업로드된 파일 내에서 선택된 대상 월에 해당하는 거래만 정확히 필터링하여 미리보기에 노출하고 확정 등록합니다.
   - 3개월치 등 대상 월 이외의 거래가 파일에 포함되어 제외된 경우, 미리보기 모달 상단에 제외된 건수와 함께 명확한 안내/경고 배너를 표시하여 사용자가 누락이나 데이터 유실 여부를 즉각 인지할 수 있도록 합니다.

4. **결제수단-파일 금융기관 불일치 엄격 검증**:
   - 사용자가 모달에서 선택한 결제수단의 기관명(예: 국민은행)과 업로드된 파일의 판별 결과(예: 신한은행)가 일치하지 않을 경우, 즉시 친절하고 명확한 오류 메시지를 반환하여 오업로드를 원천 차단합니다.

## User Stories

1. As a user, I want to upload password-protected PDF bank statements from KB Kookmin Bank and Shinhan Bank, so that I can automatically ingest my bank transactions into the expense management system.
2. As a user, I want the system to decrypt PDF files using my 6-digit birthdate password, so that I don't have to manually remove encryption before uploading.
3. As a user, I want the system to automatically detect whether an uploaded PDF belongs to KB Kookmin Bank or Shinhan Bank, so that I don't need to manually configure parsing profiles each time.
4. As a user, I want both deposit (income/refund) and withdrawal (expense) transactions to be parsed from the bank statements, so that I have a complete ledger record in the system.
5. As a user, I want the ability to toggle the 'exclude from statistics' checkbox on any parsed transaction in the preview screen, so that deposits or internal transfers do not distort my consumption metrics.
6. As a user, I want the transaction's merchant field to clearly show the counterparty (e.g., '당근페이', '화성도시고속도', '삼성카드', '토스 홍성은'), so that I can quickly recognize who the money went to or came from.
7. As a user, I want the transaction's memo field to preserve the transaction remark/method (e.g., '오픈뱅킹출금', '펌뱅킹 이체', 'CMS 공동'), so that I can audit how the payment was processed.
8. As a user, I want an 'Upload Target Month' selector in the upload modal, defaulting to the currently active month on the expenses page, so that multi-month statements only import transactions belonging to that intended month.
9. As a user, I want transactions from other months in a multi-month statement (such as a 3-month Shinhan Bank PDF) to be safely excluded from the import, preventing accidental overwrite of existing historical records.
10. As a user, I want a visible warning banner in the upload preview modal if transactions outside the target month were excluded, showing the count of excluded transactions so that I know exactly what was filtered out.
11. As a user, I want an error message if the payment method I selected does not match the institution of the uploaded statement (e.g., selecting Kookmin Bank but uploading a Shinhan Bank PDF), so that I don't corrupt my payment method ledger.
12. As a user, I want existing categorization rules to automatically match against the extracted bank merchant names, so that frequent bank transfers (e.g., recurring insurance, telecom, subscriptions) are categorized with zero manual effort.
13. As a user, I want the upload modal's file picker description to explicitly state that Kookmin Bank and Shinhan Bank PDF files are supported, so that I have clear guidance on accepted file types.
14. As a user, I want to commit the reviewed bank transactions to the database, ensuring existing records for that payment method and target month are cleanly replaced without duplicates.

## Implementation Decisions

### 1. 백엔드 PDF 복호화 및 파서 모듈 확장
- **의존성 추가**: 순수 파이썬 환경의 가볍고 안정적인 `pypdf`를 의존성 매니페스트에 추가합니다.
- **국민은행 전용 파서 모듈 구축**:
  - 비밀번호를 사용한 인메모리 스트림 복호화.
  - 헤더 탐색 및 정규식 기반 테이블 라인 파싱 (`거래일시`, `적요`, `보낸분/받는분`, `출금액`, `입금액`, `잔액`, `송금메모`, `거래점`).
  - `target_year_month` 수신 시 날짜 필터링 수행 및 대상 월 외 거래 건수(`other_month_count`) 계산.
  - 가맹점 매핑: `merchant` = '보낸분/받는분', `memo` = '적요' (송금메모 존재 시 병합), `original_type` = '출금' 또는 '입금'.
- **신한은행 전용 파서 모듈 구축**:
  - 비밀번호를 사용한 다중 페이지 복호화.
  - 줄바꿈된 텍스트('오픈뱅킹 이\n체' 등) 정규화 및 정규식 기반 거래 데이터 추출 (`거래일자`, `거래시간`, `적요`, `출금`, `입금`, `내용`, `잔액`, `거래점`).
  - 날짜 형식 표준화 (`YYYYMMDD` $\rightarrow$ `YYYY-MM-DD HH:MM:SS`).
  - `target_year_month` 필터링 및 `other_month_count` 계산.
  - 가맹점 매핑: `merchant` = '내용', `memo` = '적요', `original_type` = '출금' 또는 '입금'.
- **파서 통합 서비스 (`ExpenseParserService`) 인터페이스 확장**:
  - `detect_institution`: 파일 확장자(`.pdf`) 및 PDF 첫 페이지 시그니처('KB국민은행', '신한은행' 등) 기반 자동 감지 로직 추가.
  - `parse` 메서드 파라미터에 `target_year_month` (Optional[str]) 추가.
  - 파싱 결과 표준 딕셔너리에 `other_month_count` (int) 필드 추가.

### 2. 백엔드 API 계약 확장
- **`POST /api/expenses/upload-preview` 엔드포인트 수정**:
  - Form 파라미터 추가: `target_year_month` (Optional[str], 예: '2026-08').
  - 결제수단 기관 검증: 선택된 `payment_method_id`의 `institution`과 파서가 감지한 금융기관이 불일치할 경우 400 Bad Request 에러 반환.
  - 응답 스키마 (`ExpenseUploadPreviewResponse`) 확장: `other_month_count` (int, 기본값: 0) 필드 제공.

### 3. 프론트엔드 모달 UI 및 사용자 경험 강화
- **`ExpenseUploadModal` 업로드 스텝 개선**:
  - '업로드 대상 월' 콤보박스(셀렉트) 신설: 부모 컴포넌트(`ExpensesPage`)에서 현재 활성화된 기준 월(`startMonth`)을 prop으로 전달받아 초기값으로 세팅하고, 최근 24개월 중 다른 월로 변경 가능.
  - 안내 문구 업데이트: '국민은행/신한은행 거래내역 (.pdf)' 추가.
  - 파일 드래그 앤 드롭 및 파일 선택 input에 `.pdf` 확장자 허용 추가.
- **`ExpenseUploadModal` 미리보기 스텝 개선**:
  - 응답에 `other_month_count > 0`인 경우 상단에 경고(Alert) 배너 렌더링:
    *"업로드 대상 월({year_month}) 이외의 {count}건의 거래는 자동으로 제외되었습니다."*
  - 에러 처리 개선: 결제수단-파일 기관 불일치 시 서버에서 전달된 직관적인 에러 메시지 표출.
- **`expenseService.uploadPreview` 클라이언트 함수 확장**:
  - `target_year_month` 인자를 받아 FormData에 첨부하여 전송.

## Testing Decisions

### 1. 테스트 원칙 및 품질 기준
- **외부 동작(Behavior) 중심 검증**: 내부 구현 세부사항(정규식 패턴이나 임시 변수)이 아닌 입력(파일 바이너리, 비밀번호, 대상 월, 결제수단 ID)과 출력(파싱된 거래 리스트, 필터링 건수, 에러 상태코드) 간의 계약을 철저히 검증합니다.
- **데이터베이스 완전 격리**: 기존 `GEMINI.md` TDD 원칙에 따라 테스트는 인메모리 SQLite 격리 환경에서 수행하여 실서버 및 개발 DB에 일체 영향을 주지 않습니다.

### 2. 테스트 영역 및 Seams
1. **파서 단위 테스트 (`tests/test_kbbank_parser.py`, `tests/test_shinhanbank_parser.py`)**:
   - 올바른 비밀번호로 복호화 성공 및 정확한 거래 건수/금액/일시/가맹점/메모 추출 검증.
   - 잘못된 비밀번호 제공 시 `InvalidPasswordError` 발생 검증.
   - `target_year_month` 지정 시 해당 월만 필터링되고 `other_month_count`가 정확히 집계되는지 검증.
2. **파서 통합 서비스 테스트 (`tests/test_expense_parser_service.py`)**:
   - 국민은행 및 신한은행 PDF 파일 포맷 자동 감지 검증.
   - 지원하지 않는 파일 형식에 대한 예외 처리 검증.
3. **API 엔드포인트 통합 테스트 (`tests/test_expenses_upload_api.py`)**:
   - `POST /api/expenses/upload-preview`:
     - 대상 월 파라미터 전달 시 필터링 및 `other_month_count` 응답 검증.
     - 결제수단 기관과 업로드 파일 기관 불일치 시 400 Bad Request 검증.
     - 자동분류 규칙과의 정상적인 결합 동작 검증.
4. **프론트엔드 컴포넌트 테스트 (`ExpenseUploadModal.test.jsx`)**:
   - 업로드 대상 월 드롭다운 렌더링 및 기본값 바인딩 확인.
   - `other_month_count > 0`일 때 경고 배너 표시 여부 검증.
   - 파일 기관 불일치 에러 발생 시 UI 에러 메시지 렌더링 검증.

## Out of Scope

- **타 금융기관(하나은행, 우리은행, 농협 등) 추가**: 이번 사양 범위는 요청된 국민은행 및 신한은행에 한정합니다.
- **모바일 화면에서의 명세서 업로드 지원**: 명세서 업로드 및 복호화는 데스크탑 전용 모달에서 유지합니다 (모바일 안정성 유지).
- **결제수단 기본 시드 마이그레이션**: 사용자가 직접 웹 화면의 [결제수단 관리] 모달을 통해 등록하여 사용하도록 결정되었습니다.

## Further Notes

- 국민은행 및 신한은행 실제 PDF 샘플 파일(`KB거래내역조회_2608.pdf`, `2608.pdf`)과 복호화 비밀번호(950913)를 통해 PDF 내부 텍스트 레이아웃 및 인코딩 특성을 사전 실증 완료하였습니다.
- 개발 진행 시 TDD(Red $\rightarrow$ Green $\rightarrow$ Refactor) 순서로 백엔드 파서 및 API를 우선 완성한 후 프론트엔드 모달 UI와 E2E 검증을 진행합니다.
