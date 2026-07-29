# 01 — 무위험 수익률 DB 저장 및 API/UI 설정 기능

**What to build:**
사용자가 웹 UI에서 연율 무위험 수익률($R_f$, 기본값 3.5%)을 설정할 수 있도록 백엔드 DB 모델(`SystemSetting`), REST API 라우터(`GET/PUT /api/v1/performance/settings/risk-free-rate`) 및 프론트엔드 설정 폼/모달 컴포넌트를 구축합니다. 설정된 수치는 DB에 저장되어 지속적으로 유지됩니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] SQLAlchemy `SystemSetting` 모델 추가 및 DB 세션 연동
- [ ] `GET /api/v1/performance/settings/risk-free-rate` (조회) API 구현
- [ ] `PUT /api/v1/performance/settings/risk-free-rate` (변경) API 구현
- [ ] 웹 UI 상단/설정란에 무위험 수익률 입력/수정 폼 및 변경 시 DB 반영 확인
- [ ] pytest 단위 테스트 `tests/test_performance_service.py` 작성 및 통과
