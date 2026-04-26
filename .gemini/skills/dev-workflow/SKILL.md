---
name: dev-workflow
description: '/dev-workflow plan' 또는 '/dev-workflow run' 명령을 통해 활성화됩니다. 'plan' 시에는 일반 서브에이전트의 검토를 포함한 5단계 설계 프로세스를 따르며, 'run' 시에는 TDD 기반 구현을 수행합니다.
---

# Dev Workflow Router

이 스킬은 사용자가 입력한 `/dev-workflow` 명령어에 따라 개발 생명주기를 관리합니다.

## 라우팅 및 지침

### 1. `/dev-workflow plan` (설계 및 계획 단계)
- **금지 사항**: **어떠한 코드 작성도 허용되지 않습니다.**
- **절차 (Phase 1-5)**: [reference/task-plan.md](reference/task-plan.md)에 정의된 5단계 절차를 엄격하게 수행하세요.
- **서브에이전트 활용**: 전용 에이전트 대신 `generalist` 등을 호출하여 상황에 맞는 역할(컨설턴트, 리뷰어 등)을 부여하고 검토를 요청하세요.
- **승인 프로세스**: `requirement.md`와 `plan.md` 모두 사용자의 명시적 승인을 거쳐야 합니다.

### 2. `/dev-workflow run` (구현 단계)
- **전제 조건**: `work/task/` 하위에 승인된 `plan.md`가 포함된 태스크 폴더가 존재해야 합니다.
- **실행 프로세스**:
    1. 사용자에게 구현을 진행할 **태스크 이름(`<task-name>`)** 또는 폴더 경로를 입력받으세요.
    2. 해당 폴더 내의 `plan.md`를 로드하여 전체 태스크를 파악합니다.
    3. [reference/task-execution.md](reference/task-execution.md)의 지침에 따라 서브에이전트에게 순차적으로 태스크를 위임하여 실행하세요.
- **실행 지침**: 서브에이전트 호출 시 [reference/sub-task-execution.md](reference/sub-task-execution.md)의 TDD 사이클을 따르도록 프롬프트에 포함하세요.

### 3. `/dev-workflow` (현황 가이드)
- 현재 작업 디렉토리를 확인하여 `plan` 또는 `run`을 제안하세요.

## 핵심 준수 사항
- 모든 문서는 **한국어**로 작성합니다.
- 서브에이전트 호출 시 검토 규칙([requirement-reviewer.md](reference/requirement-reviewer.md), [plan-reviewer.md](reference/plan-reviewer.md))을 프롬프트에 포함하세요.
