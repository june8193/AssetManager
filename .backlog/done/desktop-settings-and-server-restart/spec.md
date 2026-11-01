# Spec: 데스크톱 웹 환경 설정 관리 및 서버 재시작 기능 (Desktop Web Settings Editor & Server Restart Spec)

Status: ready-for-agent

## Problem Statement (문제 정의)

현재 AssetManager에서 애플리케이션 전역 설정 파일(`settings.toml`)을 변경하거나 서버를 재시작하려면 다음과 같은 불편함이 존재합니다:

1. **호스트 파일 직접 접근 필요**:
   - 키움증권 REST API 계좌(`[[accounts]]`) 추가/수정, 데이터베이스 경로(`[database]`), 자동 백업 주기/경로(`[backup]`), 텔레그램 봇 연동(`[telegram]`), 네이버 뉴스 검색 API 인증키(`[naver]`) 등을 변경하려면 서버가 구동 중인 호스트 PC에 직접 접속하여 텍스트 에디터로 `settings.toml`을 열어야 합니다.
   - 수동으로 TOML 파일을 편집할 경우 따옴표 누락이나 배열 테이블(`[[accounts]]`) 문법 오류 등 휴먼 에러로 인해 서버 기동이 실패할 위험이 있습니다.

2. **웹 관리 화면 내 서버 재시작 수단 부재**:
   - 설정 변경 후 변경 사항(특히 텔레그램 봇/스케줄러, DB 연결 등 서버 시작 시 초기화되는 구성 요소)을 반영하거나 서버 상태를 리프레시하려면 터미널에서 PM2 명령어를 직접 입력하거나 텔레그램 앱에서 `/restart` 명령어를 보내야 합니다.
   - 데스크톱 웹 UI에서 설정을 수정하고 즉시 서버를 재시작한 뒤 재기동 완료 여부까지 한 화면에서 확인할 수 있는 통합 관리 워크플로우가 필요합니다.

## Solution (해결 방안)

1. **데스크톱 사이드바 메뉴 및 전용 페이지 신설 (`/system/settings`)**:
   - 좌측 사이드바(`Sidebar.jsx`)의 **`서버 점검`** 카테고리 하위에 **`환경 설정 및 서버 관리`** (`/system/settings`) 메뉴를 추가합니다.
   - 개인 단독 사용 환경에 맞춰 API 키·시크릿·봇 토큰 등 모든 설정 값을 별도 마스킹 없이 평문으로 즉시 확인하고 편집할 수 있도록 구성합니다.

2. **Dual Mode 설정 편집기 (구조화된 폼 UI + Raw TOML 텍스트 에디터) 및 주석 보존**:
   - **폼(Form) 편집 탭**: 섹션별(`키움 API 기본 설정`, `증권사 계좌 목록`, `데이터베이스 설정`, `자동 백업 설정`, `텔레그램 봇 설정`, `네이버 API 설정`) 구조화된 입력 UI와 계좌 카드 추가/삭제 기능을 제공합니다.
   - **Raw TOML 편집 탭**: `settings.toml` 파일 원문을 코드 에디터 형태로 직접 조회하고 수정할 수 있습니다.
   - **주석 보존**: `tomlkit` 라이브러리를 도입하여 폼 UI에서 필드를 수정하고 저장하더라도 기존 `settings.toml`에 작성된 한글 주석과 문서 구조가 손실되지 않도록 보존합니다.

3. **설정 유효성 검증, 자동 백업(`settings.toml.bak`) 및 즉시 복원**:
   - 저장 시 서버에서 TOML 문법 파싱 및 필수 스키마(필수 키 존재 여부, 타입, 양수 범위 등)를 검증하여 오류 발생 시 저장을 차단(HTTP 400)하고 명확한 오류 사유를 반환합니다.
   - 파일 덮어쓰기 직전 기존 `settings.toml`을 `settings.toml.bak`으로 자동 백업하며, 웹 UI에서 **`직전 설정 복원`** 버튼을 통해 언제든 직전 정상 설정으로 되돌릴 수 있습니다.
   - 저장 및 복원 완료 시 `get_settings(reload=True)`를 호출하여 런타임 메모리 설정 캐시를 즉시 갱신합니다.

4. **서버 재시작 기능 및 헬스체크 폴링 UI**:
   - 웹 UI 상단에 **`설정 저장`**, **`저장 후 서버 재시작`**, **`서버 재시작`**, **`직전 설정 복원`** 버튼을 제공합니다.
   - 백엔드 `POST /api/v1/system/restart` 엔드포인트는 중복 재시작 요청을 방지하고 `.restart_pending` 플래그 파일을 생성한 뒤, HTTP 200 응답을 클라이언트에 먼저 반환하고 비동기 지연(약 0.5~1초) 후 프로세스를 종료(`sys.exit(0)`)합니다.
   - **운영 환경 (`scripts/run_prod.py` + PM2)**: 기존 텔레그램 `/restart`와 동일하게 PM2가 프로세스 종료를 감지하여 전체 재기동하며, 재기동 후 텔레그램 봇이 `.restart_pending` 플래그를 확인하여 텔레그램 완료 알림을 발송합니다.
   - **개발 환경 (`scripts/dev.py`)**: 백엔드 프로세스 종료 시 `.restart_pending` 플래그가 존재하면 스크립트를 종료하지 않고 백엔드 프로세스만 자동으로 재기동하도록 개선합니다.
   - **프론트엔드 헬스체크 폴링**: 재시작 요청 직후 진행 상태 모달/배너를 표시하고 `/api/v1/system/tasks/status` 엔드포인트를 주기적으로 폴링하여 서버가 다시 온라인 응답을 줄 때 완료 안내와 함께 설정을 재조회합니다.

## User Stories (사용자 스토리)

1. As a user, I want to navigate to '환경 설정 및 서버 관리' (`/system/settings`) under the '서버 점검' menu on the desktop sidebar, so that I can manage server configurations and lifecycle in one place.
2. As a user, I want to view and edit all `settings.toml` fields in plain text without password masking through a structured Form UI, so that I can conveniently check and modify API keys, tokens, paths, and intervals.
3. As a user, I want to add, edit, or remove brokerage account entries (`[[accounts]]`) in the Form UI, so that I can manage multiple Kiwoom accounts without manually writing TOML array-of-tables syntax.
4. As a user, I want comments in `settings.toml` to be preserved even when I save changes from the Form UI, so that inline documentation in the configuration file is never lost.
5. As a user, I want to switch to a 'Raw TOML' editor tab to directly view and edit the raw `settings.toml` text, so that I have full control over the configuration file when needed.
6. As a user, I want the server to validate TOML syntax and required schema rules before saving, so that invalid configurations cannot corrupt `settings.toml` or prevent the server from starting.
7. As a user, I want the server to automatically back up `settings.toml` to `settings.toml.bak` before overwriting and provide a '직전 설정 복원' button, so that I can quickly roll back if I make a mistake.
8. As a user, I want a '설정 저장' button that saves the file and reloads the in-memory settings cache immediately, so that lightweight configuration changes take effect right away.
9. As a user, I want both a '저장 후 서버 재시작' button and a standalone '서버 재시작' button, so that I can restart the server immediately after changing startup-dependent settings or whenever needed.
10. As a user, I want to see a real-time restart progress indicator on the web page that polls the server until it comes back online, so that I know exactly when the server restart has completed.
11. As a user, I want web-triggered server restarts to work seamlessly in both production (PM2 full restart + Telegram completion notification) and development (`scripts/dev.py` automatic backend respawn), so that the feature is reliable across all environments.

## Implementation Decisions (구현 결정사항)

### 1. 의존성 및 주석 보존 TOML 처리 (`pyproject.toml`, `src/backend/services/settings_service.py`)
- `pyproject.toml`의 `dependencies`에 `tomlkit`을 추가합니다.
- 설정 파일 경로 결정:
  - `get_settings_filepath() -> Path`: `SETTINGS_PATH` 환경변수가 있으면 우선 사용하고, 없으면 프로젝트 루트의 `settings.toml`을 반환합니다 (단위 테스트에서 `monkeypatch` 또는 환경변수로 임시 파일 격리 가능).
  - 백업 파일 경로는 대상 설정 파일과 동일한 디렉터리의 `settings.toml.bak` (`filepath.with_suffix(".toml.bak")`)으로 지정합니다.
- **폼 데이터 병합 (Comment Preservation)**:
  - 기존 `settings.toml` 파일이 존재하면 `tomlkit.parse()`로 `TOMLDocument`를 로드한 뒤 변경된 키/섹션 값을 제자리(in-place) 업데이트하여 상단 및 인라인 한글 주석을 보존합니다.

### 2. 설정 스키마 및 유효성 검증 규칙
- **구조화된 설정 스키마 (`SystemSettingsPayload`)**:
  ```python
  class AccountSettingItem(BaseModel):
      broker: str = Field(..., min_length=1)
      account: str = Field(..., min_length=1)
      app_key: str = Field(..., min_length=1)
      secret_key: str = Field(..., min_length=1)

  class DatabaseSettingSection(BaseModel):
      url: str = Field(..., min_length=1)

  class BackupSettingSection(BaseModel):
      interval_hours: int = Field(..., ge=1)
      path: str = Field(..., min_length=1)
      max_files: int = Field(..., ge=1)

  class TelegramSettingSection(BaseModel):
      bot_token: str = ""
      allowed_user_ids: List[Union[int, str]] = Field(default_factory=list)
      enabled: bool = False
      storage_dir: str = "./storage"

  class NaverSettingSection(BaseModel):
      client_id: str = ""
      client_secret: str = ""

  class SystemSettingsData(BaseModel):
      base_url: str = Field(..., min_length=1)
      ws_url: str = ""
      database: DatabaseSettingSection
      accounts: List[AccountSettingItem] = Field(..., min_length=1)
      backup: BackupSettingSection
      telegram: TelegramSettingSection
      naver: NaverSettingSection
  ```
- **검증 규칙**:
  - `mode == "raw"`인 경우: 전달된 `raw_toml` 문자열을 `tomllib.loads()`(또는 `tomlkit.parse()`)로 먼저 파싱하여 문법 오류 시 HTTP 400(`"TOML 문법 오류: ..."`)을 반환하고, 파싱된 딕셔너리를 `SystemSettingsData.model_validate()`로 검증합니다.
  - `mode == "form"`인 경우: 전달된 `settings` 객체를 `SystemSettingsData`로 검증한 뒤 `tomlkit` 문서에 반영하고, 최종 직렬화된 TOML 문자열이 다시 정상 파싱되는지 교차 검증합니다.
  - `telegram.allowed_user_ids`의 모든 원소가 정수 변환 가능한지 검증합니다.

### 3. 백엔드 API 엔드포인트 (`src/backend/routers/system.py`)
- **`GET /api/v1/system/settings`**:
  - Response:
    ```json
    {
      "settings": { ...SystemSettingsData... },
      "raw_toml": "# 키움증권 REST API 서비스 URL\n...",
      "has_backup": true,
      "backup_modified_at": "2026-11-01T12:00:00"
    }
    ```
- **`PUT /api/v1/system/settings`**:
  - Request Body:
    ```json
    {
      "mode": "form",
      "settings": { ...SystemSettingsData... },
      "raw_toml": null
    }
    ```
    (또는 `"mode": "raw"`, `"raw_toml": "..."`)
  - 동작:
    1. 입력 데이터 문법 및 스키마 유효성 검증 (실패 시 400 Bad Request).
    2. 기존 `settings.toml`이 존재하면 `settings.toml.bak`으로 복사 백업 (`shutil.copy2`).
    3. 새 내용을 `settings.toml`에 UTF-8로 기록.
    4. `get_settings(reload=True)` 및 `KiwoomAuthManager._instance = None` 초기화를 통해 메모리 내 설정 싱글톤 캐시를 즉시 갱신.
    5. 갱신된 `GET /api/v1/system/settings` 동일한 응답 구조 반환.
- **`POST /api/v1/system/settings/restore`**:
  - 동작:
    1. `settings.toml.bak` 파일 존재 여부 확인 (없으면 404 Not Found).
    2. 백업 파일의 TOML 유효성 확인 후 `settings.toml`로 복원 복사.
    3. `get_settings(reload=True)` 및 `KiwoomAuthManager._instance = None` 초기화.
    4. 복원된 최신 설정 상태 반환.
- **`POST /api/v1/system/restart`**:
  - 동작:
    1. 재시작 플래그 파일 경로 확인:
       - `get_settings().telegram.storage_dir` 내 `.restart_pending` (기존 텔레그램 봇 `check_restart_flag`와 호환)
       - 프로젝트 루트(또는 `backups/`) 내 `.restart_pending` (`scripts/dev.py`에서 스토리지 경로 설정과 무관하게 즉시 감지할 수 있도록 보조 플래그 또는 공통 헬퍼 제공)
    2. 이미 재시작 플래그가 존재하면 HTTP 409 Conflict (`"이미 서버 재시작이 진행 중입니다."`) 반환.
    3. 플래그 파일을 생성하고 클라이언트에 `{"status": "restarting", "message": "서버를 재시작합니다. 약 5~8초 정도 소요됩니다..."}` (HTTP 200) 응답을 반환.
    4. 비동기 백그라운드 태스크(약 0.8초 대기 후 `default_exit_system()` 호출)를 통해 HTTP 응답 전송 완료 후 안전하게 `sys.exit(0)` 실행.

### 4. 개발 서버(`scripts/dev.py`) 백엔드 자동 재기동 지원
- `scripts/dev.py`의 메인 감시 루프에서 `backend_process.poll() is not None`일 때:
  - 재시작 플래그(`.restart_pending`)가 존재하는지 확인합니다.
  - 플래그가 존재하면 플래그를 정리하고 `backend_process`를 동일한 환경변수와 포트로 즉시 다시 `subprocess.Popen`으로 기동하여 개발/E2E 환경에서도 프론트엔드 종료 없이 백엔드가 자동 재기동되도록 처리합니다.
- 운영 환경(`scripts/run_prod.py`)에서는 기존 동작 그대로 `backend_process` 종료 시 루프를 탈출하여 PM2가 전체 프로세스를 재기동하고, 기동 후 `TelegramBot.check_restart_flag()`가 `.restart_pending`을 감지해 텔레그램 알림을 전송하고 플래그를 삭제합니다.

### 5. 프론트엔드 UI 및 서비스 (`src/frontend/src/pages/SystemSettingsPage.jsx`, `systemService.js`)
- `systemService.js` 확장:
  - `getSettings()`: `GET /api/v1/system/settings`
  - `updateSettings(payload)`: `PUT /api/v1/system/settings`
  - `restoreSettings()`: `POST /api/v1/system/settings/restore`
  - `restartServer()`: `POST /api/v1/system/restart`
- `Sidebar.jsx` & `App.jsx`:
  - `서버 점검` 하위 메뉴에 `{ path: '/system/settings', label: '환경 설정 및 서버 관리' }` 추가.
  - `DesktopAppRoutes`에 `<Route path="/system/settings" element={<SystemSettingsPage />} />` 등록.
- `SystemSettingsPage.jsx`:
  - 상단 헤더 및 액션 바: `설정 저장`, `저장 후 서버 재시작`, `서버 재시작`, `직전 설정 복원` (`has_backup`이 true일 때 활성화 및 백업 시각 표시).
  - 탭 UI: `구조화 폼 편집` 탭 / `Raw TOML 편집` 탭.
  - 재시작 상태 오버레이/모달:
    - 재시작 트리거 시 `"서버 재시작 중..."` 모달 표시.
    - 1.5초 후부터 1초 간격으로 `systemService.getTaskStatus()` 헬스체크 폴링(최대 30초 타임아웃).
    - 응답 성공 시 `"서버 재시작이 완료되었습니다."` 메시지 표시 후 `getSettings()`를 다시 로드.

## Testing Decisions (테스트 결정사항)

- **외부 동작 및 계약 중심 검증**:
  - 내부 함수 구현 디테일이 아닌 REST API 엔드포인트(`GET/PUT /api/v1/system/settings`, `POST /api/v1/system/settings/restore`, `POST /api/v1/system/restart`)의 요청/응답과 파일 시스템(임시 격리 경로) 상태 변화를 검증합니다.
- **설정 파일 및 DB 완벽 격리**:
  - 테스트 실행 시 실제 루트의 `settings.toml`이나 운영 DB(`src/assets.db`)가 절대 수정되지 않도록 `tmp_path`와 `monkeypatch`(`SETTINGS_PATH` 환경변수 등)를 사용하여 격리합니다.
  - 재시작 테스트 시 실제 테스트 러너 프로세스가 종료되지 않도록 `exit_func` 콜백 또는 `default_exit_system`을 모킹(`unittest.mock.patch`)합니다.
- **참고할 기존 테스트 심(Prior Art)**:
  - `tests/test_system_api.py`: FastAPI `TestClient` 및 `monkeypatch`를 활용한 `/api/v1/system/*` 테스트 패턴.
  - `tests/test_telegram_restart.py`: `.restart_pending` 플래그 생성, 중복 호출 방지, 종료 함수 모킹 테스트 패턴.
  - 프론트엔드 컴포넌트 테스트: `src/frontend/src/pages/*.test.jsx` (Vitest + React Testing Library).

## Out of Scope (범위 제외 사항)

- 모바일 웹 환경(`/m/*`)에서의 설정 파일 편집 및 서버 재시작 기능 (모바일은 안전을 위해 Read-Only 정책 유지).
- 다중 시점 설정 스냅샷 히스토리 관리 (본 스펙에서는 직전 정상 설정 `settings.toml.bak` 1개 자동 백업 및 복원에 집중).
- 웹 UI에서의 비밀번호/키 마스킹 토글 기능 (사용자 단독 사용 환경 요구사항에 따라 모든 필드를 평문으로 직관적 노출).

## Further Notes (기타 참고사항)

- `settings.toml` 저장 후 `KiwoomAuthManager` 싱글톤 인스턴스(`KiwoomAuthManager._instance = None`)와 `get_settings(reload=True)`를 함께 리셋하면, 키움 API 키나 계좌 정보, 백업 설정, 네이버 API 키 등은 서버를 재시작하지 않고 `'설정 저장'`만 눌러도 즉시 새 설정으로 동작합니다.
- 반면 텔레그램 봇 폴링 루프나 DB 엔진 URL 변경 등은 FastAPI `lifespan` 시작 시점에 바인딩되므로, UI 안내 문구에 `"텔레그램 봇 및 DB 경로 설정 변경 시 '저장 후 서버 재시작'을 권장합니다."` 팁을 함께 표시합니다.
