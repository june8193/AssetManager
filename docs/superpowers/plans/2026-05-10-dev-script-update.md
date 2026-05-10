# dev.py 동적 포트 및 자동 종료 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dev.py`를 개선하여 동적 포트 할당과 브라우저 종료 시 자동 서버 종료 기능을 구현합니다.

**Architecture:** `dev.py`에서 빈 포트를 찾아 환경 변수로 전달하고, 백엔드는 WebSocket 하트비트를 통해 클라이언트 유무를 감지하여 자동 종료를 수행하며, 프론트엔드는 개발 모드에서 하트비트를 유지합니다.

**Tech Stack:** Python (FastAPI, uvicorn), JavaScript (React, Vite, WebSocket), Shell (PowerShell)

---

### Task 1: 백엔드 하트비트 WebSocket 구현

**Files:**
- Modify: `src/backend/main.py`
- Test: `tests/test_dev_heartbeat.py` (New)

- [ ] **Step 1: 하트비트 및 자동 종료 로직을 포함하는 테스트 작성**
- [ ] **Step 2: 백엔드에 `/ws/dev/heartbeat` 엔드포인트 및 종료 로직 추가**
- [ ] **Step 3: 테스트 실행 및 검증**
- [ ] **Step 4: 커밋**

### Task 2: 프론트엔드 하트비트 클라이언트 구현

**Files:**
- Modify: `src/frontend/src/App.jsx`

- [ ] **Step 1: 개발 모드에서 백엔드 WebSocket에 연결하는 `useEffect` 추가**
- [ ] **Step 2: 수동 검증 준비**
- [ ] **Step 3: 커밋**

### Task 3: 동적 포트 할당 및 설정 연동

**Files:**
- Modify: `scripts/dev.py`
- Modify: `src/backend/main.py` (CORS 설정)
- Modify: `src/frontend/vite.config.js` (Proxy 설정)

- [ ] **Step 1: `dev.py`에 사용 가능한 포트를 찾는 유틸리티 함수 추가**
- [ ] **Step 2: `dev.py`에서 찾은 포트를 환경 변수로 전달하도록 수정**
- [ ] **Step 3: 백엔드 CORS와 프론트엔드 Vite Proxy에서 환경 변수를 읽도록 수정**
- [ ] **Step 4: 커밋**

### Task 4: 통합 테스트 및 마무리

**Files:**
- Modify: `scripts/dev.py` (브라우저 자동 열기 추가)

- [ ] **Step 1: `dev.py` 실행 시 브라우저가 자동으로 열리도록 수정**
- [ ] **Step 2: 전체 시나리오 통합 테스트 (포트 충돌 방지 및 자동 종료 확인)**
- [ ] **Step 3: 최종 커밋**
