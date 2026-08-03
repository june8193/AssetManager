# 01 — AssetManager 백엔드 동기화 응답에 거래일시(traded_at) 필드 추가

**What to build:** 키움증권 체결 내역 및 원장 데이터 수집 시 거래/체결 시각을 파싱하여 `/api/kiwoom/sync-transactions` 응답 데이터(`synced_transactions` 및 `unregistered_assets`)에 `traded_at` (`YYYY-MM-DD HH:MM` 또는 `YYYY-MM-DD`) 필드를 보장하여 전달합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `KiwoomTransactionService`에서 키움 국내/해외 체결내역 파싱 시 체결시각(HH:MM) 데이터 추출 및 `"YYYY-MM-DD HH:MM"` 포맷의 `traded_at` 생성
- [x] 배당금 입금 내역 등 시간이 없는 거래는 `"YYYY-MM-DD"` 포맷의 `traded_at` 생성
- [x] `synced_transactions` 및 `unregistered_assets` 반환 딕셔너리 항목에 `traded_at` 필드 포함
- [x] `tests/test_kiwoom_sync.py` 테스트 케이스에서 반환 객체의 `traded_at` 필드 구조 및 값 검증
