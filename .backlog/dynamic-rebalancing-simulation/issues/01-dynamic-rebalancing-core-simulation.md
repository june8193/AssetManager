# 01 — 동적 리밸런싱 핵심 시뮬레이션 엔진 및 UI 탭 구현

**What to build:**
사용자가 자산배분 시뮬레이션 페이지 상단의 신규 `[동적 리밸런싱 (MDD/VIX)]` 탭에 진입하여, 기본 주식/현금 비중(예: 60/40), 운용 모드(거치식/적립식), 기간(5Y, 10Y 등)을 선택하고 백테스트를 실행하면 S&P 500 일별 낙폭과 VIX 지수의 AND 결합 공포 단계에 따라 주식 비중을 확대하고 정기 점검일에 정상 복귀하는 동적 전략의 성과를 3개 벤치마크(동적 전략, 일반 정기 리밸런싱, S&P 500 단순 보유) 비교 차트와 성과 요약 카드(CAGR, MDD, 누적수익률)로 확인할 수 있는 기본 동작 완성.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] 백엔드 `SimulationService`에 일별 S&P 500 최고점(ATH) 대비 낙폭 및 VIX 종가 기반의 AND 조건 판정 및 월말 정상 복귀 동적 리밸런싱 알고리즘 구현
- [x] 백엔드 `POST /api/simulation/run-dynamic` REST API 엔드포인트 구현 (유효성 검사, 거치식/적립식 지원, 3개 벤치마크 데이터셋 반환)
- [x] 프론트엔드 `AssetAllocationSimulationPage`에 `[동적 리밸런싱 (MDD/VIX)]` 탭 추가
- [x] 기본 비중 슬라이더, 기간 선택기, 거치식/적립식 모드 토글, 3개 벤치마크 비교 Recharts 라인 차트 및 요약 카드 렌더링
- [x] 백엔드 API 유닛 테스트(`tests/test_simulation_dynamic.py`) 작성 및 통과

