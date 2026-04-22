# AssetManager

**AssetManager**는 기존 구글 스프레드시트 기반의 수동적인 자산 관리 방식에서 벗어나, 데이터 수집 및 시각화를 자동화하기 위해 구축하는 홈 서버 기반의 개인/가족 통합 자산 관리 웹 애플리케이션입니다.

## 1. 주요 목표 (Goals)

* **수작업 최소화:** 환율, 주가 등 외부 데이터의 자동 업데이트를 통해 월간 '업데이트 체크리스트' 수동 작업을 제거.
* **데이터 통제권 확보:** 구글 시트에 의존하지 않고, 자체 데이터베이스를 구축하여 데이터 안정성과 쿼리 활용성 극대화.
* **통합 시각화 및 추적:** 부부(준, 성은)의 현금, 일반 주식, 배당주, 연금저축 등 다양한 형태의 자산과 계좌 내역을 하나의 대시보드에서 통합 추적.
* **접근성 향상:** PC뿐만 아니라 모바일 환경에서도 자산 현황을 부드럽게 조회할 수 있는 반응형 웹 구현.

## 2. 핵심 기능 (Key Features)

1. **종합 대시보드 (Dashboard)**
   * 총 순자산, 총 투자수익률(ROI), 연도별/월별 자산 증감 추이 시각화.
   * 자산군별(현금, 주식, 채권 등) 및 계좌별 평가액 비율 차트 제공.
2. **데이터 업데이트 자동화 및 제어 (Automation & Control)**
   * 환율 및 주식 현재가 API(키움증권 등) 연동 (수동 갱신 또는 스케줄러 자동 갱신 및 실시간 웹소켓 연동).
3. **거래 내역 관리 (Transaction Management)**
   * 각 금융사에서 다운로드한 거래내역 CSV 파일 업로드 및 DB 자동 파싱/저장 기능.
4. **배당금 추적 (Dividend Tracking)**
   * 종목별 배당금 지급 내역 기록 및 월별/연별 배당 수익 시각화.

## 3. 기술 스택 (Tech Stack)

### Backend (Python)
* **Framework:** FastAPI, Uvicorn (REST API 서버)
* **Database & ORM:** SQLite (초기 개발용), SQLAlchemy
* **Package Management:** `uv`
* **External API:** 키움증권 Open API (실시간 주가 및 계좌 연동)

### Frontend (React)
* **Framework & Build:** React 19, Vite
* **Styling:** Tailwind CSS v4
* **Package Management:** `npm`

### Infrastructure & Network
* **Host:** 개인 홈 서버 (또는 로컬 PC)
* **Remote Access:** Tailscale (외부 네트워크 접속 보안 가상망)
