# 안티그래비티 MCP 서버 설정 가이드 (AssetManager)

이 문서는 안티그래비티(Antigravity) AI 에이전트가 본 프로젝트의 자산 현황, 원격 서버 DB 탐색 및 로그 조회 도구(MCP 서버)를 정상적으로 인식하고 실행할 수 있도록 설정하는 가이드입니다.

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

### 방법 B: 원격 서버 PC 접속 방식 (개발용 개인 노트북에서 실용 서버 DB/로그 조회 시)
* 개인 노트북에서 개발할 때 서버 PC(운영 DB가 위치한 PC)의 IP 주소(예: `http://192.168.x.x:8000`)를 `MCP_BACKEND_URL`로 지정합니다.

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
        "MCP_BACKEND_URL": "http://192.168.0.10:8000",
        "PYTHONPATH": "."
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

---

## 4. 지원하는 MCP 도구 목록

* **자산 및 성과 분석**: `get_asset_summary`, `get_asset_ratios`, `get_portfolio_status`, `get_yearly_stats`, `get_daily_stats`, `get_snapshots`, `get_transactions`
* **시장 및 종목 정보**: `get_watchlist_prices`, `get_market_history`, `get_stock_history`, `refresh_market_prices`, `check_market_holiday`, `get_market_indices`
* **원격 서버 DB 및 시스템 로그 점검 (신규)**:
  * `get_db_tables`: 서버 DB 테이블 목록 및 레코드 수 조회
  * `get_db_schema`: 특정 테이블의 컬럼, 데이터 타입 및 제약 조건 조회
  * `execute_db_query`: Read-Only SELECT SQL 실행 (최대 500행 제한)
  * `get_system_logs`: 서버 PC 백엔드 최신 시스템/에러 로그 조회 (레벨/키워드 필터 지원)
