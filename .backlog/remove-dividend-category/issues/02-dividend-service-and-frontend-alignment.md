# 02 — 배당 분석 서비스 및 프론트엔드 연동 정합성 수정

**Spec:** [spec.md](../spec.md)

**What to build:** 배당 분석 서비스(`dividend_service.py`)가 주식 대분류 전체를 포함하도록 집계 조건을 맞추고, 프론트엔드 배당 분석 페이지(`DividendAnalysisPage.jsx`)의 필터 탭을 `[주식 / 채권 / 전체 자산]`으로 변경하여 오류 없이 E2E 조회 동작을 완결합니다.

**Blocked by:** 01-backend-remove-dividend-category

**Status:** ready-for-agent

- [ ] `src/backend/services/dividend_service.py` 내 평균 배당률 계산 대상이 `major_category in ("주식", "채권")`으로 수정됨
- [ ] `tests/test_dividend_service.py` 픽스처 및 테스트 정상 통과
- [ ] `src/frontend/src/pages/DividendAnalysisPage.jsx`의 기본 활성 탭이 `'주식'`으로 변경되고 탭 리스트가 `[주식, 채권, 전체 자산]`으로 갱신됨
- [ ] `src/frontend/src/pages/DividendAnalysisPage.test.jsx` 및 `AssetsTab.test.jsx` 프론트엔드 테스트 통과 (`pnpm test`)
- [ ] E2E 검증: DB 관리 탭 자산 추가 드롭다운에 '배당주' 미노출 및 배당 분석 페이지 정상 렌더링 확인
