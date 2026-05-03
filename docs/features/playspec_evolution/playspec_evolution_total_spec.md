# PlaySpec Evolution Total Technical Spec

## Scope

This document resets the total technical specification for the remaining PlaySpec evolution work after the implementation drift that occurred since the old root-level `docs/playspec_total_spec.md` and `docs/playspec_phase_plan.md` were written.

The source problem asks to reread those older planning documents, verify the actual code, and prepare a refined spec so the remaining phase plan can continue from the real repository state. The current codebase appears implemented through Dev Phase 4.1: MCP is present, and the CLI migration runner exists. Earlier validation recorded a runtime alias parity warning around `#pack/*.js`; the downstream phase plan keeps Phase 4.2 as a baseline-confirmation gate so execution-time validation can state whether that warning is stale or still requires a narrow fix. This document treats older docs as context, not proof, and does not claim the Phase 4.1 baseline is approval-ready until that gate is completed.

This step creates only the total spec at `docs/features/playspec_evolution/playspec_evolution_total_spec.md`. The downstream phase planning output is `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`; it must be created by a later workflow step, not here.

Out of scope for this step:

- implementation code changes;
- phase execution tasks;
- creating the downstream phase plan;
- implementing future phases such as archive, evolution, harness, token tools, viewer, or DAG execution.

## Use Case Alignment

The intended user-facing use case is:

1. A user has a PlaySpec repository with a long-running implementation history.
2. Older design docs and phase plans no longer fully match the code.
3. The user wants PlaySpec to verify the current state, preserve completed work, and continue planning the remaining system phases without redoing or overclaiming behavior.
4. The final planning output should clearly separate implemented behavior from proposed behavior and produce a phase plan that can be executed safely later.

The feature is therefore not "implement the evolution engine immediately." It is the broader PlaySpec evolution planning reset: confirm the implemented baseline through Phase 4.1, identify remaining gaps, and define future implementation boundaries.

## Main And Alternative Scenarios

### Main Scenario: Rebaseline And Continue

1. User starts a `total-plan` task for `playspec evolution`.
2. PlaySpec renders the total-spec draft prompt with the source problem as a `source-problem` context reference.
3. The spec author reads the source problem, old total spec, old phase plan, and current code.
4. The new total spec records verified behavior, inferred behavior, bypasses, partial migrations, and remaining gaps.
5. A later phase-plan step turns this spec into executable Dev Phase tasks.

### Alternative Scenario: External Agent Produces A Migration Or Proposal

1. Claude/Codex/OpenClaw analyzes repository docs or task history.
2. The agent writes or updates a structured proposal file that describes a change plan, not just a knowledge record.
3. PlaySpec validates and stores that file before mutation.
4. Follow-up validation, planning, implementation, and review results add evidence to the same proposal when they address the same workflow improvement.
5. PlaySpec previews changes and requires explicit approval before apply.
6. Approved changes update only allow-listed PlaySpec-owned assets through explicit, auditable actions with before/after reports and backups.

This is already partially implemented for migration. It is proposed as the model for future evolution proposals.

### Alternative Scenario: Human Continues Without New Automation

1. User keeps using `playspec prompt`, `playspec complete`, and phase-execution tasks.
2. Current behavior remains stable.
3. Future phases can be added incrementally without breaking canonical prompt/completion flows.

## Current Implementation Summary

High-level verified state:

- PlaySpec is a TypeScript Node 22+ CLI/MCP workflow engine using commander, zod, yaml, handlebars, and vitest.
- Canonical prompt rendering is `playspec prompt`; `playspec next` remains as a deprecated compatibility alias.
- Task state is persisted as YAML under `.playspec/tasks/active/{taskId}/`.
- Core prompt and completion logic is in `PlaySpecCore`; CLI commands are adapter code around it.
- Human CLI may resolve active tasks through `.playspec/HEAD` via `ActiveTaskResolver`.
- MCP task context must use `resolveMcpTaskId()` with explicit `taskId` or `sessionId`; MCP must not read `.playspec/HEAD`.
- Completion writes snapshots, git evidence, optional review records, rollback safe point state, and phase history.
- Result-based routing and loop guards exist for workflow phases with `gate.results`, `nextByResult`, and `maxVisits`.
- Migration exists as Phase 4.1 through `playspec migrate`, `src/migration/*`, `MigrationPlanSchema`, persisted plans/reports/backups, and guarded archive support, but it is not sufficient as a general evolution mechanism.
- Evolution, general archive/knowledge base, harness safety, token context tiering, markdown viewer, and DAG execution are not implemented as complete features.

## Relevant Files Reviewed

- `.playspec/tasks/active/playspec_evolution/sources/source_problem.md` - source request.
- `.playspec/tasks/active/playspec_evolution/task.yaml` - active planning task state.
- `.playspec/tasks/active/playspec_evolution/prompts/next-prompt-2026-05-01T08-05-39-537Z.md` - generated step requirements.
- `docs/playspec_total_spec.md` - old intended v2.5 direction.
- `docs/playspec_phase_plan.md` - old Dev Phase plan through Phase 10.
- `docs/playspec_phase4.1_implementation_result.md` and `docs/playspec_phase4.1_handoff.md` - Phase 4.1 status and handoff.
- `package.json` - runtime, scripts, dependencies, bin entries, import aliases.
- `tsconfig.json` - compile-time path aliases.
- `tests/integration/runtime-bin.test.ts` - runtime/compile-time alias parity validation.
- `src/cli/index.ts` - active CLI command registration.
- `src/cli/commands/create.ts` - task creation, source problem, phase-execution context linking.
- `src/cli/commands/prompt.ts` and `src/cli/commands/next.ts` - canonical prompt path and deprecated alias.
- `src/cli/commands/complete.ts` - completion UX and next-prompt propagation.
- `src/cli/commands/migrate.ts` - migration CLI entry point and generated plan behavior.
- `src/core/playspec-core.ts` - prompt, completion, evidence, snapshot, rollback-safe-point, routing, context-ref validation.
- `src/core/types.ts` and `src/core/schemas.ts` - current domain model and validation schemas.
- `src/storage/task-store.ts` and `src/storage/yaml-task-store.ts` - task persistence and state updates.
- `src/mcp/server.ts` and `src/mcp/context.ts` - MCP tool surface and explicit context resolution.
- `src/migration/types.ts`, `src/migration/schemas.ts`, `src/migration/migration-runner.ts`, and `src/migration/migration-store.ts` - validated migration plan pattern.
- `src/cli/commands/workflow.ts` and `src/workflow/workflow-installer.ts` - implemented workflow runtime asset commands.
- `src/preset/assets/workflows/total-plan/workflow.yaml` - current planning workflow and artifact paths.

## Active Entry Points And Bypasses

### Verified Active Entry Points

- `playspec prompt` -> `runPrompt()` -> `ActiveTaskResolver.resolveTask()` -> `PlaySpecCore.renderNextPrompt()` -> template render.
- `playspec next` -> `runNext()` -> same core render path, but deprecated and with old output semantics.
- `playspec complete` -> `runComplete()` -> `PlaySpecCore.completePhase()` -> snapshots/evidence/review/phase history -> optional render of next prompt.
- `playspec migrate` -> `runMigrate()` -> generated or external `MigrationPlan` -> `MigrationRunner.run()` -> persisted plan/report -> gated action apply.
- MCP tools -> `buildMcpServer()` -> `resolveMcpTaskId()` -> `PlaySpecCore` methods.
- `playspec workflow list/show/validate/install/remove/export` -> workflow runtime asset inspection and install/export operations.

### Old Paths

- `playspec next` is still active but deprecated. New work should treat `playspec prompt` as canonical.
- Root-level `docs/playspec_total_spec.md` and `docs/playspec_phase_plan.md` are legacy planning inputs. They should remain context until superseded by reviewed feature docs.

### Bypass Paths And Risks

- Direct edits to `.playspec/tasks/active/*/task.yaml` bypass `TaskRecordSchema` unless followed by validated loading.
- Direct edits to workflow/template/rule files bypass migration-style review and backup gates.
- MCP code that calls `ActiveTaskResolver` or reads `.playspec/HEAD` would violate the established Phase 4 boundary.
- Future evolution proposal intake could create many stale one-off proposal files unless the store supports updating, revising, superseding, and appending evidence to an existing proposal.
- Future evolution apply code could accidentally become a broad file mutation engine unless action schemas, target allow-lists, backups, before/after reports, validation reports, and review gates are explicit.
- Migration `archive_file` exists, but it is migration-local and gated by `--with-archive`; it is not the future general archive system.

### Partial Migrations

- `TaskStatus` includes `archived`, but there is no complete general archive manager, archived task listing, archived context lookup, or close/archive command flow.
- `WorkflowMode` is currently `linear`; DAG is a future schema/validation preparation area, not an execution feature.
- Workflow runtime commands can manage workflow directories, but they do not provide fine-grained workflow editing commands such as add/remove/reorder phase.
- Result routing and loop guard exist for workflow phases, but harness retry/attempt/circuit-breaker behavior does not.

## Current Architecture

### Verified Flow

```text
Human CLI
  -> command runner
  -> ActiveTaskResolver (HEAD fallback allowed)
  -> PlaySpecCore
  -> YamlTaskStore / WorkflowLoader / TemplateRenderer
  -> task.yaml, prompts, snapshots, evidence, reviews

MCP client
  -> MCP tool
  -> resolveMcpTaskId(taskId | sessionId)
  -> PlaySpecCore
  -> same core state and artifact paths
```

### Current Module Responsibilities

- `src/cli/` owns command parsing, human UX, HEAD fallback, clipboard/output behavior, and interactive prompts.
- `src/core/` owns task workflow execution behavior: prompt render, completion, evidence, snapshot, desync check, rollback planning/execution, and context-ref validation.
- `src/storage/` owns YAML task persistence through `TaskStore`.
- `src/workflow/` owns workflow resolution, phase resolution, display, registry, and install/export.
- `src/template/` owns variable resolution and handlebars rendering.
- `src/mcp/` owns MCP server tools and explicit task/session resolution.
- `src/migration/` owns validated migration plans, reports, backups, and guarded action application.

## Verified Behavior And Constraints

### Verified Code Behavior

- `YamlTaskStore.createTask()` creates task folders with `outputs`, `reviews`, `prompts`, `evidence`, `snapshots`, and `rollback`.
- Normal task creation can seed a source problem into `.playspec/tasks/active/{taskId}/sources/source_problem.md`.
- Phase-execution task creation can link planning total spec and phase plan as `contextRefs`.
- `PlaySpecCore.renderNextPrompt()` validates context refs before rendering.
- Absolute or workspace-escaping context paths are rejected when manually adding context.
- `PlaySpecCore.completePhase()` validates routing before writing artifacts.
- Completion writes task and prompt snapshots, git status/diff/changed-files evidence, optional review metadata, and a rollback safe point.
- `runComplete()` renders the next prompt after successful completion when a next phase exists.
- MCP registers list/get/session/prompt/complete/evidence/desync/rollback-state tools.
- Migration plans are validated by `MigrationPlanSchema`; `delete_file` is intentionally not an action type.
- Migration persists the plan before mutation and saves a report after execution.
- `archive_file` migration actions fail unless `--with-archive` is passed.
- Migration file actions such as `update_file`, `append_section`, and `replace_section` resolve workspace-relative target paths and are not an allow-listed future evolution apply model.
- Historical validation state in the original rebaseline recorded `pnpm build` passing and `pnpm test -- --run tests/integration/runtime-bin.test.ts` failing on alias parity for `#pack/*.js`; Phase 4.2 owns reconciling that warning against the execution-time repository.

### Inferred Behavior

- The repository is directionally ready to identify remaining work after Dev Phase 4.1, because Phase 4 and 4.1 implementation docs and code paths are present; downstream planning must account for the Phase 4.2 baseline-confirmation gate before claiming approval-quality readiness or sequencing Phase 5 as executable implementation.
- The migration subsystem is the closest existing pattern for future evolution proposals: external analysis, validated plan, persisted audit trail, preview, backup, gated apply. This is an architectural reference only; current migration actions are too broad to reuse unchanged for evolution apply.
- Future evolution should attach to completion and prompt rendering points, because the old spec says evolution context is prepared after completion and pending proposals are surfaced at next prompt time.
- Future mono-spec runs should preferably produce or update one consolidated proposal for a workflow improvement area. Proposal update/merge behavior should prevent stale proposal buildup by carrying evidence, action refinements, source task references, and revision history forward in one living change plan.

### Constraints

- Do not couple Core logic to CLI.
- MCP context resolution must use `resolveMcpTaskId()` and must not use `.playspec/HEAD`.
- Do not auto-apply evolution proposals.
- Do not add automatic proposal generation until proposal schema/storage, CLI intake, update/merge, auditable apply, and harness safety foundations exist.
- Do not add the markdown viewer before its phase.
- Do not delete files through migration or future evolution unless a later phase explicitly defines a safe reviewed delete model.
- Use path aliases for cross-module imports.
- Derive paths dynamically; do not hardcode absolute paths.

## Problems

1. Old planning docs mix completed, proposed, and future behavior.
2. There is no feature-local total spec or phase plan for the current rebaseline.
3. Evolution is described in old docs but has no CLI commands, storage model, schemas, proposal records, or core hooks in current code.
4. General archive is only represented by partial state affordances and migration-local archive behavior.
5. Token/context tiering, harness safety, viewer, and DAG are future concepts with partial or no code representation.
6. Direct file mutation remains possible outside validated PlaySpec flows.
7. Future features need to preserve the Phase 4 MCP boundary and the Core/CLI separation.
8. Runtime alias parity for `#pack/*.js` has been a baseline warning, so the Phase 4.1 baseline cannot be described as fully build/test clean until Phase 4.2 confirms whether the warning is stale, fixed, or still requires a narrow correction.
9. Migration is implemented but not sufficient as a general evolution mechanism: its workspace-relative file mutations, migration-local archive path, and limited task state allow-list need stricter future boundaries before reuse.
10. Evolution proposal records need lifecycle, revision, and evidence fields before they can support a mono-spec loop without stale proposal buildup.

## Proposed Direction

### Planning Direction

The downstream phase plan should restart from the verified code reality around Phase 4.1 and plan only the remaining work. It should not reopen completed phases except for narrow hardening discovered by tests or validation findings. The alias parity baseline warning must be reconciled first in the downstream plan before Phase 5 is treated as approval-ready executable work.

Non-executable planning concerns for the later phase-plan step:

1. Baseline confirmation for runtime alias parity and any migration adequacy checks needed before reusing migration as a reference.
2. General archive and knowledge base.
3. Evolution proposal system and human edit learner.
4. Proposal update/merge and auditable proposal apply.
5. Automation safety and harness state.
6. Token/context tiering and workflow editing tools.
7. Markdown viewer.
8. DAG/subtask schema preparation.

### Proposed Evolution Flow

```text
complete phase
  -> write normal completion artifacts
  -> collect validation/planning/implementation/review evidence
  -> optionally record human edit diff inputs
  -> external agent writes first proposal YAML, or updates the existing proposal YAML for the same improvement area
  -> playspec validates and stores proposal revision
  -> playspec update/merge appends evidence and preserves previous revisions
  -> prompt/next surfaces pending proposal
  -> user views diff
  -> user applies or skips through explicit approval
  -> apply creates pre-apply backup, before/after hashes, changed file list, validation result, and success/failure report
  -> apply updates only allow-listed workflow/template/rule assets enabled by the relevant phase
```

This proposed flow is not currently implemented. It should reuse the migration principles: schema validation, explicit target files, persisted reports, backups, preview before apply, and no silent auto-apply. It must not reuse migration apply as the evolution apply engine; migration apply remains separate.

### Proposal Record Model

An evolution proposal is a reviewed change plan for improving PlaySpec-owned workflows, templates, or rules. It is not a passive knowledge-base entry and should remain focused on changes that can be reviewed, validated, applied, or intentionally skipped.

Proposal lifecycle should support at least these states:

- `pending` - stored and awaiting review or additional evidence.
- `refining` - still active and being updated with new evidence, revised rationale, or action changes.
- `skipped` - intentionally not applied, with reason/timestamp preserved.
- `applied` - explicitly approved and applied with reports/backups.
- `failed` - apply was attempted and failed, with failure or partial-apply report preserved.
- `archived` or `superseded` - optional later states for proposals replaced by a newer consolidated plan.

Proposal records should include fields for `revision`, `updatedAt`, `evidenceRefs`, `sourceTaskRefs`, `sourceResultRefs`, `supersedes` or revision history, target file refs, rationale, risk, actions, status, and validation metadata. Previous revisions should remain available so reviewers can audit why a proposal changed over time.

Mono-spec workflow usage should favor one evolving proposal per coherent improvement area. New evidence from spec validation, phase-plan validation, implementation results, review findings, or human edit observations should update that proposal instead of creating competing one-off files. New proposals remain valid only when the evidence represents a distinct improvement area.

Automatic proposal generation is explicitly deferred until after schema/storage, manual CLI intake, proposal update/merge, auditable apply, and harness safety exist. Until that later phase, agents may draft proposal YAML externally, and PlaySpec may validate, store, update, show, skip, diff, and apply only through explicit user-driven commands.

### Proposal Apply Audit Model

Proposal apply should be treated as an auditable change transaction. Apply must require explicit approval and must not mutate arbitrary workspace files.

Apply reports should be stored under `.playspec/evolution/reports/{proposalId}-{timestamp}.yaml` and should include proposal ID, revision, approval source, target files, action list, before/after hashes, changed file list, validation checks run, result status, and failure details when applicable.

Pre-apply backups should be stored under `.playspec/evolution/backups/{proposalId}-{timestamp}/` before any mutation. Failed or partially applied runs must write a failure report identifying the failed action, whether partial mutation occurred, and recovery guidance. If a report or backup cannot be written, apply should fail before mutation.

## File Responsibility Notes

These notes are not an implementation plan or phase plan. They only identify likely ownership boundaries that the later phase-plan step should verify before creating executable work:

- `src/core/types.ts` - add future archive, evolution proposal, human edit, harness attempt, token/context mode, and DAG-prep types only in their respective phases.
- `src/core/schemas.ts` - add zod schemas beside each new type before persistence or apply paths are exposed.
- `src/storage/task-store.ts` and `src/storage/yaml-task-store.ts` - extend task listing/loading only when archive or proposal storage needs it; keep current task validation intact.
- `src/core/playspec-core.ts` - add core methods for archive/evolution/harness operations without CLI dependencies.
- `src/cli/index.ts` - register future commands only when their implementation phase reaches CLI exposure.
- `src/cli/commands/*` - keep human UX, confirmation, preview, and output formatting here.
- `src/mcp/server.ts` - add future MCP tools only with `resolveMcpTaskId()` and explicit task/session context.
- `src/migration/*` - preserve Phase 4.1 behavior; use it as an architectural reference rather than mixing evolution logic into migration.
- `src/workflow/*` - keep workflow install/export behavior separate from future workflow editing commands.
- `src/template/*` - add token/context rendering modes only after a spec defines mode semantics and artifact inclusion rules.
- `tests/integration/*` - add phase-specific tests for archive movement, proposal validation/apply, pending proposal surfacing, harness safety, token modes, viewer command boundaries, and DAG rejection.
- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md` - downstream phase plan output, to be created later.

## Risks And Open Questions

Risks:

- Runtime alias parity has been a baseline warning and should be reconfirmed before downstream implementation phases are considered approval-ready.
- Migration is validated as Phase 4.1 behavior, but its file mutation actions are broad workspace-relative writes; future evolution apply must not inherit this as an unrestricted mutation model.
- Future evolution proposal storage may become a stale proposal pile unless update/merge, revision history, and evidence append behavior are first-class.
- Future evolution apply behavior could mutate important workflow assets without enough review if it is not schema-, report-, validation-, and backup-gated.
- Evolution apply may become a generalized mutation engine if action scope, allow-lists, and validation boundaries are not strictly enforced.
- Archive implementation could conflict with existing active/completed listing assumptions.
- Archive semantics are currently split between migration-local `archive_file` and future general task archive. Without a unified archive model, task lookup, listing, and context resolution may diverge in Phase 5.
- Token/context tiering could hide evidence that agents need unless full-log escape hatches are clear.
- Token/context tiering rules are not yet defined at a concrete inclusion/exclusion level, which risks either prompt explosion or loss of critical evidence during Phase 8.
- Harness automation could create loops unless retry budgets, blocked states, and circuit breakers are first-class.
- DAG schema changes could imply execution support accidentally; the phase must explicitly reject DAG execution until supported.
- Evolution flow is expected to depend on completion and next prompt rendering, which may become fragile if completion is skipped, partially executed, or diverges between CLI and MCP paths.
- CLI HEAD fallback and MCP explicit-only task context may drift further as archive, evolution, and multi-task features expand.
- Workflow editing capabilities are limited to install/export-style operations, which may constrain future evolution-driven workflow updates.

Open questions:

- Should evolution proposals live under each task, a global `.playspec/evolution/` area, or both? This must be decided before Phase 6 implementation because it affects retrieval, archive interaction, update/merge behavior, and MCP tool design.
- What exact files may an evolution proposal modify in each apply phase: built-in preset assets, installed user workflows, `.playspec/templates`, `.playspec/rules`, or only a smaller allow-list?
- When a mono-spec run discovers related evidence, what matching policy should decide whether to update an existing proposal or create a new proposal?
- How should human edit diffs be captured in normal CLI usage without a harness or external agent?
- Should general archive move completed tasks only, or can active tasks be closed/cancelled into archive states?
- Should archived tasks remain addressable by `taskId` through the same `TaskStore`, or through a separate archive store?
- What is the minimum useful token/context mode set: compact, strict, full, or another naming scheme?

## Reader Aids

### Status Legend

- Verified: read directly from current code or current task files.
- Inferred: reasonable conclusion from old docs plus current code shape.
- Proposed: future behavior to be planned and implemented later.
- Out of scope: must not be implemented in this total-spec draft step.

### Completed Baseline

- Dev Phase 0 through 4.1 are treated as implemented enough to define remaining work, not as fully validation-clean or approval-ready.
- Build/test claims for historical Phase 4.1 completion come from `docs/playspec_phase4.1_implementation_result.md` and handoff docs; Phase 4.2 must record the execution-time `pnpm build` and runtime-bin alias parity results before later implementation phases proceed.

### Command Surface Snapshot

- Canonical: `playspec prompt`.
- Compatibility alias: `playspec next`.
- Implemented task commands include create/list/current/use/get-task/add-context/specs/phase/rewind/complete/status/evidence/snapshot/desync-check/rollback/migrate.
- Implemented workflow commands include list/show/validate/install/remove/export.
- Not implemented as full features: `playspec close`, general `archive`, `view`, `evolution-context`, proposal update/merge, `propose-evolution`, `apply-evolution`, `list-proposals`, automatic proposal generation, harness execution commands, DAG execution commands.
