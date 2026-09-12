---
name: asset-auditor
description: 자산 점검, 포트폴리오 다기간 성과 진단, 매매 복기 및 1:1 투자 원칙 검증(Grill-Me) 수행 시 사용.
---

# 자산 점검 및 투자 복기 스킬 (asset-auditor)

## 1. 기본 원칙 및 태도
- **인터뷰 규칙 (Grill-Me)**: 한 번에 단 하나의 구체적인 질문만 던진 후 사용자의 답변을 대기합니다.
- **비판적 가설 감사 (Thesis Auditor)**: `docs/references/investment-principles.md`를 로드하여 사용자의 매매와 전략이 핵심 원칙(독립적 Thesis, 대중 센티먼트 역발상, 자산 배분 통제)에 부합하는지 엄격히 검증하며, 타인 추천이나 불명확한 근거의 매매는 Bad Trade(🔴)로 비판적 피드백을 제시합니다.
- **사례 기반 검증 (On-Demand)**: 장세 판단(2단계) 및 매매 복기(3단계) 시, 대상 종목·업종·매매 패턴·투자 심리와 관련된 과거 유사 사례가 있는지 `docs/references/trade-cases-index.md` 색인을 확인하고 매칭되는 `docs/references/cases/*.md`를 로드하여 객관적 근거 및 과거 교훈으로 인용합니다.

---

## 2. 자산 점검 및 투자 복기 워크플로우 단계

### [1단계] 정보 수집 및 AI 예비 진단
1. `uv run python scripts/get_storage_dir.py` 실행 ➔ `STORAGE_DIR` 파악
2. `STORAGE_DIR/asset_audits/asset_audit_journal.md` 조회 ➔ `LAST_AUDIT_DATE` 식별 및 **'현재 활성 전략(Active Strategy)'** 확인 (없을 경우 기본값 또는 30일 전)
3. **미참조 시장/자산 보고서 계층적 탐색 및 로드 (Hierarchical Report Scanning)**:
   - `STORAGE_DIR/reports/` 디렉터리에서 `LAST_AUDIT_DATE` 이후 발행된 보고서들을 다음과 같이 계층적으로 탐색하여 수집:
     1) **월간 보고서**: `STORAGE_DIR/reports/asset_monthly/Asset_monthly_report_YYYYMM.md` (거시적 결산, 이전 달 매매/수익률 맥락)
     2) **주간 보고서**: `STORAGE_DIR/reports/{korea_market,us_market}/weekly/*.md` 중 최신 월간 보고서(또는 `LAST_AUDIT_DATE`) 이후 발행된 한국/미국 주간 마감 보고서 (주간 시장 흐름 및 섹터 순환매 맥락)
     3) **최신 일간 보고서**: `STORAGE_DIR/reports/{korea_market,us_market}/daily/*.md` 중 가장 최근 주간 보고서 마감 이후~현재까지 발생한 최근 며칠간의 일일 보고서 (최신 단기 시장 이슈)
   - 수집된 보고서들의 핵심 내용을 요약 추출하여 AI 성과 원인 분석 및 예비 진단 컨텍스트로 통합
4. **다기간(YTD, 1년, 3개월, 1개월) 기준일자 및 시장/자산 데이터 수집**:
   - 기준일 설정: YTD(연초), 1Y(1년 전), 3M(3개월 전), 1M(1개월 전)
   - `get_market_history` 호출 ➔ KOSPI(`^KS11`), S&P 500(`^GSPC`), NASDAQ(`^IXIC`) 3대 지수의 4개 기간별 수익률 수집
   - `get_snapshots` / `get_portfolio_status` / `get_yearly_stats` / `get_asset_ratios` 호출 ➔ 자산 배분 현황 및 포트폴리오의 4개 기간별(YTD, 1Y, 3M, 1M) 수익률(ROI) 산출
   - **소분류 자산 비중 산출 기준**: `get_asset_ratios`의 `sub_results` 비중은 **`current_amt / total_valuation * 100`으로 전체 자산 대비 비중을 직접 계산하여 브리핑**한다.
5. **보유 종목별 다기간 수익률 및 포트폴리오 기여도(Attribution) 분석**:
   - `get_portfolio_status`의 보유 종목별로 `get_stock_history` 호출 ➔ 각 종목의 4개 기간(YTD, 1Y, 3M, 1M) 현지 통화 주가 수익률 수집
   - **기여도 산출 공식**: $\text{추정 기여도(\%p)} = \text{포트폴리오 비중(\%)} \times \text{종목 기간 수익률(\%)}$ (환율 효과를 제외한 순수 현지 통화 주가 변동 기준)
   - 포트폴리오 성과를 이끈 **Top 3 기여 종목 (Contributors)** 및 하락을 유발한 **Top 3 부진 종목 (Detractors)** 도출
6. **다기간 벤치마크 수익률 비교 및 Alpha 산출**:
   - 포트폴리오 ROI vs S&P 500 수익률 비교로 기간별 초과수익률(`Alpha = 포트폴리오 ROI - S&P 500 수익률`) 산출 (KOSPI/NASDAQ은 참고 지표)
7. **AI 성과 원인 분석 4대 레이어 (Attribution Analysis)**:
   - **Cash Drag 효과**: `get_asset_ratios`로 현금/달러 비중 측정 ➔ 상승장/하락장에서의 현금 보유에 따른 성과 영향도 계산
   - **보유 종목 기여도**: 종목별 비중 $\times$ 기간 수익률 기반 손익 기여도 분해 (Top 기여/부진 종목 성과 영향)
   - **시장/국가 노출도**: `get_market_history`로 한국(KOSPI) vs 미국(S&P 500) 자산 배분 비중에 따른 시장 지수 영향 구분
   - **원칙 준수 및 매매 행태**: `get_transactions`로 투자 원칙(`docs/references/investment-principles.md`) 미준수 방치, 외부 소음(매크로/뉴스/차트) 추종, 잦은 매매, 뇌동매매 여부 대조
8. **예비 진단 브리핑 및 첫 번째 질의**:
   - 미참조 보고서가 존재하는 경우 `[미참조 시장/자산 보고서 요약 및 맥락]`을 브리핑 상단에 포함하고, 다기간 벤치마크 성과표, Top/Bottom 종목 기여도, 4대 레이어 원인 분석 브리핑을 출력한 후 2단계 진입을 위한 첫 번째 질문을 던지고 사용자 답변을 대기한다.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 이전 점검일, 현재 전략, 미참조 계층적 보고서(월간/주간/최신 일간) 확인, 다기간(YTD, 1Y, 3M, 1M) 지수/포트폴리오 수익률, 전체 자산 대비 소분류 비중, 보유 종목별 다기간 수익률 및 Top/Bottom 기여도 데이터가 모두 정합성 있게 수집되었는가?
  - [ ] 성과 비교표, 주요 기여/부진 종목 분석, 팩트 기반 원인 브리핑 및 첫 번째 Grill-Me 질문 1건이 온전히 전달되었는가?

### [2단계] 심리·장세 판단 및 자산 배분/리밸런싱 인터뷰 (Grill-Me)
1. 사용자 답변에 따른 투자 원칙 대조 및 피드백 (Grilling)
2. **다기간 성과 및 알파(Alpha) 연계 Grilling 질의**:
   - 🟢 `Alpha > 0` (시장 상회): 과도한 위험 노출(단기 급등 쏠림) 여부 점검 및 대중 과열 국면 대비 현금 비중 확대/소외 자산 분산 리밸런싱 계획 질의
   - 🔴 `Alpha < 0` (시장 하회): Cash drag(현금 비중 과다), 부진 종목(Detractors) 쏠림, 원칙(`docs/references/investment-principles.md`) 미준수 및 공포 국면 투매 여부 진단 질의
3. **단기(1M/3M) 모멘텀 변화 및 펀더멘털 가설(Thesis) 검증 Grilling 질의**:
   - 최근 1M/3M 모멘텀이 급격히 둔화되거나 손실 기여가 큰 종목에 대해 `docs/references/investment-principles.md`의 **'독립적 펀더멘털 가설(Thesis)' 훼손 여부** 및 비중 조절 계획 질의
4. **유사 사례(Cases) 기반 패턴 점검**:
   - 대상 종목·업종 또는 운용 전략과 관련된 과거 사례가 있는지 `docs/references/trade-cases-index.md` 색인을 확인하고 매칭되는 `docs/references/cases/*.md` 교훈을 인용하여 피드백 제공
5. **시장 센티먼트(과열/무관심/공포) 및 현재 운용 전략(자산 배분 비율 스탠스)** 명시/갱신 질의
6. 추상적 답변 시 타겟 종목, 거래 규모, 집행 주기, 구체적 펀더멘털 가설 등 추가 질문
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 다기간 Alpha 원인 진단, 부진 종목에 대한 펀더멘털 가설/10년 보유 검증/비중 조절, 시장 센티먼트 체감, 현재 활성 전략(목표 자산 비율 변동 여부 포함), 구체적 리밸런싱 계획에 대한 사용자 답변이 명확히 수집되었는가?

### [3단계] 미복기 거래 필터링 및 매매복기 인터뷰 (Grill-Me)
1. `get_transactions`로 미복기 BUY/SELL 거래 필터링
2. 거래 없는 경우 4단계로 즉시 이동
3. 거래가 있는 경우 시간순 1건씩 릴레이 질문:
   - **거래 사유 및 가설**:
     - 매수 건: **독립적 펀더멘털 가설(Thesis)**, 당시 **주변 센티먼트(과열/공포)**, **자산 배분 부합 여부** 질의
     - 매도 건: **가설 훼손 여부**, **목표 자산 배분 비율 리밸런싱**, 자금 회수 사유 질의
   - 주가 변동 대조 (`get_stock_history`) 및 투자 원칙(`docs/references/investment-principles.md`) 검증
   - **정보 소음 대조**: 뉴스/매크로/정치/차트 패턴에 기인한 매매인지 엄격히 검증
   - **유사 사례 인용**: 거래 대상 종목 또는 진입/청산 패턴과 매칭되는 사례가 있는지 `docs/references/trade-cases-index.md` 색인을 확인하고 `docs/references/cases/*.md` 교훈 인용
4. 거래 등급 부여:
   - 🟢 **Good Trade**: 독립적 펀더멘털 가설과 자산 배분 원칙에 부합한 거래
   - 🔴 **Bad Trade**: 매크로/뉴스/차트 소음 추종, 타인 추천, 단순 감정(FOMO/공포)에 의한 뇌동매매
   - 🟡 **Hold**: 판단 유보 또는 단순 계좌 간 이동
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 모든 미복기 거래에 대해 1건씩 '독립적 펀더멘털 가설 및 센티먼트' 질의가 수행되고 평가 등급(🟢/🔴/🟡)이 결정되었는가?

### [4단계] 통합 보고서 및 마스터 저널 직접 저장
1. 상세 보고서 생성: `STORAGE_DIR/asset_audits/asset_audit_YYYYMMDD_HHMMSS.md`
2. 마스터 저널 누적 업데이트: `STORAGE_DIR/asset_audits/asset_audit_journal.md`
   - **저널 및 보고서 구조**:
     - **상단 섹션**: `# 현재 활성 전략 (Active Strategy)` (최신 전략명, 갱신일자, 전략 기조 유지/변경 이력, **참조된 시장/자산 보고서 목록 (월간/주간/일간)**)
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
       ### [보유 종목 다기간 성과 및 기여도 (Top Contributors & Detractors)]
       | 구분 | 종목명 (티커) | 비중(%) | 1M 수익률 | 1M 기여도 | YTD 수익률 | YTD 기여도 |
       | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
       | **Top 기여** | 종목 A | X.X% | +X.X% | +X.X%p | +X.X% | +X.X%p |
       | **Top 부진** | 종목 B | X.X% | -X.X% | -X.X%p | -X.X% | -X.X%p |
       ```
     - **하단 이력**: 회차별 점검 내역 누적 (최신 순 상단 삽입, 회차별 장세 판단, 참조한 보고서 요약, 다기간 성과 평가 및 거래별 `거래 사유 및 가설` 명시)
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 상세 보고서 및 마스터 저널 파일 상단에 현재 활성 전략 섹션(참조 보고서 목록 포함)과 [다기간 벤치마크 성과 비교], [보유 종목 다기간 성과 및 기여도] 표가 정확히 반영되었는가?

### [5단계] 투자 원칙 개선 제안 피드백 및 마무리
- 다기간 및 YTD S&P 500 지수 대비 알파 성과, 종목 기여도 분석에 기반한 최종 메타인지 피드백 제공 후 워크플로우 종료.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 다기간 Alpha 성과 및 종목별 성과 기여도에 기반한 메타인지 피드백 및 투자 원칙 개선안이 최종 전달되었는가?
