# 01 — 시장 지수·VIX·벤치마크 공유 도메인 모듈 구축

**Spec:** [spec.md](../spec.md)

**What to build:** 데스크톱과 모바일에 중복 구현된 시장 지수 메타데이터, VIX 4단계 판정 기준, 기간 날짜 변환, 극단값 추출, 벤치마크 비교 및 MDD 계산을 뷰포트 독립 공유 도메인 모듈로 통합하고, 모바일의 유령 `/api/market/benchmark` 폴백 호출 및 `setTimeout(300)` 가짜 새로고침 토스트를 실제 비동기 완료 기반으로 교체한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 데스크톱과 모바일 시장 화면이 단일 `getVixStatus` 기준 및 차트 기준선을 공유한다.
- [ ] 모바일 벤치마크 조회가 실패 폴백 없이 `/api/benchmark`만 호출하며 `useBenchmark`의 미사용 죽은 상태가 정리된다.
- [ ] 모바일 시장 새로고침이 하위 요청의 실제 완료/실패 결과에 따라 토스트를 표시한다.
- [ ] 프론트엔드 테스트(`pnpm test` / Vitest)가 모두 통과한다.
