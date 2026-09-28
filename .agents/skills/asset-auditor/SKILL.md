---
name: asset-auditor
description: 자산 점검, 포트폴리오 다기간 성과 진단, 매매 복기 및 1:1 투자 원칙 검증(Grill-Me) 수행 시 사용.
---

# 자산 점검 및 투자 복기 스킬 (asset-auditor)

## 1. 기본 원칙 및 태도
- **원격 MCP 전용 데이터 획득 (Positive Guardrails)**:
  - 로컬 DB(`src/assets.db`, `scripts/db_query.py` 등) 및 일회성 로컬 스크립트를 사용하지 않고, 오직 `assetmanager` 원격 MCP 도구(`get_benchmark_attribution`, `get_asset_summary`, `get_asset_ratios`, `get_transactions`, `get_market_history` 등)를 호출하여 서버의 최신 데이터를 획득한다.
  - 백엔드 소스코드 탐색이나 알고리즘 역공학 대신 등록된 전용 MCP 도구만을 호출한다.
- **단일 진실 공급원 (SSOT)**:
  - 리포트 및 저널 저장 경로는 하드코딩하지 않고, `uv run python scripts/get_storage_dir.py`를 실행하여 반환된 `STORAGE_DIR`을 유일한 기준 경로로 사용한다.
- **인터뷰 규칙 (Grill-Me)**:
  - 한 번에 단 하나의 구체적인 질문만 던진 후 사용자의 답변을 대기한다. 추상적이거나 모호한 답변 시 구체적 수치와 근거를 재질의한다.
- **비판적 가설 감사 (Thesis Auditor)**:
  - `docs/references/investment-principles.md`를 로드하여 핵심 원칙(독립적 Thesis, 대중 센티먼트 역발상, 자산 배분 통제) 부합 여부를 검증하고, 타인 추천이나 단순 소음(매크로/뉴스/차트) 추종 매매는 Bad Trade(🔴)로 비판적 피드백을 제시한다.
- **사례 기반 검증 (On-Demand Cases)**:
  - 장세 판단(2단계) 및 매매 복기(3단계) 시, `docs/references/trade-cases-index.md` 색인을 조회하고 매칭되는 `docs/references/cases/*.md`를 로드하여 객관적 근거 및 과거 교훈으로 인용한다.

---

## 2. 자산 점검 및 투자 복기 워크플로우 단계

### [1단계] 정보 수집 및 AI 예비 진단
1. **저장소 경로 및 이전 점검일 식별**:
   - `uv run python scripts/get_storage_dir.py` 실행 ➔ `STORAGE_DIR` 획득 (SSOT)
   - `STORAGE_DIR/asset_audits/asset_audit_journal.md` 조회 ➔ `LAST_AUDIT_DATE` 식별 및 **'현재 활성 전략(Active Strategy)'** 확인 (파일이 없거나 미기재 시 30일 전 기본값)
2. **미참조 시장/자산 보고서 계층적 탐색 및 로드 (Hierarchical Report Scanning)**:
   - `STORAGE_DIR/reports/` 디렉터리에서 `LAST_AUDIT_DATE` 이후 발행된 보고서를 다음 계층 순으로 수집:
     1) **월간 보고서**: `STORAGE_DIR/reports/asset_monthly/Asset_monthly_report_YYYYMM.md` (거시 결산 및 월간 자산 흐름)
     2) **주간 보고서**: `STORAGE_DIR/reports/{korea_market,us_market}/weekly/*.md` 중 최신 월간 보고서 이후 발행본 (섹터 순환매 및 주간 시장 맥락)
     3) **최신 일간 보고서**: `STORAGE_DIR/reports/{korea_market,us_market}/daily/*.md` 중 최신 주간 보고서 마감 이후 발행본 (최신 단기 시장 이슈)
   - 수집된 보고서의 핵심 요약을 예비 진단 컨텍스트로 통합
3. **다기간 벤치마크 성과 수집**:
   - `get_benchmark_attribution` MCP 도구를 1회 호출하여 4대 기간(1M, 3M, 1Y, YTD) 벤치마크 수익률(포트폴리오, S&P 500, NASDAQ, KOSPI) 및 S&P 500 대비 초과수익률(`Alpha = portfolio - sp500`) 일괄 수집
4. **보유 종목별 다기간 성과 및 기여도(Top/Bottom 3) 분석**:
   - `get_benchmark_attribution` 반환 데이터에서 포트폴리오 성과를 견인한 Top 3 기여 종목(`top_contributors_ytd`, `top_contributors_1m`) 및 하락을 유발한 Top 3 부진 종목(`top_detractors_ytd`, `top_detractors_1m`) 도출
   - 전체 보유 종목별 4대 기간 현지통화 주가 수익률 및 자산 가중 손익 기여도(`holdings_attribution`) 확보
5. **자산 배분 비중 및 시장 지표 수집**:
   - `get_asset_ratios` 호출 ➔ 자산군별 배분 비중 파악 (`sub_results`의 소분류 비중은 `current_amt / total_valuation * 100`으로 전체 자산 대비 비중 직접 계산)
   - `get_market_history` 호출 ➔ S&P 500 고점 대비 MDD 및 최근 20거래일 VIX 지표 확인
6. **AI 성과 원인 분석 4대 레이어 (Attribution Analysis)**:
   - **Cash Drag 효과**: 현금/달러 비중(`get_asset_ratios`) 기반 상승장/하락장 성과 영향 분석
   - **보유 종목 기여도**: Top 3 기여 종목 및 부진 종목의 포트폴리오 성과 영향 분석
   - **시장/국가 노출도**: 한국(KOSPI) vs 미국(S&P 500) 자산 배분 비중에 따른 시장 지수 영향 구분
   - **원칙 준수 및 매매 행태**: 미복기 거래 내역(`get_transactions`) 대조 및 원칙 준수 여부 점검
7. **예비 진단 브리핑 및 첫 번째 질의**:
   - 미참조 보고서 존재 시 상단에 `[미참조 시장/자산 보고서 요약 및 맥락]` 배치
   - `[다기간 벤치마크 성과 비교]` 표 렌더링:
     ```markdown
     ### [다기간 벤치마크 성과 비교]
     | 구분 | 1개월(1M) | 3개월(3M) | 1년(1Y) | YTD |
     | :--- | :---: | :---: | :---: | :---: |
     | **포트폴리오** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **S&P 500** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **NASDAQ** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **KOSPI** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **Alpha (vs S&P500)** | +X.X%p | +X.X%p | +X.X%p | +X.X%p |
     ```
   - `[보유 종목 다기간 성과 및 기여도 (Top Contributors & Detractors)]` 표 렌더링:
     ```markdown
     ### [보유 종목 다기간 성과 및 기여도 (Top Contributors & Detractors)]
     | 구분 | 종목명 (티커) | 비중(%) | 1M 수익률 | 1M 기여도 | YTD 수익률 | YTD 기여도 |
     | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
     | **Top 기여** | 종목 A (티커) | X.X% | +X.X% | +X.X%p | +X.X% | +X.X%p |
     | **Top 부진** | 종목 B (티커) | X.X% | -X.X% | -X.X%p | -X.X% | -X.X%p |
     ```
   - 4대 레이어 원인 분석 브리핑 후, 2단계 진입을 위한 첫 번째 Grill-Me 질문 단 1건을 출력하고 사용자 답변을 대기한다.
- **완료 검증 조건 (Checkable Completion Criteria)**:
  - [ ] `scripts/get_storage_dir.py`를 통해 `STORAGE_DIR`을 획득하고, 이전 점검일(`LAST_AUDIT_DATE`) 및 현재 활성 전략을 식별했는가?
  - [ ] 미참조 계층적 보고서(월간/주간/일간)를 탐색하고 핵심 요약을 도출했는가?
  - [ ] `get_benchmark_attribution` 호출로 4대 기간 벤치마크, Alpha, Top/Bottom 3 기여 종목, 전체 보유 종목 기여도 데이터를 획득했는가?
  - [ ] `get_asset_ratios` 및 `get_market_history`로 전체 자산 대비 소분류 비중과 시장 지표(MDD, VIX)를 수집했는가?
  - [ ] `[다기간 벤치마크 성과 비교]` 표와 `[보유 종목 다기간 성과 및 기여도 (Top Contributors & Detractors)]` 표, 4대 레이어 성과 분석 및 첫 번째 Grill-Me 질문 1건이 온전히 출력되어 사용자 입력을 대기하고 있는가?

### [2단계] 심리·장세 판단 및 자산 배분/리밸런싱 인터뷰 (Grill-Me)
1. 사용자 답변에 따른 투자 원칙 대조 및 피드백 (Grilling)
2. **다기간 성과 및 알파(Alpha) 연계 질의**:
   - 🟢 `Alpha > 0` (시장 상회): 과도한 위험 노출(특정 급등주 쏠림) 여부 점검 및 대중 과열 국면 대비 현금 비중 확대/소외 자산 분산 리밸런싱 계획 질의
   - 🔴 `Alpha < 0` (시장 하회): Cash drag(현금 비중 과다), 부진 종목(Detractors) 쏠림, 원칙 미준수 및 공포 국면 투매 여부 질의
3. **단기(1M/3M) 모멘텀 변화 및 펀더멘털 가설(Thesis) 검증 질의**:
   - 최근 1M/3M 모멘텀 급락 종목 및 부진 종목에 대해 `docs/references/investment-principles.md`의 **'독립적 펀더멘털 가설(Thesis)' 훼손 여부** 및 비중 조절 계획 질의
4. **유사 사례(Cases) 기반 패턴 점검**:
   - `docs/references/trade-cases-index.md` 색인을 확인하고 매칭되는 `docs/references/cases/*.md` 교훈을 인용하여 피드백 제공
5. **시장 센티먼트 및 동적 리밸런싱 준수 점검**:
   - S&P 500 고점 대비 MDD 및 최근 20거래일 VIX 수치를 대조
   - `docs/references/investment-principles.md`의 동적 리밸런싱 3단계 기준(공포 구간 확대 집행 또는 전고점 회복 시 분할 매도) 부합 여부를 점검하고 전략 질의
6. **현재 운용 전략(자산 배분 비율 스탠스) 갱신 질의**:
   - 추상적 답변 시 타겟 종목, 거래 규모, 집행 주기 등 구체화 요구
- **완료 검증 조건 (Checkable Completion Criteria)**:
  - [ ] 다기간 Alpha 원인 진단, 부진 종목 펀더멘털 가설 검증, 시장 센티먼트 판단에 대한 사용자의 구체적 답변을 확보했는가?
  - [ ] 동적 리밸런싱 기준 준수 여부 및 비중 조절 계획을 확인했는가?
  - [ ] 현재 활성 전략(목표 자산 비율 변동 여부 포함)의 유지 또는 갱신 여부를 확정했는가?

### [3단계] 미복기 거래 필터링 및 매매복기 인터뷰 (Grill-Me)
1. `get_transactions`로 `LAST_AUDIT_DATE` 이후의 미복기 BUY/SELL 거래 필터링
2. 거래가 없는 경우: "미복기 거래 없음"을 확인하고 4단계로 즉시 이동
3. 거래가 있는 경우 시간순 1건씩 릴레이 인터뷰 수행:
   - **가설 및 센티먼트 검증**:
     - 매수: 독립적 펀더멘털 가설(Thesis), 당시 주변 센티먼트(과열/공포), 목표 자산 배분 부합 여부 질의
     - 매도: 가설 훼손 여부, 목표 자산 배분 리밸런싱, 자금 회수 사유 질의
   - **소음 및 원칙 대조**: 뉴스/매크로/정치/차트 패턴 소음 추종 여부 검증 및 `docs/references/trade-cases-index.md` 매칭 사례 교훈 인용
4. **거래 등급 부여**:
   - 🟢 **Good Trade**: 독립적 펀더멘털 가설과 자산 배분 원칙에 부합한 거래
   - 🔴 **Bad Trade**: 매크로/뉴스/차트 소음 추종, 타인 추천, 단순 감정(FOMO/공포)에 의한 뇌동매매
   - 🟡 **Hold**: 판단 유보 또는 단순 계좌 간 이동
- **완료 검증 조건 (Checkable Completion Criteria)**:
  - [ ] `LAST_AUDIT_DATE` 이후의 모든 미복기 거래에 대해 1건씩 릴레이 인터뷰가 완료되었는가? (거래가 없는 경우 생략 조건 충족)
  - [ ] 각 거래마다 독립적 펀더멘털 가설, 센티먼트, 소음 추종 여부를 검증하고 최종 거래 등급(🟢/🔴/🟡)을 확정했는가?

### [4단계] 통합 보고서 및 마스터 저널 직접 저장
1. **저장 파일 경로 (SSOT)**:
   - 상세 보고서: `STORAGE_DIR/asset_audits/asset_audit_YYYYMMDD_HHMMSS.md`
   - 마스터 저널: `STORAGE_DIR/asset_audits/asset_audit_journal.md`
2. **저널 및 보고서 구조**:
   - **상단 섹션**: `# 현재 활성 전략 (Active Strategy)`
     - 최신 전략명, 갱신일자, 전략 기조 유지/변경 이력, 참조된 시장/자산 보고서 목록 (월간/주간/일간)
   - **다기간 벤치마크 성과 비교**:
     ```markdown
     ### [다기간 벤치마크 성과 비교]
     | 구분 | 1개월(1M) | 3개월(3M) | 1년(1Y) | YTD |
     | :--- | :---: | :---: | :---: | :---: |
     | **포트폴리오** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **S&P 500** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **NASDAQ** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **KOSPI** | +X.X% | +X.X% | +X.X% | +X.X% |
     | **Alpha (vs S&P500)** | +X.X%p | +X.X%p | +X.X%p | +X.X%p |
     ```
   - **보유 종목 다기간 성과 및 기여도 요약**:
     ```markdown
     ### [보유 종목 다기간 성과 및 기여도 요약]
     | 구분 | 종목명 (티커) | 비중(%) | 1M 수익률 | 1M 기여도 | YTD 수익률 | YTD 기여도 |
     | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
     | **Top 기여** | 종목 A (티커) | X.X% | +X.X% | +X.X%p | +X.X% | +X.X%p |
     | **Top 부진** | 종목 B (티커) | X.X% | -X.X% | -X.X%p | -X.X% | -X.X%p |
     ```
   - **하단 이력**: 회차별 점검 내역 누적 (최신 순 상단 삽입, 회차별 장세 판단, 참조한 보고서 요약, 다기간 성과 평가, 복기 거래 목록 및 평가 등급)
- **완료 검증 조건 (Checkable Completion Criteria)**:
  - [ ] `STORAGE_DIR/asset_audits/` 디렉터리에 타임스탬프 상세 보고서가 신규 저장되었는가?
  - [ ] 마스터 저널(`asset_audit_journal.md`) 상단에 활성 전략 및 참조 보고서 목록이 최신화되었는가?
  - [ ] 마스터 저널에 `[다기간 벤치마크 성과 비교]` 표와 `[보유 종목 다기간 성과 및 기여도 요약]` 표가 정확히 반영되었는가?
  - [ ] 이번 회차 감사 및 복기 결과(장세 판단, 거래별 가설 및 등급)가 마스터 저널 이력 최상단에 누적되었는가?

### [5단계] 메타인지 피드백 및 마무리
- 다기간 및 YTD S&P 500 대비 Alpha 성과와 Top/Bottom 기여도 분석에 기반한 최종 메타인지 피드백 및 투자 원칙 개선 권고안을 제시하고 워크플로우를 종료한다.
- **완료 검증 조건 (Checkable Completion Criteria)**:
  - [ ] 1~4단계 분석 및 인터뷰 결과에 기반한 핵심 성과 요약과 투자 원칙 준수 총평이 사용자에게 전달되었는가?
  - [ ] 다음 점검 시까지의 행동 지침 또는 개선 권고안이 명확히 제시되었는가?
