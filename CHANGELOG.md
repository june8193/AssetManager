# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/) 및 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 표준을 준수합니다.

---

## [2.4.0] - 2026-11-07

### Added
- **증권계좌 스냅샷 예수금 2단 비교 대조 UI 및 5단계 평가액 표기 개선** ([상세 스펙](.backlog/done/brokerage-snapshot-cash-comparison/spec.md))
  - 스냅샷 위저드 4단계(`Step4BrokerageDetail`)에 DB 원장 잔액과 신규 거래/이체 입금을 실시간 합산한 '현재 계좌 예상 원화/달러 예수금' 카드 배치 및 `[동일 적용 →]` 원클릭 버튼 제공
  - 실제 예수금 타이핑 시 예상 예수금과의 차액(`차액 없음`, `+원화`, `-달러`) 실시간 안내 배지 구현
  - 스냅샷 5단계(`Step5FinalConfirm`) 최종 확인 테이블에서 증권계좌 총 평가액(주식+예수금 합산)을 메인 굵은 글씨로 표시하고 하단 보조 텍스트로 예수금 잔액 병기
  - 백엔드 계좌 기준일 현금 잔액 조회 경량 엔드포인트(`GET /api/db/accounts/{account_id}/cash-balance`) 신설 및 증권 정산 응답(`BrokerageCalculateResponse`)에 `total_valuation` 필드 확장
- **거래내역 다중 입력 시트 및 인라인(In-line) 수정 UI 개편** ([상세 스펙](.backlog/done/transaction-sheet-and-inline-edit/spec.md))
  - 상단 신규 거래 다중 행 입력 시트 컴포넌트 신설 및 다중 행 추가/삭제, 키보드 Tab/Enter 빠른 입력, 원자적 일괄 등록(`POST /api/db/transactions/bulk`) API 및 서비스 구현
  - 하단 거래내역 테이블 컬럼을 9개(ID, 일자, 계좌명, 자산분류, 유형, 종목/내용, 금액/수량, 단가/수수료, 메모/작업)로 전면 개편
  - 거래내역 행 더블클릭 또는 '수정' 버튼 클릭 시 테이블 제자리(In-line) 편집 모드 전환 및 단일 거래 즉시 수정/취소 지원
- **입출금 제외 자산 수익 지수 및 실시간 추이 시각화** ([상세 스펙](.backlog/done/visualize-net-asset-returns/spec.md))
  - 스냅샷 주기별 TWR(시간가중수익률) 기반 순수 자산 수익 지수(1,000pt 기준) 산출 및 현재 실시간 평가액을 연결하는 실시간 차트 끝점 병합 API 구현
  - 데스크톱 대시보드 자산 추이 차트(`AssetChart`) 내 `수익 지수(Index)` 탭 신설, 벤치마크(S&P 500, KOSPI) 대비 상대 성과 및 순수 투자 성과 곡선 시각화
  - 모바일 대시보드 상단 2번째 위치에 자산 추이 및 수익 지수를 토글할 수 있는 전용 카드(`MobileAssetTrendCard`) 신설

---

## [2.3.0] - 2026-11-01

### Added
- **asset-auditor 7단계 파이프라인 개편 및 투자가설/감사 저널 SSOT 체계 구축**
  - 자산 점검, 포트폴리오 성과 진단, 매매 복기 및 1:1 투자 원칙 검증(Grill-Me)을 수행하는 7단계 표준 감사 파이프라인 정립
  - 종목별 투자 가설 문서(`docs/theses/*.md`) 및 감사 리포트/저널(`docs/audits/`) 저장소 내 영속화

### Changed
- **주식 서브 카테고리 '배당주' 제거 및 배당 분석 탭 개편** ([상세 스펙](.backlog/done/remove-dividend-category/spec.md))
  - 주식 서브 카테고리(`SubCategoryEnum`)에서 `DIVIDEND`(배당주) 항목 제거 및 유효성 검증 정합성 수정
  - 배당 분석 페이지를 특정 서브 카테고리 기준에서 주식/채권/전체 자산 관점의 배당 흐름 및 배당률 분석으로 개편
  - 기존 배당주 카테고리 참조 단위 테스트 및 프론트엔드 테스트 코드 동기화

### Improved
- **테스트 및 개발 환경 안정화**
  - SQLite In-memory 락 경합 방지를 위한 `GEMINI.md` pytest 순차 실행 준수 규칙 명시

---

## [2.2.0] - 2026-11-01

### Added
- **Alembic 기반 데이터베이스 버전 및 마이그레이션 관리 시스템 구축** ([상세 스펙](.backlog/done/alembic-db-migrations/spec.md))
  - SQLAlchemy Alembic 환경 구축 및 SQLite Batch Mode 지원 (`alembic.ini`, `alembic/`)
  - 서버 기동 시 미적용 마이그레이션 자동 감지, 사전 자동 백업(`./backups/assets_*.db`) 및 안전 업그레이드 연동
  - `AccountSnapshot` 유니크 제약조건 모델 반영 및 초기 Baseline 마이그레이션 확립
  - 과거 레거시 일회성 마이그레이션 스크립트 정리 및 `GEMINI.md` 스키마 관리 규칙 문서화
- **데스크톱 웹 환경 설정 관리 및 서버 재시작 기능** ([상세 스펙](.backlog/done/desktop-settings-and-server-restart/spec.md))
  - 사이드바 내 '환경 설정 및 서버 관리' (`/system/settings`) 전용 관리 화면 신설
  - Dual Mode 편집기 제공 (섹션별 구조화된 폼 UI 및 Raw TOML 텍스트 에디터)
  - `tomlkit` 라이브러리를 활용한 한글 주석 보존, TOML 스키마 유효성 검증 지원
  - 파일 저장 직전 자동 백업(`settings.toml.bak`) 생성 및 '직전 설정 복원' 기능 지원
  - 웹 UI 및 REST API 기반 서버 비동기 재시작(`POST /api/v1/system/restart`) 및 실시간 헬스체크 폴링
- **스냅샷 위저드 순서 변경(현금계좌 우선) 및 계좌 이체(TRANSFER) 자동 연동** ([상세 스펙](.backlog/done/snapshot-bank-first-and-transfer/spec.md))
  - 스냅샷 생성 위저드를 현금계좌(은행) → 주식계좌(증권) 순으로 5단계 재구성
  - 위저드 단계별 신규 거래 추가 시 이체(`TRANSFER`) 유형 및 도착 계좌 선택 지원
  - 타 계좌에서 송금된 이체 내역을 도착 계좌 거래 테이블에 읽기 전용 입금(`DEPOSIT`) 행으로 자동 연동 렌더링
  - 도착 계좌 정산 시 이체 입금을 자동 반영하여 이론 잔액(`theoretical_krw`) 및 차액 왜곡 해소
  - 통합 저장 시 고유 `transfer_pair_id`를 공유하는 출금+입금 쌍 원자적 영속화
- **계좌 이체(TRANSFER) 거래 내역 수정 및 도착 계좌 연동** ([상세 스펙](.backlog/done/transfer-transaction-edit/spec.md))
  - 마스터 관리 거래 내역 탭에서 기존 거래를 이체(`TRANSFER`) 유형으로 수정하거나 도착 계좌 변경 지원
  - 백엔드 `TransactionSchema`에 `target_account_id` 추가 및 서비스 레이어 이체 쌍 동기화 로직 구현
  - 기존 이체 쌍을 일반 거래로 수정 시 상대 짝 거래 자동 삭제 및 단독 거래 전환 지원

---

## [2.1.7] - 2026-10-31

### Added
- **지출 관리 계좌 입금 음수 지출 반영 및 거래 일괄 삭제** ([상세 스펙](.backlog/expense-negative-deposit-and-bulk-delete/spec.md))
  - 은행 계좌 입금 거래의 음수(`-`) 지출 변환 및 통계 상계 집계 반영
  - 데스크톱 지출관리 화면 일괄 삭제(선택 삭제 및 조건별 전체 삭제) UI 및 API 구현
  - 명세서 업로드 미리보기 모달 UI 개선 (입출금 뱃지 및 음수 금액 렌더링)

### Fixed
- **텔레그램 봇 안정화**
  - `/restart` 명령 시 무한 재시작 방지 및 안전 부팅 메커니즘 구축

---

## [2.1.6] - 2026-10-30

### Added
- **벤치마크 다기간 성과 및 포트폴리오 종목별 손익 기여도(Attribution)** ([상세 스펙](.backlog/done/benchmark-attribution/spec.md))
  - 벤치마크 다기간 성과 및 보유 종목 손익 기여도 계산 백엔드 API 구현
  - `get_benchmark_attribution` MCP 도구 구현
  - `asset-auditor` 스킬 개정 및 벤치마크 기여도 MCP 연동

---

## [2.1.5] - 2026-10-29

### Added
- **국민은행 및 신한은행 암호화 거래내역 명세서 지원** ([상세 스펙](.backlog/done/expense-bank-statement-support/spec.md))
  - 국민은행 및 신한은행 다중 월 암호화 거래내역 PDF 파서 및 업로드 미리보기 API 구현
  - 결제수단-명세서 금융기관 일치 검증 로직 및 오업로드 방지 에러 구현
  - 명세서 업로드 모달 UI 개선 (대상 월 선택기, PDF 안내, 제외 경고 배너)

### Changed
- **동적 리밸런싱 전략 강화**
  - S&P 500 MDD 및 VIX 기반 동적 리밸런싱 원칙 추가 및 관련 스킬 리팩토링
