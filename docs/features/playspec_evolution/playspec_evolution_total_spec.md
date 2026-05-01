# PlaySpec Evolution Total Technical Spec

## Scope

This document resets the total technical specification for the remaining PlaySpec evolution work after the implementation drift that occurred since the old root-level `docs/playspec_total_spec.md` and `docs/playspec_phase_plan.md` were written.

The source problem asks to reread those older planning documents, verify the actual code, and prepare a refined spec so the remaining phase plan can continue from the real repository state. The current codebase appears implemented through Dev Phase 4.1: MCP is present, and the CLI migration runner exists. However, the repository is not fully validation-clean: `pnpm build` passes, but `pnpm test -- --run tests/integration/runtime-bin.test.ts` currently fails because `package.json#imports` includes `#pack/*.js` while `tsconfig.json#compilerOptions.paths` does not. This document treats older docs as context, not proof, and does not claim the Phase 4.1 baseline is approval-ready until that blocker is fixed or explicitly planned as the first downstream hardening item.

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
2. The agent writes a structured plan or proposal file.
3. PlaySpec validates and stores that file before mutation.
4. PlaySpec previews changes and requires approval for risky edits.
5. Approved changes update task state, workflow/template/rule assets, or docs through explicit, auditable actions.

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
- Future evolution apply code could accidentally become a broad file mutation engine unless action schemas, target allow-lists, backups, and review gates are explicit.
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
- Current validation state: `pnpm build` passes, while `pnpm test -- --run tests/integration/runtime-bin.test.ts` fails on alias parity for `#pack/*.js`.

### Inferred Behavior

- The repository is directionally ready to identify remaining work after Dev Phase 4.1, because Phase 4 and 4.1 implementation docs and code paths are present; downstream planning must account for the current alias parity test failure before claiming approval-quality readiness or sequencing Phase 5 as executable implementation.
- The migration subsystem is the closest existing pattern for future evolution proposals: external analysis, validated plan, persisted audit trail, preview, backup, gated apply. This is an architectural reference only; current migration actions are too broad to reuse unchanged for evolution apply.
- Future evolution should attach to completion and prompt rendering points, because the old spec says evolution context is prepared after completion and pending proposals are surfaced at next prompt time.

### Constraints

- Do not couple Core logic to CLI.
- MCP context resolution must use `resolveMcpTaskId()` and must not use `.playspec/HEAD`.
- Do not auto-apply evolution proposals.
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
8. Runtime alias parity is currently broken for `#pack/*.js`, so the Phase 4.1 baseline cannot be described as fully build/test clean until this is fixed or intentionally removed.
9. Migration is implemented but not sufficient as a general evolution mechanism: its workspace-relative file mutations, migration-local archive path, and limited task state allow-list need stricter future boundaries before reuse.

## Proposed Direction

### Planning Direction

The downstream phase plan should restart from the verified code reality around Phase 4.1 and plan only the remaining work. It should not reopen completed phases except for narrow hardening discovered by tests or validation findings. The current alias parity failure must be fixed or explicitly placed first in the downstream plan before Phase 5 is treated as approval-ready executable work.

Non-executable planning concerns for the later phase-plan step:

1. Baseline hardening for the runtime alias parity failure and any migration adequacy checks needed before reusing migration as a reference.
2. General archive and knowledge base.
3. Evolution proposal system and human edit learner.
4. Automation safety and harness state.
5. Token/context tiering and workflow editing tools.
6. Markdown viewer.
7. DAG/subtask schema preparation.

### Proposed Evolution Flow

```text
complete phase
  -> write normal completion artifacts
  -> collect evolution context snapshot
  -> optionally record human edit diff inputs
  -> external agent writes proposal YAML
  -> playspec validates and stores proposal
  -> prompt/next surfaces pending proposal
  -> user views diff
  -> user applies or skips
  -> apply writes backup + updates allowed workflow/template/rule files
```

This proposed flow is not currently implemented. It should reuse the migration principles: schema validation, explicit target files, persisted reports, backups, preview before apply, and no silent auto-apply.

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

- The current alias mismatch between `package.json#imports` and `tsconfig.json#compilerOptions.paths` blocks full runtime-bin validation and should be resolved before downstream phase planning is considered approval-ready.
- Migration is validated as Phase 4.1 behavior, but its file mutation actions are broad workspace-relative writes; future evolution apply must not inherit this as an unrestricted mutation model.
- Future evolution apply behavior could mutate important workflow assets without enough review if it is not schema- and backup-gated.
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

- Should evolution proposals live under each task, a global `.playspec/evolution/` area, or both? This must be decided before Phase 6 implementation because it affects retrieval, archive interaction, and MCP tool design.
- What exact files may an evolution proposal modify: built-in preset assets, installed user workflows, `.playspec/templates`, `.playspec/rules`, or all of these with allow-lists?
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
- Build/test claims for historical Phase 4.1 completion come from `docs/playspec_phase4.1_implementation_result.md` and handoff docs; current validation during this patch confirmed `pnpm build` passes and `pnpm test -- --run tests/integration/runtime-bin.test.ts` fails on alias parity for `#pack/*.js`.

### Command Surface Snapshot

- Canonical: `playspec prompt`.
- Compatibility alias: `playspec next`.
- Implemented task commands include create/list/current/use/get-task/add-context/specs/phase/rewind/complete/status/evidence/snapshot/desync-check/rollback/migrate.
- Implemented workflow commands include list/show/validate/install/remove/export.
- Not implemented as full features: `playspec close`, general `archive`, `view`, `evolution-context`, `propose-evolution`, `apply-evolution`, `list-proposals`, harness execution commands, DAG execution commands.
