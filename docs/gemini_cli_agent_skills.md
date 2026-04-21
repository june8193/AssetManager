# 에이전트 스킬 (Agent Skills)

에이전트 스킬을 사용하면 전문 지식, 절차적 워크플로우 및 작업별 리소스로 Gemini CLI를 확장할 수 있습니다. [Agent Skills](https://agentskills.io) 오픈 표준을 기반으로 하는 "스킬"은 지침과 자산을 검색 가능한 기능으로 패키징하는 독립된 디렉토리입니다.

## 개요

지속적인 워크스페이스 전반의 배경 지식을 제공하는 일반 컨텍스트 파일([`GEMINI.md`](/docs/cli/gemini-md))과 달리, 스킬은 **온디맨드 전문 지식**을 나타냅니다. 이를 통해 Gemini는 모델의 즉각적인 컨텍스트 창을 어지럽히지 않고도 보안 감사, 클라우드 배포 또는 코드베이스 마이그레이션과 같은 방대한 전문 기능 라이브러리를 유지할 수 있습니다.

Gemini는 사용자의 요청과 스킬 설명을 기반으로 스킬을 사용할 시기를 자율적으로 결정합니다. 관련 스킬이 식별되면 모델은 `activate_skill` 도구를 사용하여 작업을 완료하는 데 필요한 전체 지침과 리소스를 "가져옵니다".

## 주요 이점

- **전문 지식 공유**: 복잡한 워크플로우(예: 특정 팀의 PR 리뷰 프로세스)를 누구나 사용할 수 있는 폴더로 패키징합니다.
- **반복 가능한 워크플로우**: 절차적 프레임워크를 제공하여 복잡한 다단계 작업이 일관되게 수행되도록 합니다.
- **리소스 번들링**: 에이전트가 필요한 모든 것을 갖출 수 있도록 지침과 함께 스크립트, 템플릿 또는 예제 데이터를 포함합니다.
- **단계적 공개**: 처음에는 스킬 메타데이터(이름 및 설명)만 로드됩니다. 상세한 지침과 리소스는 모델이 명시적으로 스킬을 활성화할 때만 공개되어 컨텍스트 토큰을 절약합니다.

## 스킬 검색 계층

Gemini CLI는 세 가지 기본 위치에서 스킬을 검색합니다.

1.  **워크스페이스 스킬 (Workspace Skills)**: `.gemini/skills/` 또는 `.agents/skills/` 별칭에 위치합니다. 워크스페이스 스킬은 일반적으로 버전 관리에 포함되어 팀과 공유됩니다.
2.  **사용자 스킬 (User Skills)**: `~/.gemini/skills/` 또는 `~/.agents/skills/` 별칭에 위치합니다. 이는 모든 워크스페이스에서 사용할 수 있는 개인용 스킬입니다.
3.  **확장 스킬 (Extension Skills)**: 설치된 [확장 프로그램](/docs/extensions) 내에 번들로 포함된 스킬입니다.

**우선순위:** 여러 스킬의 이름이 같은 경우, 우선순위가 높은 위치가 낮은 위치를 덮어씁니다: **워크스페이스 > 사용자 > 확장**.

동일한 계층(사용자 또는 워크스페이스) 내에서는 `.agents/skills/` 별칭이 `.gemini/skills/` 디렉토리보다 우선합니다. 이 일반 별칭은 다른 AI 에이전트 도구 간에 호환성을 유지하면서 에이전트 전용 전문 지식을 관리하기 위한 직관적인 경로를 제공합니다.

## 스킬 관리

### 대화형 세션에서

`/skills` 슬래시 명령어를 사용하여 사용 가능한 전문 지식을 보고 관리할 수 있습니다.

- `/skills list` (기본값): 발견된 모든 스킬과 해당 상태를 표시합니다.
- `/skills link <path>`: 심볼릭 링크를 통해 로컬 디렉토리의 에이전트 스킬을 연결합니다.
- `/skills disable <name>`: 특정 스킬이 사용되지 않도록 방지합니다.
- `/skills enable <name>`: 비활성화된 스킬을 다시 활성화합니다.
- `/skills reload`: 모든 계층에서 발견된 스킬 목록을 새로 고칩니다.

<!-- prettier-ignore -->
> [!NOTE]
> `/skills disable` 및 `/skills enable`은 기본적으로 `user` 범위를 사용합니다. 워크스페이스 관련 설정을 관리하려면 `--scope workspace`를 사용하세요.

### 터미널에서

`gemini skills` 명령어는 관리 유틸리티를 제공합니다.

```bash
# 발견된 모든 스킬 목록 표시
gemini skills list

# 심볼릭 링크를 통해 로컬 디렉토리의 에이전트 스킬 연결
# 스킬(SKILL.md 또는 */SKILL.md)을 검색하고 ~/.gemini/skills(또는 ~/.agents/skills)에 심볼릭 링크를 생성합니다.
gemini skills link /path/to/my-skills-repo

# 워크스페이스 범위(.gemini/skills 또는 .agents/skills)에 연결
gemini skills link /path/to/my-skills-repo --scope workspace

# Git 저장소, 로컬 디렉토리 또는 압축된 스킬 파일(.skill)에서 스킬 설치
# 기본적으로 사용자 범위(~/.gemini/skills 또는 ~/.agents/skills)를 사용합니다.
gemini skills install https://github.com/user/repo.git
gemini skills install /path/to/local/skill
gemini skills install /path/to/local/my-expertise.skill

# --path를 사용하여 모노레포 또는 하위 디렉토리에서 특정 스킬 설치
gemini skills install https://github.com/my-org/my-skills.git --path skills/frontend-design

# 워크스페이스 범위(.gemini/skills 또는 .agents/skills)에 설치
gemini skills install /path/to/skill --scope workspace

# 이름으로 스킬 삭제
gemini skills uninstall my-expertise --scope workspace

# 스킬 활성화 (전역)
gemini skills enable my-expertise

# 스킬 비활성화. --scope를 사용하여 워크스페이스 또는 사용자 지정 가능 (기본값은 workspace)
gemini skills disable my-expertise --scope workspace
```

## 작동 방식

1.  **검색 (Discovery)**: 세션이 시작될 때 Gemini CLI는 검색 계층을 스캔하고 활성화된 모든 스킬의 이름과 설명을 시스템 프롬프트에 주입합니다.
2.  **활성화 (Activation)**: Gemini가 스킬 설명과 일치하는 작업을 식별하면 `activate_skill` 도구를 호출합니다.
3.  **동의 (Consent)**: UI에서 스킬의 이름, 목적 및 액세스 권한을 얻게 될 디렉토리 경로가 포함된 확인 프롬프트가 표시됩니다.
4.  **주입 (Injection)**: 승인 시:
    - `SKILL.md` 본문과 폴더 구조가 대화 기록에 추가됩니다.
    - 스킬의 디렉토리가 에이전트의 허용된 파일 경로에 추가되어 번들로 제공된 모든 자산을 읽을 수 있는 권한을 부여합니다.
5.  **실행 (Execution)**: 모델은 전문 지식이 활성화된 상태로 진행합니다. 모델은 합리적인 범위 내에서 스킬의 절차적 지침을 우선시하도록 지시받습니다.

### 스킬 활성화

스킬이 활성화되면(일반적으로 Gemini가 스킬 설명과 일치하는 작업을 식별하고 사용자가 승인함) 해당 전문 지침과 리소스가 에이전트의 컨텍스트에 로드됩니다. 스킬은 활성 상태로 유지되며 세션 기간 동안 해당 지침이 우선시됩니다.

## 직접 스킬 만들기

직접 스킬을 만들려면 [에이전트 스킬 만들기](/docs/cli/creating-skills) 가이드를 참조하세요.
