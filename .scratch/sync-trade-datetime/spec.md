---
labels: ["ready-for-agent"]
---

# Feature Spec: Sync Trade Datetime in Telegram Notifications (`sync-trade-datetime`)

## Problem Statement

현재 키움증권 거래내역 수동 동기화(`/sync`) 또는 백엔드 자동동기화 수행 시 텔레그램으로 전달되는 결과 메시지에는 종목명, 수량, 단가, 총금액만 표시되고 거래일자 및 체결시각 정보가 누락되어 있습니다. 이로 인해 사용자는 동기화된 거래가 언제 발생했는지 알림만으로는 확인하기 어렵습니다.

## Solution

1. 키움증권 동기화 서비스(`KiwoomTransactionService`)에서 체결 및 원장 데이터 수집 시 거래일자 및 체결시각을 파싱하여 API 결과(`synced_transactions`, `unregistered_assets`)의 `traded_at` 필드에 포함시킵니다.
2. 텔레그램 메시지 렌더러(`MessageRenderer.render_sync_result`)에서 `traded_at` 필드를 읽어 거래 목록 뒤에 `📅 YYYY-MM-DD HH:MM` (분 단위까지) 포맷으로 표시합니다.
3. 배당금 입금 내역 등 체결 시각이 존재하지 않거나 `00:00`인 거래는 `📅 YYYY-MM-DD` (날짜만) 표기합니다.
4. DB 스키마(`transactions` 테이블) 변경 없이 기존 구조를 유지합니다.

## User Stories

1. As an investor using Asset-jun-bot, I want to see the transaction date and time (YYYY-MM-DD HH:MM) in Telegram sync notifications, so that I can easily verify when each order was executed.
2. As an investor, I want dividend transactions without specific execution times to display only the date in notifications, so that the notification remains clean and readable.
3. As a developer, I want the backend API response to include a `traded_at` field in sync results without modifying the database schema, so that contract extensions remain lightweight and non-breaking.

## Implementation Decisions

### AssetManager Backend (`src/backend/services/kiwoom_sync_service.py`)
- 키움증권 체결 및 원장 수집 메서드에서 거래일시 정보(`traded_at`) 파싱 logic 추가.
- `synced_transactions` 및 `unregistered_assets` 딕셔너리 항목에 `"traded_at": "YYYY-MM-DD HH:MM"` 또는 `"YYYY-MM-DD"` 필드 보장.
- DB `transactions` 테이블 스키마는 현행 유지 (`transaction_date: Date`).

### Asset-jun-bot Telegram Renderer (`src/asset_jun_bot/telegram_bot/renderer.py`)
- `render_sync_result` 메서드 업데이트:
  - 체결 시각이 분 단위까지 존재하는 경우: `• [{t_type}] {asset_name} | {quantity}주 | {price} (총 {total}) 📅 YYYY-MM-DD HH:MM`
  - 체결 시각이 없거나 일자만 존재하는 경우: `• [{t_type}] {asset_name} | {quantity}주 | {price} (총 {total}) 📅 YYYY-MM-DD`
  - 미등록 자산 스킵 내역에도 동일한 거래일시 포맷 추가.

## Testing Decisions

### Testing Principles
- 외부 키움 Open API 및 DB 연동은 mock 객체를 사용하여 테스트 격리 수행.
- 외부 동작(API 응답 데이터 구조 및 텔레그램 렌더링 결과 메시지) 중심으로 검증.

### Test Cases
- **AssetManager (`tests/test_kiwoom_sync.py`)**:
  - `sync_transactions` 반환 데이터의 `synced_transactions` 및 `unregistered_assets`에 `traded_at` 필드가 올바른 일시/일자 문자열 형태로 포함되는지 검증.
- **Asset-jun-bot (`tests/test_renderer.py`)**:
  - `traded_at`이 포함된 딕셔너리를 `render_sync_result`에 전달했을 때 텔레그램 메시지 문자열에 `📅 YYYY-MM-DD HH:MM` 및 `📅 YYYY-MM-DD`가 정상적으로 포함되는지 검증.

## Out of Scope

- `transactions` DB 테이블 스키마 변경 (영구 DB `DateTime` 컬럼 추가)
- 과거에 이미 저장된 거래내역의 텔레그램 알림 재전송

## Further Notes

- TDD 절차(Red-Green-Refactor)에 따라 테스트 케이스 작성 후 구현 진행 예정.
