# 01 — 환율 자동 수집 09:30 이후 변경 및 수동 새로고침 분리

**What to build:** 한국시간 오전 9시 30분 이후 당일 미수집 상태일 때 백그라운드 최초 1회 환율 수집을 실행하고, 수동 시세 새로고침 요청 시 환율 수집을 전면 제외하여 가환율 수집 및 환율 오염을 방지합니다.

**Blocked by:** None — can start immediately

**Status:** completed

- [x] `price_service.py` 내 당일 환율 자동 수집 조건이 `now_kst.hour > 9 or (now_kst.hour == 9 and now_kst.minute >= 30)` 일 때만 실행되는지 검증
- [x] 09:30 이전 시점에는 자동 환율 수집이 트리거되지 않는지 검증
- [x] `POST /api/market/refresh` (수동 시세 새로고침) 호출 시 환율 수집(`fetch_and_save_exchange_rate`)이 실행되지 않음을 단위 테스트로 검증
