# 03 — 지출 거래 내역 일괄 삭제 API 구축 (선택 ID 및 조건별 전체 삭제)

**What to build:**
지출 관리 백엔드에 다중 선택된 지출 ID들을 한 번의 호출로 원자적으로 삭제하는 엔드포인트(`POST /api/expenses/bulk-delete`)와, 특정 조건(기준 년월, 결제수단 등)에 부합하는 거래 전체를 일괄 삭제하는 엔드포인트(`DELETE /api/expenses/clear`)를 신설하여 대량 거래 삭제 성능과 데이터 정합성을 보장합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `POST /api/expenses/bulk-delete` 엔드포인트가 지출 ID 목록(`{ ids: [1, 2, 3] }`)을 받아 원자적으로 일괄 삭제하고 삭제된 건수를 반환한다.
- [ ] 빈 ID 목록이나 유효하지 않은 요청에 대해 적절한 예외 처리 및 검증을 수행한다.
- [ ] `DELETE /api/expenses/clear` 엔드포인트가 쿼리 파라미터(`year_month`, `payment_method_id` 또는 `institution`, `owner`)에 해당하는 거래들을 일괄 삭제하고 삭제된 건수를 반환한다.
- [ ] 파라미터 누락(예: `year_month` 미지정) 시 전체 DB 유실을 방지하기 위한 최소 조건 검증(400 Bad Request)을 수행한다.
- [ ] 일괄 삭제 API 단위/통합 테스트(`tests/test_expenses.py` 등)가 통과한다.
