# 01 — 텔레그램 기반 설정 및 기본 /help 핑퐁 슬라이스

**What to build:**
사용자가 텔레그램에서 `/help` 명령어를 전송했을 때 사용 가능한 전체 CLI 명령어 안내 메시지를 즉시 수신하고, 등록되지 않은 비인가 사용자가 접근했을 때는 보안 가드에 의해 차단 안내 메시지를 수신하는 최초의 E2E 수직 관통 슬라이스를 구축합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `settings.toml` 및 `settings.toml.example`에 `[telegram]`(bot_token, allowed_user_ids, enabled, storage_dir) 및 `[naver]` 섹션이 추가되고 환경변수 오버라이드가 지원된다.
- [x] 텔레그램 Bot API 통신(`getUpdates` 롱폴링, `sendMessage`)을 수행하는 비동기 클라이언트가 동작한다.
- [x] 인가된 사용자가 `/help` 입력 시 사용 가능한 명령어 목록 안내 메시지가 정상 응답된다.
- [x] 허용 목록에 없는 사용자가 메시지를 보낼 경우 접근 차단 경고 메시지를 응답하고 커맨드 실행을 차단한다.
- [x] 외부 텔레그램 API를 가상 모킹(Mock)하여 설정 로드, 비인가 차단, `/help` 응답이 검증되는 단위 테스트가 통과한다.

