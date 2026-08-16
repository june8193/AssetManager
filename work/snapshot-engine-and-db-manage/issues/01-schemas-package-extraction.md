# 01 — 독립 Pydantic 스키마 패키지 구축

**What to build:** `db_manage.py` 내부에 혼재되어 있던 모든 Pydantic 모델을 독립 패키지(`src/backend/schemas/`)로 분리 추출하여 도메인별(계좌, 자산, 거래, 스냅샷, 공통)로 정의하고, 서비스 계층과 라우터 계층의 순환 참조(Lazy Import)를 원천 차단합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `src/backend/schemas/` 패키지를 생성하고 계좌, 자산, 거래, 스냅샷, 공통 응답 스키마를 분리 정의한다.
- [x] 자산 카테고리 유효성 검증 로직(`validate_categories`)이 자산 스키마에 포함된다.
- [x] `snapshot_service.py` 내의 `from ..routers.db_manage import SnapshotPreviewSchema` 지연 임포트를 제거하고 독립 스키마 모듈을 참조하도록 정리한다.
- [x] 기존 `db_manage.py` 및 관련 서비스들이 새 스키마 모듈을 참조하도록 import 경로를 갱신한다.
- [x] 기존 백엔드 단위/통합 테스트 전체(247개)가 수정 없이 100% 정상 통과(PASS)한다.
