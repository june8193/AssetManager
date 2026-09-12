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
- `uv run python scripts/query_market.py --action holiday --country KR` 실행 ➔ `IS_HOLIDAY`, `DESCRIPTION` 기억
- `IS_HOLIDAY == True`인 경우: 지수/뉴스 수집을 건너뛰고 간이 휴장일 보고서 작성 후 3단계로 이동.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 휴장일 여부 판정이 정상 완료되었는가?

### 1단계: 지수 데이터 및 뉴스 수집
- 평일(`is_holiday == False`):
  1. 지수 데이터: `uv run python scripts/query_market.py --action indices --country KR` 실행 (KOSPI/KOSDAQ)
  2. 뉴스 수집: CLI 스크립트 실행 (최소 2회, 최대 4회)
     - `uv run python scripts/query_news.py --query "국내 주식 시장 마감 시황 요약" --date "YYYY-MM-DD"`
     - `uv run python scripts/query_news.py --query "한국 경제 주요 뉴스" --date "YYYY-MM-DD"`
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 평일인 경우 코스피/코스닥 마감 지수와 뉴스 2건 이상의 링크/제목이 확보되었는가?

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
