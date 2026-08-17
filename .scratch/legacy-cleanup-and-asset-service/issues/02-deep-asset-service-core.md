# 02 — 심화 AssetService 구현 및 도메인 불변식 TDD

**What to build:** 자산 마스터 관리, 대분류/중분류 3-Tier 카테고리 불변식 검증, 티커 중복 방지, 실시간 종목명 확인 및 통화 자산(KRW/USD) 헬퍼를 캡슐화한 클래스 기반 `AssetService`를 구현하고, 단위 테스트를 통해 비즈니스 불변식을 엄격히 검증합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `AssetService`가 DB 세션을 주입받아 자산 CRUD, 티커별 조회, 통화 자산 조회를 수행하는 클래스로 구현된다.
- [x] 자산 생성 및 수정 시 `VALID_CATEGORIES`에 정의된 올바른 대분류-중분류 조합만 허용되고 잘못된 조합은 예외를 발생시킨다.
- [x] 자산 생성 시 동일 티커가 이미 존재하는 경우 중복 예외를 명확히 발생시킨다.
- [x] 실시간 종목 검증 시 현금 자산(KRW/USD)과 주식 자산의 유효성을 구분하여 올바른 공식 명칭을 반환한다.
- [x] `AssetService`의 모든 도메인 불변식 및 헬퍼 기능을 검증하는 TDD 단위 테스트(`tests/test_asset_service.py`)가 100% 통과한다.
