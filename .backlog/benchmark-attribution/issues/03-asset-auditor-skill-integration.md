# 03 — asset-auditor 스킬 개정 및 보유 종목 기여도 복원 (writing-great-skills 준수)

**What to build:**
`.agents/skills/asset-auditor/SKILL.md`를 `/writing-great-skills` 원칙에 맞추어 개정합니다:
1. **Predictability & Information Hierarchy**: 신규 `get_benchmark_attribution` MCP 도구를 1단계에 연동하여 1~2초 만에 다기간 벤치마크 성과표와 종목별 성과 및 기여도(Top/Bottom 3)를 즉시 수집하고, 브리핑부터 1:1 심문(Grill-Me), 마스터 저널 기록까지 일관된 확정적 프로세스를 따르도록 단계별 완료 조건(Checkable & Exhaustive Completion Criteria)을 명시합니다.
2. **SSOT (Single Source of Truth)**: 저널 저장 경로를 스킬 내 하드코딩하지 않고, `settings.toml`을 유일한 기준으로 삼아 `scripts/get_storage_dir.py`를 통해 동적으로 결정합니다.
3. **Positive Guardrails**: 로컬 DB 조회 금지 규정을 "오직 `assetmanager` 원격 MCP 도구만을 사용한다"는 긍정적 목표 행동(Positive Target Behavior)과 1:1로 페어링하여 네거티브 스티어링(Negation)을 차단합니다.
4. **Pruning & Leading Words**: 중복 설명, 맥락 부하(Context Load), No-op 문장을 전면 가지치기(Pruning)하고, `Attribution`, `Alpha`, `Grill-Me`, `SSOT` 등 간결한 선도 단어로 압축합니다.
5. **Code Review**: 수정 완료 후 `/code-review`를 통해 `writing-great-skills` 원칙 부합 여부를 검증합니다.

**Blocked by:** 02 — 벤치마크 기여도 MCP 도구 구현 및 등록

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] `.agents/skills/asset-auditor/SKILL.md`의 [1단계 정보 수집]에 `get_benchmark_attribution` MCP 도구 호출 지침이 명시되어 있다.
- [ ] 1단계에 `보유 종목별 다기간 성과 및 기여도(Top/Bottom 3) 분석` 섹션이 복원되어 있으며, 예비 진단 브리핑 시 [보유 종목 다기간 성과 및 기여도 (Top Contributors & Detractors)] 표 렌더링 지침이 포함되어 있다.
- [ ] 4단계 마스터 저널 템플릿에 `[보유 종목 다기간 성과 및 기여도 요약]` 표 구조가 복원되어 있다.
- [ ] **Checkable Completion Criteria**: 각 단계(1단계 브리핑 -> 2단계 Grill-Me 심문 -> 3단계 원칙 검증 -> 4단계 저널 기록)에 에이전트의 성급한 완료(Premature completion)를 방지하는 명확하고 검증 가능한 완료 조건이 정의되어 있다.
- [ ] **SSOT 준수**: 스킬 내에 특정 드라이브나 디렉토리 경로가 하드코딩되어 있지 않으며, `scripts/get_storage_dir.py`를 호출하여 경로를 획득하도록 규정되어 있다.
- [ ] **Positive Guardrails**: 로컬 DB/스크립트 금지 조항이 원격 MCP 호출이라는 대체 행동과 명확히 페어링되어 있다.
- [ ] **Pruning & No-op 점검**: 스킬 본문에서 모델의 기본 동작(No-op)이나 중복 문장이 제거되어 간결하고 예측 가능하게 작성되어 있다.
- [ ] `/code-review`를 실행하여 스킬 변경 사항이 `writing-great-skills` 원칙(Predictability, SSOT, Information hierarchy, Positive guardrails, Pruning)을 만족함을 검증한다.
