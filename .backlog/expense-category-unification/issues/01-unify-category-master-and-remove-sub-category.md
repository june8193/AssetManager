# 01 — 단일 카테고리 마스터 통합 및 2차 카테고리 체계 폐지

**What to build:**
2차 카테고리(지출 특성/태그) 체계를 완전히 폐지하고, 기존 2차 카테고리 항목('구독료', '모임회비')을 단일 카테고리 마스터(`ExpenseCategory`)로 통합합니다. 카테고리 관리 모달(`ExpenseCategoriesModal`)에서 탭을 제거하여 하나의 목록에서 카테고리를 조회, 추가, 수정, 삭제할 수 있도록 사용자 인터페이스를 단순화합니다.

**Blocked by:** None — can start immediately

**Status:** done

- [x] 기본 카테고리 마스터 시드 및 테이블에 '구독료'(#8B5CF6), '모임회비'(#EC4899)가 정규 카테고리로 등록/유지된다.
- [x] 2차 카테고리 모델(`ExpenseSubCategory`) 및 관련 API 엔드포인트(`GET/POST/PUT/DELETE /api/expenses/sub-categories*`)가 제거된다.
- [x] 카테고리 관리 모달(`ExpenseCategoriesModal`)의 1차/2차 탭 UI가 제거되고, 단일 카테고리 목록 표시 및 추가/수정/삭제 인터랙션이 정상 작동한다.
- [x] 프론트엔드 API 클라이언트(`expenseService`)에서 2차 카테고리 관련 메서드가 정리된다.
- [x] 관련 백엔드 API 테스트 및 프론트엔드 카테고리 모달 컴포넌트 테스트가 통과한다.
