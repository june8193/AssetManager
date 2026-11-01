---
name: release-assetmanager
description: AssetManager 프로젝트 릴리즈(버전 추천, CHANGELOG 작성, 풀스택 검증 및 배포 커밋/푸시). Use when releasing a new version, cutting a release, or publishing updates for AssetManager.
---

# AssetManager 릴리즈 관리 (release-assetmanager)

직전 릴리즈 이후 main 브랜치의 변경 내역(병렬 머지 및 백로그 포함)을 분석하여 버전을 산출하고, 사용자 승인 하에 안전하게 배포 커밋 및 푸시를 완료하는 6단계 절차입니다.

---

### 1단계: Pre-flight 점검 (작업 환경 검증)
릴리즈를 시작하기 전, Git 작업 트리의 안전성을 확인합니다.

1. **현재 브랜치 확인**:
   ```powershell
   git branch --show-current
   ```
   - `main` 브랜치가 아니면 릴리즈를 중단하고 사용자에게 브랜치 전환을 요청합니다.
2. **미커밋 변경사항 확인**:
   ```powershell
   git status --porcelain
   ```
   - 미커밋 또는 미추적 파일이 존재하면 작업을 중단하고 사용자에게 정리를 요청합니다.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 현재 브랜치가 `main`임이 확인됨
  - [ ] 워킹 트리가 깨끗함(`working tree clean`)이 확인됨

---

### 2단계: Diff Audit (변경 내역 및 백로그 수집)
직전 릴리즈 이후 머지된 모든 커밋과 완료된 백로그 문서를 수집합니다.

1. **직전 릴리즈 기준점 및 현재 버전 확인**:
   - `pyproject.toml`에서 현재 버전 확인
   - 직전 릴리즈 커밋 해시 탐색:
     ```powershell
     git log --grep="release:" -n 1 --format="%H %s"
     ```
2. **커밋 및 머지 내역 전수 수집**:
   ```powershell
   git log <LAST_RELEASE_HASH>..HEAD --oneline
   git log <LAST_RELEASE_HASH>..HEAD --merges --oneline
   ```
3. **완료된 백로그 문서 매핑**:
   - 이번 릴리즈에 포함된 `.backlog/done/<feature-slug>/spec.md` 및 이슈 문서 경로를 확인합니다.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 직전 릴리즈 커밋 해시 및 현재 버전 확인 완료
  - [ ] 신규 커밋 및 병렬 머지 내역 전수 수집 완료
  - [ ] 해당되는 기능별 백로그 문서(`.backlog/done/<feature-slug>/spec.md`) 매핑 완료

---

### 3단계: Approval Gate (버전 제안, CHANGELOG 초안 보고 및 대기)
수집된 변경사항을 바탕으로 [SemVer](https://semver.org/lang/ko/) 기준의 다음 버전을 산출하고 사용자 승인을 구합니다.

> [!IMPORTANT]
> **승인 전까지는 엄격히 읽기 전용(Read-Only) 상태를 유지합니다.**
> 파일 수정이나 후속 단계 진행은 반드시 사용자의 명시적인 승인 답변을 수신한 직후에만 시작합니다.

1. **사용자 보고 항목 작성**:
   - 현재 버전 및 추천 신규 버전 (Major/Minor/Patch 판정 근거 제시)
   - 주요 변경 내역 요약 (머지된 기능 및 백로그 링크 목록)
   - **CHANGELOG.md 반영 예정 초안 전문**
2. **사용자 승인 요청 및 대기**:
   - 위 내용을 최종 답변 메시지로 사용자에게 제시하고 승인 여부를 질문합니다.
   - **질문 제시 후 추가 도구 호출 없이 해당 턴을 종료하여 사용자의 승인 응답을 기다립니다.**
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] 변경 요약, 권장 버전, CHANGELOG 초안 전문이 사용자에게 보고됨
  - [ ] 사용자로부터 버전 및 초안에 대한 명시적 승인 응답을 수신함

---

### 4단계: Changelog & Version Bump (문서 및 버전 갱신)
사용자가 승인한 버전을 프로젝트 파일에 반영합니다.

1. **CHANGELOG.md 업데이트**:
   - [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 양식을 준수하여 최상단에 신규 버전 섹션을 추가합니다:
     ```markdown
     ## [X.Y.Z] - YYYY-MM-DD
     ### Added
     - 추가 기능 요약 ([상세 스펙](.backlog/done/<feature-slug>/spec.md))
     ### Changed
     - 변경 사항 요약
     ### Fixed
     - 버그 수정 요약
     ```
2. **pyproject.toml 갱신**:
   - `version = "X.Y.Z"` 항목을 승인된 신규 버전으로 업데이트합니다.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] `CHANGELOG.md` 최상단에 올바른 서식의 릴리즈 섹션이 작성됨
  - [ ] `pyproject.toml`의 `version` 필드가 신규 버전으로 갱신됨

---

### 5단계: Full-Stack Green Bar (단위 테스트 무결성 검증)
릴리즈 커밋 생성 전 백엔드와 프론트엔드의 모든 단위 테스트가 통과하는지 검증합니다.

1. **백엔드 테스트**:
   ```powershell
   uv run pytest
   ```
2. **프론트엔드 테스트**:
   ```powershell
   cd src/frontend; npm test -- --run
   ```
- 테스트 중 하나라도 실패할 경우 커밋을 중단하고 즉시 사용자에게 실패 로그를 보고합니다.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] `uv run pytest` 결과 0 failures로 전체 통과
  - [ ] `npm test -- --run` 결과 0 failures로 전체 통과

---

### 6단계: Ship (릴리즈 커밋 및 푸시)
모든 검증을 마친 후 원자적 릴리즈 커밋을 발행하고 원격 저장소에 반영합니다.

1. **커밋 생성**:
   ```powershell
   git add pyproject.toml CHANGELOG.md
   git commit -m "release: vX.Y.Z"
   ```
2. **원격 저장소 푸시**:
   ```powershell
   git push origin main
   ```
3. **완료 보고**:
   - 배포 버전, 커밋 해시, 릴리즈 요약을 최종 안내합니다.
- **완료 검증 조건 (Completion Criterion)**:
  - [ ] `release: vX.Y.Z` 커밋이 로컬에 생성됨
  - [ ] `origin/main`으로 푸시가 성공함
