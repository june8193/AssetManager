# 01 — 지출 DB 스키마 구축 및 결제수단/카테고리 관리 기능

**What to build:** 
지출 관리를 위한 데이터베이스 테이블(`payment_methods`, `expense_categories`, `expenses`)을 안전하게 구축하고, 사용자가 웹 화면에서 결제수단(소유주: 장준/성은, 금융기관, 별칭, 계좌/카드 식별번호, 기본비밀번호)과 지출 카테고리(카테고리명, 색상)를 직접 등록, 수정, 삭제, 조회할 수 있는 엔드투엔드 기능을 제공합니다.

**Blocked by:** None — can start immediately

**Status:** resolved


## Acceptance criteria

- [x] `settings.toml` 백업 경로에 마이그레이션 전 안전 백업 파일(`assets_YYYYMMDD_HHMMSS.db`)이 생성된다.
- [x] `payment_methods`, `expense_categories`, `expenses` 테이블이 SQLite 스키마에 추가된다.
- [x] 기본 결제수단(장준 카카오뱅크, 장준 현대카드) 및 기본 카테고리(식비/카페, 쇼핑, 주거/통신 등) 시드 데이터가 적재된다.
- [x] 결제수단 CRUD 백엔드 API (`/api/expenses/payment-methods`) 및 단위 테스트가 구현되어 정상 통과한다.
- [x] 카테고리 CRUD 백엔드 API (`/api/expenses/categories`) 및 단위 테스트가 구현되어 정상 통과한다.
- [x] 프론트엔드 모달 컴포넌트를 통해 사용자가 결제수단과 카테고리를 UI에서 원활히 추가/수정/삭제할 수 있다.

