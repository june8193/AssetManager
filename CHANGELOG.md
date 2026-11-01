# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/) 및 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 표준을 준수합니다.

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
