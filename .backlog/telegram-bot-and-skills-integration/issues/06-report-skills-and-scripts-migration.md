# 06 — 리포트 5종 에이전트 스킬 및 보조 CLI 스크립트 이관 슬라이스

**What to build:**
Antigravity 에이전트가 `AssetManager` 환경 내에서 직접 실행할 수 있도록 일간/주간/월간 리포트 5종 스킬(`korea-daily`, `korea-weekly`, `us-daily`, `us-weekly`, `asset-monthly`)과 데이터 수집 및 발송용 보조 CLI 스크립트들을 이관하여, 시장 지수/뉴스 수집부터 리포트 마크다운 파일 저장 및 텔레그램 알림 발송까지 단독으로 완결되는 E2E 슬라이스를 구축합니다.

**Blocked by:** 01 — 텔레그램 기반 설정 및 기본 /help 핑퐁 슬라이스

**Status:** ready-for-agent

- [ ] `.agents/skills/`에 5종 리포트 스킬(`korea-daily-index-report`, `korea-weekly-index-report`, `us-daily-index-report`, `us-weekly-index-report`, `asset-monthly-report`)이 배치된다.
- [ ] `scripts/`에 보조 CLI 스크립트(`query_market.py`, `query_news.py`, `query_us_news.py`, `send_telegram.py`, `get_storage_dir.py`, `resolve_url.py`)가 이관된다.
- [ ] 보조 스크립트들이 `settings.toml`에 정의된 텔레그램 및 네이버 API 키 설정을 참조하도록 업데이트된다.
- [ ] 불필요한 레거시 Gemini API 직접 호출 코드가 완전히 배제되었음을 검증한다.
- [ ] CLI 스크립트 실행을 통해 지수 조회, 뉴스 검색 및 텔레그램 메시지 발송이 정상 동작하는지 검증하는 단위 테스트가 통과한다.
