# 01 — 자동분류 규칙 데이터 모델 및 백엔드 CRUD API 구축

**What to build:** 
가맹점 키워드 기반의 자동분류 규칙을 저장할 데이터베이스 스키마와 규칙을 등록, 조회, 수정, 삭제할 수 있는 백엔드 REST API를 구축합니다. 사용자가 규칙을 등록할 때 공백이 자동 제거되고, 동일 키워드의 중복 등록이 차단되며, 통계 제외 규칙인 경우 카테고리 없이 단독 설정할 수 있도록 비즈니스 규칙과 무결성을 보장합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `ExpenseRule` DB 모델 및 스키마(`expense_rules` 테이블) 구현 (`keyword`, `category_id`, `is_excluded`, `created_at`)
- [ ] `ExpenseCategory` 삭제 시 연관된 규칙이 안전하게 연쇄 삭제(Cascade)되도록 외래키 관계 설정
- [ ] 규칙 생성/수정/조회 Pydantic 스키마 정의 (`is_excluded`가 False일 때 `category_id` 필수, True일 때 카테고리 None 처리)
- [ ] `GET /api/expenses/rules`: 등록된 규칙 목록 조회 (키워드 문자열 길이 내림차순, 최신 등록일 내림차순 정렬)
- [ ] `POST /api/expenses/rules`: 신규 규칙 등록 (중복 키워드 등록 시 400 또는 409 반환, 키워드 앞뒤 공백 자동 trim)
- [ ] `PUT /api/expenses/rules/{rule_id}`: 기존 규칙 키워드/카테고리/제외여부 수정
- [ ] `DELETE /api/expenses/rules/{rule_id}`: 규칙 삭제
- [ ] 백엔드 단위/통합 테스트(`tests/test_expense_rules.py`) 작성 및 전체 통과
