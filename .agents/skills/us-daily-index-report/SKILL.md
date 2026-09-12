---
name: us-daily-index-report
description: 미국(S&P500/NASDAQ/DOW/VIX) 일일 지수 마감 보고서 작성 및 텔레그램 발송 스킬. Use when executing scheduled US daily market report task or requested to generate US daily briefing.
---

# 미국 시장 일일 지수 현황 보고서 작성 (US Daily Index Report)

미국 3대 주가지수(S&P 500, NASDAQ, DOW JONES) 및 CBOE 변동성 지수(VIX) 데이터를 수집하여 당일 등락률과 VIX 4단계 리스크 상태를 진단하고, 최신 뉴스 요약을 결합한 일일 보고서를 생성한 뒤 텔레그램으로 발송하는 스킬입니다.

⚠️ **계획 모드 및 승인 생략**: 구현 계획서 작성 없이 즉시 워크플로우를 실행합니다.

---

## Workflows

### 0단계: 주말 및 휴장일 여부 확인 (Pre-check)
- `check_market_holiday` MCP 도구 호출:
  - 인자: `country="US"` (특정 일자 조회 필요 시 `date="YYYY-MM-DD"`, 생략 시 오늘)
  - 반환값의 `is_holiday` 및 `description` 확인
- `is_holiday == True`인 경우:
  - 지수/뉴스 수집을 건너뛰고 간이 휴장일 안내 보고서를 작성한 후 3단계(텔레그램 전송)로 바로 이동합니다.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 휴장일 여부 판정이 정상 완료되었는가?

### 1단계: 시장 데이터(지수·VIX) 및 뉴스 수집
- 평일(`is_holiday == False`):
  1. **지수 및 VIX 데이터 수집 (MCP 단일 호출)**:
     - `get_market_history` MCP 도구를 단일 호출하여 최근 5일간(주말/휴장일 고려)의 일별 시계열을 수집합니다.
     - 인자: `tickers="^GSPC,^IXIC,^DJI,^VIX"`, `start_date="YYYY-MM-DD"`(조회일 기준 5~7일 전)
  2. **마감 수치 및 등락률 계산 로직**:
     - 각 티커(`^GSPC`, `^IXIC`, `^DJI`, `^VIX`)별 시계열 데이터에서 날짜순으로 정렬된 가장 최근 2개 거래일 종가를 추출합니다:
       - 전 거래일 종가: C_prev
       - 당일(최근 거래일) 종가: C_today
     - 변동폭 및 등락률 계산:
       - 변동폭(Change) = C_today - C_prev
       - 등락률(%) = ((C_today - C_prev) / C_prev) * 100
     - 부호 표기 원칙:
       - 상승 시 `+` 부호 필수 기재 (예: `+1.23%`, `+50.25pt`)
       - 하락 시 `-` 부호 기재 (예: `-0.45%`, `-12.30pt`)
       - 보합 시 `0.00%`, `0.00pt`
  3. **VIX 4단계 리스크 등급 분류**:
     - 당일 VIX 마감 수치를 기준으로 아래 4단계 리스크 영역으로 분류하고 시장 심리를 진단합니다:
       - 🟢 **안정**: VIX < 20 (시장 심리 안정)
       - 🟡 **주의**: 20 ≤ VIX < 25 (단기 변동성 확대 주의)
       - 🟠 **경고**: 25 ≤ VIX < 30 (시장 불안 심리 고조)
       - 🔴 **위기**: VIX ≥ 30 (극심한 공포 및 위기 국면)
  4. **뉴스 수집 및 요약**:
     - `uv run python scripts/query_us_news.py --limit 5` 실행
     - 수집된 영문 뉴스를 핵심 시황 위주로 자연스러운 한국어로 번역 및 요약
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 3대 지수와 VIX의 최근 2거래일 종가 및 변동률 계산이 완료되었는가?
  - [ ] VIX 4단계 리스크 등급 판정이 정상적으로 도출되었는가?
  - [ ] 한글 번역 뉴스 요약이 확보되었는가?

### 2단계: 마크다운 파일 생성 및 저장
- `uv run python scripts/get_storage_dir.py` 실행 ➔ `STORAGE_DIR` 획득
- `STORAGE_DIR/reports/us_market/daily/US_market_daily_report_YYYYMMDD.md` 파일 생성
- **서식 규칙**:
  - 한국 시간과 미국 현지 시장 날짜를 병기합니다.
  - 모바일 텔레그램 화면 줄바꿈 깨짐을 방지하기 위해 **표(Table) 서식은 절대 사용하지 않으며**, 불릿 리스트와 이모지를 활용합니다.
  - VIX 모니터링은 독립된 섹션으로 구성하여 리스크 등급 이모지(🟢/🟡/🟠/🔴)와 상태 설명을 명확히 표시합니다.
- **보고서 템플릿 양식**:
```markdown
# 🇺🇸 미국 시장 일일 지수 현황 (YYYY-MM-DD)
> 한국 시간: YYYY-MM-DD HH:MM / 현지 기준: YYYY-MM-DD

### 📊 3대 주요 지수 마감 현황
- **S&P 500**: 5,550.00 (+50.00pt, +0.91%)
- **NASDAQ**: 18,200.00 (+200.00pt, +1.11%)
- **DOW JONES**: 40,200.00 (+200.00pt, +0.50%)

### 🌡️ 변동성 지수 (VIX) 모니터링
- **VIX 지수**: 14.80 (-0.70pt, -4.52%)
- **리스크 등급**: 🟢 안정 (시장 심리 안정)
- **시장 심리 진단**: VIX 지수가 20 미만으로 안정권에 머물며 시장 참여자들의 불안 심리가 낮고 변동성이 통제되고 있습니다.

### 📰 주요 뉴스 및 시황 요약
- **[뉴스 헤드라인 1]**: 요약 내용
- **[뉴스 헤드라인 2]**: 요약 내용
- **[뉴스 헤드라인 3]**: 요약 내용
```
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 표(Table) 서식 없이 독립 VIX 섹션이 포함된 마크다운 파일이 정상 생성되었는가?

### 3단계: 텔레그램 알림 전송 (Telegram Notification)
- `uv run python scripts/send_telegram.py "[마크다운보고서전문 + 생성파일경로]"` 실행
- 로그 `"Telegram message sent successfully..."` 검증 후 종료
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 텔레그램 전송 성공 로그가 확인되었는가?
