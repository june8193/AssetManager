# 자산 비율 계산기 (Asset Allocation Calculator) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 설정한 목표 비중에 따라 현재 자산과의 차이를 계산하고 리밸런싱 가이드를 제공하는 독립 페이지를 구축합니다.

**Architecture:** 계층적 카테고리(대분류-중분류) 구조를 지원하며, 전체 자산 평가액에 추가 투자금을 더해 목표 금액을 산출하는 로직을 Backend(RatioService)에서 처리합니다.

**Tech Stack:** FastAPI, SQLAlchemy (SQLite), React, TailwindCSS, Lucide React

---

### Task 1: 데이터베이스 스키마 및 모델 정의

**Files:**
- Modify: `src/backend/models.py`
- Create: `src/backend/migration_v2.py` (또는 기존 migration.py 확장)
- Test: `tests/test_ratio_model.py`

- [ ] **Step 1: TargetRatio 모델 정의**
```python
class TargetRatio(Base):
    __tablename__ = "target_ratios"
    id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String, index=True)
    category_type = Column(String) # 'major', 'sub'
    target_percentage = Column(Float, default=0.0)
    parent_category = Column(String, nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

- [ ] **Step 2: 마이그레이션 실행 및 모델 검증 테스트 작성**
- [ ] **Step 3: Commit**

### Task 2: Backend RatioService 구현

**Files:**
- Create: `src/backend/services/ratio_service.py`
- Test: `tests/test_ratio_service.py`

- [ ] **Step 1: 계산 로직 구현 (calculate_rebalancing)**
  - 현재 자산 평가액 합산 (DashboardService 활용 가능성 검토)
  - `total_target = current_total + additional_cash`
  - `major_target_amt = total_target * (major_ratio / 100)`
  - `sub_target_amt = major_target_amt * (sub_ratio / 100)`
- [ ] **Step 2: TDD 기반 로직 검증**
- [ ] **Step 3: Commit**

### Task 3: API 엔드포인트 구현

**Files:**
- Create: `src/backend/routers/ratios.py`
- Modify: `src/backend/main.py`

- [ ] **Step 1: GET/POST 라우터 작성**
- [ ] **Step 2: main.py에 라우터 등록**
- [ ] **Step 3: API 동작 확인 (Swagger UI)**
- [ ] **Step 4: Commit**

### Task 4: Frontend 비율계산기 페이지 구현

**Files:**
- Create: `src/frontend/src/pages/RatioCalculatorPage.jsx`
- Create: `src/frontend/src/hooks/useRatios.js`
- Modify: `src/frontend/src/App.jsx`
- Modify: `src/frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: useRatios 커스텀 훅 작성 (API 연동)**
- [ ] **Step 2: 목표 비중 설정 폼 UI 구현**
- [ ] **Step 3: 계산 결과 요약 테이블 구현**
- [ ] **Step 4: 사이드바 메뉴 추가 및 라우팅 설정**
- [ ] **Step 5: 전체 통합 테스트**
- [ ] **Step 6: Commit**
