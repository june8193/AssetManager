# 01 — 에이전트 스킬 2종 및 투자 참조 문서 이관 슬라이스

**What to build:**
`Asset-jun-bot`에 남아있던 투자 상담 스킬(`asset-advisor`), 자산 점검 및 투자 복기 스킬(`asset-auditor`)과 이들이 참조하는 핵심 투자 원칙 및 매매 사례집(`docs/references/`)을 `AssetManager`로 완벽히 이관하여 단일 저장소 내에서 투자 자문과 다기간 성과 감사가 가능하도록 만듭니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `Asset-jun-bot`의 `asset-advisor` 스킬 정의서가 `AssetManager/.agents/skills/asset-advisor/SKILL.md`로 온전히 이관된다.
- [x] `Asset-jun-bot`의 `asset-auditor` 스킬 정의서가 `AssetManager/.agents/skills/asset-auditor/SKILL.md`로 온전히 이관된다.
- [x] 투자 원칙(`docs/references/investment-principles.md`), 매매 사례 마스터 색인(`docs/references/trade-cases-index.md`), 상세 매매 사례(`docs/references/cases/*.md`)가 `AssetManager/docs/references/`로 온전히 이관된다.
- [x] 스킬 파일 내 상대 경로 및 참조가 AssetManager 모노레포 구조에 부합하게 유지된다.
- [x] `Asset-jun-bot`의 원본 파일들은 일체 변경/삭제되지 않고 그대로 보존된다.
