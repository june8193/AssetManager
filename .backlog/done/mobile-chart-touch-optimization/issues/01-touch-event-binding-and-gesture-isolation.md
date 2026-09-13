# 01 — 모바일 차트 터치 이벤트 연결 및 캔버스 제스처 격리 (touch-none & onTouchStart)

**What to build:** 모바일 지수 차트에서 화면을 탭(Touch Down)하는 즉시 첫 번째 시점의 세로선과 상단 인스펙터 바가 지체 없이 노출되고, 차트 캔버스 영역 위에서 브라우저 세로 스크롤 간섭 없이 터치 슬라이드를 안정적으로 시작할 수 있는 엔드투엔드 동작.

**Blocked by:** None — can start immediately

**Status:** closed

- [x] 차트 캔버스 컨테이너에 `touch-none` 및 `select-none` 스타일이 적용되어 슬라이드 중 브라우저 스크롤 개입이 차단된다.
- [x] 화면을 터치하는 즉시(`touchStart`) 첫 번째 포인트의 데이터가 상단 인스펙터 바에 노출된다.
- [x] 손가락을 떼는 순간(`touchEnd`) 세로선과 인스펙터 바가 즉시 소멸하는 기존 무잔상 규격이 유지된다.
- [x] 관련 단위 테스트가 통과한다.
