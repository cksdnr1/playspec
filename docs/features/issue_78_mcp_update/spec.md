# Issue 78 MCP Update Technical Spec

## Scope

Update the PlaySpec MCP adapter so it reflects current CLI/Core capabilities through PlaySpec 7.1 while preserving the MCP safety boundary:

- MCP task-scoped tools must require `taskId` or `sessionId`.
- MCP task resolution must continue to use `resolveMcpTaskId()`.
- MCP must not import CLI command modules, call `ActiveTaskResolver`, or read `.playspec/HEAD`.
- MCP should reuse existing Core/evolution implementation paths instead of duplicating business logic.

Out of scope:

- archive and migration MCP tools;
- viewer, DAG, workflow editing, or future phase behavior;
- automatic application of evolution proposals without explicit approval;
- broad CLI behavior changes unrelated to MCP parity.

## Use Case Alignment

MCP clients are used by coding agents that need to drive the same PlaySpec task lifecycle as the human CLI. After updates through 7.1, CLI users can add context, snapshot state, recover phases, inspect and reset harness state, and manage evolution proposals. MCP clients still expose only the original Phase 4 tool set, so agents cannot use current PlaySpec workflows without falling back to shelling out to CLI commands or bypassing PlaySpec state conventions.

## High-Level Current Implementation Summary

Verified behavior:

- `src/mcp/server.ts` registers the original task/session, prompt, completion, evidence, desync, and state-only rollback tools.
- `src/mcp/context.ts` provides explicit `taskId` / `sessionId` resolution and intentionally does not fall back to `.playspec/HEAD`.
- `PlaySpecCore` now exposes task-scoped methods beyond the MCP surface: `addContextRef`, `setCurrentPhase`, `planRollback`, `executeGitRollback`, `createSnapshot`, `getHarnessStatus`, `recordHarnessAttempt`, and `resetHarness`.
- CLI 7.1 includes evolution lifecycle and generation commands backed by `EvolutionProposalStore`, `EvolutionApplyRunner`, `EvolutionHumanEditStore`, and `generateEvolutionProposal()`.
- `tests/integration/mcp-server.test.ts` currently asserts no evolution/proposal MCP tools are registered; that assertion is now stale for issue #78.

Inferred behavior:

- MCP parity should expose structured tool results for current Core/evolution operations, not formatted CLI stdout.
- Hidden CLI commands can still be relevant when they represent current Core capabilities, but migration/archive remain intentionally excluded based on existing docs and issue scope.

Validation update from Step 2:

- Latest verifier score: 74/100, gate `needs_revision`.
- Resolved in this patch: exact MCP input/output contracts are specified below; git rollback requires explicit `confirm: true`; MCP evolution generation keeps the existing `generationSource: cli` schema value and returns `invokedBy: mcp` in the MCP response instead of changing proposal schema metadata.
- Remaining blocker after patch: none intended; the next validation pass must verify this.

Closed decision:

- Full CLI parity would include every hidden command. This implementation prioritizes current task lifecycle, harness, rollback, and evolution 7.1 operations that agents need, while leaving archive/migration out.

## Relevant Files Reviewed

- `src/mcp/server.ts`
- `src/mcp/context.ts`
- `src/mcp/session-store.ts`
- `src/core/playspec-core.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/cli/index.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/commands/harness.ts`
- `src/evolution/proposal-generator.ts`
- `src/evolution/proposal-store.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/playspec_update_7_1/spec.md`
- `docs/features/playspec_update_7_automation_safety_harness/spec.md`
- `README.md`

## Active Entry Points And Bypasses

Current MCP entry points:

- `playspec_list_tasks`
- `playspec_get_task`
- `playspec_use_session_task`
- `playspec_get_session_task`
- `playspec_render_next_prompt`
- `playspec_render_phase_prompt`
- `playspec_complete_phase`
- `playspec_collect_evidence`
- `playspec_run_state_desync_check`
- `playspec_rollback_state`

CLI/Core entry points missing from MCP:

- add context ref;
- set current phase for recovery;
- create manual snapshot;
- rollback plan and confirmed git rollback;
- harness status, attempt, and reset;
- evolution proposal generate, list, show, propose, update, append evidence, skip, diff, apply, and human edit observation record/update.

Bypasses to avoid:

- Do not call CLI command runners from MCP.
- Do not use CLI HEAD fallback.
- Do not add migration/archive MCP tools as a side effect.
- Do not auto-apply evolution proposals; `apply` requires an explicit approval flag.

## Current Architecture

Verified MCP flow:

```text
MCP tool args
  -> resolveMcpTaskId(args, sessionStore)
  -> PlaySpecCore / YamlTaskStore
  -> JSON tool result
```

Proposed MCP flow for 7.1 parity:

```text
MCP tool args
  -> zod input validation
  -> explicit task/session resolution when task-scoped
  -> existing Core/evolution service
  -> structured JSON result
```

Evolution tools:

```text
MCP evolution args
  -> EvolutionProposalStore / EvolutionApplyRunner / generateEvolutionProposal()
  -> same schema validation and persistence paths as CLI
  -> structured proposal/report/path result
```

## Verified Behavior

- `PlaySpecCore.addContextRef()` validates relative paths and rejects missing or escaping paths.
- `PlaySpecCore.setCurrentPhase()` validates target phase IDs against the task workflow.
- `PlaySpecCore.planRollback()` previews rollback; `executeGitRollback()` performs the existing guarded git rollback path.
- Harness methods require active tasks, validate phases, persist `harness.yaml`, and block attempts once retry budget is exhausted.
- `generateEvolutionProposal()` blocks when harness state is blocked or circuit breaker is active.
- Evolution proposal store validates schemas, evidence references, target paths, revision history, and terminal state restrictions.

## Problems

1. MCP has fallen behind CLI/Core capabilities after Phase 4.
2. The README MCP tool list is stale once MCP tools are updated.
3. Current tests encode stale expectations that no evolution tools exist.
4. Without MCP harness tools, MCP agents cannot inspect/reset the 7.x automation safety state through PlaySpec.
5. Without MCP evolution tools, MCP agents cannot use 7.1 proposal generation without shelling out to the CLI.

## Proposed Direction

Add MCP tools in `src/mcp/server.ts` for current Core/evolution capabilities:

- `playspec_add_context`
- `playspec_set_current_phase`
- `playspec_create_snapshot`
- `playspec_plan_rollback`
- `playspec_execute_git_rollback`
- `playspec_get_harness_status`
- `playspec_record_harness_attempt`
- `playspec_reset_harness`
- `playspec_generate_evolution_proposal`
- `playspec_list_evolution_proposals`
- `playspec_get_evolution_proposal`
- `playspec_store_evolution_proposal`
- `playspec_update_evolution_proposal`
- `playspec_append_evolution_evidence`
- `playspec_skip_evolution_proposal`
- `playspec_diff_evolution_proposal`
- `playspec_apply_evolution_proposal`
- `playspec_record_human_edit_observation`
- `playspec_update_human_edit_observation_status`

Use structured inputs instead of YAML file paths where MCP can provide objects directly. Keep explicit file-path inputs only where the underlying operation is file/evidence based.

## MCP Tool Contracts

All task-scoped tools accept `taskId?: string` and `sessionId?: string`. They must call `resolveMcpTaskId(args, sessionStore)`. If both are provided, `taskId` wins through the existing resolver. Tools that are not task-scoped must not read `.playspec/HEAD`.

Task lifecycle tools:

- `playspec_add_context`
  - input: `{ taskId?, sessionId?, path: string }`
  - implementation: resolve task, call `core.addContextRef(resolvedTaskId, path)`
  - output: `{ taskId, path, added: boolean }`
- `playspec_set_current_phase`
  - input: `{ taskId?, sessionId?, phaseId: string }`
  - implementation: resolve task, call `core.setCurrentPhase(resolvedTaskId, phaseId)`
  - output: `SetCurrentPhaseResult`
- `playspec_create_snapshot`
  - input: `{ taskId?, sessionId? }`
  - implementation: resolve task, call `core.createSnapshot(resolvedTaskId)`
  - output: `SnapshotResult`
- `playspec_plan_rollback`
  - input: `{ taskId?, sessionId? }`
  - implementation: resolve task, call `core.planRollback(resolvedTaskId)`
  - output: `RollbackPlanResult`
- `playspec_execute_git_rollback`
  - input: `{ taskId?, sessionId?, confirm: boolean }`
  - implementation: reject unless `confirm === true`; then resolve task and call `core.executeGitRollback(resolvedTaskId)`
  - output: `RollbackExecutionResult`

Harness tools:

- `playspec_get_harness_status`
  - input: `{ taskId?, sessionId?, phaseId?: string }`
  - implementation: resolve task, call `core.getHarnessStatus(resolvedTaskId, phaseId)`
  - output: `HarnessRecord`
- `playspec_record_harness_attempt`
  - input: `{ taskId?, sessionId?, phaseId: string, result: "success" | "failure", reason?: string }`
  - implementation: resolve task, call `core.recordHarnessAttempt(resolvedTaskId, phaseId, result, reason)`
  - output: `HarnessRecord`
- `playspec_reset_harness`
  - input: `{ taskId?, sessionId?, reason?: string }`
  - implementation: resolve task, call `core.resetHarness(resolvedTaskId, reason)`
  - output: `HarnessRecord`

Evolution proposal tools:

- `playspec_generate_evolution_proposal`
  - input: `{ taskId?, sessionId?, fromEvidence: string, target: string, summary: string, rationale: string, risk?: "low" | "medium" | "high", proposalId?: string, generatedId?: string }`
  - implementation: resolve task; call `generateEvolutionProposal(workspaceRoot, { taskId: resolvedTaskId, evidencePath: fromEvidence, targetPath: target, summary, rationale, riskLevel: risk, proposalId, generatedId })`
  - output: `{ taskId, invokedBy: "mcp", proposal, proposalPath, validationPath, revisionPath? }`
  - schema decision: do not change `EvolutionProposalSourceSchema`; generated proposals continue to store `source.generationSource: "cli"` because the existing generator is shared CLI/core generation machinery. MCP invocation is reported only in the tool response.
- `playspec_list_evolution_proposals`
  - input: `{}`
  - implementation: `new EvolutionProposalStore(workspaceRoot).listProposals()`
  - output: `{ proposals }`
- `playspec_get_evolution_proposal`
  - input: `{ proposalId: string }`
  - implementation: load proposal and load validation report if present
  - output: `{ proposal, validationReport?: EvolutionProposalValidationReport }`
- `playspec_store_evolution_proposal`
  - input: `{ proposal: EvolutionProposal }`
  - implementation: `EvolutionProposalStore.validateProposal(proposal)`, reject invalid, `saveProposal(validated.proposal)`, `saveValidationReport(validated.report)`
  - output: `{ proposal, proposalPath, validationPath, validationReport }`
- `playspec_update_evolution_proposal`
  - input: `{ proposalId: string, proposal: unknown }`
  - implementation: `EvolutionProposalStore.updateProposal(proposalId, proposal)`
  - output: `EvolutionProposalWriteResult`
- `playspec_append_evolution_evidence`
  - input: `{ proposalId: string, path: string, note: string }`
  - implementation: `EvolutionProposalStore.appendEvidence(proposalId, { path, note })`
  - output: `EvolutionProposalWriteResult`
- `playspec_skip_evolution_proposal`
  - input: `{ proposalId: string, reason?: string }`
  - implementation: `EvolutionProposalStore.skipProposal(proposalId, { skippedAt: now, skipReason: reason })`
  - output: `{ proposal }`
- `playspec_diff_evolution_proposal`
  - input: `{ proposalId: string }`
  - implementation: `new EvolutionApplyRunner(workspaceRoot).diff(proposalId)`
  - output: `EvolutionDiffResult`
- `playspec_apply_evolution_proposal`
  - input: `{ proposalId: string, approved: boolean }`
  - implementation: reject unless `approved === true`; then call `EvolutionApplyRunner.apply(proposalId, { approved: true, approvalSource: "mcp approved:true" })`
  - output: `EvolutionApplyResult`

Human edit tools:

- `playspec_record_human_edit_observation`
  - input: `{ id?: string, target: string, summary: string, rationale: string, taskId?: string, proposalId?: string, before?: string, after?: string }`
  - implementation: build a `HumanEditObservation` with current timestamps, generated ID when omitted, status `recorded`, and save through `EvolutionHumanEditStore.saveObservation()`
  - output: `{ observation, observationPath }`
- `playspec_update_human_edit_observation_status`
  - input: `{ editId: string, status: "ignored" | "superseded", reason?: string }`
  - implementation: `EvolutionHumanEditStore.markObservationStatus(editId, status, { reason })`
  - output: `{ observation }`

Validation and error handling:

- New input schemas should use zod enums for harness result, risk level, approval booleans, and human-edit status.
- Proposal object intake may use `z.unknown()` at the MCP boundary but must immediately pass through `EvolutionProposalStore.validateProposal()` / `updateProposal()` before persistence.
- Tool responses should continue to use the existing MCP `ok()` / `err()` JSON text envelope.

## File-By-File Plan

- `src/mcp/server.ts`: register new tools and route them to Core/evolution services.
- `src/evolution/proposal-generator.ts`: no behavior change required unless implementation finds a direct type blocker; MCP response handles invocation metadata.
- `src/evolution/types.ts` / `src/evolution/schemas.ts`: no planned changes; keep `generationSource: "cli"` as the existing shared generator metadata.
- `tests/integration/mcp-server.test.ts`: replace stale no-evolution assertion with positive tool registration and behavior coverage.
- `README.md`: update registered MCP tool list and clarify explicit task/session context for new task-scoped tools.
- `docs/features/issue_78_mcp_update/result.md`: record implementation and validation evidence.
- `docs/features/issue_78_mcp_update/pr.md`: draft PR summary after validation.

## Risks And Open Questions

- Exposing `playspec_apply_evolution_proposal` over MCP is sensitive because it mutates files. The tool must require an explicit `approved: true` flag and use `EvolutionApplyRunner.apply()` exactly as CLI uses `--yes`.
- Git rollback over MCP is also sensitive. The tool must require `confirm: true` and remain separate from rollback planning.
- Evolution proposal object intake must not weaken schema validation; all stored proposals must pass `EvolutionProposalStore`.
- Task-scoped MCP tools must keep no-HEAD-fallback behavior even when HEAD exists.

## Required Tests And Acceptance

Registration tests:

- MCP registers all new non-archive, non-migration tools listed in this spec.
- MCP still registers no archive or migration tools.
- The stale assertion that no evolution tools exist is replaced with positive evolution tool registration checks.

Behavior tests:

- `playspec_add_context`, `playspec_create_snapshot`, `playspec_set_current_phase`, `playspec_plan_rollback`, and harness tools require explicit `taskId` or `sessionId` and succeed through session resolution without reading HEAD.
- `playspec_execute_git_rollback` rejects missing or false `confirm`.
- `playspec_generate_evolution_proposal` creates or updates proposals through the same generator and returns `invokedBy: "mcp"` without requiring schema changes.
- `playspec_store_evolution_proposal` rejects invalid proposal objects and persists valid proposal objects with a validation report.
- `playspec_apply_evolution_proposal` rejects missing or false `approved`.
- Human edit observation create/update tools persist through `EvolutionHumanEditStore`.

Documentation acceptance:

- `README.md` registered MCP tool list matches `src/mcp/server.ts`.
- `docs/features/issue_78_mcp_update/result.md` records validation commands and behavior evidence.

## Reader Aids

Search for `server.tool(` in `src/mcp/server.ts` to audit the public MCP surface. Search for `resolveMcpTaskId` to verify task-scoped tools preserve explicit MCP context.
