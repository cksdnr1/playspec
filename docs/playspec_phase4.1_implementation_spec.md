# Dev Phase 4.1 — MCP-Driven Context Migration and State Promotion

## Goal

Migrate fragmented historical project markdown documents into structured PlaySpec state using Claude/MCP for analysis and proposal generation.

Existing repos may contain many legacy planning and result documents:

- `playspec_phase0_implementation_spec.md`
- `playspec_phase1_handoff.md`
- `playspec_phase2_test_result.md`
- `playspec_phase3_implementation_result.md`
- `playspec_total_spec.md`
- `playspec_phase_plan.md`

Phase 4.1 lets Claude/MCP read these documents, infer the current project and task state, and generate a validated `MigrationPlan` that can promote useful context into PlaySpec structures.

**Core principle:**
Claude analyses and proposes. PlaySpec validates, previews, backs up, and applies only authorised plan actions.

---

## Implementation-Ready Verification Addendum

This addendum refines the first-draft Phase 4.1 spec against the current codebase. The sections below are the implementation handoff source of truth for Phase 4.1; the original sections later in this document remain the intended feature design unless this addendum narrows or clarifies them.

### 1. How to Read This Spec

- Treat `docs/playspec_phase_plan.md` as the phase-boundary source of truth.
- Treat `docs/playspec_total_spec.md` as architecture truth, especially MCP explicit context rules and the meaning of `contextRefs`.
- Treat this addendum as the code-grounded implementation map for Phase 4.1.
- Do not implement later archive, viewer, evolution, harness, Project/Stage, or arbitrary cleanup behavior while implementing this phase.
- Do not mark the phase complete until the observable `playspec migrate` workflows exist and are tested end to end.

### 2. Phase Boundary Alignment

Phase 4.1 enables migration from fragmented historical markdown documents into guarded PlaySpec state. The visible capability is a `playspec migrate` workflow that discovers/accepts markdown sources, produces a validated `MigrationPlan`, persists the plan/report under `.playspec/migrations/`, previews proposed mutations, creates backups before applying approved mutations, and only archives files when `--with-archive` is explicit.

Before the next phase can safely begin:

- `playspec migrate` must exist and default to `review` mode.
- `--mode dry-run` must persist a plan/report and mutate nothing.
- `--mode auto` must be explicit and limited to low-risk validated actions.
- `MigrationPlan` must reject unsupported actions, especially `delete_file`.
- `task.yaml` promotions must be schema-validated and previewed before mutation.
- Backups must be created before every mutation.
- Archive behavior must be gated by `--with-archive`.
- MCP-related migration paths must not introduce HEAD fallback for MCP.

Intentionally deferred:

- File deletion.
- Silent mutation.
- Default archive.
- Project/Stage hierarchy.
- Runtime code fixing during migration.
- General markdown viewer.
- Evolution proposal application.
- Archive system beyond optional migration archive action.
- New MCP context rules that bypass `resolveMcpTaskId()`.

This phase is unsafe if a partial implementation can update `task.yaml` or rewrite/archive documents without persisted plan/report, schema validation, preview, approval policy, and backup.

### 3. Phase Outcome at a Glance

After this phase, you can:

- Run `playspec migrate` and receive a review-mode migration plan.
- Run `playspec migrate --mode dry-run` and inspect persisted plan/report without mutations.
- Apply approved migration actions with backups.
- Promote selected `task.yaml` fields and `contextRefs` through validated actions.
- Archive migration source files only with `--with-archive`.

After this phase, you still cannot:

- Delete files through migration.
- Silently auto-promote ambiguous inferred state.
- Use migration as a code repair mechanism.
- Introduce project-level state or Stage hierarchy.
- Depend on MCP HEAD fallback.

This phase is ready to implement / hand off when:

- The implementation has a clear CLI entry point, migration schema, persistence path, application path, and tests for positive and negative workflows.
- Reviewers can run a demo that shows plan generation, persisted report, previewed task/context mutation, backup creation, and dry-run non-mutation.

### 4. High-Level Pre-Read Summary

Phase 4.1 is trying to convert existing planning/result markdown into structured, reviewable PlaySpec state. The current implementation already has task storage, `target`, `contextRefs`, CLI task resolution, MCP task/session resolution, and context reference validation during prompt rendering. It does not yet have a migration command, migration schema, plan/report persistence, backup/apply path, archive gate, or Claude/MCP plan intake path.

After this phase, users can bootstrap a PlaySpec task from historical docs without manually editing `task.yaml`. After this phase, users still cannot perform deletion, silent archive, or later-phase archive/evolution/viewer workflows. The phase is ready for implementation only when the migration path is observable from CLI and backed by tests that prove dry-run, review/apply, auto restrictions, backup, and action validation.

The real workflow this phase unlocks is: historical docs exist, Claude proposes a migration plan, PlaySpec validates/persists/previews it, and approved actions promote docs into `contextRefs` or selected task fields. The workflow intentionally deferred is full knowledge-base archival and broad project lifecycle management.

### 5. Minimal File Scan

must-read:

- `docs/playspec_phase_plan.md` — locks Phase 4.1 scope, modes, safety rules, acceptance criteria.
- `docs/playspec_total_spec.md` — architecture rules for `contextRefs`, MCP explicit context, and no Project/Stage hierarchy.
- `src/cli/index.ts` — active CLI command registration; currently no `migrate` command.
- `src/mcp/server.ts` — active MCP tool registration and task/session use; currently no migration tool.
- `src/mcp/context.ts` — `resolveMcpTaskId()` explicit task/session resolver with no HEAD fallback.
- `src/mcp/session-store.ts` — MCP session ownership/lifetime path.
- `src/core/types.ts` — current `TaskRecord`, `TaskTarget`, `TaskContextRef` shape.
- `src/core/schemas.ts` — current Zod validation for task fields that migration may mutate.
- `src/storage/task-store.ts` — task mutation interface available to migration.
- `src/storage/yaml-task-store.ts` — YAML-backed task read/write/update behavior.
- `src/core/playspec-core.ts` — context reference validation path and existing core boundaries.
- `tests/integration/mcp-server.test.ts` — existing tests for no MCP HEAD fallback.
- `tests/integration/task-store.test.ts` — existing tests for `target`/`contextRefs` persistence.

maybe-read:

- `src/cli/commands/create.ts` — existing Planning Task to Execution Task context binding path.
- `src/utils/fs.ts` — atomic write and lock utilities suitable for plan/report/backups.
- `src/utils/paths.ts` — `.playspec` path helpers; may need migration path helpers.
- `tests/cli.test.ts` — CLI integration style for adding `migrate` tests.
- `tests/integration/init-create-next.test.ts` — contextRefs render behavior style.

ignore-for-now:

- `src/core/rollback-manager.ts` and rollback CLI except as backup inspiration; Phase 4.1 backup is migration-local, not git rollback.
- Archive system not yet implemented as a general feature; only migration-local `archive_file` gated by `--with-archive` is in scope.
- Evolution, harness, viewer, DAG, Project/Stage, and later-phase MCP tools.

### 6. Current Implementation vs Proposed Direction

Verified current behavior:

- CLI commands are registered in `src/cli/index.ts`; there is no `migrate` command in the command list (`init` through `rollback` only).
- MCP server registers Phase 4 tools in `src/mcp/server.ts`; there is no migration MCP tool.
- MCP task resolution uses `resolveMcpTaskId()` and accepts only explicit `taskId` or `sessionId`; it throws when neither is provided.
- `TaskRecord` supports `title`, `currentPhase`, `target`, and `contextRefs`.
- `TaskRecordSchema` validates `target` and `contextRefs`.
- `YamlTaskStore.updateTask()` can patch a task and updates `updatedAt`, but it writes through `saveTask()` with non-atomic `writeTextFile()`.
- `YamlTaskStore.completePhase()` uses atomic write, proving atomic task writes are already available in the codebase.
- `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()` verify `contextRefs` exist and stay inside the workspace before rendering.
- Existing tests verify `target`/`contextRefs` persistence and MCP no-HEAD-fallback behavior.

Inferred but not fully verified:

- The migration implementation can reuse existing `writeTextFileAtomic()` and `withWriteLock()` utilities for plan/report/backups, but no migration-specific lock path exists yet.
- Diff preview will likely need a small local utility or dependency check; no existing general diff utility was found in the minimal scan.
- Interactive review can follow existing CLI style, but there is no shared approval framework beyond simple command-specific prompts.

Proposed direction for Phase 4.1:

- Add a narrow migration module that owns `MigrationPlan` schema, plan generation intake, persistence, preview, backup, and apply.
- Add `playspec migrate` CLI registration and command runner.
- Keep the first implementation CLI-first. If MCP support is added, expose only a plan/proposal tool that still validates through the same migration service and still requires explicit task/session context.
- Use `TaskStore.getTask()` and a validated task patch path for `update_task_state`, `add_context_ref`, and `remove_context_ref`; avoid direct ad hoc YAML mutation for `task.yaml`.
- Persist plan/report before any action application.
- Apply mutations under a migration lock and write backups before changing each target.
- Treat `archive_file` as a migration-local move into `.playspec/migrations/archived/` only when `--with-archive` is present.

### 7. Use Case Alignment for This Phase

| Use case | Current status | Phase 4.1 outcome | Observable reviewer result |
|---|---|---|---|
| Generate migration plan from docs | missing | enabled | `playspec migrate --mode dry-run --source docs/ --task TASK_ID` writes a plan/report under `.playspec/migrations/` |
| Review proposed `task.yaml.currentPhase` update | missing | enabled | review mode shows previous/proposed value, evidence, confidence, and diff before approval |
| Add master docs as `contextRefs` | partial | enabled | task YAML gains approved `contextRefs`; later `playspec next --task TASK_ID` accepts existing refs |
| Reject unsupported delete | missing | enabled | plan validation rejects `delete_file` before apply |
| Dry-run safety | missing | enabled | plan/report are written; source docs and `task.yaml` are unchanged |
| Auto mode restrictions | missing | enabled | medium/low confidence state promotion is skipped, downgraded, or fails with a clear message |
| Backup before mutation | missing | enabled | backup file exists before changed target is written |
| Optional archive | missing | enabled only with flag | `archive_file` fails without `--with-archive`; succeeds only into migration archive path with the flag |
| MCP no HEAD fallback | done for existing MCP tools | preserved | migration does not call `ActiveTaskResolver` from MCP path and tests still prove context is required |

### 8. Active Entry Points and Possible Bypasses

| Entry point / call site | Current behavior | Status | Why it matters |
|---|---|---|---|
| `src/cli/index.ts` command registration | Registers existing CLI commands; no `migrate` command | missing | `playspec migrate` is the observable Phase 4.1 capability |
| `src/mcp/server.ts` tool registration | Registers existing MCP tools; no migration tool | partial | Phase depends on MCP/Claude analysis, but PlaySpec must keep validation/apply centralized |
| `src/mcp/context.ts#resolveMcpTaskId` | Explicit `taskId` wins, then `sessionId`; no HEAD fallback | done | Any MCP migration path must use this resolver, not `ActiveTaskResolver` |
| `src/storage/task-store.ts#updateTask` | Interface exposes task patch mutation | partial | Migration state promotions need a controlled task update path |
| `src/storage/yaml-task-store.ts#updateTask` | Reads, shallow-patches, validates through `saveTask()` | partial | Needs backup/lock/atomicity around migration usage |
| `src/core/schemas.ts#TaskRecordSchema` | Validates current task fields, including `target` and `contextRefs` | partial | Migration must validate task output against this schema plus migration-specific rules |
| `src/core/playspec-core.ts#assertContextRefsExist` | Rejects absolute, escaping, and missing context ref paths during prompt rendering | done | Migration-added refs must pass this later observable path |
| `src/cli/commands/create.ts` context binding | Creates execution tasks with total spec and phase plan refs | partial | Provides an old/parallel path for adding contextRefs that migration must not conflict with |

Possible bypasses and risks:

- Old path: `playspec create --phase --from` already adds `contextRefs`; migration should not duplicate identical refs.
- Bypass path: direct YAML writes to `task.yaml` could skip `TaskRecordSchema`; migration must not use raw string edits for task state.
- Bypass path: MCP migration apply without `resolveMcpTaskId()` would violate the Phase 4 rule forbidding HEAD fallback.
- Dual path risk: CLI may use HEAD fallback for human commands, while MCP may not. Migration must make the CLI fallback explicit and keep MCP strict.
- Partial migration risk: persisting a plan without an execution report, or mutating a file before plan/report persistence, would make migration non-auditable.

### 9. Verified Behavior and Constraints

- `contextRefs` are references, not workflow state or task dependencies.
- `contextRefs` must remain relative workspace paths and must point to existing files before prompt rendering works.
- MCP cannot infer task context from `.playspec/HEAD`.
- Human CLI commands currently may default to HEAD.
- `TaskContextRef.role` currently only allows `planning-context`; do not invent new roles unless the master spec is updated.
- `TaskContextRef.source` is typed as `TaskId`; for migration-created refs use a stable source value that still validates, such as the target task ID or a migration source ID only if the type/schema is deliberately widened in this phase.
- `task.yaml.routing` is mentioned in the phase plan only if already supported; no `routing` field exists on `TaskRecord`, so routing mutation is out of scope unless an already-supported field is found during implementation.
- `TaskStore.updateTask()` is a shallow patch; nested merges for `target`/`contextRefs` must be explicit.

### 10. What Is Already Implemented vs What Still Needs Verification

Already implemented:

- Task storage and validation for `title`, `currentPhase`, `target`, and `contextRefs`.
- Existing context binding on task creation.
- Context ref existence and workspace-boundary checks during prompt rendering.
- MCP task/session binding and no-HEAD-fallback resolver.
- Atomic write and write-lock utilities.

Still needs implementation/verification:

- `playspec migrate` CLI command and options.
- `MigrationPlan` TypeScript types and Zod schema.
- Plan/report directory layout under `.playspec/migrations/`.
- Source markdown discovery/selection.
- Claude/MCP plan proposal intake format.
- Diff/preview generation.
- Review-mode approval loop.
- Dry-run non-mutation guarantee.
- Auto-mode confidence/risk gate.
- Backup creation before each mutation.
- Migration-local archive gate.
- Duplicate `contextRefs` handling.
- Tests proving unsupported `delete_file` is rejected.

### 11. Proposed Implementation Direction for This Phase

Suggested minimal module shape:

- `src/migration/types.ts` — migration DTOs and discriminated action union.
- `src/migration/schemas.ts` — Zod schemas for `MigrationPlan`, action types, state promotions, mode, risk, confidence.
- `src/migration/migration-store.ts` — persist plan/report/backup files under `.playspec/migrations/`.
- `src/migration/migration-runner.ts` — validate, preview, apply approved actions, enforce mode and archive rules.
- `src/cli/commands/migrate.ts` — CLI option parsing and user interaction.
- `src/cli/index.ts` — register `migrate`.

Keep implementation localized. Do not move existing task store responsibilities into migration. Do not add a broad plugin or job framework. The migration runner should call existing task store APIs for task state and use file utilities for document backup/apply.

Action handling:

- `update_task_state`: only allow whitelisted `TaskRecord` fields from the phase plan (`title`, `target`, `currentPhase`, `contextRefs`; `routing` only if implemented). Validate the full resulting task record before backup/apply.
- `add_context_ref`: add only if the same `path` is not already present. Validate relative path and existence, or mark missing refs as review-blocked.
- `remove_context_ref`: remove only exact existing refs and require review.
- `update_file`, `append_section`, `replace_section`: create preview and backup before writing.
- `archive_file`: require `--with-archive`, create backup/report entry, then move under `.playspec/migrations/archived/`.
- Reject unknown action types; `delete_file` must fail validation.

### 12. Testable Outcomes

| Test scenario | Entry point | Required setup | Expected observable result | Status | Out-of-phase failure acceptable |
|---|---|---|---|---|---|
| Default review mode creates plan/report | `playspec migrate --source docs --task TASK_ID` | workspace with task and markdown docs | plan/report under `.playspec/migrations/`; no unapproved mutation | testable after implementation | no |
| Dry-run mutates nothing | `playspec migrate --mode dry-run` | task with known YAML and docs | plan/report exists; task/doc contents unchanged | testable after implementation | no |
| Reject `delete_file` action | migration schema/runner | proposed plan includes `delete_file` | validation fails before backup/apply | testable after implementation | no |
| Add context ref | review/apply runner | approved `add_context_ref` action and existing doc | backup exists; task has ref; `playspec next --task` does not fail for missing ref | testable after implementation | no |
| Ambiguous state not auto-applied | `playspec migrate --mode auto` | `update_task_state` confidence `medium` | action skipped/downgraded/fails; no state mutation | testable after implementation | no |
| Archive requires flag | runner or CLI | plan has `archive_file` | fails without `--with-archive`; succeeds only with flag | testable after implementation | no |
| MCP path keeps explicit context | MCP migration tool if added | no taskId/sessionId but HEAD exists | context-required error, no HEAD fallback | testable if MCP tool is added | yes, if no MCP tool is added in this phase |
| Reviewer demo | CLI | legacy docs plus active task | dry-run, review preview, approved context ref, backup, report | testable after implementation | no |

### 13. Example Review / Demo Scenarios

Reviewer demo scenario:

1. Initialize a temp PlaySpec workspace and create an active task.
2. Add `docs/playspec_total_spec.md`, `docs/playspec_phase_plan.md`, and one historical phase result markdown file.
3. Run `playspec migrate --mode dry-run --source docs --task TASK_ID`.
4. Confirm `.playspec/migrations/plans/*.yaml` and `.playspec/migrations/reports/*` exist.
5. Confirm `task.yaml` and source docs are unchanged.
6. Run `playspec migrate --mode review --source docs --task TASK_ID` with an approved `add_context_ref` action.
7. Confirm backup exists before/with the mutation report.
8. Confirm `task.yaml.contextRefs` contains the approved doc.
9. Run `playspec next --task TASK_ID` and verify context ref validation does not reject the promoted file.

Negative demo scenario:

1. Provide a proposed plan containing `delete_file`.
2. Run the validator/runner.
3. Confirm the plan fails validation and no backup or target mutation is created.

### 14. Risks / Open Questions

medium risk — Claude proposal intake boundary:

- Smallest safe fix: define a strict serialized `MigrationPlan` input contract and validate it before any preview/apply. Never execute arbitrary Claude output.

medium risk — task mutation atomicity:

- Smallest safe fix: migration runner should backup first, validate the full resulting `TaskRecord`, then write through an atomic path or update `YamlTaskStore.saveTask()`/migration-specific task write to use `writeTextFileAtomic()`.

medium risk — duplicate or stale `contextRefs`:

- Smallest safe fix: de-duplicate by normalized relative path and reject absolute or escaping paths before apply.

medium risk — CLI HEAD versus MCP explicit context:

- Smallest safe fix: make CLI fallback explicit in command docs and tests; any MCP migration tool must call `resolveMcpTaskId()`.

low risk — `routing` field ambiguity:

- Smallest safe fix: do not implement `task.yaml.routing` migration unless current code already exposes a supported `routing` field. Current scan found no such field.

Open question:

- Should Phase 4.1 add an MCP migration proposal tool, or is CLI-first migration with Claude-provided plan files sufficient? The phase plan says bulk markdown reading via MCP tools and Claude-assisted analysis, but Phase 4.0 currently has no generic markdown file-read MCP tool in the scanned server. If MCP tooling is added, keep it proposal-only and route apply through the same migration runner.

---

## Why This Phase Exists

After Dev Phase 4 MCP Adapter is in place, Claude/MCP can read project files through the MCP server. This capability enables a new use case: structured state promotion from unstructured historical documents.

Without Phase 4.1, users who already have planning documents must manually:

1. Identify which files contain relevant context.
2. Manually update `task.yaml` fields such as `title`, `target`, `currentPhase`, `contextRefs`.
3. Decide which historical documents should become master context references.

Phase 4.1 automates the analysis (Claude proposes) and provides safe, reviewable promotion (PlaySpec validates and applies), ensuring users do not lose valuable planning context when starting or resuming a task.

---

## Responsibility Boundary

| Actor | Responsibility |
|---|---|
| Claude / MCP | Read source documents, analyse content, infer structure, propose `MigrationPlan` |
| PlaySpec | Validate plan schema, preview diffs, create backups, apply only authorised actions |
| User | Review plan, approve or reject actions selectively |

Claude **must not** directly mutate files or `task.yaml`. PlaySpec applies only validated, user-approved plan actions.

---

## In Scope

- Bulk markdown reading via MCP tools introduced in Dev Phase 4.
- Claude-assisted document analysis and state inference.
- `MigrationPlan` schema definition and Zod validation.
- State promotion plan generation.
- Migration report generation.
- Diff preview for document and state changes.
- Selective apply in `review` mode.
- Backup before any mutation.
- Optional archive with explicit `--with-archive` flag.
- Persist all migration plans and reports under `.playspec/migrations/`.

### State Promotion Targets

The following `task.yaml` fields may be promoted:

- `task.yaml.title`
- `task.yaml.target`
- `task.yaml.currentPhase`
- `task.yaml.contextRefs`
- `task.yaml.routing` — only if already supported by the active workflow
- Current active task metadata
- Master doc reference: `playspec_total_spec.md`
- Phase plan reference: `playspec_phase_plan.md`

State promotion is higher-risk than document cleanup and must always be gated behind `review` unless confidence is `deterministic` and explicitly allowed.

## Out of Scope

- File deletion (no `delete_file` action type).
- Silent mutation.
- Automatic archive without `--with-archive`.
- Arbitrary shell command execution.
- Code bug fixing during migration.
- External cloud archive.
- Migration without a persisted plan and report.
- Fully automatic state inference without `review` for ambiguous cases.
- Project/Stage state model.
- Rewriting PlaySpec architecture.

---

## Modes

### 1. `review` (Default)

- Generate migration plan.
- Show document diffs and task state changes before applying each action.
- User approves or rejects each action interactively.
- Required for all state promotions (`update_task_state`, `add_context_ref`, `remove_context_ref`) unless confidence is `deterministic` and explicitly overridden.

### 2. `dry-run`

- Generate plan and report only.
- No file mutation.
- No `task.yaml` mutation.
- No archive.
- Plan and report are persisted under `.playspec/migrations/`.

### 3. `auto`

- Explicit opt-in only (`--mode auto`).
- Requires a backup or reversible snapshot before applying.
- May apply only **low-risk validated** actions automatically.
- Must not delete files.
- Must not archive unless `--with-archive` is passed.
- Must not promote ambiguous inferred state.
- If state promotion confidence is `medium` or `low`, downgrade to `review` or fail with a clear message.

---

## CLI

```bash
# Run migration in default review mode
playspec migrate

# Explicit mode selection
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

---

## MigrationPlan Schema

```yaml
id: "migration_20260425_001"
createdAt: "2026-04-25T10:00:00+09:00"
mode: "review"                          # review | dry-run | auto
sourceRoot: "docs/"
targetTaskId: "login_system_phase_1_execution"

sourceFiles:
  - "docs/playspec_total_spec.md"
  - "docs/playspec_phase_plan.md"
  - "docs/playspec_phase3_implementation_result.md"

targetFiles:
  - ".playspec/tasks/active/login_system_phase_1_execution/task.yaml"
  - "docs/playspec_total_spec.md"

actions:
  - actionId: "action_001"
    type: "update_task_state"
    targetPath: ".playspec/tasks/active/login_system_phase_1_execution/task.yaml"
    sourcePaths:
      - "docs/playspec_phase_plan.md"
    reason: "Phase plan identifies current phase as 3"
    evidence: "Line 42: section heading indicates phase 3 is the active phase"
    riskLevel: "high"
    preview: |
      - currentPhase: "2"
      + currentPhase: "3"
    backupRequired: true
    requiresReview: true

  - actionId: "action_002"
    type: "add_context_ref"
    targetPath: ".playspec/tasks/active/login_system_phase_1_execution/task.yaml"
    sourcePaths:
      - "docs/playspec_total_spec.md"
    reason: "Master spec document identified as primary context reference"
    evidence: "Document title and structure match total spec pattern"
    riskLevel: "medium"
    preview: |
      contextRefs:
        + - path: docs/playspec_total_spec.md
        +   role: planning-context
        +   source: migration_20260425_001
    backupRequired: true
    requiresReview: true

statePromotions:
  - fieldPath: "task.yaml.currentPhase"
    previousValue: "2"
    proposedValue: "3"
    evidenceSources:
      - "docs/playspec_phase_plan.md"
    confidence: "medium"
    reason: "Phase plan section heading and content indicate phase 3 is active"
    requiresReview: true

riskLevel: "high"
requiresReview: true
summary: "2 actions proposed: 1 state promotion (currentPhase), 1 context ref addition"
warnings:
  - "State promotion of currentPhase requires manual verification"
  - "Confidence for currentPhase inference is medium — review required"
```

### Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique migration plan identifier |
| `createdAt` | ISO 8601 | Plan creation timestamp |
| `mode` | enum | `review` \| `dry-run` \| `auto` |
| `sourceRoot` | string | Root directory scanned for source documents |
| `targetTaskId` | string | Target active task ID |
| `sourceFiles` | string[] | Source document paths that were analysed |
| `targetFiles` | string[] | Files that will be mutated if actions are applied |
| `actions` | Action[] | Ordered list of proposed actions |
| `statePromotions` | StatePromotion[] | Structured list of task.yaml field promotions |
| `riskLevel` | enum | `low` \| `medium` \| `high` — overall plan risk |
| `requiresReview` | boolean | Whether the plan as a whole requires interactive review |
| `summary` | string | Human-readable summary of proposed changes |
| `warnings` | string[] | Non-blocking warnings for the user |

---

## Action Types

| Type | Description | Default Risk |
|---|---|---|
| `update_file` | Overwrite or rewrite a document file | medium |
| `append_section` | Append a section to a document | low |
| `replace_section` | Replace a named section in a document | medium |
| `update_task_state` | Mutate a `task.yaml` field | high |
| `add_context_ref` | Add an entry to `task.yaml.contextRefs` | medium |
| `remove_context_ref` | Remove an entry from `task.yaml.contextRefs` | medium |
| `archive_file` | Move a document to `.playspec/migrations/archived/` | high |

**`delete_file` does not exist.** No delete action type is defined or supported.

### Per-Action Fields

Each action must include:

| Field | Type | Description |
|---|---|---|
| `actionId` | string | Unique ID within the plan |
| `type` | enum | One of the action types above |
| `targetPath` | string | File path being mutated |
| `sourcePaths` | string[] | Evidence source files |
| `reason` | string | Why this action is proposed |
| `evidence` | string | Specific evidence (file, line, content excerpt) |
| `riskLevel` | enum | `low` \| `medium` \| `high` |
| `preview` | string | Unified diff or YAML diff of the proposed change |
| `backupRequired` | boolean | Whether a backup must be created before applying |
| `requiresReview` | boolean | Whether this action must be user-approved |

---

## State Promotion Rules

Each state promotion entry must specify:

```yaml
fieldPath: "task.yaml.currentPhase"   # target field path in task.yaml
previousValue: "2"                     # value before promotion
proposedValue: "3"                     # proposed new value
evidenceSources:                       # source files that support the inference
  - "docs/playspec_phase_plan.md"
confidence: "medium"                   # deterministic | high | medium | low
reason: "..."                          # human-readable explanation
requiresReview: true                   # always true unless confidence: deterministic
```

### Confidence Levels

| Level | Meaning |
|---|---|
| `deterministic` | Value is explicitly stated in a single authoritative source with no ambiguity |
| `high` | Strong evidence from multiple sources but requires confirmation |
| `medium` | Reasonable inference from context but ambiguous |
| `low` | Weak or conflicting signals |

### Auto-Apply Rules by Confidence

| Confidence | `auto` mode | `review` mode |
|---|---|---|
| `deterministic` | May apply if explicitly allowed | Show preview and require approval |
| `high` | Must downgrade to review | Show preview and require approval |
| `medium` | Must downgrade to review or fail | Show preview and require approval |
| `low` | Must fail with explanation | Show preview and require approval |

Ambiguous state promotions must never be silently applied.

---

## Backup and Reversibility

- Every mutation creates a backup before applying.
- `task.yaml` mutations generate a timestamped backup at `.playspec/migrations/backups/{plan_id}/`.
- Document file mutations generate a `.bak` copy before overwriting.
- All migration plans and reports are always persisted under `.playspec/migrations/`.
- Migration must be explainable (report) and reversible (backups).

### `.playspec/migrations/` Directory Layout

```
.playspec/migrations/
  plans/
    migration_{timestamp}_{seq}.yaml         # MigrationPlan YAML
  reports/
    migration_{timestamp}_{seq}_report.yaml  # execution report
  backups/
    migration_{timestamp}_{seq}/
      task.yaml.bak
      {escaped_file_path}.bak
  archived/                                  # only with --with-archive
    {escaped_file_path}
```

---

## Safety Rules

1. `review` is the default mode.
2. `dry-run` mutates nothing — generates plan and report only.
3. `auto` must be explicitly opted into with `--mode auto`.
4. Every mutation creates a backup or reversible snapshot before applying.
5. `task.yaml` mutation always requires a diff preview before applying.
6. Ambiguous `currentPhase`, `target`, or active task inference must not be auto-applied.
7. Claude must not directly mutate files.
8. PlaySpec applies only validated, schema-checked plan actions.
9. Archive is optional and requires explicit `--with-archive`.
10. Delete is not a supported action type.
11. All migration plans and reports are persisted under `.playspec/migrations/`.
12. Migration must be explainable and reversible.
13. Do not introduce Project/Stage hierarchy.
14. Do not rewrite PlaySpec architecture.

---

## UX Flow

### `review` mode (default)

```
playspec migrate

Scanning source documents in docs/ ...
  Found 5 markdown files.

Analysing with Claude ...

Migration Plan: migration_20260425_001
Mode: review
Risk: high
2 actions proposed.

──────────────────────────────────────────────
Action 1 of 2 — update_task_state  [HIGH RISK]
  Field:      task.yaml.currentPhase
  Previous:   "2"
  Proposed:   "3"
  Source:     docs/playspec_phase_plan.md
  Confidence: medium
  Evidence:   Section heading at line 42 indicates phase 3 is active.

  Diff:
  - currentPhase: "2"
  + currentPhase: "3"

  Approve this action? [y/N/view evidence]
──────────────────────────────────────────────

Action 2 of 2 — add_context_ref  [MEDIUM RISK]
  File:   docs/playspec_total_spec.md
  Role:   planning-context

  Diff:
  + contextRefs:
  +   - path: docs/playspec_total_spec.md
  +     role: planning-context
  +     source: migration_20260425_001

  Approve this action? [y/N/view diff]
──────────────────────────────────────────────

Applying 1 approved action ...
  Backup created: .playspec/migrations/backups/migration_20260425_001/task.yaml.bak
  Applied: add_context_ref → task.yaml

Plan saved:   .playspec/migrations/plans/migration_20260425_001.yaml
Report saved: .playspec/migrations/reports/migration_20260425_001_report.yaml
```

### `dry-run` mode

```
playspec migrate --mode dry-run

[DRY RUN] No files will be mutated.

Migration Plan: migration_20260425_001
Mode: dry-run
2 actions proposed (no changes applied).

Plan saved:   .playspec/migrations/plans/migration_20260425_001.yaml
Report saved: .playspec/migrations/reports/migration_20260425_001_report.yaml
```

### `auto` mode

```
playspec migrate --mode auto

[AUTO] Applying low-risk validated actions only.
  Skipping: update_task_state (confidence: medium — downgraded to review)
  Applying: add_context_ref (confidence: high — backup created, applying)

Report saved: .playspec/migrations/reports/migration_20260425_001_report.yaml

1 action skipped (requires manual review):
  Run: playspec migrate --mode review --plan migration_20260425_001
```

---

## MCP Integration

Phase 4.1 composes on top of the MCP infrastructure from Dev Phase 4. No new MCP tools are introduced.

Key flow:

1. `playspec migrate` triggers bulk document reading via MCP file access.
2. Document content is passed to Claude for analysis.
3. Claude returns a structured `MigrationPlan` proposal.
4. PlaySpec validates the plan against the `MigrationPlan` Zod schema.
5. PlaySpec applies only approved, validated actions.

Claude reads. Claude proposes. PlaySpec validates. User approves. PlaySpec applies.

---

## Acceptance Criteria

- Phase 4.1 is documented in `docs/playspec_phase_plan.md` after Dev Phase 4.
- `playspec migrate` runs in `review` mode by default.
- `--mode dry-run` generates a plan and report but mutates no files.
- `--mode auto` is explicit and applies only low-risk validated actions.
- `--mode auto` downgrades ambiguous state promotions to `review` or fails with a clear message.
- `update_task_state` and context promotion are `requiresReview: true` unless `confidence: deterministic` and explicitly allowed.
- No `delete_file` action type exists in the plan schema.
- Archive requires `--with-archive`.
- Every mutation creates a backup before applying.
- All plans and reports are persisted under `.playspec/migrations/`.
- `review` mode shows document diffs and task state changes before applying each action.
- State promotion shows `previousValue`, `proposedValue`, `confidence`, and `evidenceSources` before user approval.
- The spec clearly states that Claude proposes and PlaySpec validates/applies.
- Phase 4.1 does not introduce Project/Stage hierarchy.
- Phase 4.1 does not rewrite PlaySpec architecture.
- Documentation only — no runtime code is written in this phase.
