---
name: korea-daily-index-report
description: 국내(KOSPI/KOSDAQ) 일일 지수 마감 보고서 작성 및 텔레그램 발송 스킬. Use when executing scheduled Korea daily market report task or requested to generate Korea daily briefing.
---

# 국내 시장 일일 지수 현황 보고서 작성 (Korea Daily Index Report)

국내 시장(KOSPI, KOSDAQ)의 지수 및 핵심 뉴스 데이터를 수집하여 일일 보고서를 생성하고 텔레그램으로 발송하는 스킬입니다.

⚠️ **계획 모드 및 승인 생략**: 구현 계획서 작성 없이 즉시 워크플로우를 실행합니다.

---

## Workflows

### 0단계: 주말 및 휴장일 여부 확인 (Pre-check)
- `check_market_holiday` MCP 도구 호출:
  - 인자: `country="KR"` (특정 일자 조회 필요 시 `date="YYYY-MM-DD"`, 생략 시 오늘)
  - 반환값의 `is_holiday` 및 `description` 확인
- `is_holiday == True`인 경우: 지수/뉴스 수집을 건너뛰고 간이 휴장일 안내 보고서 작성 후 3단계로 이동.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 휴장일 여부 판정이 정상 완료되었는가?

### 1단계: 지수 데이터 및 뉴스 수집
- 평일(`is_holiday == False`):
  1. **지수 데이터 수집 (MCP 단일 호출)**:
     - `get_market_history` MCP 도구를 단일 호출하여 최근 5일간(주말/휴장일 고려)의 일별 시계열을 수집합니다.
     - 인자: `tickers="^KS11,^KQ11"`, `start_date="YYYY-MM-DD"`(조회일 기준 5~7일 전)
  2. **마감 수치 및 등락률 계산 로직**:
     - 각 티커(`^KS11`, `^KQ11`)별 시계열 데이터에서 날짜순으로 정렬된 가장 최근 2개 거래일 종가를 추출합니다:
       - 전 거래일 종가: C_prev
       - 당일(최근 거래일) 종가: C_today
     - 변동폭 및 등락률 계산:
       - 변동폭(Change) = C_today - C_prev
       - 등락률(%) = ((C_today - C_prev) / C_prev) * 100
     - 부호 표기 원칙:
       - 상승 시 `+` 부호 필수 기재 (예: `+1.23%`, `+30.50pt`)
       - 하락 시 `-` 부호 기재 (예: `-0.45%`, `-12.30pt`)
       - 보합 시 `0.00%`, `0.00pt`
  3. **뉴스 수집**: CLI 스크립트 실행 (최소 2회, 최대 4회)
     - `uv run python scripts/query_news.py --query "국내 주식 시장 마감 시황 요약" --date "YYYY-MM-DD"`
     - `uv run python scripts/query_news.py --query "한국 경제 주요 뉴스" --date "YYYY-MM-DD"`
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] `get_market_history` MCP 도구를 통해 코스피/코스닥 최근 2거래일 종가 및 변동률 계산이 완료되었는가?
  - [ ] 뉴스 2건 이상의 링크/제목이 확보되었는가?

### 2단계: 마크다운 파일 생성 및 저장
- `uv run python scripts/get_storage_dir.py` ➔ `STORAGE_DIR` 획득
- `STORAGE_DIR/reports/korea_market/daily/Korea_market_daily_report_YYYYMMDD.md` 쓰기 생성
- 서식 규칙: 지수 등락률은 상승 시 `+` 표기(예: `+1.23%`). 텔레그램 깨짐 방지를 위해 **표(Table) 서식 절대 금지** (이모지, 리스트 활용).
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 지정된 경로에 마크다운 파일 생성이 완료되었는가?

### 3단계: 텔레그램 알림 전송 (Telegram Notification)
- `uv run python scripts/send_telegram.py "[마크다운보고서전문 + 생성파일경로]"` 실행
- 로그 `"Telegram message sent successfully..."` 검증 후 종료
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 텔레그램 전송 성공 로그가 확인되었는가?
