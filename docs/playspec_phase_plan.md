# PlaySpec v2.5 — Practical Dev Phase Plan

## 0. 용어 정리

| 용어 | 의미 |
|---|---|
| Dev Phase | PlaySpec 자체를 구현하는 개발 단계 |
| Workflow Phase | 사용자가 PlaySpec로 진행하는 task 안의 phase |
| Core Module | PlaySpec 내부 기능 책임 영역 |
| Task | 사용자가 진행 중인 하나의 기능/버그/스펙 작업 |
| Session | CLI, MCP, OpenClaw, Harness별 작업 context |

예:

```bash
playspec phase 3
```

여기서 `phase 3`은 **Workflow Phase 3**이다.

반면 이 문서의:

```text
Dev Phase 1 — Core Foundation
```

은 **PlaySpec 자체 구현 단계**다.

---

## 1. 전체 Dev Phase 요약

| Dev Phase | 이름 | 핵심 목표 |
|---|---|---|
| Dev Phase 0 | Project Bootstrap | 프로젝트 뼈대, 테스트 환경, mock FS 준비 |
| Dev Phase 1 | Core Foundation | init/create/next/phase 기본 동작 |
| Dev Phase 1.5 | Template Renderer Hardening | next/phase shared render path hardening |
| Dev Phase 2 | Completion Engine | complete, lock, snapshot, evidence, review |
| Dev Phase 3 | Reality Safety | desync 감지, safe rollback |
| Dev Phase 3.5 | Compact Context Header and Task Visibility | next/status/complete용 compact header, --quiet 지원 |
| Dev Phase 3.6 | Task Relay and Smart Context Binding | Planning→Execution context 자동 바인딩, confirmation UX |
| Dev Phase 3.7 | Simple Conditional Routing with Human Selection | result 기반 phase routing, loop guard |
| Dev Phase 4 | MCP Adapter | Claude Code / Codex / OpenClaw 연동 |
| Dev Phase 4.1 | MCP-Driven Context Migration and State Promotion | 역사 문서를 PlaySpec 상태로 마이그레이션 |
| Dev Phase 5 | Archive & Knowledge Base | close/archive/archived context |
| Dev Phase 6 | Evolution System | proposal, proactive evolution, human edit learner |
| Dev Phase 7 | Automation Safety | retry budget, circuit breaker |
| Dev Phase 8 | Token & Workflow Tools | token optimizer, workflow editing |
| Dev Phase 9 | Full Markdown Viewer | 제대로 된 viewer |
| Dev Phase 10 | Future DAG Preparation | DAG/subtask schema 준비 |

---

# Dev Phase 0 — Project Bootstrap

## Goal

PlaySpec를 안정적으로 개발할 수 있는 TypeScript 프로젝트 뼈대를 만든다.

## Why This Phase Exists

PlaySpec는 파일을 많이 읽고 쓰는 도구다.

초기부터 테스트 환경을 제대로 분리하지 않으면 실제 프로젝트의 `.playspec` 폴더를 오염시키거나, 테스트 간 상태 충돌이 발생한다.

## In Scope

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/` 기본 구조
- CLI entry point placeholder
- Core module skeleton
- 기본 타입 정의
- 기본 에러 타입
- Zod schema skeleton
- 테스트용 temp workspace helper
- `memfs` 또는 temp-dir 기반 filesystem test strategy

## Required Dependencies

```bash
typescript
tsx
vitest
zod
commander
yaml
handlebars
chalk
ora
fast-glob
proper-lockfile
chokidar
execa
simple-git
marked
open
```

## Test Strategy Decision

처음부터 테스트 파일시스템을 분리한다.

권장 방식:

1. Unit test: `memfs` 또는 추상 FS adapter 사용
2. Integration test: OS temp directory 사용
3. 실제 repo root에는 테스트 중 `.playspec` 생성 금지

## Recommended Test Helpers

```text
tests/helpers/createTempWorkspace.ts
tests/helpers/createMockFs.ts
tests/helpers/fixtures.ts
```

## Acceptance Criteria

- `pnpm install` 가능
- `pnpm build` 통과
- `pnpm test` 실행 가능
- CLI가 최소 help를 출력한다
- 테스트는 실제 프로젝트 root에 `.playspec`를 만들지 않는다
- Core는 CLI/MCP에 의존하지 않는다
- 파일 접근은 나중에 교체 가능한 adapter 경계를 가진다

---

# Dev Phase 1 — Core Foundation

## Goal

사용자가 PlaySpec를 처음 설치하고, task를 만들고, prompt를 렌더할 수 있게 한다.

사용자 흐름:

```bash
playspec init --preset default
playspec create multi-spec "Feature Name"
playspec next
playspec phase 3
```

## Important Risk

이 Dev Phase는 가장 크다.

따라서 하나의 PR로 만들더라도 내부 커밋 단위를 반드시 쪼개야 한다.

## Internal Milestones

### Dev Phase 1.1 — CLI Skeleton + Schema

#### In Scope

- `commander` 기반 CLI 구조
- `init/create/list/current/use/next/phase` 명령 placeholder
- Zod schema 정의
- error formatting

#### Acceptance

- 모든 명령어가 help에 표시된다
- 아직 실제 동작은 없어도 command parsing은 된다

---

### Dev Phase 1.2 — TaskStore + File Layout

#### In Scope

- `TaskStore` interface
- `YamlTaskStore` 구현
- `.playspec` 생성
- task folder 생성
- `task.yaml` 생성
- `memory.yaml` 생성

#### Acceptance

- `playspec init --preset default`가 `.playspec` 구조를 만든다
- `playspec create`가 task folder를 만든다

---

### Dev Phase 1.3 — HEAD + Session Context

#### In Scope

- `.playspec/HEAD`
- `.playspec/sessions/cli.default.yaml`
- `ActiveTaskResolver`
- `SessionResolver`
- CLI는 HEAD fallback 허용
- Core는 `taskId` 기반 호출 우선

#### Acceptance

- create 후 HEAD가 새 task를 가리킨다
- `current`가 active task를 보여준다
- `use TASK_ID`가 HEAD를 변경한다

---

### Dev Phase 1.4 — Workflow + Variable Resolver

#### In Scope

- workflow load
- `phaseOrder` validation
- phase resolve
- next phase 계산
- variable resolve
- `FEATURE_SLUG` 자동 생성
- `SPEC_FILE` / `HANDOFF_FILE` 자동 생성

#### Acceptance

- `next`가 현재 Workflow Phase를 계산한다
- `phase 3`이 명시 Workflow Phase를 찾는다

---

### Dev Phase 1.5 — Template Renderer Hardening

#### In Scope

- handlebars rendering
- include system
- circular include detection
- `requiredVariables` validation
- unresolved placeholder detection
- missing template error

#### Acceptance

- `next`가 실제 prompt를 렌더한다
- include가 동작한다
- unresolved `{{placeholder}}`가 남으면 실패한다
- 잘못된 template/workflow는 친절한 에러를 낸다

## Dev Phase 1 Out of Scope

- lock
- complete
- evidence
- rollback
- archive
- MCP
- evolution
- full viewer

## Dev Phase 1 Final Acceptance

- `init --preset default`가 기본 workflow/templates/rules를 설치한다
- `create`가 독립 task folder를 생성한다
- `next`가 active task 기준으로 prompt를 렌더한다
- `phase 3`이 명시 phase prompt를 렌더한다
- CLI는 HEAD fallback을 사용한다
- Core API는 `taskId` 명시 호출을 지원한다
- 템플릿 오류는 사용자가 고칠 파일 경로를 알려준다

---

# Dev Phase 1.5 Note

초기 초안에 있던 `Minimal Markdown Preview`는 Phase `1.5` 범위에서 제거한다.

viewer/preview 계열 작업은 Dev Phase `9 — Full Markdown Viewer`에서 다룬다.

Dev Phase `1.5`의 실제 범위는 위에 정의된 `Template Renderer Hardening`이다.

---

# Dev Phase 2 — Completion Engine

## Goal

Workflow Phase 완료 시점에 상태 업데이트, snapshot, evidence, review를 남긴다.

## Why This Phase Merges Multiple Concerns

`complete`가 단순히 `currentPhase`만 넘기면 실제로는 쓸모가 부족하다.

완료 시점에는 최소한 아래가 함께 필요하다.

- safe write
- phaseHistory update
- snapshot
- evidence
- review

## In Scope

- `proper-lockfile` 기반 write lock
- atomic write
- `complete` command
- phaseHistory update
- currentPhase 이동
- completion record
- `task.yaml` snapshot
- prompt snapshot
- git status 수집
- `git diff --stat` 수집
- changed files 수집
- `complete --with-review`
- `review.yaml` 저장
- `validationTemplate` 지원

## CLI

```bash
playspec complete
playspec complete --with-review
playspec evidence
playspec snapshot
```

## Out of Scope

- rollback 실행
- desync severity
- archive
- MCP
- evolution

## Acceptance Criteria

- `complete`가 현재 Workflow Phase를 completed로 기록한다
- `currentPhase`가 다음 Workflow Phase로 이동한다
- evidence 파일이 생성된다
- `review.yaml`이 생성된다
- snapshot이 생성된다
- write operation은 lock을 사용한다
- lock timeout은 명확한 에러를 낸다

## Implementation Status

- active `CLI -> ActiveTaskResolver -> PlaySpecCore -> TaskStore.completePhase()` 경로 기준 완료
- `playspec complete`, `playspec evidence`, `playspec snapshot`이 연결되어 있다
- evidence / snapshot / optional review artifact가 phase 단위로 저장된다
- Phase `2` 범위 밖의 기존 unlocked write 경로는 남아 있지만 active completion path 완료 판단을 무효화하지는 않는다

---

# Dev Phase 3 — Reality Safety

## Goal

PlaySpec 상태와 실제 Git 상태가 어긋났을 때 감지하고, 안전한 rollback을 제공한다.

## In Scope

- `StateDesyncDetector`
- `lastKnownGitHead` 저장
- changed files since last complete
- deleted/renamed file 감지
- desync severity 계산
- `next` 전 sanity check
- rollback safe point
- state-only rollback
- git rollback preview
- clean working tree guard

## CLI

```bash
playspec desync-check
playspec rollback
playspec rollback --state-only
playspec rollback --git-only
```

## Safe Rollback Rules

- working tree가 clean일 때만 자동 git rollback 허용
- uncommitted changes가 있으면 preview만 제공
- 새 commit이 생겼으면 자동 patch rollback 금지
- untracked file 삭제는 기본 금지
- git stash는 사용자 승인 필요

## Acceptance Criteria

- high desync는 `next` 전에 경고한다
- `desync-check`가 severity와 changed files를 보여준다
- `rollback --state-only`가 task 상태를 safe point로 되돌린다
- 위험한 Git 상태에서는 state-only rollback을 추천한다

---

# Dev Phase 3.5 — Compact Context Header and Task Visibility

## Goal

`playspec next`, `playspec status`, `playspec complete` 실행 시 사용자에게 현재 task 상태를 한눈에 전달하는 compact Context Header를 추가한다.

MCP 지원 이전에 CLI DX를 개선하면서도 Single Task 모델과 `task.yaml` 단일 source of truth 원칙을 유지한다.

## Why This Phase Exists

현재 `playspec next`와 `playspec complete`는 task 상태를 시각적으로 요약해주지 않는다.

사용자는 매번 `playspec status`를 별도로 실행하거나 `task.yaml`을 직접 열어 현재 phase, attempt 수, target phase를 확인해야 한다.

짧고 스캔 가능한 Context Header가 모든 주요 명령어 상단에 표시되면 사용자가 "지금 어디에 있는지"를 즉시 파악할 수 있다.

## In Scope

### Compact Context Header

`playspec next`, `playspec status`, `playspec complete` 실행 시 명령어 출력 상단에 Context Header를 렌더한다.

Header 규칙:

- 기본(default) 최대 5줄
- 표시 항목:
  - task title
  - 현재 workflow phase
  - attempt count (1보다 클 때만 표시)
  - target phase (설정된 경우에만 표시)
  - linked contextRefs 요약 count 또는 짧은 경로 (있을 때만 표시)
- Full detail은 `playspec status`에 속한다. 다른 명령어에서 반복 표시하지 않는다.

Header 예시:

```
Task: Login System Phase 1 Execution
Phase: 2 / 5
Target: Phase 1
Context: 2 refs linked
```

attempt가 있는 경우:

```
Task: Login System Phase 1 Execution
Phase: 3 / 5  (attempt 2)
Target: Phase 1
Context: 2 refs linked
```

### Quiet Mode

`--quiet` 플래그 또는 나중에 config 동등 옵션으로 Context Header를 완전히 억제할 수 있다.

- `playspec next --quiet`: header 없이 prompt만 출력
- CI/script 환경에서 machine-readable 출력이 필요할 때 사용

### Header Source

Header는 오직 `task.yaml`에서 파생한다.

- project-level state 또는 `project.yaml`을 도입하지 않는다.
- `task.yaml`에 없는 정보는 header에 표시하지 않는다.

## CLI UX

```bash
playspec next               # Context Header + rendered prompt
playspec next --quiet       # prompt only, no header
playspec status             # full task detail (header included)
playspec complete           # Context Header + completion flow
```

## Out of Scope

- project-level 상태 표시
- 멀티 task summary dashboard
- HTML/web viewer 출력
- `task.yaml` 외부 데이터 소스 참조

## Acceptance Criteria

- `playspec next`가 최대 5줄 Context Header를 prompt 앞에 출력한다.
- `playspec complete`가 실행 전 Context Header를 출력한다.
- `playspec status`가 Context Header를 포함한 full task detail을 출력한다.
- attempt count는 1보다 클 때만 표시된다.
- target phase는 설정된 경우에만 표시된다.
- contextRefs는 있는 경우에만 요약 표시된다.
- `--quiet` 플래그가 Context Header를 억제한다.
- Header는 `task.yaml`에서만 파생한다.
- project-level state를 도입하지 않는다.

## Implementation Status

- `src/cli/context-header.ts`의 공유 `formatContextHeader()` 헬퍼 기준 완료
- `playspec next`, `playspec complete`, `playspec status` 모두 동일 헬퍼 사용
- `--quiet`는 Context Header만 억제하며 desync 경고·완료 결과·에러는 그대로 출력
- `status` command 신규 등록; `current`는 legacy 경로로 유지 (충돌 없음)
- task schema에 신규 필드 없음; `target`/`contextRefs`/attempt 표시는 Phase 3.6+ 위임

---

# Dev Phase 3.6 — Task Relay and Smart Context Binding

## Goal

Planning Task(Total Spec / Phase Plan 작업)에서 Execution Task(구현 작업)로 context를 끊김 없이 전달하는 메커니즘을 제공한다.

Project/Stage 계층을 도입하지 않고 Single Task 모델을 유지하면서, Planning Context와 Execution Task가 명시적이고 확인 가능한 방식으로 연결되도록 한다.

## Why This Phase Exists

사용자는 보통 planning 작업(spec 작성, phase plan 수립)을 먼저 완료하고, 이후 실제 구현 task를 시작한다.

지금까지는 이 두 작업이 단절되어 있었다. 구현 task를 만들 때 관련 spec 파일을 수동으로 `contextRefs`에 추가해야 했다.

Dev Phase 3.6은 이 흐름을 자동화하되, 자동화 결과를 항상 사용자에게 명시하고 확인받는다:

- 완료된 Planning Context / Master Task에서 spec 파일을 자동으로 발견한다.
- Execution Task의 `contextRefs`에 자동으로 바인딩한다.
- 바인딩 내용을 사용자에게 명시적으로 출력하고 interactive 환경에서 one-time 확인을 요청한다.

## In Scope

### New Command Pattern

```bash
playspec create <workflow> "<title>" --phase <n>
```

예:

```bash
playspec create phase-execution "Login System" --phase 1
```

- `--phase <n>` 플래그가 있으면 `phase-execution` 흐름을 활성화한다.
- Final task title은 자동 생성: `"Login System Phase 1 Execution"`
- `task.yaml`의 `target.phaseNumber` 필드에 phase 번호를 저장한다.
- 사용자가 title 안에 "Phase 1"을 직접 입력하지 않아도 된다.

### Smart Context Binding

실행 task 생성 시, 완료된 Planning Context / Master Task 중 제목이 일치하는 것을 검색한다.

일치 기준: `"Login System"` → 완료 상태이며 `"Login System"`과 관련된 title을 가진 task

발견된 Planning Task의 `total_spec.md`, `phase_plan.md`를 새 task의 `contextRefs`에 자동 링크한다.

### Binding Priority

1. `--from <TASK_ID>`: 명시적 source task ID가 제공된 경우 최우선 사용
2. Unique match: 완료된 Planning Task 중 title이 고유하게 일치하면 자동 바인딩
3. Interactive selector: 복수 후보가 존재하고 TTY가 interactive한 경우 선택 prompt 제공
4. Fail with error: non-interactive 환경에서 복수 후보가 존재하거나, 필수 context를 찾을 수 없을 때

### Ambiguity Rules

- 복수 후보가 있으면 절대 자동 선택하지 않는다.
- Interactive 환경: 후보 목록을 numbered list로 표시하고 사용자 선택을 요청한다.
- Non-interactive 환경: `--from TASK_ID` 명시를 요청하는 에러를 출력하고 즉시 종료한다.

### Auto-binding Transparency

자동 바인딩은 절대 사일런트하게 진행되지 않는다.

- create 완료 즉시 링크된 파일 목록을 CLI에 출력한다.
- Interactive 환경에서는 one-time confirmation을 요청한 뒤 finalizing한다.
- Non-interactive 환경에서는 `--from` 명시가 없으면 에러를 출력하고 종료한다. 추측으로 진행하지 않는다.

출력 예시:

```
Created task: login_system_phase_1_execution

Auto-linked context from "Login System" (planning task):
  - docs/features/login_system/total_spec.md
  - docs/features/login_system/phase_plan.md

Confirm linking these files? [y/N]
```

### Missing Context Guard

- `contextRefs`에 명시된 파일이 실제로 존재하지 않으면 `playspec next`가 prompt 렌더를 거부한다.
- `contextRefs`는 참조(reference)이지 workflow 상태(state)가 아니다.

### Task Title Normalization

입력: `"Login System"` + `--phase 1`

최종 title: `"Login System Phase 1 Execution"`

규칙:

- title에 "Phase N"이 이미 포함되어 있으면 중복 추가하지 않는다.
- title에 "Execution"이 이미 포함되어 있으면 중복 추가하지 않는다.

## CLI UX

```bash
# 기본 사용
playspec create phase-execution "Login System" --phase 1

# 명시적 source task 지정
playspec create phase-execution "Login System" --phase 1 --from login_system

# TTY interactive: 복수 후보 선택
playspec create phase-execution "Login System" --phase 1
# → "Multiple planning tasks found. Select one: ..."
```

## Data Model

`task.yaml`에 추가되는 필드:

```yaml
target:
  phaseNumber: "1"

contextRefs:
  - path: docs/features/login_system/total_spec.md
    role: planning-context
    source: login_system
  - path: docs/features/login_system/phase_plan.md
    role: planning-context
    source: login_system
```

## Safety Rules

- `task.yaml`은 task context 상태의 유일한 source of truth다.
- `project.yaml`, Project/Stage hierarchy, DAG 실행, automatic next-task spawning을 도입하지 않는다.
- `contextRefs`는 참조(reference)이지 workflow 상태(state)가 아니다.
- 자동 바인딩 결과는 항상 CLI에서 출력된다. 사용자 모르게 바인딩되는 경우는 없다.
- Interactive 환경에서 one-time confirmation 없이 auto-linked context를 finalize하지 않는다.
- Non-interactive 환경에서 추측 바인딩을 허용하지 않는다.

## Out of Scope

- `project.yaml` 또는 Project/Stage state 모델
- DAG 실행 또는 automatic next-task spawning
- Planning Task에서 Execution Task 자동 생성
- 복수 후보에서 자동 선택 또는 추측

## Acceptance Criteria

- `playspec create phase-execution "Login System" --phase 1`이 `Login System Phase 1 Execution` task를 생성한다.
- 생성된 task의 `task.yaml`에 `target.phaseNumber`와 `contextRefs`가 저장된다.
- 완료된 Planning Task에서 `total_spec.md`와 `phase_plan.md`를 자동으로 발견한다.
- `--from TASK_ID`를 제공하면 해당 task의 context를 최우선으로 사용한다.
- 복수 후보가 있고 TTY가 interactive하면 선택 prompt를 제공한다.
- 복수 후보가 있고 non-interactive 환경이면 에러를 출력하고 종료한다.
- Interactive 환경에서 auto-linked 파일 목록을 출력하고 one-time confirmation을 요청한다.
- Non-interactive 환경에서 `--from` 없이 후보가 확정되지 않으면 에러를 출력하고 종료한다.
- `contextRefs`에 명시된 파일이 없으면 `playspec next`가 prompt 렌더를 거부한다.
- `project.yaml`, DAG 실행, automatic spawning을 도입하지 않는다.

## Implementation Status

- `playspec create phase-execution "<Title>" --phase <n> [--from <TASK_ID>]` 기준 완료
- `TaskRecord`/`CreateTaskInput`에 `target`, `contextRefs` 필드 추가; `TaskRecordSchema` round-trip 통과
- `YamlTaskStore.listCompletedTasks()` 추가; completed planning task 탐색 가능
- `PlaySpecCore.assertContextRefsExist()`가 `renderNextPrompt`/`renderExplicitPhasePrompt` 양쪽에 적용됨
- `phase-execution.yaml` default preset workflow 추가
- `formatContextHeader()`에 `Target:`/`Context:` 조건부 라인 추가
- 기존 `playspec create <type> "<Title>"` old path 변경 없음
- build: zero errors, test: 83/86 통과 (3건은 pre-existing rollback timeout 실패)

---

---

# Dev Phase 3.7 — Simple Conditional Routing with Human Selection

## Goal

하나의 task 안에서 결과 기반(result-based) phase routing을 지원한다.

사람이 결과를 선택하거나 `--result` 플래그로 명시하면 `playspec next`가 올바른 다음 phase로 이동한다. DAG 실행, 자동 AI output 파싱, automatic spawning 없이 Simple Conditional Routing만 제공한다.

## Why This Phase Exists

현재 workflow는 항상 선형(linear)으로 진행한다.

하지만 실제 개발에서는 결과에 따라 다른 phase로 이동해야 하는 경우가 있다:

- 승인 → 구현 단계로 이동
- 검토 필요 → spec 수정 단계로 이동
- spec 수정 완료 → 다시 validation으로 이동

이러한 조건 분기를 workflow yaml에 선언적으로 정의하고, 사람이 결과를 선택하는 방식으로 구현한다.

## In Scope

### Workflow Routing Fields

workflow yaml의 phase에 다음 필드를 추가한다:

```yaml
phases:
  "validation":
    title: Spec Validation
    template: multi-spec/validation.md
    results:
      - approved
      - needs_patch
    nextByResult:
      approved: implementation
      needs_patch: spec_patch
    maxVisits: 3
```

- `results`: 현재 phase에서 가능한 result 값 목록
- `nextByResult`: result 값 → 다음 phase 이름 매핑
- `maxVisits`: 동일 phase 반복 방문 허용 최대 횟수 (loop guard)

### `playspec complete` Behavior

현재 workflow phase가 `results`를 정의한 경우:

- **Interactive 환경**: `playspec complete` 실행 시 selection menu를 표시하고 사람이 결과를 선택한다.
- **Non-interactive 환경**: `--result <value>` 플래그가 필수다. 없으면 에러를 출력하고 종료한다.

Interactive 예시:

```
Phase "validation" complete. Select result:
  1. approved
  2. needs_patch

Choice [1-2]:
```

### Result Storage

선택된 result는 `phaseHistory`에 저장된다:

```yaml
phaseHistory:
  - phase: "validation"
    status: completed
    completedAt: "2026-04-25T10:00:00+09:00"
    result: needs_patch
    visitCount: 1
```

### Visit and Attempt Counting

- 동일 phase를 반복 방문할 때마다 `visitCount`가 증가한다.
- `maxVisits`를 초과하면 `playspec complete`가 에러를 출력하고 종료한다: loop guard 발동.
- attempt count와 visit count는 별도로 추적한다.

### `playspec next` Routing

- 현재 phase의 마지막 완료 result를 `phaseHistory`에서 읽는다.
- `nextByResult` 매핑에 따라 다음 phase를 결정한다.
- result가 없거나 매핑에 없으면 에러를 출력하고 종료한다.

### Invalid Result Guard

- `results`에 없는 값을 `--result`로 전달하면 즉시 에러를 출력하고 종료한다.
- 허용된 값 목록을 에러 메시지에 포함한다.

### Recommendation Hint (Optional, Non-authoritative)

approval fatigue 감소를 위해 optional hint를 지원한다:

- 호출자 또는 메타데이터가 명시적으로 result hint를 제공하면 selection menu에 `(recommended)` 표시를 추가한다.
- hint는 사람의 선택에 영향을 줄 수 있지만 결과를 자동으로 결정하지 않는다.
- AI output을 파싱해서 자동으로 hint를 추출하지 않는다.
- 사람의 선택 또는 `--result` 플래그가 항상 authoritative하다.

## CLI UX

```bash
# Interactive: selection menu 표시
playspec complete

# Non-interactive: result 명시
playspec complete --result approved
playspec complete --result needs_patch

# next는 routing을 자동으로 따른다
playspec next
```

## Data Model

`task.yaml`에 추가되는 필드:

```yaml
phaseHistory:
  - phase: "validation"
    status: completed
    completedAt: "2026-04-25T10:00:00+09:00"
    result: needs_patch
    visitCount: 2

routing:
  currentResult: needs_patch
```

## Safety Rules

- Single Task 모델을 유지한다. `project.yaml`을 도입하지 않는다.
- DAG 실행, parallel execution, automatic next-task spawning을 도입하지 않는다.
- AI output을 자동으로 파싱해 result를 결정하지 않는다.
- result 값은 workflow yaml에 선언된 허용 목록에서만 선택한다.
- loop guard(`maxVisits`)가 무한 반복을 방지한다.
- hint는 non-authoritative다. 사람 선택이 항상 우선한다.

## Out of Scope

- DAG 실행 또는 parallel phase 실행
- automatic AI-driven result selection
- GitHub Actions-style workflow complexity
- 자동 next-task spawning

## Acceptance Criteria

- workflow yaml에 `results`, `nextByResult`, `maxVisits`를 정의할 수 있다.
- Interactive 환경에서 `playspec complete`가 selection menu를 표시한다.
- Non-interactive 환경에서 `--result` 없이 `playspec complete`를 실행하면 에러를 출력한다.
- 선택된 result가 `phaseHistory`의 `result` 필드에 저장된다.
- `playspec next`가 `nextByResult` 매핑에 따라 올바른 다음 phase로 이동한다.
- `results`에 없는 `--result` 값은 에러를 출력하고 종료한다.
- `maxVisits`를 초과한 phase에서 `playspec complete`가 loop guard 에러를 출력한다.
- visitCount가 `phaseHistory`에 정확히 기록된다.
- DAG 실행, automatic spawning, AI-driven routing을 도입하지 않는다.

## Implementation Status

- `playspec complete --result <value>` 기준 완료; `--result` 없는 non-interactive 환경 에러 처리 포함
- `src/core/types.ts`: `PhaseDefinition`에 `results`, `nextByResult`, `maxVisits` 추가; `PhaseHistoryEntry`에 `result`, `visitCount` 추가
- `src/core/schemas.ts`: `PhaseDefinitionSchema` / `PhaseHistoryEntrySchema` routing 필드 확장
- `src/core/errors.ts`: `MissingResultError`, `InvalidResultError`, `MissingResultMappingError`, `InvalidRoutingTargetError`, `LoopGuardError`, `UnexpectedResultError` 추가
- `src/core/playspec-core.ts`: `resolveRoutedCompletion` private method 추가; artifact write 전 routing 검증
- `src/storage/yaml-task-store.ts`: `buildPhaseHistory` deduplication 제거; `result` / `visitCount` 영속 저장
- `src/cli/index.ts` / `src/cli/commands/complete.ts`: `--result` 옵션 등록; interactive selection menu 구현
- build: zero errors, test: 101/101 통과 (86 pre-existing + 15 new Phase 3.7 tests)

# Dev Phase 4 — MCP Adapter

## Goal

Claude Code, Codex, OpenClaw가 PlaySpec Core를 사용할 수 있게 MCP server를 제공한다.

## In Scope

- MCP stdio server
- task list/get
- render next prompt
- render explicit phase prompt
- complete phase
- collect evidence
- desync check
- state rollback
- session task set/get
- MCP input schema validation

## Critical Rule

MCP는 `taskId` 또는 `sessionId`가 필수다.

MCP는 global HEAD fallback을 사용하지 않는다.

## Acceptance Criteria

- MCP server가 stdio로 실행된다
- `taskId/sessionId` 없이 상태 변경 tool은 실패한다
- `render_next_prompt`는 CLI `next`와 같은 Core 결과를 반환한다
- MCP는 HEAD를 직접 읽지 않는다

## Implementation Status

- `src/mcp/` 모듈 신규 추가: `index.ts` (stdio entry), `server.ts` (10 tools), `context.ts` (`resolveMcpTaskId`), `session-store.ts` (`McpSessionStore`), `errors.ts`
- 10개 Phase 4.0 tool 전부 등록: `playspec_list_tasks`, `playspec_get_task`, `playspec_use_session_task`, `playspec_get_session_task`, `playspec_render_next_prompt`, `playspec_render_phase_prompt`, `playspec_complete_phase`, `playspec_collect_evidence`, `playspec_run_state_desync_check`, `playspec_rollback_state`
- `resolveMcpTaskId()`가 HEAD 없이 taskId → sessionId 순으로 context를 해소; HEAD fallback 없음을 테스트로 검증
- `McpSessionStore`가 `.playspec/sessions/{sessionId}.yaml` 읽기/쓰기 담당
- `@modelcontextprotocol/sdk 1.29.0` 의존성 추가; `playspec-mcp` bin entry 등록
- build: zero errors, test: 115/115 (101 pre-existing + 14 new Phase 4.0 tests)
- Phase 4.1 dependency 요건 충족: working stdio server, reliable tool registration, explicit context resolution, stable structured results

---

# Dev Phase 4.1 — MCP-Driven Context Migration and State Promotion

## Goal

Migrate fragmented historical project markdown documents into structured PlaySpec state using Claude/MCP for analysis and proposal generation.

Existing repos may already contain legacy planning and result documents such as:

- `playspec_phase0_implementation_spec.md`
- `playspec_phase1_handoff.md`
- `playspec_phase2_test_result.md`
- `playspec_phase3_implementation_result.md`
- `playspec_total_spec.md`
- `playspec_phase_plan.md`

Phase 4.1 lets Claude/MCP read these documents, infer current project and task state, and generate a validated `MigrationPlan` that can promote useful context into PlaySpec structures.

**Core principle:** Claude analyses and proposes. PlaySpec validates, previews, backs up, and applies only authorised plan actions.

## In Scope

- Bulk markdown reading via MCP tools from Dev Phase 4.
- Claude-assisted document analysis and state inference.
- `MigrationPlan` schema and Zod validation.
- State promotion plan generation.
- Migration report generation.
- Diff preview for document and state changes.
- Selective apply in `review` mode.
- Backup before any mutation.
- Optional archive with explicit `--with-archive`.
- All plans and reports persisted under `.playspec/migrations/`.

State promotion targets: `task.yaml.title`, `task.yaml.target`, `task.yaml.currentPhase`, `task.yaml.contextRefs`, `task.yaml.routing` (if already supported), current active task metadata, and master docs (`playspec_total_spec.md`, `playspec_phase_plan.md`).

## Modes

| Mode | Behaviour |
|---|---|
| `review` (default) | Generate plan, show diffs, user approves each action interactively |
| `dry-run` | Generate plan and report only — no file or state mutation |
| `auto` | Explicit opt-in; applies only low-risk validated actions; ambiguous state promotions downgrade to review or fail |

## CLI

```bash
playspec migrate
playspec migrate --mode review
playspec migrate --mode dry-run
playspec migrate --mode auto
playspec migrate --mode auto --with-archive

# Optional targeting
playspec migrate --source docs/
playspec migrate --task TASK_ID
playspec migrate --target-total-spec docs/playspec_total_spec.md
playspec migrate --target-phase-plan docs/playspec_phase_plan.md
```

## MigrationPlan Action Types

| Type | Description |
|---|---|
| `update_file` | Overwrite or rewrite a document file |
| `append_section` | Append a section to a document |
| `replace_section` | Replace a named section in a document |
| `update_task_state` | Mutate a `task.yaml` field |
| `add_context_ref` | Add an entry to `task.yaml.contextRefs` |
| `remove_context_ref` | Remove an entry from `task.yaml.contextRefs` |
| `archive_file` | Move a document to `.playspec/migrations/archived/` |

`delete_file` does not exist as an action type.

## Safety Rules

- `review` is the default mode.
- `dry-run` mutates nothing.
- `auto` must be explicitly opted into.
- Every mutation creates a backup before applying.
- `task.yaml` mutation always requires preview.
- Ambiguous state inference must not be auto-applied.
- Claude must not directly mutate files. PlaySpec applies only validated plan actions.
- Archive requires `--with-archive`. Delete is out of scope.
- All plans/reports are always persisted under `.playspec/migrations/`.

## Out of Scope

- File deletion.
- Silent mutation.
- Auto archive by default.
- Code bug fixing during migration.
- Migration without persisted plan/report.
- Project/Stage state model.

## Acceptance Criteria

- `playspec migrate` runs in `review` mode by default.
- `dry-run` generates plan/report only.
- `auto` is explicit and limited to low-risk validated actions.
- `update_task_state` and context promotion are `requiresReview: true` unless confidence is `deterministic`.
- No `delete_file` action type exists.
- Archive requires `--with-archive`.
- Every mutation creates a backup.
- All plans/reports are persisted under `.playspec/migrations/`.
- The spec clearly states Claude proposes and PlaySpec validates/applies.

Full spec: `docs/playspec_phase4.1_implementation_spec.md`

## Implementation Status

- `src/migration/` 모듈 신규 추가: `types.ts` (DTOs), `schemas.ts` (Zod), `migration-store.ts` (영속화), `migration-runner.ts` (review/dry-run/auto 실행)
- `src/cli/commands/migrate.ts` 신규 추가; `src/cli/index.ts`에 `migrate` 명령어 등록
- `src/utils/paths.ts`에 마이그레이션 경로 헬퍼 5개 추가 (`getMigrationsRoot`, `getMigrationPlansDir`, `getMigrationReportsDir`, `getMigrationBackupsDir`, `getMigrationArchivedDir`)
- `tsconfig.json` / `vitest.config.ts`에 `#migration` 경로 alias 추가
- `MigrationPlanSchema`가 `delete_file` action type을 스키마 레벨에서 거부
- `archive_file` action은 `--with-archive` 없이 실패
- 모든 mutation 전 `.playspec/migrations/backups/` 하위 백업 생성
- `task.yaml` state promotion은 `TaskRecordSchema.parse()` + `writeTextFileAtomic()` 경로로만 적용
- build: zero errors, test: 133/133 (115 pre-existing + 18 new Phase 4.1 tests)
- Phase 5 dependency 요건 충족: migration-local archive 경로(`/migrations/archived/`)는 Phase 5 general archive 모델과 독립적

---

# Dev Phase 5 — Archive & Knowledge Base

## Goal

종료된 task를 active 목록에서 제거하고, 기술 문서와 evidence/history를 장기 보존한다.

## In Scope

- close task
- archive task
- `close --archive`
- `archived/{YYYY-MM}/{task_id}` 이동
- `list --archived`
- archived context read
- basic archived search

## CLI

```bash
playspec close
playspec archive
playspec close --archive
playspec list --archived
playspec context archived TASK_ID
```

## Acceptance Criteria

- closed task를 archive할 수 있다
- active task folder가 `archived/{YYYY-MM}/{task_id}`로 이동한다
- HEAD가 archived task를 가리키면 복구 안내를 제공한다
- archived task context를 읽을 수 있다

---

# Dev Phase 6 — Evolution System

## Goal

완료 이후 개선 후보를 준비하고, 사용자가 직접 evolve를 치지 않아도 `next` 시점에 자연스럽게 제안한다.

## In Scope

- evolution context 생성
- proposal schema validation
- pending proposal 저장
- apply-evolution
- skip/view/apply UX
- proposal diff preview
- human edit diff 기록
- repeated human edit pattern context

## Boundary

PlaySpec는 reasoning을 직접 하지 않는다.

Claude/Codex/OpenClaw가 분석하고 proposal을 제출한다.

PlaySpec는 proposal 저장/검증/적용만 담당한다.

## CLI

```bash
playspec evolution-context
playspec propose-evolution proposal.yaml
playspec apply-evolution 1
playspec list-proposals
```

## Acceptance Criteria

- complete 이후 evolution context가 생성된다
- `next` 시 pending proposal이 있으면 사용자에게 알려준다
- proposal은 schema validation을 통과해야 저장된다
- apply 전 diff preview를 보여준다
- 승인 전에는 templates/workflows/rules가 수정되지 않는다
- human edit diff가 task folder에 저장된다

---

# Dev Phase 7 — Automation Safety

## Goal

Harness나 multi-agent 자동 반복 실행에서 무한 실패 루프와 비용 폭발을 막는다.

## In Scope

- harness mode schema
- retry budget
- phase attempt record
- failure signature
- failure severity
- severity-aware circuit breaker
- `human_intervention_required` state
- unblock command

## CLI

```bash
playspec harness status --task TASK_ID
playspec record-attempt --task TASK_ID --phase 7 --status failed
playspec unblock --task TASK_ID
```

## Acceptance Criteria

- attempt record가 phase별로 저장된다
- 같은 failure signature 반복 시 retry budget이 감소한다
- high/critical failure는 circuit breaker가 빠르게 발동한다
- low severity lint/format failure는 과하게 막지 않는다
- blocked task는 `human_intervention_required` 상태가 된다

---

# Dev Phase 8 — Token & Workflow Tools

## Goal

장기 task의 token 폭발을 막고, 사용자가 workflow를 CLI로 안전하게 수정할 수 있게 한다.

## In Scope

- compact / strict / full mode
- context tiering
- memory window
- evidence summary injection
- old logs on-demand only
- workflow phase add/remove/reorder
- template path update
- `requiredVariables` update
- workflow validation after edit

## CLI

```bash
playspec next --mode compact
playspec phase 7 --mode strict
playspec context --summary

playspec workflow add-phase multi-spec 7.1
playspec workflow remove-phase multi-spec 7.1
playspec workflow validate multi-spec
```

## Acceptance Criteria

- compact/strict/full mode가 다르게 렌더된다
- old phase는 summary로만 주입된다
- full logs/diffs는 기본 prompt에 들어가지 않는다
- workflow edit 후 schema validation을 수행한다
- 잘못된 workflow는 저장하지 않는다

---

# Dev Phase 9 — Full Markdown Viewer

## Goal

초기 preview를 확장해 active task, archived task, evidence, proposal, rollback point를 모두 확인할 수 있게 한다.

## In Scope

- React/Vite 기반 viewer 또는 lightweight web app
- active task dashboard
- archived task explorer
- session context viewer
- phase history timeline
- evidence viewer
- review viewer
- rendered prompt preview
- output markdown preview
- proposal diff viewer
- rollback point viewer
- human edit pattern viewer

## Acceptance Criteria

- active task 상태를 볼 수 있다
- archived task를 탐색할 수 있다
- phase history timeline을 볼 수 있다
- evidence/review/proposal/rollback 기록을 볼 수 있다

---

# Dev Phase 10 — Future DAG Preparation

## Goal

v1에서는 linear workflow만 실행하지만, future DAG/subtask 확장을 막지 않게 schema를 준비한다.

## In Scope

- `workflowMode` field
- DAG schema validation
- node `dependsOn` schema
- subtask metadata schema
- unsupported DAG execution error

## Out of Scope

- DAG 실행
- parallel scheduler
- multi-agent task assignment

## Acceptance Criteria

- `workflowMode: linear`는 기존처럼 동작한다
- `workflowMode: dag` schema를 validate할 수 있다
- DAG 실행 요청 시 `not supported yet` 에러를 낸다
- Task model에 `subtasks` field가 있다

---

# Milestone 기준

## Milestone 1 — Local MVP

대상:

- Dev Phase 0
- Dev Phase 1
- Dev Phase 1.5

사용 가능:

```bash
playspec init
playspec create multi-spec "Feature"
playspec next
playspec view
```

---

## Milestone 2 — Safe Daily Use

대상:

- Dev Phase 2
- Dev Phase 3
- Dev Phase 3.5
- Dev Phase 3.6
- Dev Phase 3.7

사용 가능:

```bash
playspec complete --with-review
playspec complete --result approved
playspec rollback
playspec desync-check
playspec status
playspec create phase-execution "Feature" --phase 1
playspec next                   # follows result-based routing
```

---

## Milestone 3 — MCP Ready

대상:

- Dev Phase 4

사용 가능:

- Claude Code / Codex / OpenClaw 연동 가능

---

## Milestone 4 — Knowledge & Evolution

대상:

- Dev Phase 5
- Dev Phase 6

사용 가능:

- Archive 시작
- Evolution 시작

---

## Milestone 5 — Automation Ready

대상:

- Dev Phase 7
- Dev Phase 8

사용 가능:

- Harness 대응
- 장기 task 대응

---

## Milestone 6 — Full UX

대상:

- Dev Phase 9
- Dev Phase 10

사용 가능:

- Full viewer
- future DAG 준비

---

# 최종 구현 순서 추천

1. Dev Phase 0 — Project Bootstrap
2. Dev Phase 1 — Core Foundation
3. Dev Phase 1.5 — Template Renderer Hardening
4. Dev Phase 2 — Completion Engine
5. Dev Phase 3 — Reality Safety
6. Dev Phase 3.5 — Compact Context Header and Task Visibility
7. Dev Phase 3.6 — Task Relay and Smart Context Binding
8. Dev Phase 3.7 — Simple Conditional Routing with Human Selection
9. Dev Phase 4 — MCP Adapter
10. Dev Phase 4.1 — MCP-Driven Context Migration and State Promotion
11. Dev Phase 5 — Archive & Knowledge Base
12. Dev Phase 6 — Evolution System
13. Dev Phase 7 — Automation Safety
14. Dev Phase 8 — Token & Workflow Tools
15. Dev Phase 9 — Full Markdown Viewer
16. Dev Phase 10 — Future DAG Preparation

---

# 핵심 변경 요약

이번 업데이트에서 반영한 리스크는 4개다.

## 1. `Epic`이라는 용어 제거

`Dev Phase`, `Workflow Phase`, `Core Module`로 정리했다.

## 2. Dev Phase 1 Monster PR 리스크 완화

Dev Phase 1을 `1.1 ~ 1.5` 내부 마일스톤으로 나눴다.

## 3. Minimal Viewer 오버엔지니어링 방지

React 없이 `marked + open + preview.html`로 처리한다.

## 4. 파일 시스템 테스트 오염 방지

Dev Phase 0에서 `memfs` / temp workspace 전략을 필수화했다.
