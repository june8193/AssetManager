# 02 — SVG 영역 채우기(Area) 포인터 간섭 차단 및 3대 차트 일괄 적용 (pointer-events-none)

**What to build:** 지수 종가 차트의 거대한 면적 채우기(Area Fill) 요소가 터치 제스처를 가로채지 않아, 화면 어디를 터치하든 세로선이 손가락을 매끄럽게 따라오며 손을 떼는 순간 1밀리초의 잔상 없이 즉각 사라지는 동작을 지수·MDD·VIX 3대 차트 전체에서 동일하게 완성하는 작업.

**Blocked by:** 01 — 모바일 차트 터치 이벤트 연결 및 캔버스 제스처 격리 (touch-none & onTouchStart)

**Status:** ready-for-agent

- [ ] 지수 종가 및 MDD 차트의 `<Area>` 면적 채우기 `<path>`에 `pointer-events-none` 스타일이 적용되어 터치/포인터 이벤트가 루트 SVG 캔버스로 직통 전달된다.
- [ ] 지수 종가, MDD, VIX 3개 서브탭 차트 전체에 동일한 터치 최적화 규격(touch-none, onTouchStart, pointer-events-none)이 일괄 적용된다.
- [ ] 3개 서브탭 전환 시에도 각 탭의 세로선 추종과 터치 종료 즉시 소멸 동작이 일관되게 유지된다.
- [ ] `MobileMarketIndexSection.test.jsx`의 모든 단위 테스트가 통과한다.
