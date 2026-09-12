# Feature Spec: Asset-jun-bot 텔레그램 봇 및 리포트 스킬의 AssetManager 서버 통합

Triage: ready-for-agent

## Problem Statement

현재 자산 관리 시스템은 두 개의 개별 프로젝트 및 서버 프로세스로 이원화되어 운영되고 있습니다:
1. `AssetManager`: 웹 UI 대시보드, 키움증권 연동, SQLite 데이터베이스 및 백엔드 REST API 서버.
2. `Asset-jun-bot`: 텔레그램 봇 롱폴링, CLI 명령어 처리, 장 마감 동기화 알림, 정기 리포트 에이전트 스킬 및 이전 자연어 대화(Gemini API) 기능.

이로 인해 다음과 같은 비효율과 운영 복잡도가 발생하고 있습니다:
- **프로세스 이원화로 인한 서버 리소스 낭비 및 관리 부담**: 상시 구동되어야 하는 PM2 데몬 프로세스가 두 개로 나뉘어 있어 모니터링, 프로세스 재시작, 배포 관리가 번거롭습니다.
- **불필요한 레거시 기능 잔존**: Antigravity 에이전트 환경으로 완전히 전환됨에 따라 과거 `Asset-jun-bot`에 탑재되었던 직접적인 Gemini API 호출 및 자연어 대화 기능이 더 이상 사용되지 않음에도 코드베이스에 남아있습니다.
- **환경 설정의 파편화**: 토큰과 설정값이 한쪽은 `.env`, 다른 한쪽은 `settings.toml`로 분산되어 관리 일관성이 떨어집니다.
- **스킬 및 스크립트의 분산**: 일간/주간/월간 리포트 작성 스킬 및 보조 스크립트가 `Asset-jun-bot`에 위치하여 자산 데이터의 원천인 `AssetManager`와 물리적으로 분리되어 있습니다.

## Solution

1. **단일 서버 통합 구동**:
   - `AssetManager`의 FastAPI 백엔드 서버 생명주기(`lifespan`)에 텔레그램 롱폴링(Long-Polling) 루프와 장 마감/서버 장애 알림 스케줄러를 백그라운드 비동기 태스크로 내장합니다.
   - 단 하나의 백엔드 프로세스 구동만으로 웹 API 서빙과 텔레그램 봇 기능이 동시에 상시 동작하도록 일원화합니다.

2. **검증된 로컬 REST API 통신 유지**:
   - 텔레그램 CLI 커맨드(`/asset`, `/ratio`, `/tx`, `/daily`, `/yearly`, `/sync` 등) 처리 시, `Asset-jun-bot`에서 수개월간 안정적으로 검증된 `asset_client` 패턴을 그대로 활용하여 로컬 REST API 엔드포인트와 HTTP 통신합니다.
   - 백엔드 DB 스키마나 내부 서비스 구조 변경에 영향을 받지 않는 낮은 결합도(Decoupling)를 유지합니다.

3. **환경별 봇 활성화 격리**:
   - 텔레그램 롱폴링 충돌(409 Conflict)을 원천 방지하기 위해 프로덕션 환경(`APP_ENV=production`)에서만 텔레그램 봇이 구동되도록 제어합니다.
   - 로컬 개발 서버 구동(`dev.py`) 및 단위 테스트(`pytest`) 실행 시에는 봇이 기본적으로 비활성화됩니다.

4. **설정 일원화**:
   - `AssetManager`의 `settings.toml`에 `[telegram]`(봇 토큰, 허용 Chat ID, 활성화 플래그, 리포트 저장 경로) 및 `[naver]`(뉴스 검색 API 키) 섹션을 추가하고, 환경변수 오버라이드를 지원합니다.

5. **정기 보고서 에이전트 스킬 및 보조 스크립트 이관**:
   - 일간/주간/월간 리포트 5종 스킬(`korea-daily`, `korea-weekly`, `us-daily`, `us-weekly`, `asset-monthly`)과 관련 보조 스크립트(`query_market.py`, `query_news.py`, `query_us_news.py`, `send_telegram.py` 등)를 `AssetManager`로 이관합니다.
   - 불필요한 Gemini API 직접 호출 로직을 완전히 제거하고, Antigravity 에이전트 앱에서 스케줄 및 수동 트리거로 스킬을 실행할 수 있도록 정비합니다.

6. **기존 운영 프로세스 정리**:
   - 통합 및 검증 완료 후 PM2의 `asset-jun-bot` 데몬 프로세스는 안전하게 중지/삭제하며, `Asset-jun-bot` 레포지토리는 로컬 자산 상담/감사용으로만 보존합니다.

## User Stories

1. As an investor, I want to operate a single backend server process for both web management and telegram notifications, so that I don't have to manage multiple PM2 daemon processes.
2. As an investor, I want to send `/asset` in Telegram to receive my total portfolio valuation, total return rate, and benchmark comparison, so that I can monitor my assets on the go.
3. As an investor, I want to send `/ratio` in Telegram to inspect major and minor asset allocation percentages alongside rebalancing guidance, so that I maintain my target investment principles.
4. As an investor, I want to send `/tx` or `/transactions [limit]` in Telegram to view my most recent transactions, so that I can quickly verify executed trades.
5. As an investor, I want to send `/yearly` in Telegram to review my historical annual returns and dividend performance, so that I can evaluate long-term compound growth.
6. As an investor, I want to send `/daily [days]` in Telegram to check snapshot-based daily asset fluctuations, so that I can track recent short-term equity trends.
7. As an investor, I want to send `/sync [days]` in Telegram to manually trigger Kiwoom Securities transaction synchronization, so that new trade records are immediately recorded.
8. As an investor, I want to send `/help` in Telegram to view all available CLI commands and their descriptions, so that I know what capabilities are supported.
9. As an investor, I want unauthorized Telegram users to be completely blocked from executing commands or receiving asset data, so that my financial information remains secure.
10. As an investor, I want automatic transaction synchronization and Telegram notifications triggered at 18:10 on Korean market close and 07:10 on US market close, so that daily trading activities are registered without manual effort.
11. As an investor, I want urgent Telegram alerts whenever backend periodic background tasks (price updates, DB backups, stock sync) fail, so that I can immediately detect and troubleshoot server issues.
12. As a developer, I want Telegram bot long-polling to run inside the FastAPI application lifespan as an asyncio background task, so that the bot starts and shuts down cleanly alongside the web server.
13. As a developer, I want the bot to be automatically disabled in test (`pytest`) and local development (`dev.py`) environments, so that local runs never clash with the production bot via Telegram 409 Conflict errors.
14. As an administrator, I want to configure Telegram bot token, allowed user IDs, and Naver API keys in `settings.toml`, so that all application configurations are unified in a single file.
15. As an investor, I want to execute Korea Daily, Korea Weekly, US Daily, US Weekly, and Asset Monthly report skills within Antigravity directly from the AssetManager workspace, so that market and asset briefings are generated and delivered via Telegram.
16. As a developer, I want all obsolete Gemini API direct call dependencies and codes removed, so that the codebase remains lightweight and free of unused dependencies.
17. As an investor, I want rich formatted Markdown messages delivered cleanly to Telegram with emojis and bullet points instead of broken tables, so that readability on mobile devices is optimal.

## Implementation Decisions

1. **FastAPI Lifespan 백그라운드 태스크 통합**:
   - 백엔드 서버 구동 시(`lifespan` startup), `APP_ENV=production` 또는 설정된 활성화 플래그(`telegram.enabled = true`)를 확인하여 `TelegramBot.start_polling()` 비동기 태스크를 가동.
   - 서버 종료 시(`lifespan` shutdown), 실행 중인 롱폴링 및 스케줄러 태스크를 안전하게 취소(`cancel()`)하고 리소스를 정리.
   - 테스트 환경(`pytest`) 및 개발 서버(`dev.py`)에서는 기본 비활성화 가드를 적용하여 텔레그램 409 Conflict 원천 차단.

2. **텔레그램 모듈 구조 (관심사 분리)**:
   - `src/backend/telegram/` 패키지 구성:
     - `config`: `settings.toml` 및 환경 변수로부터 봇 토큰, 허가 Chat ID, 네이버 키, 스토리지 경로 로드.
     - `client`: `httpx.AsyncClient` 기반 텔레그램 Bot API 통신 (메시지 전송, 편집, Chat Action, getUpdates 롱폴링).
     - `renderer`: 수신 데이터를 텔레그램 전용 마크다운/HTML로 포맷팅 (표 서식 배제, 이모지 및 불릿 리스트 활용).
     - `commands`: CLI 커맨드 라우팅 및 비즈니스 디스패치 (`/help`, `/asset`, `/ratio`, `/tx`, `/yearly`, `/daily`, `/sync`, `/restart`).
     - `scheduler`: 평일 18:10(국내장), 화~토 07:10(미국장) 자동 동기화 루프 및 5분 주기 백엔드 태스크 상태 감시 루프.
     - `bot`: 롱폴링 이벤트 루프, 비인가 사용자 차단 가드, 커맨드 디스패치 총괄.
     - `asset_client`: `http://localhost:8000` REST API 호출을 전담하는 검증된 HTTP 클라이언트 서브패키지.

3. **설정 스키마 확장 (`settings.toml`)**:
   - `[telegram]` 섹션:
     - `bot_token`: 텔레그램 봇 토큰 문자열
     - `allowed_user_ids`: 정수형 Chat ID 배열
     - `enabled`: boolean (기본값: false, 프로덕션 환경에서 true)
     - `storage_dir`: 리포트 파일 생성 및 저장 상대/절대 경로 (기본 `./storage`)
   - `[naver]` 섹션:
     - `client_id`: 네이버 검색 API 클라이언트 ID
     - `client_secret`: 네이버 검색 API 시크릿
   - 환경변수(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS` 등)가 제공되면 toml 설정을 오버라이드.

4. **에이전트 스킬 5종 및 보조 스크립트 이관**:
   - `.agents/skills/`에 리포트 5종 스킬 폴더 배치:
     - `korea-daily-index-report`
     - `korea-weekly-index-report`
     - `us-daily-index-report`
     - `us-weekly-index-report`
     - `asset-monthly-report`
   - `scripts/`에 스킬 실행 보조 CLI 스크립트 배치:
     - `scripts/query_market.py`
     - `scripts/query_news.py`
     - `scripts/query_us_news.py`
     - `scripts/send_telegram.py`
     - `scripts/get_storage_dir.py`
     - `scripts/resolve_url.py`
   - 스크립트 내 API 호출 주소 및 설정 참조를 `settings.toml` 기반으로 일원화.

5. **Gemini API 직접 사용 코드 배제**:
   - 과거 `Asset-jun-bot`에 존재했던 Gemini API SDK 및 관련 키 설정은 완전히 배제.
   - 텔레그램 봇은 순수 CLI 커맨드 및 자동 알림만 처리하며, 자연어 텍스트 수신 시 CLI 안내 메시지만 응답.

## Testing Decisions

1. **테스트 품질 원칙**:
   - 구현 내부 세부사항 대신 외부 관측 가능한 동작(External Behavior)을 검증.
   - 외부 네트워크(Telegram Bot API 서버, Kiwoom API 등) 실제 호출은 `respx` 및 `unittest.mock`을 통해 100% Mocking하여 테스트 격리 보장.
   - 실제 운영 DB(`assets.db`)에 일체 영향을 주지 않는 인메모리/격리 테스트 환경 유지.

2. **테스트 대상 모듈 및 시나리오**:
   - **보안 가드 검증**: 허가된 Chat ID의 요청은 정상 처리되고, 비인가 Chat ID의 요청은 거부 메시지 발송 후 차단되는지 검증.
   - **CLI 커맨드 디스패치**: `/help`, `/asset`, `/ratio`, `/tx`, `/daily`, `/yearly`, `/sync` 수신 시 올바른 API를 호출하고 적절한 텔레그램 마크다운 메시지를 반환하는지 검증.
   - **롱폴링 오프셋 갱신**: `getUpdates` 수신 후 다음 `offset` 값이 정확하게 갱신되는지 검증.
   - **자동 동기화 및 장애 감지 스케줄러**: 장 마감 시각 조건 충족 시 자동 동기화 트리거 여부 및 백엔드 태스크 `failed` 상태 감지 시 경고 메시지 발송 여부 검증.
   - **환경별 봇 활성화 가드**: 테스트 환경 및 일반 개발 서버 기동 시 봇이 활성화되지 않는지 검증.

3. **기존 테스트 선례 (Prior Art)**:
   - `tests/test_kiwoom_service.py`, `tests/test_tasks.py` 등에서 사용된 pytest fixture, async mock 패턴 및 `Asset-jun-bot`의 `tests/test_telegram_bot.py` 테스트 케이스를 벤치마킹하여 적용.

## Out of Scope

- 텔레그램 봇을 통한 LLM 기반 자유 자연어 대화 기능 복구 (Antigravity 에이전트 대화로 일원화되었으므로 범위 밖).
- `Asset-jun-bot`의 `asset-advisor`, `asset-auditor` 스킬 이관 (사용자의 요구에 따라 해당 레포지토리에서 개별 로컬 도구로 유지).
- 텔레그램 Webhook 방식 도입 (롱폴링 방식으로 확정).
- 내부 DB 직접 접근 방식의 CLI 재작성 (검증된 로컬 REST API 통신 방식으로 확정).

## Further Notes

- 통합 완료 후 PM2 환경 설정(`ecosystem.config.js`)에서 `asset-jun-bot` 프로세스를 중지(`pm2 stop asset-jun-bot`)하고, `AssetManager`의 `asset-manager-prod` 프로세스만 단일 상시 가동하면 됩니다.
- Windows 콘솔 및 텔레그램 환경에서의 한글 인코딩 깨짐을 방지하기 위해 표준 인코딩 가드를 준수합니다.
