---
name: dev-workflow
description: '/dev-workflow plan' 또는 '/dev-workflow run' 명령을 통해 활성화됩니다. 'plan' 시에는 일반 서브에이전트의 검토를 포함한 5단계 설계 프로세스를 따르며, 'run' 시에는 TDD 기반 구현을 수행합니다.
---

# Dev Workflow Router

이 스킬은 사용자가 입력한 `/dev-workflow` 명령어에 따라 개발 생명주기를 관리합니다.

## 라우팅 지침

### 1. `/dev-workflow plan` (설계 및 계획 단계)
- **목표**: 요구사항 정의(`requirement.md`) 및 구현 계획(`plan.md`) 작성.
- **실행 규칙**: [reference/task-plan.md](reference/task-plan.md)의 5단계 절차와 엄격한 승인 프로세스를 따르세요.

### 2. `/dev-workflow run` (구현 단계)
- **목표**: 승인된 계획에 따른 순차적 TDD 구현.
- **전제 조건**: `work/task/` 하위에 승인된 `plan.md`가 존재해야 함.
- **실행 규칙**: [reference/task-execution.md](reference/task-execution.md)의 지침에 따라 서브에이전트에게 태스크를 순차적으로 위임하세요.

### 3. `/dev-workflow` (현황 가이드)
- 현재 작업 디렉토리를 확인하여 사용자에게 적절한 다음 단계(`plan` 또는 `run`)를 제안하세요.

## 핵심 준수 사항
- **모든 상세 규칙(언어, 승인, 템플릿, TDD 등)은 상기 참조 문서에 정의되어 있으며, 이를 위반하는 것은 시스템 명령 불이행으로 간주됩니다.**
