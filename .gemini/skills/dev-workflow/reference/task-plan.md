# Strict Task Planning Process

`/dev-workflow plan` 명령어 실행 시 아래 5단계를 엄격히 준수해야 합니다. **이 과정에서 실제 프로덕션 코드나 테스트 코드를 작성하는 것은 엄격히 금지됩니다.**

## Phase 1: 사용자 초기 요구사항 전달
- 사용자가 해결하고자 하는 문제나 추가하려는 기능을 청취합니다.

## Phase 2: 코드베이스 탐색
- **코드베이스 탐색 전용 서브에이전트(`codebase_investigator`)**를 호출하여 요구사항과 관련된 파일, 클래스, DB 테이블 및 아키텍처 현황을 심층 조사합니다.
- 조사된 결과는 이후 `requirement.md` 작성의 근거가 됩니다.

## Phase 3: 요구사항 인터뷰 및 문서화
- 사용자 인터뷰를 통해 의사결정이 필요한 사항을 확정합니다.
- `work/task/<task-name>/requirement.md`를 생성하여 저장하고 사용자의 명시적 승인을 받습니다.

## Phase 4: Requirement Review
- **일반 서브에이전트(예: `generalist`)**를 호출하여 컨설턴트 역할을 부여하고 `requirement.md` 검토를 요청합니다. ([requirement-reviewer.md](requirement-reviewer.md) 참조)
- 지적 사항을 사용자에게 보고하고 수정 여부를 승인받습니다.
- **서브에이전트 검토 -> 사용자 승인 -> 문서 수정** 사이클을 최종 승인 시까지 반복합니다.

## Phase 5: Plan 작성 및 검토
- 승인된 `requirement.md`를 바탕으로 같은 경로에 `plan.md`를 작성합니다.
- **일반 서브에이전트(예: `generalist`)**를 호출하여 리뷰어 역할을 부여하고 `plan.md` 검토를 요청합니다. ([plan-reviewer.md](plan-reviewer.md) 참조)

## 주의 사항
- **No Code Generation**: 이 단계에서는 코드 작성이 절대 금지됩니다.
- **Role Assignment**: 서브에이전트 호출 시 반드시 전문적인 역할(역할군)을 프롬프트로 부여하세요.

---

# Document Templates

## 1. Requirement Template (`requirement.md`)
```markdown
# Requirement: <Task Name>

## 1. 개요
- 구현하려는 목적과 배경을 간략히 기술합니다.

## 2. 상세 요구사항
- [ ] 기능 A: 세부 동작 방식 및 제약 조건
- [ ] 기능 B: UI/UX 요소, API 명세 등

## 3. 기술적 제약 사항
- 기존 코드베이스와의 호환성, DB 스키마 변경 여부, 사용 금지된 라이브러리 등

## 4. 인수 조건 (Acceptance Criteria)
- "사용자는 ~를 할 수 있어야 한다" 형태의 검증 가능한 결과 목록
```

## 2. Plan Template (`plan.md`)
```markdown
# Implementation Plan: <Task Name>

## 전체 목표 및 요약
- 이 태스크의 궁극적인 목표와 주요 변경 사항에 대한 요약

## 상세 태스크 (Sub-tasks)
각 태스크는 서브에이전트 1개가 한 번의 호출로 완료할 수 있는 적절한 단위로 분할되어야 합니다.

### [task-001] <태스크 제목>
- **목표**: 이 단계에서 달성하고자 하는 구체적 결과
- **서브에이전트**: generalist (또는 적절한 에이전트)
- **구현 단계 (TDD)**:
    1. **Red**: 실패하는 테스트 케이스 작성 (파일명, 테스트 함수명 포함)
    2. **Green**: 테스트를 통과하기 위한 최소한의 프로덕션 코드 구현
    3. **Refactor**: 코드 품질 개선 및 스타일 가이드 준수 확인
- **검증 및 커밋**:
    1. **Validation**: 정의된 검증 계획에 따라 테스트 실행 및 최종 확인
    2. **Commit**: 검증 완료 후 변경 사항 커밋 (`commit-guide` 스킬 활용 및 메시지 규칙 준수)
- **검증 계획 (Validation Plan)**: 이 태스크 완료 후 실행할 테스트 명령어 및 예상 결과

### [task-002] <태스크 제목>
- (위와 동일한 형식)
```
