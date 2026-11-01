# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/) 및 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 표준을 준수합니다.

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
