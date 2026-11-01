# 01 — 백엔드 카테고리 모델 및 검증 로직에서 '배당주' 제거

**Spec:** [spec.md](../spec.md)

**What to build:** `src/backend/models.py`의 `VALID_CATEGORIES["주식"]`에서 `"배당주"`를 제거하고, `GET /api/db/assets/categories` 및 자산 생성/수정 API에서 "배당주" 입력 시 정상 거부(Validation Error)되도록 백엔드 E2E 검증을 완결합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `src/backend/models.py`의 `VALID_CATEGORIES["주식"]`에 `["코어(지수)", "알파(성장)"]`만 유지
- [ ] `tests/test_assets_verify.py`에서 `assert "배당주" not in data["주식"]` 통과
- [ ] `tests/test_asset_validation.py` 및 `test_asset_service.py`에서 "배당주" 거절 검증 테스트 통과
- [ ] `tests/test_kiwoom_sync.py` 픽스처 수정 및 백엔드 관련 단위 테스트 통과 (`uv run pytest`)
