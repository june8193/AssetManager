# 03 — 2차 카테고리(지출 특성/태그) 마스터 관리 체계 구축

**What to build:**
지출의 특성을 나타내는 2차 카테고리(지출 특성/태그) 마스터 테이블을 신설하고 초기 기본값('구독료', '모임회비')을 등록합니다. 카테고리 관리 모달에서 1차(지출 종류)와 2차(지출 특성)를 탭으로 분리하여 각각 추가/수정/삭제 관리할 수 있는 사용자 인터페이스를 제공합니다.

**Blocked by:** None — can start immediately (또는 02 완료 후 진행)

**Status:** ready-for-agent

- [ ] 2차 카테고리 마스터 DB 모델(`ExpenseSubCategory`) 및 Pydantic 스키마가 생성된다 (`id`, `name`, `color`, `is_default`, `created_at`).
- [ ] 데이터베이스 초기 마이그레이션 또는 시드 생성 시 '구독료', '모임회비' 2개 항목이 기본값(`is_default=True`)으로 등록된다.
- [ ] 2차 카테고리 목록 조회, 생성, 수정, 삭제 REST API 엔드포인트(`GET/POST/PUT/DELETE /api/expenses/sub-categories`)가 구현된다.
- [ ] 카테고리 관리 모달(`ExpenseCategoriesModal`)에 '1차 카테고리(지출 종류)'와 '2차 카테고리(지출 특성)'를 전환할 수 있는 탭 UI가 구현된다.
- [ ] 2차 카테고리 탭에서 새 특성 태그 등록, 수정, 삭제 인터랙션이 정상 작동한다.
- [ ] 관련 백엔드 API 테스트 및 카테고리 모달 컴포넌트 테스트가 통과한다.
