# Spec: 시장 시세·환율·영업일 모듈 단일 수렴 및 PriceService 해체

Status: ready-for-agent

## Problem Statement (문제 정의)

이미 깊은 시장 데이터 제공 모듈과 어댑터 이음새(`MarketAdapterBase` 기반 `KiwoomAdapter`·`YahooFinanceAdapter`·`FakeMarketAdapter`)가 존재함에도, 대시보드·포트폴리오·종목·섹터 모듈들이 이를 우회하여 자체 장중 판정, 독자 시세 캐시 적재, 7중 환율 폴백, 동기 HTTP 호출을 수행하고 있다. 또한 얕은 패스스루 싱글톤인 `PriceService`가 호출자의 데이터베이스 세션을 무시하고 내부에서 전역 세션을 열어 테스트 격리를 깨뜨리며, 평일 공휴일 장중 오판과 비동기 경로 내 동기 네트워크 블로킹 버그를 일으키고 있다.

## Solution (해결 방안)

얕은 `PriceService` 싱글톤과 각 모듈의 개별 시세·환율·키움·야후 직접 호출을 제거하고, 영업일·공휴일 판정, 시세 캐시 갱신, 기준 환율 폴백, 종목 검색 및 발행주식수 조회를 단일 비동기 깊은 모듈인 `MarketDataProvider` 내부 구현으로 완전히 흡수한다. 키움 REST 통신과 설정(`settings.toml`) 로더 역시 비동기 게이트웨이와 단일 설정 모델로 통일하여 모든 도메인 모듈과 라우터가 주입된 하나의 인터페이스만 바라보게 만든다.

## User Stories (사용자 스토리)

1. As an 자산 관리자, I want 평일 공휴일(추석·성탄절 등)에도 한국과 미국 시장의 휴장 여부가 정확히 판정되어 불필요한 외부 API 호출 없이 캐시된 종가가 표시되기를, so that 휴장일에 대시보드 응답이 지연되거나 시세가 흔들리지 않는다.
2. As an 백엔드 개발자, I want 대시보드와 포트폴리오 모듈이 비동기 경로 안에서 동기 네트워크 요청으로 이벤트 루프를 블로킹하지 않기를, so that 동시 요청 시에도 서버 응답성이 안정적으로 유지된다.
3. As an 시스템 유지보수자, I want 시세 조회·환율 폴백·캐시 적재·설정 로딩 규칙이 단일 모듈에 응집되기를, so that 환율 기준이나 캐시 정책 변경 시 6~7개 파일을 수정하지 않고 한 곳만 고칠 수 있다.
4. As an 테스트 작성자, I want 모든 도메인 모듈이 주입된 `MarketDataProvider`와 `FakeMarketAdapter` 이음새를 통해 검증되기를, so that 격리된 테스트 환경에서 외부 API나 `settings.toml` 파일 없이 결정론적으로 테스트할 수 있다.

## Implementation Decisions (구현 결정사항)

- **단일 시장 데이터 인터페이스 확장**: `MarketDataProvider`가 보유 현금 티커(`KRW`/`USD`=1.0) 및 국가 해석을 포함한 기준일 벌크 시세 조회, 기준일 이하 최근 환율 조회(기본값 폴백 포함), 종목 검색, 발행주식수 조회, 백그라운드 일괄 시세 갱신을 모두 제공한다.
- **비동기 키움 게이트웨이 통합**: 동기 `requests` 기반 호출과 서비스별 독자 `httpx` 호출을 토큰 갱신·지수 백오프 재시도·커넥션 재사용을 내장한 단일 비동기 키움 클라이언트로 통합하고, 순수 달력 모듈에서 네트워크 호출을 분리한다.
- **의존성 주입 일관화**: 라우터와 도메인 모듈은 내부에서 키움·야후·세션을 직접 생성하지 않고 FastAPI 의존성 주입(`Depends`)을 통해 `MarketDataProvider`와 `Session`을 전달받는다.
- **얕은 래퍼 제거**: `SessionLocal`을 내부에서 여는 `PriceService` 싱글톤을 제거하고 스케줄러 시세 갱신 작업도 주입된 `MarketDataProvider`를 사용하도록 전환한다.
- **단일 설정 모델**: `settings.toml` 파싱을 통합 설정 모델 한 곳으로 일원화하고(`accounts` 섹션 포함), 생성자 시점의 파일 I/O 부작용을 제거한다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 내부 구현 함수나 `yfinance`/`requests` 라이브러리를 `patch`하지 않고, 공개 인터페이스와 어댑터 이음새를 통해 외부 관찰 가능한 동작(공휴일 캐시 폴백, 환율 폴백, 비동기 동작, 격리 세션 유지)을 검증한다.
- **사전 합의된 테스트 심 (Pre-agreed Seams)**:
  - `MarketDataProvider` 공개 인터페이스 + `FakeMarketAdapter` + 인메모리 SQLite: **Catches** 평일 공휴일 장중 오판, 환율 폴백 불일치, 캐시 중복 적재, 동기 블로킹 / **Misses** 키움·Yahoo Finance 실제 원격 응답 스키마 변경
  - FastAPI 대시보드·포트폴리오·종목 조회 HTTP 인터페이스(`dependency_overrides`): **Catches** 의존성 주입 누락 및 HTTP 응답 스키마 회귀 / **Misses** 프로덕션 네트워크 타임아웃
- **참고할 기존 테스트 패턴**: `conftest`의 `fake_market_provider` 및 리스크 라우터의 `Depends(get_market_provider)` 주입 패턴.

## Out of Scope (범위 제외 사항)

- 키움증권·Yahoo Finance 외 신규 외부 시세 벤더 추가.
- 포트폴리오 원화 평가 루프 및 스냅샷 정산 통합(별도 피처 `portfolio-valuation-and-timeseries-core`에서 다룸).

## Further Notes (기타 참고사항)

- 본 피처는 원화 평가·스냅샷 정산 심화 및 백엔드 테스트 스위트 내부 `patch` 제거의 기반이 되므로 트랙 A의 최우선 선행 피처로 실행한다.
