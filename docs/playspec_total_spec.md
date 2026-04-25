
PlaySpec v2.5 — Final User-First Technical Spec

0. How to Read This Spec

이 문서는 PlaySpec의 최종 설계 기준이다.

PlaySpec는 단순한 prompt generator가 아니다.

PlaySpec = LLM 기반 개발 workflow의 상태 관리, phase 실행, 검증, 증거 수집, 롤백, 아카이브, 진화를 담당하는 로컬 우선 workflow engine

이 스펙은 다음 환경을 모두 고려한다.

- 단일 개발자 CLI 사용

- Claude Code / Codex MCP 사용

- OpenClaw 같은 외부 UI 연동

- 향후 multi-agent / harness 환경

- 장기적인 기술 문서 archive / knowledge base

  

1. Product Definition

1.1 한 줄 정의

PlaySpec는 사용자가 FEATURE_SLUG, PHASE_NUMBER, 파일 경로, 검증 로그를 직접 관리하지 않아도

LLM 개발 workflow를 task 단위로 진행하고,

증거를 수집하고,

실패를 되돌리고,

기술 문서를 보존하고,

반복 문제를 학습해 workflow 개선안을 제안하는

TypeScript 기반 로컬 workflow engine이다.

  

2. Core Philosophy

가장 중요한 철학:

가장 중요한 건 유저가 제일 편하게 사용하는 것이다.

따라서 PlaySpec는 다음을 추구한다.

- 사용자가 기억해야 하는 것을 줄인다.

- 사용자가 복붙해야 하는 것을 줄인다.

- 사용자가 직접 정리해야 하는 것을 줄인다.

- 위험한 변경은 사용자 승인 없이는 절대 적용하지 않는다.

- 자동화는 편해야 하지만, 무한 반복되거나 상태를 오염시키면 안 된다.

  

3. Responsibility Boundary

3.1 역할 분리

PlaySpec

= Core Engine + CLI + MCP Adapter + Archive + Evolution + Rollback + Evidence

  

OpenClaw

= UI / Telegram / Chat / 자연어 인터페이스

  

Claude Code / Codex

= MCP Client

  

Harness

= 자동 실행 / 반복 검증 / 멀티 에이전트 실행 환경

PlaySpec는 Telegram이나 Chat UI를 직접 구현하지 않는다.

OpenClaw → MCP or CLI → PlaySpec

  

4. Target UX

4.1 사용자는 보통 이것만 쓴다

playspec init --preset cpp-vulkan

playspec create multi-spec "Post Simulation Transition Rendering"

  

playspec next

playspec complete

playspec rollback

playspec view

4.2 사용자가 기억하지 않아도 되는 것

❌ FEATURE_SLUG

❌ PHASE_NUMBER

❌ SPEC_FILE

❌ HANDOFF_FILE

❌ task folder path

❌ archive path

❌ evidence file path

  

5. Technology Stack

5.1 Required

Language: TypeScript

Runtime: Node.js 22+

Package Manager: pnpm

commander                  # CLI

@modelcontextprotocol/sdk  # MCP

zod                        # schema validation

yaml                       # YAML read/write

handlebars                 # template rendering

chalk                      # CLI output

ora                        # CLI spinner

fast-glob                  # file discovery

proper-lockfile            # file lock

chokidar                   # file watcher

execa                      # safe command execution

simple-git                 # git status/diff helper

vitest                     # tests

5.2 Optional / Future

better-sqlite3             # future multi-agent TaskStore

React + Vite               # markdown viewer

react-markdown             # markdown rendering

  

6. High-Level Architecture

User / Agent

 ├─ Human CLI

 ├─ Claude Code / Codex via MCP

 ├─ OpenClaw

 └─ Harness Runner

  

        ↓

  

PlaySpec Interface Layer

 ├─ CLI Adapter

 ├─ MCP Adapter

 └─ Optional HTTP Adapter later

  

        ↓

  

PlaySpec Core Engine

 ├─ SessionResolver

 ├─ ActiveTaskResolver

 ├─ TaskStore

 ├─ WorkflowRegistry

 ├─ PhaseResolver

 ├─ VariableResolver

 ├─ TemplateRenderer

 ├─ PromptRenderer

 ├─ CompletionValidator

 ├─ AutoEvidenceCollector

 ├─ StateDesyncDetector

 ├─ SnapshotManager

 ├─ ArchiveManager

 ├─ RollbackManager

 ├─ EvolutionEngine

 ├─ HumanEditLearner

 ├─ CircuitBreaker

 ├─ RetryBudgetManager

 ├─ PresetManager

 ├─ TokenOptimizer

 └─ LockManager

  

        ↓

  

Storage Layer

 ├─ YamlTaskStore v1

 └─ SQLiteTaskStore future

  

7.

.playspec

Directory Layout

.playspec/

  HEAD

  

  config.yaml

  

  sessions/

    cli.default.yaml

    mcp.claude-code.yaml

    mcp.codex.yaml

    openclaw.default.yaml

    harness.run-20260424-001.yaml

  

  tasks/

    active/

      {task_id}/

        task.yaml

        memory.yaml

  

        outputs/

        reviews/

        prompts/

        proposals/

        evidence/

        snapshots/

        rollback/

        human-edits/

        subtasks/

  

    archived/

      2026-04/

        {task_id}/

          task.yaml

          memory.yaml

          outputs/

          reviews/

          prompts/

          proposals/

          evidence/

          snapshots/

          rollback/

          human-edits/

  

  workflows/

    mono-spec.yaml

    multi-spec.yaml

    simple-bug.yaml

  

  templates/

    mono-spec/

    multi-spec/

    simple-bug/

  

  rules/

    global_rules.md

    spec_validation_rules.md

    implementation_rules.md

    entry_point_audit_rules.md

    rollback_rules.md

    harness_rules.md

  

  presets/

    default/

    cpp-vulkan/

    react-frontend/

    python-api/

    nestjs-backend/

  

8. Active Task and Session Context

8.1 HEAD는 사람용 편의 기능

.playspec/HEAD는 human CLI 사용자를 위한 기본 active task pointer다.

tasks/active/post_simulation_transition_rendering

사람은 편하게 쓸 수 있다.

playspec next

playspec complete

8.2 MCP / OpenClaw / Harness는 taskId 명시 필수

멀티 세션 충돌을 막기 위해 MCP와 Agent 환경에서는 global HEAD fallback을 금지한다.

playspec_render_next_prompt({

  taskId: "post_simulation_transition_rendering"

})

또는 session 기반:

playspec_render_next_prompt({

  sessionId: "mcp.claude-code"

})

8.3 Context Resolution 규칙

1. --task TASK_ID가 있으면 최우선 사용

2. --session SESSION_ID가 있으면 session currentTaskId 사용

3. Human CLI만 HEAD fallback 허용

4. MCP/OpenClaw/Harness는 HEAD fallback 금지

5. task가 불명확하면 실행하지 않고 후보를 보여준다

  

6. Task Folder Isolation

Task는 독립 폴더를 가진다.

.playspec/tasks/active/{task_id}/

Task 생성:

playspec create multi-spec "Post Simulation Transition Rendering"

생성 결과:

.playspec/tasks/active/post_simulation_transition_rendering/

  task.yaml

  memory.yaml

  outputs/

  reviews/

  prompts/

  proposals/

  evidence/

  snapshots/

  rollback/

  human-edits/

  

10. Task File Spec

id: post_simulation_transition_rendering

title: Post-Simulation Transition Rendering

workflowType: multi-spec

status: active

  

workflowMode: linear

currentPhase: "2.5"

  

createdAt: "2026-04-24T10:00:00+09:00"

updatedAt: "2026-04-24T13:00:00+09:00"

  

paths:

  taskRoot: .playspec/tasks/active/post_simulation_transition_rendering

  projectDocRoot: docs/features/post_simulation_transition_rendering

  

variables:

  FEATURE_SLUG: post_simulation_transition_rendering

  TARGET_BRANCH: refactor

  

phaseHistory:

  - phase: "1"

    status: completed

    completedAt: "2026-04-24T11:00:00+09:00"

  

  - phase: "2.5"

    status: active

  

automation:

  mode: assisted

  retryPolicy:

    maxAttemptsPerPhase: 3

    maxAttemptsPerTask: 12

    stopOnRepeatedFailure: true

  

stateSync:

  lastKnownGitHead: abc1234

  lastCompletedAt: "2026-04-24T13:00:00+09:00"

  lastCompletedDiffHash: diff_123

  lastSanityCheckAt: "2026-04-24T13:00:00+09:00"

  

archive:

  status: none

  archivedAt: null

  archivePath: null

  

rollback:

  lastSafePoint: null

  

subtasks: []

  

11. TaskStore Abstraction

PlaySpec v1은 YAML 기반으로 시작한다.  
하지만 Core는 YAML에 직접 의존하면 안 된다.

11.1 Interface

interface TaskStore {

  getTask(taskId: string): Promise<TaskRecord>;

  saveTask(task: TaskRecord): Promise<void>;

  

  listActiveTasks(): Promise<TaskSummary[]>;

  listArchivedTasks(): Promise<TaskSummary[]>;

  

  createTask(input: CreateTaskInput): Promise<TaskRecord>;

  updateTask(taskId: string, patch: TaskPatch): Promise<TaskRecord>;

  

  moveToArchive(taskId: string, archivePath: string): Promise<void>;

}

11.2 구현체

YamlTaskStore v1

SQLiteTaskStore future

11.3 원칙

좋은 구조:

core.renderNextPrompt({ taskId });

core.completePhase({ taskId });

나쁜 구조:

core.completePhaseFromHead();

HEAD는 CLI adapter에서만 처리한다.

  

12. Workflow System

12.1 Linear Workflow v1

id: multi-spec

mode: linear

  

phaseOrder:

  - "1"

  - "1.1"

  - "1.5"

  - "2"

  - "3"

  - "3.5"

  - "4"

  - "5"

  - "6"

  - "6.1"

  - "7"

  - "7.5"

  - "8"

  - "9"

  

phases:

  "7":

    title: Phase별 기술 구현

    template: multi-spec/phase7_implementation.md

    requiredVariables:

      - FEATURE_SLUG

      - PHASE_NUMBER

    defaultMode: strict

  

    outputs:

      - "{{PHASE_IMPL_FILE}}"

      - "{{PHASE_HANDOFF_FILE}}"

  

    completion:

      validationTemplate: multi-spec/phase7_completion_validation.md

      collectEvidence: true

      requireUserReview: true

      createRollbackPoint: true

12.2 Future DAG 준비

v1에서는 실행하지 않지만 schema 여지는 둔다.

mode: dag

  

nodes:

  "3.A":

    title: Investigate Network Layer

    template: investigate_network.md

  

  "3.B":

    title: Investigate Database Layer

    template: investigate_database.md

  

  "4":

    title: Merge Findings

    dependsOn:

      - "3.A"

      - "3.B"

  

13. Template System

템플릿은 Markdown 기반이다.

Task:

Implement phase {{PHASE_NUMBER}} for {{FEATURE_SLUG}}.

  

Variables:

- FEATURE_SLUG={{FEATURE_SLUG}}

- PHASE_NUMBER={{PHASE_NUMBER}}

- PHASE_SPEC_FILE={{PHASE_SPEC_FILE}}

  

{{include:rules/global_rules.md}}

{{include:rules/implementation_rules.md}}

13.1 Include Rules

- include는 .playspec 내부만 허용

- include path는 normalize 후에도 .playspec 밖으로 나가면 실패

- 순환 include 금지

- missing include는 실패

- workflow phase는 `requiredVariables`로 render contract를 선언할 수 있다

- active render path는 missing required variable이면 출력 전에 실패한다

- unresolved placeholder가 남으면 실패

  

14. Preset System

14.1 목적

초기 세팅 고통 제거.

playspec init --preset cpp-vulkan

14.2 기본 Preset

default

cpp-vulkan

react-frontend

python-api

nestjs-backend

14.3 Preset이 설치하는 것

- workflows

- templates

- rules

- default config

- default viewer settings

  

15. State Desync Detector

15.1 문제

사용자가 PlaySpec 없이 수동으로 코드를 크게 바꾸면 PlaySpec 상태와 현실 코드가 어긋난다.

예:

금요일: Phase 3 완료

주말: 사용자가 수동 리팩토링

월요일: playspec next

PlaySpec가 금요일 상태만 믿고 prompt를 만들면 LLM이 틀린 파일을 참조할 수 있다.

15.2 해결

playspec next, phase, complete 전 lightweight sanity check를 수행한다.

수집 대상:

- current git HEAD

- git status

- changed files since last completion

- diff stat since last safe point

- deleted/renamed files

- docs/features 변경 여부

15.3 UX

PlaySpec detected significant changes since the last completed phase.

  

Changed files:

- src/render/transition/...

- docs/features/...

  

This task may be out of sync with the current codebase.

  

Options:

[y] continue

[r] refresh context before next prompt

[s] create sync snapshot

[v] view changes

15.4 Desync Severity

low:

  - small doc changes

  - formatting-only changes

  

medium:

  - files changed outside expected phase outputs

  - new files added

  

high:

  - target files deleted or renamed

  - git HEAD changed

  - large diff after last complete

  - projectDocRoot changed heavily

15.5 Rule

low: silently record

medium: warn

high: ask before rendering next prompt

  

16. Auto-Evidence Collector

16.1 목적

사용자가 git diff, test log, lint log를 복붙하지 않게 한다.

16.2 수집 대상

- git status

- git diff --stat

- git diff

- changed files

- recent build result

- recent test result

- recent lint result

- failure logs

16.3 저장 위치

.playspec/tasks/active/{task_id}/evidence/

  phase7_git_status.txt

  phase7_git_diff_stat.txt

  phase7_test_result.txt

  phase7_lint_result.txt

Harness attempt별:

evidence/

  phase7_attempt1_build.log

  phase7_attempt1_diff.patch

  phase7_attempt2_build.log

  

17. Completion Validator

complete는 단순히 phase를 넘기지 않는다.

17.1 Complete Flow

1. state desync check

2. rollback safe point 생성

3. evidence 자동 수집

4. validation prompt 생성

5. user review 저장

6. output snapshot 생성

7. phaseHistory 업데이트

8. proactive evolution 후보 생성

9. retry/circuit breaker 상태 갱신

17.2 Completion Record

phase: "7"

status: completed

completedAt: "2026-04-24T14:00:00+09:00"

  

validation:

  evidenceCollected: true

  validationPromptRendered: true

  userConfirmed: true

  warnings:

    - Runtime validation was not performed.

  

evidence:

  - evidence/phase7_git_diff_stat.txt

  - evidence/phase7_test_result.txt

  

snapshots:

  - snapshots/phase7_before_complete.yaml

  

18. Snapshot System

18.1 Snapshot 생성 시점

- phase 시작 전

- phase complete 시

- state desync refresh 시

- rollback safe point 생성 시

- task close 시

- archive 시

- 수동 playspec snapshot

18.2 Snapshot 대상

- task.yaml

- rendered prompts

- reviews

- evidence

- workflow output files

- selected project docs

  

19. Rollback Manager

19.1 목적

AI가 phase를 망쳤을 때 사용자가 수동으로 복구하지 않게 한다.

playspec rollback

playspec rollback --task TASK_ID

playspec rollback --state-only

playspec rollback --git-only

19.2 Rollback 대상

- task.yaml 상태

- currentPhase

- phaseHistory

- HEAD/session state

- prompts/reviews/evidence 기록

- optional git working tree changes

19.3 Git Hell 방지 규칙

Git rollback은 매우 조심해야 한다.

- working tree가 clean일 때만 자동 git rollback 허용

- uncommitted changes가 있으면 preview만 제공

- commit이 새로 생겼으면 자동 patch rollback 금지

- git pull/branch change 감지 시 state-only rollback 권장

- untracked file 삭제는 기본 금지

- git stash는 사용자 승인 필요

19.4 UX

Git working tree is not clean.

  

Safe rollback options:

1. State-only rollback

2. Create stash, then rollback

3. Cancel

  

Recommended:

State-only rollback

  

20. Archive System

20.1 상태 정의

completed = workflow 작업이 끝남

closed = task를 더 이상 진행하지 않음

archived = active 목록에서 제거하고 보관소로 이동

20.2 명령어

playspec close

playspec archive

playspec close --archive

playspec list --archived

playspec view --archived TASK_ID

20.3 Archive Path

.playspec/tasks/archived/{YYYY-MM}/{task_id}/

Archive는 다음을 보존한다.

task.yaml

memory.yaml

outputs/

reviews/

prompts/

proposals/

evidence/

snapshots/

rollback/

human-edits/

  

21. Token Optimizer

21.1 문제

Task가 길어질수록 prompt가 비대해진다.

Phase 10

+ evidence

+ proposals

+ reviews

+ prompts

= token explosion

21.2 해결

TokenOptimizer는 다음을 수행한다.

- compact / strict / full mode

- include rule dedup

- memory window 제한

- evidence summary injection

- old phase full text exclusion

- important decisions only injection

21.3 Memory Window

memoryWindow:

  recentPhases: 3

  maxLessons: 8

  maxEvidenceFiles: 5

  maxTokens: 12000

21.4 Context Tiers

Tier 1: Always include

- current task summary

- current phase

- target files

- locked rules

- latest relevant decisions

  

Tier 2: Summarized

- previous phase results

- evidence summary

- evolution lessons

  

Tier 3: Available on demand

- full logs

- full diffs

- old prompts

- archived outputs

  

22. Evolution Engine

22.1 책임 분리

PlaySpec Core = context 수집 + proposal 저장 + patch 적용

LLM Caller = 분석과 제안 작성

즉, Claude/Codex/OpenClaw가 reasoning을 수행한다.

22.2 Proactive Evolution

사용자가 evolve를 직접 치지 않아도 된다.

complete 이후 PlaySpec는 evolution context를 준비한다.

다음 next 시점에 부드럽게 묻는다.

1 pending improvement proposal found.

  

Problem:

Phase 7 repeatedly missed runtime evidence.

  

Suggestion:

Add runtime evidence checklist to phase7 completion template.

  

Apply now?

[y] apply / [n] skip / [v] view

22.3 자동 적용 금지

자동 분석 준비 = 가능

자동 proposal 생성 = 가능

자동 적용 = 금지

  

23. Human Edit Learner

23.1 문제

템플릿은 시간이 지나면 낡는다.

팀 컨벤션, 기술 스택, 스타일이 바뀌면 프롬프트도 바뀌어야 한다.

23.2 해결

PlaySpec는 AI output 이후 사용자가 수동으로 수정한 diff를 학습 신호로 기록한다.

저장 위치:

.playspec/tasks/active/{task_id}/human-edits/

  phase7_human_edit_diff.patch

  phase7_human_edit_summary.yaml

23.3 학습 대상

- AI가 만든 코드와 사용자가 최종 수정한 코드의 차이

- 반복되는 스타일 수정

- 반복되는 naming 변경

- 반복되는 architecture correction

- 반복되는 test pattern correction

23.4 Evolution 연결

Human edit pattern이 반복되면 template/rule 개선안을 만든다.

예:

observedHumanEdits:

  - user repeatedly replaced raw uint64_t IDs with strong wrapper types

  

suggestedRulePatch:

  file: rules/cpp_vulkan_architecture_rules.md

  content: |

    Semantic IDs must use strong wrapper types. Do not expose raw uint64_t in public APIs.

  

24. Harness Mode

24.1 목적

Harness는 자동으로 phase를 실행하고, evidence를 수집하고, 실패 시 retry할 수 있다.

하지만 무한 반복은 막아야 한다.

24.2 명령어

playspec harness run --task TASK_ID

playspec harness run --task TASK_ID --phase 7

playspec harness status --task TASK_ID

playspec harness stop --task TASK_ID

24.3 원칙

- taskId 필수

- HEAD 사용 금지

- retry budget 필수

- failure signature 기록 필수

- 같은 실패 반복 시 circuit breaker 발동

  

25. Retry Budget

25.1 Task File 구조

automation:

  mode: assisted

  retryPolicy:

    maxAttemptsPerPhase: 3

    maxAttemptsPerTask: 12

    stopOnRepeatedFailure: true

  

phaseAttempts:

  - phase: "7"

    attempt: 1

    status: failed

    failureSignature: build_error_transition_gpu_binding

    failureSeverity: high

25.2 Failure Signature

실패 로그 전체를 비교하지 않고 signature를 만든다.

- error type

- file path

- compiler/test/lint category

- normalized error message

  

26. Severity-Aware Circuit Breaker

26.1 문제

너무 민감한 circuit breaker는 유저를 귀찮게 만든다.

단순 lint 에러와 심각한 architecture failure를 똑같이 취급하면 안 된다.

26.2 Failure Severity

low:

  - formatting

  - simple lint

  - trailing comma

  - import order

  

medium:

  - unit test failure

  - type error

  - missing file

  - snapshot mismatch

  

high:

  - build failure

  - repeated compile error

  - runtime crash

  - destructive file operation

  - security-sensitive failure

  

critical:

  - data loss risk

  - git corruption risk

  - repeated same high failure

  - source tree damaged

26.3 Retry Policy by Severity

retryPolicy:

  low:

    maxAttempts: 5

    circuitBreaker: false

  

  medium:

    maxAttempts: 3

    circuitBreaker: true

  

  high:

    maxAttempts: 2

    circuitBreaker: true

  

  critical:

    maxAttempts: 1

    circuitBreaker: true

26.4 Blocked State

status: human_intervention_required

  

circuitBreaker:

  triggered: true

  reason: repeated_failure_signature

  phase: "7"

  failureSignature: build_error_transition_gpu_binding

  failureSeverity: high

  triggeredAt: "2026-04-24T15:00:00+09:00"

  recommendedAction: "Manual review required before retrying phase 7."

26.5 UX

Task is blocked: Human Intervention Required

  

Reason:

Repeated high-severity build failure in Phase 7.

  

Suggested action:

Review evidence/phase7_attempt2_build.log before retrying.

  

Commands:

playspec view

playspec rollback --task TASK_ID

playspec unblock --task TASK_ID

  

27. File Lock / Race Condition Policy

27.1 v1 YAML Policy

모든 write operation은 lock을 사용한다.

대상:

.playspec/HEAD

.playspec/sessions/**

.playspec/tasks/active/**

.playspec/tasks/archived/**

.playspec/workflows/**

.playspec/templates/**

.playspec/rules/**

27.2 규칙

- write는 exclusive lock

- temp file write 후 atomic rename

- archive/rollback은 transaction-like operation

- timeout 발생 시 무한 retry 금지

- timeout은 명확한 에러로 사용자에게 알려준다

27.3 Future SQLite 전환 기준

다음 중 하나가 생기면 SQLite TaskStore를 고려한다.

- 동시 agent 3개 이상

- lock timeout 빈번

- harness가 지속적으로 상태 업데이트

- remote worker 연동

  

28. Markdown Viewer

명령어:

playspec view

playspec view --task TASK_ID

playspec view --archived TASK_ID

Viewer가 보여줄 것:

- active task dashboard

- archived task explorer

- session context

- phase history timeline

- state desync warning

- retry attempts

- circuit breaker state

- evidence logs

- output markdown

- rendered prompt preview

- evolution proposal diff

- rollback points

- human edit patterns

  

29. MCP Tools

MCP는 명시적 task context 중심이다.

playspec_list_tasks

playspec_get_task

playspec_use_session_task

  

playspec_render_next_prompt

playspec_render_phase_prompt

  

playspec_complete_phase

playspec_collect_evidence

playspec_run_state_desync_check

  

playspec_create_snapshot

playspec_rollback

  

playspec_get_harness_status

playspec_record_attempt_result

playspec_unblock_task

  

playspec_close_task

playspec_archive_task

  

playspec_get_evolution_context

playspec_propose_evolution

playspec_apply_evolution

  

playspec_get_archived_task_context

MCP rule:

taskId required or sessionId required

global HEAD fallback forbidden

  

30. CLI Commands

playspec init --preset cpp-vulkan

playspec create multi-spec "Feature Name"

  

playspec list

playspec list --archived

playspec current

playspec use TASK_ID

  

playspec next

playspec next --task TASK_ID

  

playspec phase 3

playspec phase 3 --task TASK_ID

  

playspec complete

playspec complete --task TASK_ID --with-review

  

playspec evidence

playspec desync-check

  

playspec rollback

playspec rollback --task TASK_ID

playspec rollback --state-only

playspec rollback --git-only

  

playspec harness run --task TASK_ID

playspec harness status --task TASK_ID

playspec unblock --task TASK_ID

  

playspec close

playspec close --archive

playspec archive --task TASK_ID

  

playspec view

playspec view --task TASK_ID

playspec view --archived TASK_ID

  

playspec apply-evolution 1

  

31. PlaySpec Development Phase Plan

Phase 1 — Core + CLI + Preset + HEAD + TaskStore Abstraction

Scope:

- playspec init --preset default

- .playspec 생성

- TaskStore interface

- YamlTaskStore 구현

- task folder 생성

- HEAD pointer

- task create/list/use/current

- workflow load

- phase resolve

- template render

- variable resolve

Acceptance:

playspec next가 active task 기준으로 prompt를 렌더하고,

Core API는 taskId 명시 호출을 지원한다.

  

Phase 2 — Lock + Snapshot + Completion + Auto-Evidence

Scope:

- file lock

- complete --with-review

- auto evidence collect

- snapshot

- rollback safe point

Acceptance:

phase 완료 시 evidence, review, snapshot, rollback point가 저장된다.

  

Phase 3 — State Desync Detector + Safe Rollback

Scope:

- git 상태 sanity check

- significant change detection

- state-only rollback

- git rollback preview

- clean tree guard

Acceptance:

PlaySpec 없이 코드가 크게 바뀐 경우 next 전에 경고하고,

복잡한 git 상태에서는 안전한 rollback 옵션만 제공한다.

  

Phase 4 — MCP Adapter with Explicit Task Context

Scope:

- MCP tools

- taskId/sessionId required

- HEAD fallback 금지

Acceptance:

Claude Code/Codex에서 PlaySpec phase3 요청이 CLI와 같은 Core 결과를 반환한다.

  

Phase 5 — Archive System

Scope:

- close task

- archive task

- list archived

- archived context read

Acceptance:

완료된 task가 archived/{YYYY-MM}/{task_id}로 이동하고 다시 조회 가능하다.

  

Phase 6 — Proactive Evolution + Human Edit Learner

Scope:

- complete 이후 evolution context 생성

- pending proposal 표시

- human edit diff 기록

- template/rule improvement proposal

Acceptance:

사용자가 evolve를 직접 치지 않아도 next 시점에 개선 제안이 표시되고,

반복 human edit이 rule patch proposal로 연결된다.

  

Phase 7 — Harness Safety

Scope:

- retry budget

- attempt history

- failure signature

- severity-aware circuit breaker

- human_intervention_required 상태

Acceptance:

반복 실패는 비용을 태우기 전에 멈추고,

사소한 lint 실패는 과하게 막지 않는다.

  

Phase 8 — Token Optimizer

Scope:

- compact / strict / full mode

- context tiering

- memory window

- evidence summary

- old logs on-demand only

Acceptance:

장기 task에서도 next prompt가 token 폭발 없이 핵심 context만 포함한다.

  

Phase 9 — Workflow Editing

Scope:

- phase add/remove/reorder

- template path update

- rule include update

Acceptance:

사용자가 workflow를 CLI로 안전하게 수정할 수 있다.

  

Phase 10 — Markdown Viewer

Scope:

- active/archived/session/harness viewer

- evidence/review/proposal/rollback viewer

- human edit pattern viewer

Acceptance:

playspec view로 현재 task와 과거 archive를 검토할 수 있다.

  

Phase 11 — Future DAG Preparation

Scope:

- workflowMode field

- DAG schema validation

- subtask metadata

Acceptance:

v1 실행은 linear만 지원하지만, schema는 DAG 확장을 막지 않는다.

  

32. Acceptance Criteria

- init --preset 하나로 기본 workflow/templates/rules가 생성된다.

- task 생성 시 독립 task folder가 생성된다.

- Human CLI는 HEAD 기반으로 편하게 사용할 수 있다.

- MCP/OpenClaw/Harness는 taskId 또는 sessionId 없이는 상태 변경을 수행하지 않는다.

- Core 함수는 taskId 명시 호출을 우선한다.

- TaskStore는 YAML에서 SQLite로 교체 가능하다.

- next 실행 전 큰 코드 변경이 있으면 state desync warning을 제공한다.

- complete는 evidence/review/snapshot/rollback point를 자동 생성한다.

- rollback은 복잡한 git 상태에서 위험한 자동 복구를 하지 않는다.

- archived task는 다시 조회 가능하다.

- proactive evolution은 자동 제안하지만 자동 적용하지 않는다.

- human edit diff는 template/rule 개선 신호로 기록된다.

- token optimizer는 장기 task에서 context를 tier별로 제한한다.

- harness mode는 retry budget과 severity-aware circuit breaker를 가진다.

- 모든 write operation은 file lock을 사용한다.

  

33. Final Conclusion

PlaySpec v2.5의 최종 핵심은 다음이다.

1. 사용자는 편하게 쓴다.

2. Agent는 명시적으로 쓴다.

3. 상태는 task folder에 격리한다.

4. 완료 시 증거와 snapshot을 남긴다.

5. 실패하면 안전하게 되돌린다.

6. 오래된 task는 archive로 보존한다.

7. 반복 문제는 evolution proposal로 개선한다.

8. token 폭발은 context tiering으로 막는다.

9. 자동화는 retry budget과 circuit breaker로 통제한다.

10. 미래 multi-agent/DAG 확장성을 막지 않는다.

최종 정의:

PlaySpec는 prompt manager가 아니다.

  

PlaySpec는 LLM 개발 workflow를 기억하고,

현재 상태와 코드 현실의 차이를 감지하고,

증거를 모으고,

위험한 변경을 되돌리고,

기술 문서를 보존하고,

반복 실수를 학습해 개선안을 제안하는

사용자 중심 workflow operating system이다.
