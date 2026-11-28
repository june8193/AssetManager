# Spec: 에이전트 스킬 정합화, 고아 CLI 정리 및 ADR-0001 기록

Status: ready-for-agent

## Problem Statement (문제 정의)

에이전트 스킬들이 원격 MCP 도구로 전환된 이후에도 호출자가 0건인 고아 CLI 스크립트 4종(`query_asset`, `query_market`, `query_stock`, `resolve_url`)과 그 모킹 테스트가 남아 도구 선택 혼란을 유발하고 있다. 또한 5개 정기 리포트 스킬이 `send_telegram` 실행 시 생성된 파일 경로 대신 멀티라인 마크다운 전문을 PowerShell 문자열 인자로 넘기도록 지시해 따옴표·줄바꿈 깨짐 위험이 있으며, `asset-monthly-report` 스킬은 이미 존재하는 `get_benchmark_attribution` MCP 도구 대신 종목별 시세를 N번 개별 조회해 근사 기여도를 수동 계산하도록 지시하고 있다.

## Solution (해결 방안)

호출자가 없는 고아 CLI 스크립트 4종과 대응 죽은 테스트를 삭제한다. 5개 리포트 스킬의 텔레그램 발송 지침을 파일 경로 인자 전달 방식으로 통일하고, 월간 종합 보고서 스킬의 종목별 기여도 산출을 `get_benchmark_attribution` MCP 도구 호출로 정합화한다. 아울러 투자 원칙 판정·VIX 해석·리포트 포맷 같은 정책/표현은 유연성을 위해 마크다운에 유지하고, 서버 PC 로컬 배치 I/O(뉴스 조회·저장 경로·텔레그램 발송)는 MCP로 올리지 않고 CLI로 유지한다는 아키텍처 결정을 `ADR-0001`로 기록한다.

## User Stories (사용자 스토리)

1. As an 에이전트 스킬 실행자, I want 호출되지 않는 고아 `query_*.py` 스크립트들이 제거되기를, so that 스킬 실행 시 MCP 도구와 레거시 CLI 사이에서 혼동하지 않는다.
2. As an 정기 리포트 스킬 운영자, I want 텔레그램 발송 시 멀티라인 문자열 대신 생성된 보고서 파일 경로를 전달하기를, so that PowerShell 특수문자·줄바꿈 이스케이프 오류로 발송이 깨지지 않는다.
3. As an 월간 자산 보고서 사용자, I want 월간 보고서의 종목별 성과 기여도가 `asset-auditor`와 동일한 `get_benchmark_attribution` 기준으로 산출되기를, so that 감사 보고서와 월간 보고서 간 기여도 수치가 일치한다.
4. As an 프로젝트 아키텍트, I want 정책·포맷 마크다운 유지 및 서버 로컬 배치 CLI 유지 결정이 ADR로 남기를, so that 향후 아키텍처 리뷰에서 유연성 트레이드오프를 무시한 MCP 코드화를 반복 제안하지 않는다.

## Implementation Decisions (구현 결정사항)

- **고아 CLI 4종 및 죽은 테스트 삭제**: 프로덕션·스킬 어디에서도 호출되지 않는 `query_asset`, `query_market`, `query_stock`, `resolve_url` 스크립트와 테스트 스위트 내 해당 모킹 테스트 섹션을 삭제한다.
- **리포트 스킬 5종 정합화**: 5개 리포트 스킬의 텔레그램 발송 명령을 생성된 마크다운 보고서 파일 경로를 첫 번째 인자로 전달하는 형태로 통일한다. 월간 보고서 스킬의 보유 종목 기여도 산출은 `get_benchmark_attribution` MCP 도구 호출로 대체한다.
- **ADR-0001 기록 및 범위 제약**: 투자 원칙(`7:3`, `6:3:1`, 동적 리밸런싱, 2주 매매 간격), VIX 등급 해석, 리포트 템플릿·`journal.md` 표 포맷은 마크다운에 유지하고, 서버 PC 로컬 배치 I/O(`query_news`, `query_us_news`, `get_storage_dir`, `send_telegram`)는 `scripts/` CLI로 유지함을 `ADR-0001`로 문서화한다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 삭제된 고아 스크립트에 대한 잔존 참조가 `.backlog/done/` 과거 기록 외 0건임을 확인하고, 유지되는 로컬 배치 CLI 4종 테스트가 모두 통과함을 검증한다.
- **사전 합의된 테스트 심 (Pre-agreed Seams)**:
  - 유지되는 로컬 배치 CLI 테스트 스위트(`get_storage_dir`, `send_telegram`, `query_news`, `query_us_news`): **Catches** 파일 기반 텔레그램 발송·저장소 경로 해석·뉴스 검색 회귀 / **Misses** 실제 텔레그램/네이버 외부 서버 장애
- **참고할 기존 테스트 패턴**: `tests/test_report_scripts.py` 및 `docs/agents/domain.md`의 ADR 형식.

## Out of Scope (범위 제외 사항)

- 투자 원칙 판정·VIX 해석·리포트 포맷의 Python/MCP 코드화(ADR-0001에 의해 의도적으로 제외).
- 서버 PC 로컬 배치 CLI(뉴스 조회·저장 경로·텔레그램 발송)의 MCP 도구 전환(ADR-0001에 의해 의도적으로 제외).

## Further Notes (기타 참고사항)

- 본 피처는 백엔드·프론트엔드 피처와 독립적이므로 언제든 즉시 착수 가능하다.
