# Spec: 주식 서브 카테고리 '배당주' 삭제

## Problem Statement (문제 정의)

기존에는 주식 종목의 서브 카테고리로 `코어(지수)`, `알파(성장)`, `배당주` 3가지를 운영했으나, 관리 포인트를 단순화하기 위해 '배당주' 서브 카테고리를 삭제하고 `코어(지수)`와 `알파(성장)` 2가지 체계로 통합하고자 합니다.

## Solution (해결 방안)

- 백엔드 자산 마스터 모델(`VALID_CATEGORIES`)에서 '배당주'를 제거하여 신규 등록 및 수정 시 '배당주' 입력을 차단합니다.
- 서버 DB 실사 결과 현재 '배당주'로 등록된 자산이 0건이며, DB 스키마에 enum/CHECK 제약조건이 없으므로 일회성 DB 변경이나 DDL 마이그레이션 없이 코드 수정 및 배포로 해결합니다.
- 자주 사용하지 않는 '배당 분석 페이지'는 에러 없이 안전하게 조회되도록 상단 필터 탭을 `[배당주 / 채권 / 전체 자산]`에서 `[주식 / 채권 / 전체 자산]`으로 변경하고 기본 탭을 `'주식'`으로 최소 정합성을 맞춥니다.

## User Stories (사용자 스토리)

1. **종목 카테고리 관리 간소화**: 관리자로서 자산 마스터를 관리할 때, 주식 종목의 중분류 선택지에 '배당주'가 노출되지 않고 '코어(지수)'와 '알파(성장)'만 선택할 수 있기를 원합니다.
2. **유효성 검증 유지**: 시스템은 '배당주'를 서브 카테고리로 입력하려는 API 요청을 유효하지 않은 카테고리로 거부해야 합니다.
3. **배당 분석 조회 지속성**: 사용자가 배당 분석 페이지에 진입했을 때 에러 없이 주식/채권 종목의 배당 데이터를 정상 조회할 수 있어야 합니다.

## Implementation Decisions (구현 결정사항)

- **백엔드**:
  - `src/backend/models.py`: `VALID_CATEGORIES["주식"]`을 `["코어(지수)", "알파(성장)"]`으로 수정.
  - `src/backend/services/dividend_service.py`: `get_dividend_summary`의 평균 배당률 계산 대상 자산군을 `major_category in ("주식", "채권")`으로 수정하여 대분류 주식/채권 전체 집계.
- **프론트엔드**:
  - `src/frontend/src/pages/DividendAnalysisPage.jsx`: `activeTab` 기본 상태를 `'주식'`으로 수정하고, 탭 목록을 `[주식, 채권, 전체 자산]`으로 변경. 필터 조건은 `stock.major_category === activeTab`.
- **DB 마이그레이션**:
  - 기존 실서버 데이터 0건 확인 및 SQLite 컬럼이 VARCHAR로 제약조건이 없으므로 마이그레이션 불필요.

## Testing Decisions (테스트 결정사항)

- **백엔드**:
  - `tests/test_assets_verify.py`: `GET /api/db/assets/categories`에서 "배당주" 미포함 검증.
  - `tests/test_asset_validation.py`: Pydantic 스키마 수준에서 `sub_category="배당주"` 입력 시 `ValidationError` 발생 검증.
  - `tests/test_asset_service.py`: 자산 수정 시 "배당주" 입력 거절 검증.
  - `tests/test_dividend_service.py`: 픽스처 카테고리 갱신 및 서비스 메서드 정상 실행 검증.
- **프론트엔드**:
  - `src/frontend/src/pages/DividendAnalysisPage.test.jsx`: 탭 구성 및 렌더링 검증.

## Out of Scope (범위 제외 사항)

- 배당 분석 페이지 시뮬레이터 신규 기능 개발 또는 전면 개편.
- DB 스키마 DDL 마이그레이션 (제약조건 부재로 불필요).
