# 자산 배분 비율 계산기 계층화 및 실시간 비교 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB에 정의된 카테고리를 기반으로 대분류 > 중분류 > 종목 계층을 자동 구성하고, 입력 모드(상대/절대)에 따라 실시간으로 리밸런싱 금액을 계산하는 기능을 구현합니다.

**Architecture:** 
- Backend: `Asset`, `TargetRatio`, `Transaction` 데이터를 조합하여 계층 구조를 반환하는 Service 및 API 개발
- Frontend: React 기반의 Accordion형 테이블 구성, `useMemo`를 활용한 실시간 계산 로직 적용

**Tech Stack:** Python (FastAPI, SQLAlchemy, Pytest), React (Vite, TailwindCSS, Vitest)

---

### Task 1: Backend - 계층형 데이터 구조 API 개발

**Files:**
- Modify: `src/backend/services/ratio_service.py`
- Modify: `src/backend/routers/ratios.py`
- Test: `tests/test_ratio_hierarchy.py`

- [ ] **Step 1: 계층형 데이터 조회를 위한 테스트 코드 작성**
```python
def test_get_ratio_hierarchy(client):
    response = client.get("/api/ratios/hierarchy")
    assert response.status_code == 200
    data = response.json()
    assert "hierarchy" in data
    # 대분류, 중분류, 종목 구조 확인
```

- [ ] **Step 2: 테스트 실행 및 실패 확인**
`uv run pytest tests/test_ratio_hierarchy.py`

- [ ] **Step 3: RatioService에 계층 데이터 생성 로직 구현**
`Asset` 테이블에서 유니크한 major/sub category를 추출하고, 현재 보유 종목을 매핑하여 트리 구조 생성.

- [ ] **Step 4: API 엔드포인트 구현**
`GET /api/ratios/hierarchy` 엔드포인트를 `routers/ratios.py`에 추가.

- [ ] **Step 5: 테스트 통과 확인 및 커밋**
`uv run pytest tests/test_ratio_hierarchy.py`

---

### Task 2: Backend - 목표 비중 저장 API 확장

**Files:**
- Modify: `src/backend/models.py`
- Modify: `src/backend/routers/ratios.py`

- [ ] **Step 1: TargetRatio 모델에 category_type 및 mode 컬럼 추가 (필요시)**
- [ ] **Step 2: 일괄 저장(Bulk Save) API 구현**
`POST /api/ratios/targets`에서 리스트 형태로 받아 처리.

---

### Task 3: Frontend - 계층형 테이블 및 Accordion UI 구현

**Files:**
- Create: `src/frontend/src/components/RatioCalculator/HierarchyTable.jsx`
- Modify: `src/frontend/src/pages/RatioCalculatorPage.jsx`

- [ ] **Step 1: 기본적인 대분류 리스트 렌더링 및 토글 로직 구현**
- [ ] **Step 2: 중분류 및 종목 행(Row) 컴포넌트 개발**
- [ ] **Step 3: TailwindCSS를 이용한 들여쓰기 및 아이콘(▶/▼) 적용**

---

### Task 4: Frontend - 실시간 리밸런싱 계산 로직 구현

**Files:**
- Create: `src/frontend/src/hooks/useRatioCalculator.js`

- [ ] **Step 1: 입력 모드(상대/절대) 스위칭 상태 관리**
- [ ] **Step 2: 목표 비중 입력 시 즉시 조정액을 계산하는 useMemo 훅 작성**
- [ ] **Step 3: '추가 투자금' 반영 로직 추가**

---

### Task 5: 전체 통합 테스트 및 E2E 검증

- [ ] **Step 1: 실제 데이터를 입력하고 계산 결과가 디자인 목업과 일치하는지 확인**
- [ ] **Step 2: '목표 비중 저장' 후 새로고침 시 데이터 유지 확인**
