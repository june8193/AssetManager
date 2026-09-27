# Feature Spec: 지출 관리 MCP 도구 추가 (get_expense_summary, get_expenses, get_expense_categories)

Status: resolved

## Problem Statement

현재 AssetManager는 자산 현황, 포트폴리오 성과, 일별/월별 스냅샷, 시장 지수, 거래 내역 및 시스템 로그 조회를 위한 다양한 MCP(Model Context Protocol) 도구를 제공하고 있습니다. 또한 백엔드에는 지출 거래 내역 관리, 카테고리 분류, 월별/기간별 지출 통계 집계 API가 완벽히 구축되어 있습니다.

그러나 MCP 서버에는 지출(Expense) 관련 도구가 등록되어 있지 않아 다음과 같은 문제가 있습니다:

1. **투자 상담 및 재무 코칭 에이전트의 한계**:
   - `asset-advisor`나 `asset-auditor` 등의 에이전트가 사용자의 투자 성향이나 리밸런싱을 상담할 때, 실제 가용 현금 흐름(Cash Flow)과 월평균 지출 규모를 직접 조회할 수 없습니다.
   - 이로 인해 투자 원금 증액이나 저축 여력 분석 시 정밀한 맞춤형 조언을 제공하기 어렵습니다.
2. **지출 내역 및 패턴 대화형 조회 불가**:
   - 사용자가 "이번 달 식비로 얼마 썼어?", "최근 3개월간 지출 추이가 어떻게 돼?", "특정 가맹점 결제 내역 찾아줘"와 같은 일상적 질문을 에이전트에게 할 때, 에이전트가 직접 정형화된 MCP 도구로 답변할 수 없습니다.

## Solution

기존 백엔드 REST API(`GET /api/expenses/stats`, `GET /api/expenses`, `GET /api/expenses/categories`)를 활용하는 3개의 직관적인 읽기 전용 지출 관리 MCP 도구를 신규 추가합니다.

1. **`get_expense_summary`**:
   - 특정 월(`year_month`) 또는 기간(`start_month` ~ `end_month`) 동안의 총 지출액, 전월/전기간 대비 증감률, 월별 추이, 카테고리별 지출액/비중, 결제수단별 지출액/비중 등 종합 통계를 조회합니다.
2. **`get_expenses`**:
   - 조건별(기간, 소유주, 카테고리, 가맹점/메모 검색어, 페이징) 지출 상세 거래 내역 목록을 조회합니다.
   - 특히 에이전트가 카테고리 ID를 몰라도 자연스러운 카테고리명(예: `'식비'`, `'주거/통신'`)으로 바로 필터링할 수 있도록 도구 내부에서 카테고리 자동 매핑 편의 기능을 제공합니다.
3. **`get_expense_categories`**:
   - 시스템에 등록된 카테고리 마스터 목록(ID, 이름, 색상 등)을 조회하여 에이전트가 분류 체계를 사전에 파악하거나 사용자에게 알맞은 카테고리를 안내할 수 있도록 지원합니다.
4. **에이전트 스킬 연계**:
   - `asset-advisor` 스킬에 `assetmanager` MCP를 통해 지출 내역 및 요약 통계를 함께 조회하여 현금 흐름 및 저축 여력을 진단할 수 있다는 안내를 간략히 추가합니다.

## User Stories

1. As an AI financial advisor agent, I want to call `get_expense_summary(year_month="2026-08")`, so that I can analyze the user's monthly spending total and major cost categories to assess their savings buffer.
2. As an AI financial advisor agent, I want to call `get_expense_summary(start_month="2026-01", end_month="2026-08")`, so that I can track multi-month spending trends and average living expenses for long-term retirement and portfolio planning.
3. As an AI agent answering user queries, I want to call `get_expenses(category_name="식비", year_month="2026-08")`, so that I can look up dining/grocery transactions without needing to look up internal integer IDs first.
4. As an AI agent, I want to call `get_expenses(search="스타벅스")`, so that I can quickly find recent coffee expenses across multiple months.
5. As an AI agent, I want to call `get_expenses(owner="장준", year_month="2026-08")`, so that I can distinguish individual family member spending patterns.
6. As an AI agent, I want to call `get_expense_categories()`, so that I can discover valid categories when recommending expense categorizations or reviewing budgets.
7. As a system maintainer, I want all expense MCP tools to follow the existing `src/mcp/tools/*.py` and `api_client` pattern, so that codebase consistency and test isolation are maintained.

## Implementation Decisions

1. **신규 MCP 도구 모듈 신설**:
   - 위치: `src/mcp/tools/expenses.py`
   - 비동기 클라이언트(`src.mcp.client.api_client`)를 사용하여 기존 백엔드 FastAPI 엔드포인트를 호출하는 일관된 방식을 유지합니다.
   - 반환 타입은 기존 도구들과 동일하게 `dict` 형태(오류 발생 시 `{"error": "..."}`)를 반환합니다.

2. **도구별 인터페이스 사양**:
   - **`get_expense_summary`**:
     - 매개변수: `year_month: Optional[str] = None`, `start_month: Optional[str] = None`, `end_month: Optional[str] = None`, `owner: Optional[str] = None`
     - 연동 엔드포인트: `GET /api/expenses/stats`
     - 반환 구조: `ExpenseStatsResponse` 기반 dict (`period_total`, `monthly_trends`, `category_breakdown`, `payment_method_breakdown`, 증감률 등)
   - **`get_expenses`**:
     - 매개변수: `year_month: Optional[str] = None`, `start_month: Optional[str] = None`, `end_month: Optional[str] = None`, `owner: Optional[str] = None`, `category_name: Optional[str] = None`, `category_id: Optional[int] = None`, `search: Optional[str] = None`, `limit: int = 50`, `offset: int = 0`
     - 연동 엔드포인트: `GET /api/expenses`
     - 카테고리 매핑 로직: `category_name`이 제공되고 `category_id`가 없는 경우, 먼저 카테고리 목록을 내부 조회하여 일치하는 카테고리명을 찾아 `category_id` 파라미터로 백엔드에 요청. 일치하는 항목이 없을 경우 빈 목록 반환 또는 명확한 결과 반환.
     - 반환 구조: `{"total_count": len(expenses), "expenses": [...]}`
   - **`get_expense_categories`**:
     - 매개변수: 없음
     - 연동 엔드포인트: `GET /api/expenses/categories`
     - 반환 구조: `{"categories": [...]}`

3. **MCP 서버 진입점 등록**:
   - `src/mcp/main.py`에 세 도구를 import하고 `mcp.tool()`로 명시적 등록.

4. **스킬 프롬프트 갱신**:
   - `.agents/skills/asset-advisor/SKILL.md`에 지출 MCP 도구 활용 가이드 한 단락 추가.

## Testing Decisions

- **좋은 테스트의 기준**:
  - 외부 백엔드 실제 통신(실서버 구동)에 의존하지 않고, MCP 도구의 계약(Contract) 및 외부 동작을 모킹(mock)하여 격리 검증합니다.
  - 파라미터가 백엔드 API 엔드포인트에 올바른 쿼리 스트링으로 전달되는지 검증합니다.
  - `category_name`을 전달했을 때 카테고리 목록 조회를 통한 ID 자동 변환 매핑이 정확히 일어나는지 검증합니다.
  - 백엔드 HTTP/네트워크 에러 발생 시 `{"error": ...}` 형태의 일관된 응답이 반환되는지 검증합니다.
- **테스트 Seam (1개 Seam)**:
  - **MCP 도구 함수 인터페이스 Seam (`tests/test_mcp_expenses.py`)**: `api_client.get`을 비동기 모킹하여 `get_expense_summary`, `get_expenses`, `get_expense_categories` 함수의 입력 및 반환 포맷 검증.
- **기존 테스트 참고 (Prior Art)**:
  - `tests/test_mcp_market.py` 또는 `tests/test_mcp_system_tools.py`

## Out of Scope

- 지출 내역 신규 등록, 수정, 삭제(CUD) MCP 도구 (추후 대화형 입력 요구 발생 시 별도 구현)
- 카테고리 생성/수정/삭제 및 자동분류 룰 관리 MCP 도구
- 백엔드 REST API 신규 엔드포인트 개발 (기존 완성된 엔드포인트 100% 재활용)

## Further Notes

- 모든 파이썬 스크립트 실행 및 테스트는 `uv run pytest tests/test_mcp_expenses.py`를 사용합니다.
- 코딩 컨벤션 및 언어 정책(한국어 docstring 및 주석)을 철저히 준수합니다.
