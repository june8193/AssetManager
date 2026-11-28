# 03 — 지출·비중·보유자산 공유 도메인 모듈 구축 및 역참조 제거

**Spec:** [spec.md](../spec.md)

**What to build:** 지출 24개월 옵션·프리셋·초기 기준월 동기화 조회를 단일 지출 도메인 모듈로 통합해 모바일 초기 기간 불일치와 데스크톱 마운트 이중 페칭을 해결하고, 3계층 비중 리밸런싱과 자산 추이 상태를 데스크톱 페이지에서 독립시켜 모바일→데스크톱 역참조와 `MobileAssetsPage`의 7중 과잉 페칭을 제거한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 모바일 지출 화면 최초 진입 시 상단 KPI와 하단 거래 내역이 동일한 기준월 범위로 조회되며, 데스크톱 마운트 시 중복 API 호출이 발생하지 않는다.
- [ ] 모바일 비중·자산 추이 화면이 데스크톱 페이지/차트 파일을 직접 import하지 않고 독립 도메인 모듈을 사용한다.
- [ ] `MobileAssetsPage`가 불필요한 성과 히스토리(yearly/monthly/daily/snapshots)를 호출하지 않고 보유자산 슬라이스만 조회한다.
- [ ] 프론트엔드 테스트(Vitest)가 모두 통과한다.
