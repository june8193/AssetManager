# 02 — 명세서 업로드 미리보기 자동분류 매칭 엔진 연동

**What to build:** 
명세서 파일(엑셀, PDF 등)을 업로드하여 미리보기를 생성할 때(`POST /api/expenses/upload-preview`), 원시 거래의 가맹점명(`merchant`)에 등록된 자동분류 규칙들을 순차 평가하여 카테고리(`category_id`) 및 통계 제외(`is_excluded`)를 자동으로 주입하는 서버 사이드 매칭 엔진을 구축합니다. 대소문자 무관 부분 일치와 더 구체적인 키워드 우선순위(Longest Match)를 완벽히 준수합니다.

**Blocked by:** 01 — 자동분류 규칙 데이터 모델 및 백엔드 CRUD API 구축

**Status:** ready-for-agent

- [ ] `POST /api/expenses/upload-preview` 파이프라인에서 활성 `ExpenseRule` 목록을 길이 내림차순으로 조회하여 메모리 매칭 수행
- [ ] 대소문자 구분 없이(Case-Insensitive) 가맹점명(`merchant`)에 규칙 키워드가 포함되어 있는지 부분 일치 검사
- [ ] 복수 규칙이 동시 일치하는 경우 더 긴(구체적인) 키워드를 가진 규칙을 최우선 매칭 (예: '쿠팡이츠' > '쿠팡')
- [ ] 매칭된 규칙이 `is_excluded == True`인 경우 거래의 `is_excluded = True`, `category_id = None` 주입
- [ ] 매칭된 규칙이 `is_excluded == False`인 경우 거래의 `is_excluded = False`, `category_id = rule.category_id` 주입
- [ ] 일치하는 규칙이 없는 경우 기본값 `is_excluded = False`, `category_id = None` 유지
- [ ] 업로드 미리보기 매칭 통합 테스트(`tests/test_expense_preview_matching.py`) 작성 및 통과
