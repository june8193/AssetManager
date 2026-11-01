# 02 — 웹 서버 재시작 API(`POST /api/v1/system/restart`) 및 개발 서버(`dev.py`) 자동 재기동 연동

**Spec:** [spec.md](../spec.md)

**What to build:**
데스크톱 웹에서 서버 재시작을 요청할 수 있는 `POST /api/v1/system/restart` 엔드포인트를 구현하고, 중복 재시작 요청 방지 및 `.restart_pending` 플래그 생성 후 HTTP 200 응답을 먼저 반환한 뒤 비동기 지연 종료를 트리거합니다. 운영 환경(PM2)에서는 전체 재기동 및 텔레그램 완료 알림과 연동되며, 개발 환경(`scripts/dev.py`)에서는 플래그 감지 시 스크립트를 종료하지 않고 백엔드 프로세스만 자동 재기동하도록 개선합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `POST /api/v1/system/restart` 호출 시 텔레그램 스토리지 경로(`telegram.storage_dir`) 및 재시작 감지 경로에 `.restart_pending` 플래그 파일을 생성하고 HTTP 200 응답(`{"status": "restarting", ...}`)을 반환한다.
- [x] 이미 `.restart_pending` 플래그 파일이 존재하는 상태에서 중복 재시작 요청 시 프로세스를 종료하지 않고 HTTP 409 Conflict 에러를 반환한다.
- [x] HTTP 응답이 클라이언트에 정상 도달할 수 있도록 비동기 지연(BackgroundTasks 또는 `asyncio.create_task` 딜레이) 후 종료 함수(`default_exit_system` / `sys.exit(0)`)를 호출한다.
- [x] 운영 환경(`run_prod.py` + PM2)에서 재기동 후 `TelegramBot.check_restart_flag()`가 웹에서 생성한 `.restart_pending` 플래그를 정상 감지하여 텔레그램 재시작 완료 알림을 보내고 플래그를 삭제한다.
- [x] 개발 환경(`scripts/dev.py`)에서 백엔드 프로세스가 종료되었을 때 `.restart_pending` 플래그가 존재하면 `dev.py` 전체를 종료하지 않고 플래그 삭제 후 백엔드 프로세스를 자동으로 재실행(respawn)한다.
- [x] 종료 함수를 모킹한 단위 테스트(`tests/test_system_api.py` 또는 `tests/test_telegram_restart.py`)가 작성되고 통과한다.
