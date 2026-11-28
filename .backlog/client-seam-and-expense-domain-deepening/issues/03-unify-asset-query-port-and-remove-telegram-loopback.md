# 03 — 단일 AssetQueryPort 정립 및 텔레그램 자기 자신 HTTP 루프백 제거

**Spec:** [spec.md](../spec.md)

**What to build:** 중립 패키지에 `AssetQueryPort` 인터페이스를 정의하고, 동일 프로세스 내 텔레그램 봇과 장마감 스케줄러에는 인프로세스 어댑터를 연결하여 자기 자신 HTTP 루프백을 제거하며, MCP 서버에는 백엔드 스키마를 공유하는 단일 원격 HTTP 어댑터를 연결해 중복 클라이언트와 응답 모델을 정리한다.

**Blocked by:** 02-deepen-backend-query-responses

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 텔레그램 봇 명령어와 장마감 스케줄러가 로컬 HTTP 루프백 없이 인프로세스 어댑터를 통해 도메인 모듈을 호출한다.
- [ ] MCP 도구들이 단일 원격 HTTP 어댑터를 사용하며, 클라이언트 측 리스크/관심종목/지출 재조립 보일러플레이트가 제거된다.
- [ ] 스냅샷 조회 이름 충돌(`/api/dashboard/snapshots` vs `/api/db/snapshots`) 및 중복 환경변수 충돌이 해소된다.
- [ ] `uv run pytest`로 텔레그램·MCP 테스트가 실제 어댑터 이음새를 통해 통과한다.
