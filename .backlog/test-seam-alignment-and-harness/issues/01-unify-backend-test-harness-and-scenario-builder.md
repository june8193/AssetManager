# 01 — 백엔드 단일 DB 하네스 일원화 및 도메인 시나리오 빌더 도입

**Spec:** [spec.md](../spec.md)

**What to build:** 개별 테스트 파일 8곳의 중복 SQLite 엔진/세션 픽스처와 18곳의 모듈 전역 `TestClient(app)` 인스턴스를 `conftest.py` 단일 하네스로 통합하여 불필요한 `lifespan` 마이그레이션 반복을 제거하고, 40+개 파일에 복제된 로우레벨 ORM 조립을 대체할 선언적 도메인 시나리오 빌더를 도입한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 개별 테스트 파일의 중복 `create_engine("sqlite:///:memory:")` 및 전역 `TestClient(app)` 선언이 제거되고 `conftest.py` 단일 픽스처를 사용한다.
- [ ] 포트폴리오(계좌·자산·환율·거래·스냅샷) 및 지출(10개 기본 카테고리 시드) 시나리오 빌더가 제공되어 주요 테스트 파일에 적용된다.
- [ ] `uv run pytest` 전체 순차 실행이 격리된 인메모리 DB에서 정상 통과한다.
