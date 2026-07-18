# 안티그래비티 MCP 서버 설정 가이드 (AssetManager)

이 문서는 안티그래비티(Antigravity) AI 에이전트가 본 프로젝트의 자산 현황 및 조회 도구(MCP 서버)를 정상적으로 인식하고 실행할 수 있도록 설정하는 가이드입니다.

---

## 1. 설정 파일 위치 설명

안티그래비티는 설정 범위(전역 또는 프로젝트별)에 따라 다음 경로의 `mcp_config.json` 파일을 참조합니다.

### 1) 프로젝트별 로컬 설정 (추천)
* **목적**: 이 프로젝트(`AssetManager`)를 활성화해서 작업할 때만 해당 MCP 도구를 사용합니다.
* **위치**: `[프로젝트 루트]\.agents\mcp_config.json`
* **설정 방식**: 협업 및 다른 환경으로 복사 시 경로 오류를 방지하기 위해 **상대 경로** 방식을 권장합니다.

### 2) 전역 설정
* **목적**: 안티그래비티가 어떤 프로젝트를 열든 공통적으로 이 MCP 도구를 사용할 수 있도록 합니다.
* **위치**: `C:\Users\<사용자명>\.gemini\config\mcp_config.json`
* **설정 방식**: 실행 경로에 구애받지 않도록 **절대 경로** 방식을 권장합니다.

---

## 2. MCP 설정 템플릿

상황에 맞는 설정을 복사하여 해당 경로의 `mcp_config.json`에 붙여넣어 사용하세요.

### 방법 A: 상대 경로 방식 (프로젝트 로컬 `.agents/mcp_config.json` 용)
* 프로젝트 루트가 작업 디렉터리(`cwd`)로 동작하며, 실행 명령어 또한 로컬에서 기동될 때 최적의 방법입니다.

```json
{
  "mcpServers": {
    "assetmanager": {
      "command": "uv",
      "args": [
        "run",
        "src/mcp/main.py"
      ],
      "env": {
        "MCP_BACKEND_URL": "http://localhost:8000",
        "PYTHONPATH": "."
      }
    }
  }
}
```

### 방법 B: 절대 경로 방식 (전역 설정 용)
* 다른 폴더나 절대 경로 기준의 환경에서 `AssetManager` 도구를 강제 기동하고 싶을 때 사용합니다.
* *주의: `c:/localrepo/AssetManager` 부분을 실제 프로젝트가 설치된 절대 경로로 변경해야 합니다.*

```json
{
  "mcpServers": {
    "assetmanager": {
      "command": "uv",
      "args": [
        "--directory",
        "c:/localrepo/AssetManager",
        "run",
        "src/mcp/main.py"
      ],
      "env": {
        "MCP_BACKEND_URL": "http://localhost:8000",
        "PYTHONPATH": "c:/localrepo/AssetManager"
      }
    }
  }
}
```

---

## 3. 실행 및 사전 요구사항

1. **의존성 동기화**: MCP 서버 실행을 위해 먼저 프로젝트 루트에서 가상환경 동기화를 수행해야 합니다.
   ```powershell
   uv sync
   ```
2. **백엔드 API 서버 기동**: 본 MCP 서버(`src/mcp/main.py`)는 데이터를 데이터베이스에서 직접 가져오지 않고 백엔드 API를 호출해 가져오도록 설계되어 있습니다. 따라서 도구들이 정상 작동하려면 백엔드가 기동 중이어야 합니다.
   * 개발/테스트용 실행:
     ```powershell
     uv run scripts/dev.py
     ```
   * 운영 서버 실행:
     ```powershell
     uv run scripts/run_prod.py
     ```
