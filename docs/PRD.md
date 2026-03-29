# AssetDash Product Requirements Document (PRD)

## 1\. 프로젝트 개요 (Project Overview)

**AssetDash**는 기존 구글 스프레드시트 기반의 수동적인 자산 관리 방식에서 벗어나, 데이터 수집 및 시각화를 자동화하기 위해 구축하는 홈 서버 기반의 개인/가족 통합 자산 관리 웹 애플리케이션입니다.

### 1.1. 주요 목표 (Goals)

* **수작업 최소화:** 환율, 주가 등 외부 데이터의 자동 업데이트를 통해 월간 '업데이트 체크리스트' 수동 작업을 제거.
* **데이터 통제권 확보:** 구글 시트에 의존하지 않고, 자체 데이터베이스(RDBMS)를 구축하여 데이터 안정성과 쿼리 활용성 극대화.
* **통합 시각화 및 추적:** 부부(준, 성은)의 현금, 일반 주식, 배당주, 연금저축 등 다양한 형태의 자산과 계좌 내역을 하나의 대시보드에서 통합 추적.
* **접근성 향상:** PC뿐만 아니라 모바일 환경에서도 자산 현황을 부드럽게 조회할 수 있는 반응형 웹 구현.

## 2\. 핵심 기능 (Key Features)

1. **종합 대시보드 (Dashboard)**

   * 총 순자산, 총 투자수익률(ROI), 연도별/월별 자산 증감 추이 시각화.
   * 자산군별(현금, 주식, 채권 등) 및 계좌별 평가액 비율 차트 제공.
2. **데이터 업데이트 자동화 및 제어 (Automation \& Control)**

   * 환율 및 주식 현재가 API 연동 (버튼 클릭 시 수동 갱신 또는 스케줄러를 통한 자동 갱신).
3. **거래 내역 관리 (Transaction Management)**

   * 각 금융사에서 다운로드한 거래내역 CSV 파일 업로드 및 DB 자동 파싱/저장 기능 (또는 수동 입력 폼 제공).
4. **배당금 추적 (Dividend Tracking)**

   * 종목별 배당금 지급 내역 기록 및 월별/연별 배당 수익 시각화.

## 3\. 기술 스택 (Tech Stack)

* **데이터베이스 (Database): PostgreSQL**

  * 무료 오픈소스 RDBMS. 금융 데이터의 무결성을 보장하고 복잡한 시계열/수익률 계산 쿼리에 최적화됨.
* **프론트엔드 \& 백엔드 (UI \& Logic): Python Dash (Plotly)**

  * 파이썬 기반의 웹 프레임워크. 단일 언어로 복잡한 데이터 분석, 시각화, 백엔드 스크립트 실행(Callback)을 모두 처리 가능.
  * `dash-bootstrap-components`를 활용하여 모바일 반응형 UI 구현.
* **인프라 및 네트워크 (Infrastructure \& Network)**

  * **Host:** 개인 홈 서버 (또는 로컬 PC)
  * **Remote Access:** Tailscale (외부 네트워크에서 모바일로 홈 서버에 안전하게 접속하기 위한 VPN)

## 4\. 향후 진행 업무 (Next Action Items)

프로젝트의 성공적인 시작을 위해 다음 단계들을 순차적으로 진행합니다.

* \[ ] **Phase 1: 데이터베이스 설계 (DB Schema Design)**

  * 기존 구글 시트 데이터(자산현황, 계좌별 내역, 현금계좌 거래내역 등)를 분석하여 PostgreSQL 테이블 구조(Accounts, Transactions, Assets 등) 설계.
* \[ ] **Phase 2: Dash 프로토타이핑 (UI \& Callback Test)**

  * Dash를 이용해 간단한 웹 화면을 띄우고, '환율 업데이트' 등 버튼 클릭 시 파이썬 함수가 동작하는 기본 구조 테스트.
* \[ ] **Phase 3: 과거 데이터 마이그레이션 (Data Migration)**

  * 구글 시트의 과거 기록들을 CSV로 추출하여 설계된 PostgreSQL DB에 모두 이관.
* \[ ] **Phase 4: 대시보드 화면 구현 (Dashboard Development)**

  * DB에 적재된 데이터를 바탕으로 Dash/Plotly를 이용해 메인 자산 현황 차트와 표 구현.
* \[ ] **Phase 5: 모바일 최적화 및 원격 접속 설정 (Deployment)**

  * UI 모바일 반응형 작업 및 Tailscale을 통한 외부 접속 환경 구축.

