# 02 — Asset-jun-bot 텔레그램 알림 메시지에 거래일시 표기

**What to build:** 수동/자동 키움 동기화 완료 후 발송되는 텔레그램 알림 메시지에 각 거래별 거래일시(`📅 YYYY-MM-DD HH:MM` 또는 `📅 YYYY-MM-DD`)가 정확하게 출력되도록 렌더러를 업데이트합니다.

**Blocked by:** 01 — AssetManager 백엔드 동기화 응답에 거래일시(traded_at) 필드 추가

**Status:** resolved

- [x] `MessageRenderer.render_sync_result`에서 `tx` 딕셔너리의 `traded_at` (또는 `date`/`time`) 필드를 추출하여 포맷팅
- [x] 시각(HH:MM) 정보가 포함된 거래는 `📅 YYYY-MM-DD HH:MM` 포맷으로 텔레그램 메시지 생성
- [x] 시각 정보가 없거나 일자만 있는 거래는 `📅 YYYY-MM-DD` 포맷으로 텔레그램 메시지 생성
- [x] 미등록 자산 스킵 내역에도 동일한 거래일시 포맷 추가
- [x] `tests/test_renderer.py` 단위 테스트 케이스 작성 및 검증
