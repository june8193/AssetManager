---
name: korea-weekly-index-report
description: 국내(KOSPI/KOSDAQ) 주간 지수 현황 보고서 작성 및 텔레그램 발송 스킬. Use when executing scheduled Korea weekly market report task or requested to generate Korea weekly briefing.
---

# 국내 시장 주간 지수 현황 보고서 작성 (Korea Weekly Index Report)

최근 1주일간의 국내 시장 일일 보고서를 요약하고 주간 지수 변동률(KOSPI, KOSDAQ)을 수집하여 주간 마크다운 보고서를 작성 후 텔레그램으로 전송하는 스킬입니다.

⚠️ **계획 모드 및 승인 생략**: 구현 계획서 작성 없이 즉시 워크플로우를 실행합니다.

---

## Workflows

### 1단계: 분석 대상 주간 범위 판정
- 오늘 요일 확인 후 최근 마감된 주간(일요일~토요일) 시작일/종료일 산출 (YYYY-MM-DD)
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 주간 시작일(일)과 종료일(토) 날짜 계산 완료

### 2단계: 일일 보고서 수집 및 파싱
- `uv run python scripts/get_storage_dir.py` ➔ `STORAGE_DIR` 획득
- `STORAGE_DIR/reports/korea_market/daily/Korea_market_daily_report_YYYYMMDD.md` 7일치 존재 여부 확인 및 파싱
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 대상 기간 내 존재하는 일일 보고서 내용 요약 완료

### 3단계: 주간 지수 변동 데이터 조회 & 계산
- `uv run python scripts/query_market.py --action history --tickers "^KS11,^KQ11" --start-date "[시작일]" --end-date "[종료일]"` 실행
- 변동금액 및 변동률(`(종료가 - 시작가) / 시작가 * 100`) 직접 계산 (상승 시 `+` 기호)
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] KOSPI/KOSDAQ 주간 변동률 계산 완료

### 4단계: 주간 보고서 마크다운 생성 및 저장
- `STORAGE_DIR/reports/korea_market/weekly/Korea_market_weekly_report_YYYYMMDD.md` 생성
- 텔레그램 깨짐 방지를 위해 **표(Table) 서식 절대 금지**
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 주간 마크다운 보고서 저장 완료

### 5단계: 텔레그램 전송 (Telegram Notification)
- 텔레그램 전송: `uv run python scripts/send_telegram.py "[전문 + 파일경로]"`
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 텔레그램 전송 성공 로그 확인 완료
