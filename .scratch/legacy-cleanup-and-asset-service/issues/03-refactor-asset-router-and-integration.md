# 03 — 자산 API 라우터 연동 및 통합 회귀 검증

**What to build:** 자산 API 라우터에 직접 작성되어 있던 ORM 쿼리와 검증 로직을 제거하고 새로 구축된 `AssetService`에 위임하도록 리팩토링합니다. 레거시 스크립트의 의존성을 정리하고 전체 백엔드 테스트 스위트 및 개발 서버 환경에서 회귀 검증을 완료합니다.

**Blocked by:** 02 — 심화 AssetService 구현 및 도메인 불변식 TDD

**Status:** resolved

- [x] `routers/assets.py` 라우터가 비즈니스 로직 및 ORM 직접 조작 없이 `AssetService`를 의존성 주입받아 동작하는 얇은 컨트롤러로 리팩토링된다.
- [x] 자산 목록 조회, 단일 조회, 생성, 수정, 삭제, 실시간 종목 검증 엔드포인트가 기존 API 규격을 100% 호환하며 동작한다.
- [x] 레거시 마이그레이션 스크립트(`src/backend/scripts/fix_tlt_category.py`)가 `AssetService`를 호출하도록 업데이트된다.
- [x] 전체 백엔드 테스트 스위트(pytest)가 회귀 결함 없이 모두 통과한다.
- [x] 개발 서버(`uv run scripts/dev.py`) 구동 상태에서 프론트엔드 자산 관리 UI와의 통신 및 동작이 정상 검증된다.
