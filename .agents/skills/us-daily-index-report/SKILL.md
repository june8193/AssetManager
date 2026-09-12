---
name: us-daily-index-report
description: 미국(S&P500/NASDAQ/DOW) 일일 지수 마감 보고서 작성 및 텔레그램 발송 스킬. Use when executing scheduled US daily market report task or requested to generate US daily briefing.
---

# 미국 시장 일일 지수 현황 보고서 작성 (US Daily Index Report)

미국 시장(S&P 500, NASDAQ, DOW JONES)의 지수를 수집하고, yfinance 뉴스 수집 및 AI 번역/요약을 거쳐 마크다운 보고서를 생성한 뒤 텔레그램으로 발송하는 스킬입니다.

⚠️ **계획 모드 및 승인 생략**: 구현 계획서 작성 없이 즉시 워크플로우를 실행합니다.

---

## Workflows

### 0단계: 주말 및 휴장일 여부 확인 (Pre-check)
- `uv run python scripts/query_market.py --action holiday --country US` 실행 ➔ `IS_HOLIDAY`, `DESCRIPTION` 기억
- `IS_HOLIDAY == True`인 경우: 지수/뉴스 수집을 건너뛰고 간이 휴장일 보고서 작성 후 3단계로 이동.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 휴장일 여부 판정이 정상 완료되었는가?

### 1단계: 지수 데이터 및 뉴스 수집
- 평일(`is_holiday == False`):
  1. 지수 데이터: `uv run python scripts/query_market.py --action indices --country US` 실행 (S&P 500, NASDAQ, DOW)
  2. 뉴스 수집: `uv run python scripts/query_us_news.py --limit 5` 실행
  3. 번역 & 요약: 수집된 영문 뉴스를 자연스러운 한국어로 요약
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 평일인 경우 미국 3대 지수와 한글 번역 뉴스 요약이 확보되었는가?

### 2단계: 마크다운 파일 생성 및 저장
- `uv run python scripts/get_storage_dir.py` ➔ `STORAGE_DIR` 획득
- `STORAGE_DIR/reports/us_market/daily/US_market_daily_report_YYYYMMDD.md` 쓰기 생성
- 한국 시간과 미국 분석 시간(API `DATE` 값)을 병기하고, 상승 등락률에 `+` 표기. 텔레그램 깨짐 방지를 위해 **표(Table) 서식 절대 금지**.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 마크다운 파일 생성이 완료되었는가?

### 3단계: 텔레그램 알림 전송 (Telegram Notification)
- `uv run python scripts/send_telegram.py "[마크다운보고서전문 + 생성파일경로]"` 실행
- 로그 `"Telegram message sent successfully..."` 검증 후 종료
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 텔레그램 전송 성공 로그가 확인되었는가?
