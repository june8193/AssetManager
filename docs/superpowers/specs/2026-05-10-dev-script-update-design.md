# Design Spec: dev.py Dynamic Ports & Auto-Shutdown

## Overview
`scripts/dev.py`를 개선하여 여러 작업 공간(Git Worktree)에서 충돌 없이 개발 서버를 구동할 수 있도록 동적 포트 할당 기능을 추가하고, 브라우저 종료 시 서버가 자동으로 정지되도록 하트비트 메커니즘을 구현합니다.

## Requirements
- `dev.py` 실행 시 사용 가능한 빈 포트를 자동으로 찾아 할당.
- 브라우저를 닫으면 백엔드와 프론트엔드 서버가 자동으로 종료됨.
- 여러 워크트리에서 동시에 서버를 띄울 수 있어야 함.

## Architecture

### 1. Dynamic Port Selection (`scripts/dev.py`)
- `socket` 모듈을 사용하여 8000번(백엔드) 및 5173번(프론트엔드)부터 비어있는 포트를 검색합니다.
- 찾은 포트 번호를 환경 변수(`ASSET_MANAGER_BACKEND_PORT`, `ASSET_MANAGER_FRONTEND_PORT`)로 프로세스에 전달합니다.

### 2. Heartbeat Mechanism
- **Backend (`src/backend/main.py`)**:
    - WebSocket 엔드포인트 `/ws/dev/heartbeat`를 추가합니다.
    - 연결된 클라이언트 수를 전역적으로 관리합니다.
    - 모든 연결이 끊어지면 10초 타이머를 시작합니다.
    - 타이머 종료 전까지 재연결이 없으면 백엔드 프로세스를 종료(`SIGINT`)합니다.
    - 이 로직은 `DEBUG=true` 환경 변수가 있을 때만 활성화됩니다.
- **Frontend (`src/frontend/src/App.jsx`)**:
    - 개발 모드(`import.meta.env.DEV`)인 경우 백엔드 하트비트 WebSocket에 연결합니다.
    - 페이지 새로고침 등을 고려하여 연결이 끊어져도 자동으로 재시도합니다.

### 3. Coordination
- **Vite Proxy (`src/frontend/vite.config.js`)**:
    - 환경 변수에서 백엔드 포트를 읽어 프록시 타겟을 동적으로 설정합니다.
- **Backend CORS (`src/backend/main.py`)**:
    - 환경 변수에서 프론트엔드 포트를 읽어 CORS 허용 목록에 추가합니다.

## Data Flow
1. `dev.py` -> 포트 찾기 -> 환경 변수 설정 -> 서버 실행
2. 프론트엔드 로드 -> 백엔드 WebSocket 연결
3. 사용자 브라우저 종료 -> WebSocket 단절 -> 백엔드 클라이언트 수 0 -> 10초 대기 -> 백엔드 종료
4. `dev.py`가 백엔드 종료 감지 -> 프론트엔드 정리 및 전체 종료

## Testing Strategy
- **Manual Test**: `dev.py`를 실행하여 브라우저가 자동으로 열리는지 확인하고, 포트가 기본값과 다른지 확인합니다.
- **Auto-Shutdown Test**: 브라우저 탭을 닫고 약 10초 후에 터미널의 서버들이 종료되는지 확인합니다.
- **Conflict Test**: 다른 터미널에서 `dev.py`를 하나 더 실행하여 다른 포트로 정상 작동하는지 확인합니다.
