# PlaySpec Phase 2 Implementation Spec

## 1. How to Read This Spec

This document is for Dev Phase `2` only: `Completion Engine`.

Read it in this order:

1. `Phase boundary alignment` to confirm what this phase is allowed to do.
2. `Phase Outcome at a Glance` to understand the user-visible outcome.
3. `Current implementation vs proposed direction` to see the actual starting point.
4. `Proposed implementation direction` and `Testable outcomes` to implement the phase without leaking into later phases.

Legend used below:

- `Verified current behavior`: confirmed from code in this repo
- `Inferred`: consistent with current code and master spec, but not yet implemented
- `Proposed direction`: what this phase should add
- `Deferred`: intentionally left for later phases

## 2. Phase Boundary Alignment

### Locked phase goal

Dev Phase `2` exists to make phase completion a real state transition instead of a prompt-only workflow.

From `docs/playspec_phase_plan.md`, this phase is trying to enable:

- safe write on completion
- phase completion state update
- snapshot creation
- evidence collection
- optional review persistence

### What must be complete before Dev Phase 3 can safely begin

- `playspec complete` records the current workflow phase as completed
- `task.yaml` moves the task to the next workflow phase
- completion-related writes use a lock and atomic write path
- completion creates observable snapshot/evidence artifacts
- `complete --with-review` persists a review record
- lock timeout failures are explicit and actionable

### What is intentionally deferred

- rollback execution
- desync severity / desync engine
- archive
- MCP
- evolution

### Visible capability or safety property introduced by this phase

After this phase, PlaySpec is no longer only a renderer. It can persist a completed phase with evidence and snapshots through one coherent, reviewable write path.

### What would make this phase unsafe even if partially implemented

- a `complete` command that advances `currentPhase` without recording completion history
- completion artifacts written without lock protection
- a second ad hoc mutation path that bypasses the store and lock policy
- evidence or snapshot files written without a coherent relation to the completed phase
- `complete --with-review` printing success without actually persisting `review.yaml`

## 3. Phase Outcome at a Glance

### After this phase, you can

- run `playspec complete` for the active task
- record the current workflow phase as completed in `task.yaml`
- advance `currentPhase` to the next workflow phase
- generate completion evidence files for that phase
- generate a completion snapshot for that phase
- optionally persist `review.yaml` with `playspec complete --with-review`
- run `playspec evidence`
- run `playspec snapshot`

### After this phase, you still cannot

- perform rollback
- run desync severity analysis
- archive tasks
- use MCP completion flows
- use evolution or retry-budget behaviors

### This phase is ready to implement / hand off when

- the entry point, state mutation path, artifact path, and observable CLI output all align
- the completion flow is grounded in the existing task store and active-task resolution rules
- no later-phase responsibilities are required for Phase 2 acceptance
- the lock and atomic write rules are defined for the new completion path

## 4. Current Implementation vs Proposed Direction

### Verified current behavior

- `src/cli/index.ts` registers `init`, `create`, `list`, `current`, `use`, `next`, and `phase`
- `src/core/playspec-core.ts` supports only prompt rendering via `renderNextPrompt()` and `renderExplicitPhasePrompt()`
- `src/core/active-task-resolver.ts` already defines the CLI rule: explicit `taskId` wins, otherwise read `.playspec/HEAD`
- `src/storage/task-store.ts` exposes only generic task persistence primitives
- `src/storage/yaml-task-store.ts` creates and updates `task.yaml`, but has no completion-specific API
- `src/core/types.ts` and `src/core/schemas.ts` already include `currentPhase`, `status`, and `phaseHistory`
- `src/utils/fs.ts` writes files directly with `writeFile()` and no lock or atomic rename behavior
- `src/cli/commands/next.ts` can optionally persist rendered prompts under `prompts/`
- there is no `complete`, `evidence`, or `snapshot` command today

### Verified gaps against Phase 2

- no CLI registration for `complete`, `evidence`, or `snapshot`
- no core completion API
- no lock usage on task or head writes
- no atomic write helper
- no completion record persistence path
- no snapshot path for `task.yaml`
- no evidence collection path
- no review persistence path
- no `validationTemplate` support in workflow schema/runtime

### Proposed direction for this phase

Keep the design localized around the current runtime:

- add Phase 2 CLI commands
- extend the existing core with completion-oriented methods
- extend the existing task schema only as far as needed for coherent completion records
- add one lock-aware, atomic write path and use it for all new completion writes
- keep completion state mutation inside one task-store-backed path

Do not introduce a new framework-style orchestration layer unless current files cannot support the phase cleanly.

## 5. Use Case Alignment for This Phase

| Use case | Current status | Phase 2 target | Observable result |
|---|---|---|---|
| Complete the active workflow phase | blocked | enabled | `task.yaml` records the completed phase and advances to the next phase |
| Complete with review | blocked | enabled | `review.yaml` exists for the completed phase |
| Collect completion evidence | blocked | enabled | evidence files exist for the completed phase |
| Create task snapshot at completion | blocked | enabled | snapshot file exists and reflects task state at completion |
| Run manual evidence collection | blocked | enabled | `playspec evidence` writes evidence files without changing phase state |
| Run manual snapshot creation | blocked | enabled | `playspec snapshot` writes a snapshot without changing phase state |
| Roll back a phase | deferred | deferred | intentionally unavailable in Phase 2 |
| Detect desync severity before completion | deferred | deferred | intentionally unavailable in Phase 2 |

Real workflow unlocked by this phase:

- render the prompt with `next`
- do the work outside PlaySpec
- run `playspec complete`
- review the recorded state, evidence, and snapshot
- continue with the next workflow phase safely

Workflow intentionally still deferred:

- rollback after a bad completion
- archive and later retrieval
- MCP-managed completion

## 6. Relevant Files Reviewed

### must-read

- `docs/playspec_phase_plan.md`
- `src/cli/index.ts`
- `src/cli/commands/create.ts`
- `src/cli/commands/use.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/phase.ts`
- `src/core/active-task-resolver.ts`
- `src/core/playspec-core.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/utils/fs.ts`
- `src/utils/paths.ts`

### maybe-read

- `src/cli/commands/init.ts`
- `src/preset/preset-manager.ts`
- `src/core/session-resolver.ts`
- `src/preset/assets/default/sessions/cli.default.yaml`
- `tests/integration/active-task-resolver.test.ts`
- `tests/integration/task-store.test.ts`
- `tests/cli.test.ts`
- `src/workflow/phase-resolver.ts`
- `src/workflow/workflow-loader.ts`

### ignore-for-now

- `src/template/**`
- `src/workflow/**` beyond phase-advance needs
- viewer work
- rollback work
- archive work
- MCP work
- evolution work
- Phase `3+` desync logic

## 7. Active Entry Points and Possible Bypasses

### Entry-point audit

| Entry point / call site | Current behavior | Status | Why it matters to this phase |
|---|---|---|---|
| `src/cli/index.ts` | Registers prompt/render/task selection commands only | partial | Phase 2 must add new command entry points here |
| `src/cli/commands/create.ts` | Creates task and writes `HEAD` directly | done | Establishes current direct-write pattern and lock bypass risk |
| `src/cli/commands/use.ts` | Rebinds active task by writing `HEAD` directly | done | Shows another unlocked write path already in repo |
| `src/core/active-task-resolver.ts` | Resolves explicit task first, otherwise `HEAD` | done | Completion CLI should follow the same task-resolution rule |
| `src/core/playspec-core.ts` | Renders prompts only | partial | This is the natural place for completion orchestration unless split is necessary |
| `src/storage/yaml-task-store.ts` | Owns persisted task state via `task.yaml` | done | Completion state mutation must stay coherent with this ownership |
| `src/workflow/phase-resolver.ts` | Can compute the next phase from `currentPhase` | done | Completion needs the same next-phase logic when advancing state |

### Active bypasses and old-path risk

- `src/storage/yaml-task-store.ts` can mutate task state through `saveTask()` and `updateTask()` with no lock
- `src/cli/commands/create.ts`, `src/cli/commands/use.ts`, and `src/preset/preset-manager.ts` write `HEAD` through the unlocked generic file helper
- `src/cli/commands/next.ts --write` persists prompt files using a timestamped prompt path that is not a completion snapshot path

Phase 2 must not add a second completion mutation path beside the store-backed path above.

## 8. Verified Behavior and Constraints

### Verified behavior

- task creation initializes `phaseHistory` as an empty array
- task creation initializes `currentPhase` as `null`
- task updates can persist a patched `currentPhase`
- the current codebase already models `TaskStatus` as `active | completed | archived`
- prompt rendering can already produce content that may be used as a completion snapshot source, but only via the render path
- `writeTextFile()` already creates parent directories recursively, so evidence/review/snapshot directories can be created lazily

### Constraints grounded by current code and phase plan

- Core should still prefer explicit `taskId`; CLI may keep `HEAD` fallback
- completion must not depend on viewer, rollback, archive, or MCP work
- schema changes must remain valid YAML-backed task persistence
- the current generic `updateTask()` is too weak to count as a grounded completion path on its own
- task-scoped completion artifacts should resolve from `task.paths.taskRoot`, not only from active-layout helper recomputation
- a path is only grounded when state update, artifact creation, and CLI entry point are coherent together

## 9. What Is Already Implemented vs What Still Needs Verification

### Already implemented

- CLI bootstrapping and error formatting
- active-task resolution
- workflow next-phase resolution
- generic task YAML persistence
- prompt rendering and optional prompt file output
- `phaseHistory` storage field

### Still needs implementation or verification for Phase 2

- completion command registration and execution
- evidence and snapshot command registration and execution
- lock-aware write helper
- atomic write helper
- completion-specific core API
- completion-specific task-store mutation path
- completion record shape in schema
- evidence file naming and contents
- snapshot file naming and contents
- review persistence format and location
- final-phase behavior when no next workflow phase exists
- explicit lock-timeout error type and CLI output
- `validationTemplate` runtime contract

## 10. Proposed Implementation Direction for This Phase

### 10.1 CLI surface

Add these command entry points in `src/cli/index.ts`:

- `complete`
- `evidence`
- `snapshot`

Minimal CLI shape for Phase 2:

- `playspec complete`
- `playspec complete --with-review`
- `playspec evidence`
- `playspec snapshot`

Inferred but consistent with existing CLI patterns:

- optional `--task <id>` can be supported because `next` and `phase` already do this and `ActiveTaskResolver` already supports it

This is useful, but it should not be treated as a Phase 2 blocker if the team wants to keep the first implementation to `HEAD` resolution only.

### 10.2 Core orchestration

Extend `PlaySpecCore` with a completion-oriented entry point instead of creating a parallel state engine.

Minimal proposed methods:

- `completePhase(taskId: string, options?: { withReview?: boolean }): Promise<CompletionResult>`
- `collectEvidence(taskId: string): Promise<EvidenceResult>`
- `createSnapshot(taskId: string): Promise<SnapshotResult>`

Why this is the smallest safe change:

- it preserves the current Core ownership model
- it keeps CLI adapters thin
- it avoids introducing a new service graph for one phase

### 10.3 Task state mutation model

Phase 2 needs a dedicated completion mutation path. Do not treat generic `updateTask()` as the full completion engine.

Proposed minimal rule:

- completion reads the task
- identifies the phase being completed
- creates required completion artifacts for that phase through the same Core-owned flow
- writes one updated `task.yaml` that includes:
  - completed phase history entry update
  - next `currentPhase` value, or terminal task status if there is no next phase
  - updated timestamp

Coherence rule for Phase 2:

- if snapshot, evidence, or requested review creation fails, completion aborts and `task.yaml` must remain unchanged
- `task.yaml` may only claim a phase completion after the required artifacts for that completion attempt have been written successfully
- manual `playspec evidence` and `playspec snapshot` remain artifact-only commands and do not advance phase state

### 10.4 Completion record shape

Current `phaseHistory` is the only persisted phase timeline structure already in use. The smallest coherent Phase 2 extension is to enrich the completed phase entry rather than add a second top-level completion ledger.

Proposed addition to `PhaseHistoryEntry`:

- `reviewFile?: string`
- `evidenceFiles?: string[]`
- `snapshotFiles?: string[]`
- `validationTemplate?: string`

Optional and still Phase 2-compatible if needed:

- `warnings?: string[]`

Do not add rollback, desync, archive, or retry-budget metadata here yet.

### 10.5 Next-phase advancement

Reuse `PhaseResolver.resolveNextPhase()` semantics for advancement.

Grounded Phase 2 rule:

- if there is a next workflow phase, set `currentPhase` to that phase id
- if there is a next workflow phase, keep task `status: active`
- if the completed phase is the final workflow phase, set `currentPhase: null` and task `status: completed`
- the completed phase history entry must reflect the phase that just finished

### 10.6 Snapshot behavior

Phase 2 requires snapshot creation, but current code has no snapshot subsystem.

Smallest safe snapshot for this phase:

- persist a copy of the pre-update or completion-time `task.yaml` under a deterministic snapshot path
- path should live under the active task root
- file name should include the completed phase id

Recommended minimal path:

- `.playspec/tasks/active/<taskId>/snapshots/phase<phaseId>_before_complete.yaml`

This aligns with the total spec and avoids reusing `prompts/` for non-prompt artifacts.

### 10.7 Prompt snapshot behavior

Current `next --write` output is a user-triggered prompt export, not a completion snapshot.

Phase 2 should keep that path separate.

Recommended minimal approach:

- when completion needs a prompt snapshot, write it under `snapshots/` or a clearly phase-scoped completion artifact path
- do not rely on a preexisting timestamped prompt file being present

### 10.8 Evidence behavior

Evidence collection must be observable and phase-scoped.

Minimum required evidence for this phase plan:

- git status
- git diff `--stat`
- changed files

Recommended minimal artifact set:

- `evidence/phase<phaseId>_git_status.txt`
- `evidence/phase<phaseId>_git_diff_stat.txt`
- `evidence/phase<phaseId>_changed_files.txt`

Use `simple-git` or shell-safe git execution already allowed by project dependencies. Keep the implementation local and synchronous from the completion flow.

Coherence rule:

- `playspec complete` must not persist its `task.yaml` completion update until the required evidence artifacts for that completion attempt have been written successfully
- `playspec evidence` writes evidence for the resolved task and current phase only, without mutating `phaseHistory`, `currentPhase`, or task `status`

### 10.9 Review behavior

The phase plan requires `complete --with-review` and `review.yaml` persistence.

Minimum Phase 2 behavior:

- if `--with-review` is not set, completion does not write `review.yaml`
- if `--with-review` is set, persist a review record for the completed phase under the task’s `reviews/` directory

Recommended minimal path:

- `reviews/phase<phaseId>_review.yaml`

Recommended minimal fields:

- `phase`
- `createdAt`
- `status: pending` or `recorded`
- optional `validationTemplate`

This keeps review storage grounded without inventing a richer approval system.

Coherence rule:

- review persistence is part of the same completion flow when `--with-review` is requested
- if requested review persistence fails, completion aborts and `task.yaml` must not be advanced

### 10.10 `validationTemplate` support

This is required by the phase plan and is currently absent from the workflow schema/runtime.

Smallest safe implementation:

- extend workflow phase schema so `phases.<id>.completion.validationTemplate` is valid
- expose the resolved template path to the completion flow
- record the resolved template reference in the completion history entry or review record

Phase 2 meaning:

- `validationTemplate` support in this phase means persisted resolved-reference support only
- Phase 2 does not require rendering a validation prompt from that template

If the team decides to render a validation prompt now, that must be explicitly called out as additional work inside Phase 2, not assumed.

### 10.11 Lock and atomic write policy for Phase 2

At minimum, every new completion-related write must use one shared helper that provides:

- exclusive file lock
- temp-file write
- atomic rename
- timeout with explicit error

This helper should back:

- `task.yaml` completion update
- snapshot file writes
- evidence file writes
- review file writes

Phase 2 lock-scope rule:

- Phase 2 acceptance requires lock + atomic write coverage for completion writes only
- existing `create`, `use`, preset-init, and prompt-export writes are current older unlocked paths and must not be described as already covered by the new guarantee unless they are explicitly migrated
- reusing the same helper for those older writes is recommended alignment work, but not required for Phase 2 acceptance

## 11. Testable Outcomes

| Test scenario | Entry point | Required setup | Expected observable result | Status | Out-of-phase failure acceptable |
|---|---|---|---|---|---|
| complete active phase | `playspec complete` | initialized workspace, active task, workflow with current phase | `task.yaml` shows completed phase entry and advanced `currentPhase` | testable after implementation | no |
| complete with review | `playspec complete --with-review` | same as above | review file exists and task completion still succeeds | testable after implementation | no |
| evidence collection | `playspec evidence` | initialized workspace, active task, git repo available | evidence files exist for current phase without phase advance | testable after implementation | no |
| snapshot creation | `playspec snapshot` | initialized workspace, active task | snapshot file exists without phase advance | testable after implementation | no |
| lock timeout | `playspec complete` | hold the same target lock before command runs | command fails with a clear lock-timeout error | testable after implementation | no |
| final phase completion | `playspec complete` | task positioned on last workflow phase | terminal task state is explicit and consistent | testable after implementation | no |
| review disabled path | `playspec complete` | same as success case, without `--with-review` | completion succeeds and no review file is written | testable after implementation | no |
| render path remains unchanged | `playspec next` | existing Phase 1.5 setup | prompt rendering still works with no completion side effects | testable now and after implementation | no |
| rollback command remains unavailable | CLI help / command invocation | existing workspace | rollback still not implemented in Phase 2 | testable now and after implementation | yes |

## 12. Example Review / Demo Scenarios

### Reviewer demo 1: phase completion

1. Initialize a workspace and create a task.
2. Ensure the task is positioned on a known current phase.
3. Run `playspec complete`.
4. Confirm:
   - command exits successfully
   - `task.yaml` records the completed phase
   - `currentPhase` advances
   - snapshot file exists
   - evidence files exist

### Reviewer demo 2: review-enabled completion

1. Run `playspec complete --with-review`.
2. Confirm `reviews/phase<phaseId>_review.yaml` exists.
3. Confirm the completed phase entry links to or names the review artifact.

### Reviewer demo 3: lock safety

1. Hold the relevant lock target.
2. Run `playspec complete`.
3. Confirm the command fails with a timeout message and no partial task mutation.

## 13. Risks / Open Questions

### Narrow, phase-relevant risks

- `old-path risk`: current generic file writes are unlocked; Phase 2 must avoid mixing locked and unlocked task mutation paths for completion data
- `dual-path risk`: using `next --write` as a completion snapshot source would create two meanings for prompt persistence
- `ownership risk`: current code has no completion transaction path yet; Phase 2 must keep review, evidence, snapshot, and `task.yaml` update inside one Core-owned flow
- `spec/code drift risk`: `validationTemplate` is in the master spec and phase plan, but absent from the current schema/runtime
- `path ownership risk`: current task code often recomputes active-task paths from helpers instead of using `task.paths.taskRoot`; that becomes a bypass risk once Phase 2 adds more task-scoped artifacts
- `lifecycle bypass risk`: current `HEAD` resolution has no lifecycle guard, so default `next` and `phase` would still operate on a completed task until Phase 2 adds a non-active-task rejection on the default `HEAD` path

### Smallest safe fixes

- keep task completion state changes inside one core/store-backed flow
- keep completion artifacts phase-scoped and deterministic
- define one write helper for lock + atomic write and route completion state/artifact writes through it
- add only the workflow completion fields required for Phase 2, including persisted `validationTemplate` reference support
- resolve new artifact paths from the loaded task record’s task root
- reject non-`active` tasks on the default `HEAD`-based render path once Phase 2 can mark tasks completed

### Open questions that should be resolved before implementation

No architecture/spec-level open questions remain.

### Intentionally deferred later-phase items

- rollback safe-point execution
- desync checks and severity
- archive/move-to-archive behavior
- MCP adapter behavior
- evolution metadata
- harness retry and circuit-breaker state

## 14. Mermaid Diagrams

No diagram is included. The current Phase 2 path is small enough to stay clearer as a linear written flow.
