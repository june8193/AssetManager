---
name: asset-monthly-report
description: 자산/포트폴리오 월간 종합 보고서(주간 시장 요약, 매매 정리, 수익률 및 자산배분 검토) 작성 및 텔레그램 발송 스킬. Use when executing scheduled monthly asset report task or requested to generate monthly asset review.
---

# 자산 및 포트폴리오 월간 종합 보고서 작성 (Asset Monthly Report)

한 달간의 국내/미국 주간 시장 동향을 종합 요약하고, 포트폴리오 및 벤치마크(S&P 500, KOSPI 등) 수익률, 보유 종목별 성과 기여도, 당월 매매 내역을 종합 결산하여 마크다운 보고서를 작성 후 텔레그램으로 전송하는 스킬입니다.

⚠️ **계획 모드 및 승인 생략**: 구현 계획서 작성 없이 즉시 워크플로우를 실행합니다.

---

## Workflows

### 1단계: 분석 대상 월간 범위 판정
1. 사용자 인자(예: `YYYY-MM`)가 주어진 경우 해당 연월의 1일(시작일) ~ 말일(종료일)을 설정합니다.
2. 인자가 없는 경우:
   - 오늘이 해당 월의 마지막 날(말일)인 경우: 당월 1일 ~ 말일 설정
   - 그 외의 경우: 최근 마감된 전월 1일 ~ 전월 말일 설정 (예: 8월 15일 실행 시 `2026-07-01` ~ `2026-07-31`)
3. `TARGET_MONTH` (예: `2026-07` 또는 `202607`), `START_DATE`, `END_DATE` 확정
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 대상 월(`TARGET_MONTH`), 시작일(`START_DATE`), 종료일(`END_DATE`) 날짜 계산 완료

---

### 2단계: 해당 월 주간 시장 보고서 수집 및 파싱
1. `uv run python scripts/get_storage_dir.py` 실행 ➔ `STORAGE_DIR` 획득
2. 대상 기간 내 발행된 한국 및 미국 주간 마감 보고서 파일 탐색:
   - 한국 주간 보고서: `STORAGE_DIR/reports/korea_market/weekly/Korea_market_weekly_report_*.md`
   - 미국 주간 보고서: `STORAGE_DIR/reports/us_market/weekly/US_market_weekly_report_*.md`
3. 주간 보고서들의 핵심 이슈, 섹터 흐름, 지수 변동 요약을 추출하여 월간 시장 동향으로 종합 요약
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 대상 월에 속하는 국내/미국 주간 보고서 파싱 및 월간 시장 핵심 흐름 요약 완료

---

### 3단계: 월간 지수, 포트폴리오 성과 및 종목별 기여도 데이터 수집
1. **3대 지수 월간 변동률 조회**:
   - `uv run python scripts/query_market.py --action history --tickers "^GSPC,^IXIC,^KS11" --start-date "[시작일]" --end-date "[종료일]"`
   - 각 지수의 월초 대비 월말 등락률(%) 계산 (상승 시 `+` 기호)
2. **포트폴리오 월간 수익률(ROI) 및 기말 상태 조회**:
   - `uv run python scripts/query_asset.py --action daily --start-date "[시작일]" --end-date "[종료일]"` (기간 손익 및 ROI 산출)
   - `uv run python scripts/query_asset.py --action portfolio --date "[종료일]"` (보유 종목 및 평가금액)
   - `uv run python scripts/query_asset.py --action ratios` (자산군별/소분류별 비중)
   - 포트폴리오 초과수익률 계산: `Alpha = 포트폴리오 ROI - S&P 500 수익률`
3. **주요 보유 종목별 월간 성과 및 추정 기여도 산출**:
   - 보유 종목별 `uv run python scripts/query_stock.py --ticker [종목코드] --start-date [시작일] --end-date [종료일]`로 시작일 대비 종료일 주가 변동률 수집
   - 종목별 추정 기여도(%p) = 비중(%) $\times$ 기간 수익률(%)
   - Top 기여 종목 및 Bottom 부진 종목 도출
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 벤치마크 지수, 포트폴리오 월간 ROI, Alpha, 주요 종목별 월간 성과 및 기여도 계산 완료

---

### 4단계: 당월 매매 내역 수집 및 정리
1. `uv run python scripts/query_asset.py --action transactions --start-date "[시작일]" --end-date "[종료일]"` 실행
2. 당월 체결된 매수(BUY) 및 매도(SELL) 거래 내역 분류:
   - 종목명, 매매 구분, 수량, 체결 단가, 총 거래금액
   - 거래가 없는 경우 "당월 체결된 매매 내역 없음 (포지션 유지)" 명시
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 당월 매매 내역 목록 및 거래 사유/유형 요약 완료

---

### 5단계: 월간 종합 마크다운 보고서 생성 및 저장
1. 디렉토리 확인 및 생성: `STORAGE_DIR/reports/asset_monthly/`
2. 마크다운 보고서 생성: `STORAGE_DIR/reports/asset_monthly/Asset_monthly_report_YYYYMM.md` (예: `Asset_monthly_report_202607.md`)
3. **서식 규칙**:
   - 텔레그램 메시지 깨짐 방지를 위해 **표(Table) 서식 절대 금지** (이모지 및 불릿 리스트 활용)
   - 등락률 표기 시 상승은 `+` 부호 필수 기재
4. **보고서 필수 섹션 구성**:
   - **제목 및 분석 개요**: 분석 대상 연월, 기간, 보고서 종류
   - **1. 🌐 월간 글로벌 & 국내·미국 시장 동향 요약**: 주간 보고서 종합 분석
   - **2. 📊 월간 포트폴리오 성과 및 벤치마크 비교**: 포트폴리오 ROI, S&P 500, KOSPI, NASDAQ 대비 Alpha 성과
   - **3. 🏆 주요 보유 종목 성과 및 기여도**: Top 기여 종목 및 부진 종목
   - **4. 📝 당월 매매 내역 (Trading Summary)**: 체결 내역 정리 및 포지션 변화
   - **5. 💡 자산 배분 현황 및 총평**: 현금/주식 비중 및 익월 운용 관전 포인트
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 지정된 경로에 월간 종합 마크다운 보고서 저장 완료

---

### 6단계: 텔레그램 발송 (Telegram Notification)
1. **텔레그램 알림 전송**:
   - `uv run python scripts/send_telegram.py "[마크다운보고서전문 + 생성파일경로]"` 실행
   - 로그 `"Telegram message sent successfully..."` 확인
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 텔레그램 전송 성공 로그 확인 완료
