---
triage: ready-for-agent
---

# 환율 수집 시점 변경 및 백그라운드 태스크 통합 경고 배너 명세서 (Spec)

## Problem Statement

현재 AssetManager는 매일 아침 일찍(오전 5시 이후) 당일 환율을 최초 1회 수집합니다. 외환시장이 정식 개장(오전 9시)하기 이전 시점에 수집되어 키움 API로부터 정식 고시환율이 아닌 가환율(전일 종가 또는 임시 환율)을 전달받고 있으며, 그 결과 매도환율이 실제보다 낮게 DB에 수집되고 평가액이 왜곡되는 문제가 있습니다. 
또한 수동 시세 새로고침 시에도 가환율이 다시 수집될 가능성이 존재하며, 환율 수집 실패 시 사용자가 오류 상황을 명확하게 파악할 수 있는 시스템 경고 체계가 부재합니다.

## Solution

1. **환율 자동 수집 시점 변경**: 한국시간 오전 9시 30분 이후 백그라운드 루프에서 당일 환율을 최초 1회만 수집하도록 변경하여 가환율 수집을 방지합니다.
2. **수동 시세 새로고침 분리**: 웹 대시보드 및 API의 '시세 새로고침' 기능에서 환율 수집을 제외하고, 오직 주식/지수 시세만 갱신합니다.
3. **실패 시 재시도 중단**: 오전 9시 30분 수집 실패 시 자동 재시도를 수행하지 않고 즉시 수집을 중단하며 에러를 수집합니다.
4. **통합 백그라운드 태스크 경고 배너 구축**: `BackgroundTaskManager`에 `exchange_rate_update` 태스크를 신규 등록하고, 환율 수집 실패를 포함하여 실패(`status == "failed"`)한 모든 백그라운드 태스크(시세, DB 백업, 종목 동기화)의 경고 상태를 AssetManager 대시보드 상단 경고 배너에 통합 노출합니다.

## User Stories

1. As an investor using AssetManager, I want exchange rates to be fetched after 09:30 KST, so that accurate official market exchange rates are applied to my asset valuation.
2. As a user, I want manual price refreshes to update only stock and index prices without affecting exchange rates, so that temporary manual refreshes do not corrupt stored exchange rates.
3. As a system administrator, I want failed exchange rate fetch attempts to stop immediately without retrying silently, so that API failures do not cause repeated failing loops.
4. As an investor, I want to see a clear warning banner at the top of the dashboard when exchange rate fetching fails, so that I immediately know why exchange rates are not updated.
5. As an investor, I want to see warning alerts for any failing background task (such as DB backup or stock sync) on the dashboard, so that I can maintain full awareness of overall system health.

## Implementation Decisions

### 백엔드 (Python / FastAPI)
- **수집 시점 조건**: `price_service.py` 내 `update_all_market_prices()`에서 당일 환율 수집 조건 시각을 `now_kst.hour > 9 or (now_kst.hour == 9 and now_kst.minute >= 30)`로 변경.
- **수동 시세 새로고침 분리**: `POST /api/market/refresh` 호출 로직에서는 환율 수집(`fetch_and_save_exchange_rate`)을 실행하지 않고 시세 및 지수만 업데이트하도록 분리.
- **백그라운드 태스크 관리**: `tasks.py`의 `BackgroundTaskManager` 레지스트리에 `exchange_rate_update` 키 추가. 환율 수집 실패 시 `_update_task_error("exchange_rate_update", error_msg)`로 상태 기록 (`status: "failed"`).
- **시스템 태스크 API 노출**: `GET /api/system/tasks` 엔드포인트를 통해 백그라운드 태스크들의 상태(`last_run`, `status`, `last_error` 등)를 프론트엔드로 전달.

### 프론트엔드 (React / Vite)
- **통합 경고 배너 컴포넌트 (`TaskAlertBanner`)**: 대시보드 최상단에 배치하여 `/api/system/tasks`를 주기적으로 또는 마운트 시 조회.
- 하나 이상의 태스크가 `status === "failed"` 상태일 경우, 대시보드 상단에 경고 스타일(Alert Banner)로 해당 에러 메시지(예: `[환율 수집 실패] 키움 API 응답 오류`)를 노출.

## Testing Decisions

### 테스트 접점 (Seams)
- **백엔드 서비스/API 접점**: `pytest`를 통해 `price_service.py` 시간대별 조건 동작 검증, `BackgroundTaskManager` 태스크 상태 업데이트 검증, `GET /api/system/tasks` API 검증.
- **프론트엔드 컴포넌트 접점**: `Vitest` 및 `React Testing Library`를 활용하여 `TaskAlertBanner`가 태스크 실패 상태일 때 경고 배너를 렌더링하고, 성공 상태일 때 비노출됨을 검증.
- **E2E 검증**: Playwright MCP 및 `scripts/dev.py` 환경에서 대시보드 상단 경고 배너 렌더링 시나리오와 수동 시세 새로고침 동작 검증.

## Out of Scope

- 키움 API 외 기타 외부 환율 제공 서비스(한국수출입은행, Yahoo Finance 등) 대치 연동은 포함하지 않습니다.
- 과거 가환율로 기록되었던 이력 데이터에 대한 소급 수정 마이그레이션 스크립트는 포함하지 않습니다.

## Further Notes

- 테스트 시 `freezegun` 또는 datetime mocking을 활용하여 09:30 이전/이후 환율 수집 트리거 여부를 정교하게 검증합니다.
