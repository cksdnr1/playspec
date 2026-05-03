# PlaySpec Evolution Phase Implementation Plan

Approved total spec: `docs/features/playspec_evolution/playspec_evolution_total_spec.md`.

This plan translates the approved total technical spec into future implementation phases. It starts from the verified repository state around Dev Phase 4.1 and plans only remaining work plus the minimum baseline confirmation required before later phases can be run safely.

This document is planning-only. It does not implement code, create child tasks, apply proposals, or change task state.

## Phase Summary

| Phase | Name | Primary outcome | Depends on |
|---|---|---|---|
| 4.2 | Baseline Confirmation | Runtime alias parity and Phase 4.1 validation are confirmed before future work starts | Phase 4.1 |
| 5 | Archive Storage And Close | Completed tasks can be closed into canonical archive storage through explicit archive APIs | 4.2 |
| 5.1 | Archive Inspection And Context References | Archived tasks can be listed/inspected, and active prompts can reference archived artifacts through explicit paths | 5 |
| 6 | Evolution Proposal Schema And Store | Evolution proposals can be validated and stored with lifecycle, revision, source, and evidence fields without CLI listing, prompt surfacing, or mutations | 5.1 |
| 6.1 | Evolution Proposal CLI Intake | Stored proposals can be created from files, listed, viewed, and skipped without applying mutations or changing prompts | 6 |
| 6.2 | Proposal Update / Merge | Pending/refining proposals can be revised and enriched with evidence without creating stale competing proposals | 6.1 |
| 6.3 | Evolution Apply | Approved proposal actions can safely mutate allow-listed assets with backups, reports, hashes, validation results, and failure records | 6.2 |
| 6.4 | Human Edit Observation Intake | Human edits can be recorded as structured observations without generating or applying proposals | 6.3 |
| 6.5 | Evolution Prompt Surfacing | Pending/refining proposals and evolution context snapshots are surfaced read-only in prompt and completion paths | 6.4 |
| 7 | Automation Safety Harness | Harness attempts have retry budgets, blocked states, and circuit breakers | 6.5 |
| 7.1 | Automatic Proposal Generation | Deferred generation can draft or update proposals only after update/apply/harness safety exists | 7 |
| 8 | Token And Context Modes | Prompt rendering supports explicit compact/strict/full context tiers | 7.1 |
| 8.1 | Workflow Editing Tools | Workflow assets can be edited through validated commands instead of direct file mutation | 8 |
| 9 | Markdown Viewer | A local markdown viewer can inspect PlaySpec docs/artifacts without changing state | 8.1 |
| 10 | DAG And Subtask Schema Preparation | DAG/subtask metadata can be validated and rejected safely without DAG execution | 9 |

## Cross-Phase Rules

- Keep `src/core/` independent of CLI concerns.
- Human CLI commands may use `ActiveTaskResolver` and `.playspec/HEAD` fallback where existing command semantics require it.
- MCP tools must resolve context through `resolveMcpTaskId()` and must not read `.playspec/HEAD`.
- Use path aliases for cross-module imports.
- Validate persisted state with zod schemas before apply.
- Do not auto-apply evolution proposals.
- Do not automatically generate evolution proposals before proposal schema/storage, manual intake, update/merge, apply auditability, and harness safety exist.
- Do not reuse migration file actions as a general unrestricted evolution mutation engine.
- Keep migration-local `archive_file` separate from the general archive model.
- Do not add viewer behavior before Phase 9.
- Do not add DAG execution in Phase 10.

## Phase 4.2 - Baseline Confirmation

### Scope

Confirm the current validation state recorded in the total spec before feature work begins. The total spec records a runtime alias parity failure, but the current repository has `#pack/*.js` in both `package.json` and `tsconfig.json`; this phase should verify the current state and document the reconciliation. The phase decision is to preserve `#pack` as a reserved future alias as long as runtime-bin alias parity passes; removal is allowed only if validation fails and both runtime and compile-time aliases are removed consistently.

### Entry Points

- `package.json`
- `tsconfig.json`
- `tests/integration/runtime-bin.test.ts`
- Existing `playspec migrate` CLI and migration tests as regression coverage.

### Data And State Updates

- No PlaySpec task state changes.
- If validation still fails, either add the missing implementation boundary or remove the unused alias consistently from runtime and compile-time config.
- If validation passes, update phase-execution result docs to record that the total-spec warning is stale against the execution-time codebase.
- Preserve existing package imports for `#core`, `#storage`, `#workflow`, `#template`, `#preset`, `#utils`, `#mcp`, `#migration`, and `#pack`.
- If `#pack` is preserved while no pack module exists, document it as a reserved future alias in the phase result so later validation does not treat the empty module boundary as accidental.

### Propagation, Callback, And Event Behavior

- Runtime-bin validation should continue to enforce parity between package import aliases and TypeScript path aliases.
- No new runtime behavior should propagate from this phase if validation already passes.
- No completion, prompt, MCP, migration, or workflow callbacks should be added in this phase.

### Reset And Clear Behavior

- No reset command is needed.
- Failed validation should leave no generated state beyond normal build/test output.

### User-Visible Outcome

- `pnpm build` passes.
- `pnpm test -- --run tests/integration/runtime-bin.test.ts` passes.
- The repository can claim a clean baseline for later phase work, or has a documented narrow fix if validation fails during execution.

### Tests

- Runtime-bin alias parity test.
- Existing migration integration tests.
- Existing MCP no-HEAD-fallback tests.

### Dependencies

- Phase 4.1 implementation must remain intact.

### Non-Goals

- Do not implement archive, evolution, harness, viewer, token modes, workflow editing, or DAG behavior.
- Do not broaden migration action types.

## Phase 5 - Archive Storage And Close

### Scope

Implement the first general archive model for completed PlaySpec tasks. This phase is intentionally limited to archive path helpers, storage APIs, and one close/archive command path for completed tasks. Archive listing, archive inspection, archive-aware `contextRefs`, restore, and MCP archive lookup remain deferred to later phases. This archive model is separate from migration-local `archive_file`.

### Entry Points

- One narrow CLI command path, such as `playspec close --task <taskId>` or `playspec archive close --task <taskId>`, for moving an already-completed task into archive storage.
- Core methods on `PlaySpecCore` for closing and archiving tasks.
- Storage extensions in `TaskStore` and `YamlTaskStore`.
- No MCP archive lookup tools in this phase; MCP lookup can be added later only through `resolveMcpTaskId()` or explicit task IDs.
- No prompt rendering or context reference changes in this phase.
- No broad `playspec list` behavior changes in this phase; archive listing is owned by Phase 5.1.

### Data And State Updates

- Use `.playspec/tasks/archived/{taskId}/` as the canonical archived task location.
- Add path helpers for active and archived task roots instead of continuing to treat `.playspec/tasks/active` as the only task root.
- Extend `TaskStore` with only the archived-task methods required for this slice: `getArchivedTask(taskId)` and `archiveCompletedTask(taskId)`.
- Keep active-task lookup APIs active-only; archived tasks are addressable only through explicit archived-task APIs or explicit archive-aware command options.
- Do not create an archive index in this phase; Phase 5.1 may add one only if listing requires it, while the task directory and `task.yaml` remain the source of truth.
- Preserve `TaskStatus` values and validate through `TaskRecordSchema`.
- Move completed task records and artifacts without deleting them.
- Reject archive if `.playspec/tasks/archived/{taskId}/` already exists or if `.playspec/tasks/active/{taskId}/` is not a completed task.
- Do not introduce `restoreArchivedTask()` in this phase unless a later phase-plan patch explicitly adds restore as its own validated slice.

### Propagation, Callback, And Event Behavior

- Closing a task should write a final archival record and preserve evidence/snapshots/reviews.
- MCP must not infer archived context from `.playspec/HEAD`.
- Existing active-task prompt rendering should remain unchanged.

### Reset And Clear Behavior

- Archive commands should fail before mutation if target archive paths already exist.
- No unarchive or restore command in this phase.

### User-Visible Outcome

- Users can close a completed task into canonical archive storage.
- Active task workflows remain unchanged until archive-aware context references are added in Phase 5.1.

### Tests

- Close/archive completed task.
- Reject archiving active task unless explicitly supported by the phase spec.
- Archive destination collision tests.
- Archived task read APIs do not affect active task resolution.
- Regression test proving no MCP archive lookup tool is registered in this phase.
- Regression test proving no archive list/show CLI behavior is registered in this phase unless this plan is patched again.
- Regression test proving prompt rendering and active `contextRefs` behavior are unchanged.

### Dependencies

- Phase 4.2 confirmed baseline.

### Non-Goals

- Do not archive arbitrary workspace files.
- Do not change migration-local archive semantics.
- Do not implement evolution proposals.
- Do not implement restore/unarchive behavior.
- Do not add MCP archive lookup tools.
- Do not implement archive-aware `contextRefs`.
- Do not add archive listing, archive inspection, or active/completed list category changes.

## Phase 5.1 - Archive Inspection And Context References

### Scope

Add archive-specific list/inspection behavior, then allow active tasks to reference archived task artifacts through explicit workspace-relative paths. This task archive is the first knowledge-base slice for completed PlaySpec work: archived task documents, evidence, snapshots, and results become reusable read-only knowledge through explicit references. A separate global knowledge-base store is intentionally deferred until a later approved spec defines it. This phase does not add restore behavior, MCP archive lookup, or proposal validation.

### Entry Points

- Archive-specific CLI commands such as `playspec archive list` and `playspec archive show --task <taskId>`.
- `TaskStore` and `YamlTaskStore` archived listing APIs.
- Core context reference validation.
- Prompt rendering for active tasks with explicit `contextRefs`.
- No proposal validation path in this phase; proposal records do not exist until Phase 6.

### Data And State Updates

- Keep archived task records under `.playspec/tasks/archived/{taskId}/`.
- Add `listArchivedTasks()` only in this phase, after archive movement semantics are stable.
- Persist any archive index under `.playspec/tasks/archived/index.yaml` only if implementation needs faster listing; the task directory and `task.yaml` remain the source of truth.
- Extend context reference validation to accept explicit workspace-relative paths under `.playspec/tasks/archived/{taskId}/`.
- Treat archived task artifacts as read-only knowledge-base inputs only when referenced by explicit workspace-relative path.
- Do not add task-ID guessing, HEAD fallback, or automatic archived context inclusion.
- Do not mutate archived task records when they are referenced.

### Propagation, Callback, And Event Behavior

- Prompt rendering for active tasks may include archived artifacts only when the active task has explicit `contextRefs` pointing at existing archived paths.
- MCP must not infer archived context from `.playspec/HEAD`.

### Reset And Clear Behavior

- No reset, restore, or clear behavior.
- Missing archived context references should fail with the same explicit missing-reference style as active context refs.

### User-Visible Outcome

- Active task workflows can cite archived planning artifacts without browsing manually.
- Users can list and inspect archived tasks through archive-specific commands without changing active task lookup.
- Archived artifacts remain read-only context inputs.

### Tests

- Archive-specific list/show commands do not mix archived tasks into active listing.
- Archived `contextRefs` validation for existing files.
- Missing archived `contextRefs` produce explicit errors.
- Archived context lookup does not affect active task resolution.
- Regression test proving no proposal schema, proposal store, or proposal validation path is introduced in this phase.
- MCP no-HEAD-fallback regression.

### Dependencies

- Phase 5 archive storage and close/read APIs.

### Non-Goals

- Do not implement restore/unarchive behavior.
- Do not add MCP archive lookup tools.
- Do not auto-include archived context.
- Do not mutate archived task records.
- Do not add proposal schemas, proposal storage, or proposal validation.
- Do not add a separate global knowledge-base store in this phase.

## Phase 6 - Evolution Proposal Schema And Store

### Scope

Add the validated proposal schema and storage layer that later CLI, update/merge, and apply phases will use. A proposal is a change plan for reviewed PlaySpec-owned asset updates, not just a knowledge record. This first proposal phase is limited to schema definitions, filesystem-safe proposal IDs, lifecycle and revision fields, persistence, validation reports, and store read/write APIs. CLI propose/list/show/skip behavior, update/merge commands, prompt surfacing, completion-time evolution snapshots, MCP proposal intake, acceptance/apply, and generated proposal behavior are deferred out of this phase.

### Entry Points

- Core proposal validation and storage methods only.
- New `src/evolution/` module for proposal schemas, storage, and reports.
- No public CLI command group in this phase except test-only or internal helpers if needed.
- No MCP proposal intake tool in this phase; keep MCP proposal intake deferred until proposal storage and CLI behavior are validated.
- No prompt-rendering integration in this phase; prompt surfacing should be added only by a later phase with an explicit propagation contract.

### Data And State Updates

- Define `EvolutionProposalSchema` with proposal metadata, revision number, `createdAt`, `updatedAt`, source task/result references, evidence refs, target files, risk level, actions, rationale, lifecycle status, validation metadata, and optional `supersedes` or revision-history metadata.
- Store proposals under `.playspec/evolution/proposals/{proposalId}/proposal.yaml`.
- Store proposal validation reports under `.playspec/evolution/proposals/{proposalId}/validation.yaml`.
- Track proposal status values needed by the full lifecycle: `pending`, `refining`, `skipped`, `applied`, and `failed`. `archived` or `superseded` may be added later if a dedicated archival phase needs them.
- Proposal IDs must be filesystem-safe, unique, and stable after creation.
- Proposal records may reference task IDs, archived task IDs, and workspace-relative target files, but must not copy task artifacts into proposal storage.
- Proposal records may reference archived task artifacts only by explicit workspace-relative paths accepted by the Phase 5.1 archived context validation rules.
- Persist validation reports and proposal status without mutating workflow/template/rule assets.
- Store APIs may write and reload `pending` and `refining` proposal records and validation reports; user-facing skip and update behavior are added in later phases.
- Schema must allow previous revision metadata to be stored later under `.playspec/evolution/proposals/{proposalId}/revisions/` without changing the canonical `proposal.yaml` path.
- Add the `#evolution/*.js` path alias to both runtime `package.json#imports` and compile-time `tsconfig.json#compilerOptions.paths` when `src/evolution/` is introduced.
- Keep runtime-bin alias parity passing after adding the module boundary.

### Propagation, Callback, And Event Behavior

- Completion must not collect evolution context snapshots in this phase.
- Prompt rendering must remain unchanged in this phase and must not surface proposal summaries yet.
- Proposal storage should not be loaded by normal prompt rendering or completion paths.

### Reset And Clear Behavior

- No user-facing skip or update command in this phase.
- No proposal clear command in this phase.

### User-Visible Outcome

- PlaySpec has a validated, reloadable proposal store that later command phases can expose safely.
- External agents can produce proposal YAML that PlaySpec validation tests can load and store without mutation.
- Proposal records are ready to support one evolving mono-spec proposal with revisions and evidence refs in later phases.

### Tests

- Schema rejects unknown action types and workspace-escaping paths.
- Schema accepts explicit archived artifact references without copying archived artifacts into proposal storage.
- Proposal storage persists and reloads validated records.
- Store-level status and revision metadata updates preserve proposal/report files.
- Schema accepts `revision`, `updatedAt`, `evidenceRefs`, source task/result refs, and optional supersession metadata.
- Prompt rendering behavior remains unchanged and does not load proposal summaries.
- Completion behavior is unchanged and writes no evolution context snapshots.
- No MCP proposal intake tools are registered in this phase.
- No public `playspec evolution` command group is registered in this phase unless this plan is patched again.
- Runtime-bin alias parity covers `#evolution/*.js` in both package imports and TypeScript paths.

### Dependencies

- Phase 5.1 archive context reference support, because proposals may reference completed or archived task artifacts.

### Non-Goals

- Do not apply proposal actions.
- Do not expose public proposal CLI commands.
- Do not implement proposal update/merge commands.
- Do not mutate workflows, templates, rules, or task state from proposals.
- Do not surface proposals in prompt rendering.
- Do not add completion-time evolution snapshot hooks.
- Do not add MCP proposal intake.
- Do not generate proposals automatically.
- Do not implement harness retries.

## Phase 6.1 - Evolution Proposal CLI Intake

### Scope

Expose the Phase 6 proposal store through narrow CLI commands for file intake, listing, inspection, and skip status updates. This phase still does not update/merge proposal revisions, apply proposal actions, surface proposals in prompts, add MCP proposal intake, or generate proposals.

### Entry Points

- New commands such as `playspec evolution propose --file <proposal.yaml>`, `playspec evolution list`, `playspec evolution show <proposalId>`, and `playspec evolution skip <proposalId> [--reason <text>]`.
- Core proposal read/status methods from `src/evolution/`.
- No prompt-rendering integration in this phase.
- No MCP proposal intake tool in this phase.

### Data And State Updates

- CLI `propose` validates an external proposal file through `EvolutionProposalSchema`, assigns or confirms a filesystem-safe proposal ID, persists revision `1` as `proposal.yaml`, initializes `createdAt`/`updatedAt`, and writes `validation.yaml`.
- `list` and `show` are read-only and must expose `pending`, `refining`, and `skipped` status.
- `skip` marks a proposal skipped and records timestamp/reason metadata without deleting proposal or validation files.
- `propose` must reject duplicate active proposal IDs unless the later update/merge command is used.
- No proposal apply report or backup directories are created in this phase.

### Propagation, Callback, And Event Behavior

- CLI intake must not block normal prompt rendering, completion, workflow loading, or migration.
- Prompt rendering must remain unchanged and must not surface proposal summaries yet.
- Completion must not collect evolution context snapshots in this phase.

### Reset And Clear Behavior

- `skip` should mark proposals skipped rather than deleting them.
- There is no reset from `skipped` back to `pending` in this phase unless a later phase explicitly defines reopen semantics.
- No proposal clear command in this phase.

### User-Visible Outcome

- Users can see pending evolution proposals and inspect the exact proposed actions before any apply path exists.
- External agents can produce proposal YAML that PlaySpec validates and stores through a public command.
- Users are directed to update an existing active proposal in the next phase instead of creating duplicate proposal files for the same improvement area.

### Tests

- `propose --file` validates and stores a proposal plus validation report.
- `propose --file` rejects duplicate active IDs with recovery guidance to use the later update command.
- `list` and `show` expose pending/refining/skipped status.
- `skip` only marks a proposal skipped and keeps the proposal/report files.
- Prompt rendering behavior remains unchanged and does not load proposal summaries.
- Completion behavior is unchanged and writes no evolution context snapshots.
- No MCP proposal intake tools are registered in this phase.

### Dependencies

- Phase 6 proposal schema and store APIs.

### Non-Goals

- Do not apply proposal actions.
- Do not update or merge proposal revisions.
- Do not mutate workflows, templates, rules, or task state from proposals.
- Do not surface proposals in prompt rendering.
- Do not add completion-time evolution snapshot hooks.
- Do not add MCP proposal intake.
- Do not generate proposals automatically.
- Do not implement harness retries.

## Phase 6.2 - Proposal Update / Merge

### Scope

Add explicit update and evidence-append behavior so a mono-spec workflow can maintain one evolving proposal instead of creating many stale one-off files. This phase is limited to revising pending/refining proposal records, preserving old revisions, validating every update, and appending evidence references. It does not apply proposal actions, surface proposals in prompts, add MCP proposal intake, or generate proposals.

### Entry Points

- `playspec evolution update <proposalId> --file <proposal.yaml>`.
- Optional `playspec evolution append-evidence <proposalId> --file <path> --note <text>`.
- Core proposal update/merge methods in `src/evolution/`.
- No prompt-rendering integration in this phase.
- No MCP proposal intake tool in this phase.

### Data And State Updates

- `update` loads the current proposal, verifies status is `pending` or `refining`, validates the incoming file, stores the previous canonical `proposal.yaml` under `.playspec/evolution/proposals/{proposalId}/revisions/`, increments `revision`, updates `updatedAt`, and writes the merged canonical `proposal.yaml`.
- `append-evidence` validates the evidence file as a workspace-relative non-escaping path, verifies status is `pending` or `refining`, appends an `evidenceRefs` entry with path, note, timestamp, and source command, stores the previous revision, increments `revision`, and rewrites `validation.yaml`.
- `skipped`, `applied`, and `failed` proposals cannot be updated or appended to in this phase.
- Every update must revalidate the full proposal record and rewrite validation metadata before the command succeeds.
- Revision files should use deterministic names such as `revision-{n}.yaml` under `.playspec/evolution/proposals/{proposalId}/revisions/`.
- Update/merge must preserve source task/result refs unless the incoming file explicitly changes them and the merged record remains valid.
- Update/merge should avoid stale proposal buildup by giving users a supported path to refine an active proposal instead of creating duplicate active proposals for the same improvement area.
- No proposal apply report or backup directories are created in this phase.

### Propagation, Callback, And Event Behavior

- Update/merge affects only proposal storage and validation metadata.
- Prompt rendering, completion, workflow loading, migration, and MCP behavior remain unchanged.
- Proposal listings and show output should reflect new revision number, `updatedAt`, evidence refs, and current status.
- Updating a proposal must not trigger apply, prompt surfacing, workflow edits, template edits, rule edits, or task completion behavior.

### Reset And Clear Behavior

- There is no destructive reset or clear command.
- Previous revisions remain available under the proposal `revisions/` directory.
- Invalid incoming updates must leave the canonical proposal and existing revisions unchanged.

### User-Visible Outcome

- Users can keep one active mono-spec proposal current as evidence accumulates across validation, planning, implementation, and review.
- Reviewers can inspect current proposal state and previous revisions without stale competing proposal files.

### Tests

- `update <proposalId> --file` accepts valid updates for `pending` and `refining` proposals.
- `append-evidence` appends validated evidence refs and notes.
- Updates reject `skipped`, `applied`, and `failed` proposals without mutation.
- Every update increments revision, updates `updatedAt`, stores the previous proposal under `revisions/`, and rewrites validation metadata.
- Invalid update files leave canonical proposal and revision storage unchanged.
- Prompt rendering behavior remains unchanged and does not load proposal summaries.
- Completion behavior is unchanged and writes no evolution context snapshots.
- No MCP proposal intake tools are registered in this phase.

### Dependencies

- Phase 6.1 proposal CLI intake and storage.

### Non-Goals

- Do not apply proposal actions.
- Do not mutate workflows, templates, rules, task state, source code, tests, package configuration, migration state, or arbitrary workspace files.
- Do not surface proposals in prompt rendering.
- Do not add completion-time evolution snapshot hooks.
- Do not add MCP proposal intake.
- Do not generate proposals automatically.
- Do not implement harness retries.

## Phase 6.3 - Evolution Apply

### Scope

Implement reviewed proposal application for already-stored, updatable evolution proposals. Apply is an auditable change transaction: it requires explicit approval, creates backups before mutation, records before/after hashes and changed files, validates affected artifacts, and writes success/failure reports. This phase is separate from migration apply and remains narrower than migration.

### Entry Points

- Commands such as `playspec evolution diff <proposalId>` and `playspec evolution apply <proposalId>`.
- Core apply methods that validate the current proposal revision, create backups, apply allow-listed actions, validate results, and persist reports.
- Proposal apply runner separate from `src/migration/`.

### Data And State Updates

- Store proposal apply reports under `.playspec/evolution/reports/{proposalId}-{timestamp}.yaml`.
- Store proposal apply backups under `.playspec/evolution/backups/{proposalId}-{timestamp}/`.
- Reports must include proposal ID, proposal revision, approval source, target files, action list, before hashes, after hashes when available, changed file list, validation result, result status, failed action when applicable, partial-apply flag, and recovery guidance.
- Backups must be created before mutation for every target file; if backup or report initialization fails, apply fails before mutation.
- Allow only these mutable target roots in this phase: `.playspec/templates/` and `.playspec/rules/`.
- Reject `.playspec/workflows/` as an evolution apply target in this phase. Workflow mutations require the validated workflow editing primitives introduced in Phase 8.1 or a later phase-plan patch.
- Reject task state, evidence, snapshots, migration plans/reports/backups, source files under `src/`, tests, package configuration, and arbitrary workspace files as evolution apply targets.
- Allowed action types are `replace_file`, `append_section`, and `replace_section`; no delete, move, chmod, shell, package-install, git, or human-edit actions.
- Apply may run only for current `pending` or `refining` proposal revisions. `skipped` and already `applied` proposals must be rejected; failed proposals require an explicit later retry/reopen design.
- On success, mark proposal status `applied`, update `updatedAt`, and preserve the applied revision number.
- On failure, mark proposal status `failed` only after writing the failure report; the report must identify whether partial mutation happened.
- Validate every post-apply artifact before final success using an explicit template/rule validation contract:
  - For `.playspec/templates/` targets, render-validate affected templates through the existing template renderer with representative task/workflow variables, validate include paths, and reject unresolved placeholders unless the template syntax intentionally preserves them.
  - For `.playspec/rules/` targets, validate the persisted file shape expected by rule loading; if no standalone schema exists at implementation time, add a narrow schema before apply support writes rule files.
  - Apply reports must record which validation checks were run for each changed artifact.

### Propagation, Callback, And Event Behavior

- Applied proposals may affect future prompt rendering, templates, or rules only after explicit approval and successful validation.
- After apply, proposal listings and any later read-only summaries should show applied or failed status and the last apply report path.
- Do not add prompt surfacing here; Phase 6.5 owns read-only prompt surfacing and completion-time evolution snapshots.
- Apply must not call migration apply, mutate migration state, or reuse migration file actions as unrestricted evolution actions.

### Reset And Clear Behavior

- Provide backup metadata sufficient for manual or tool-assisted rollback.
- Failed apply should leave a failure or partial-apply report that identifies the first failed action.
- No automatic rollback command is required in this phase, but failure reports must preserve enough detail for recovery.

### User-Visible Outcome

- Users can review a diff, explicitly approve an evolution proposal, and see a report of exactly what changed.
- Proposal apply is auditable, backed up, validated, and narrower than migration.

### Tests

- Apply requires explicit approval or explicit non-interactive approval flag.
- Unknown or disallowed target files are rejected before mutation.
- Disallowed action types are rejected during diff and apply.
- Backups are created before mutation under `.playspec/evolution/backups/{proposalId}-{timestamp}/`.
- Reports are written under `.playspec/evolution/reports/{proposalId}-{timestamp}.yaml` and include before/after hashes, changed files, validation result, and failure/partial-apply fields.
- Applied template/rule files pass the explicit validation contract before final success.
- Workflow targets are rejected before mutation.
- Reports distinguish applied, skipped, failed, and partial-apply outcomes.
- Migration apply state and reports are not touched by evolution apply.

### Dependencies

- Phase 6.2 proposal update/merge and revision storage.

### Non-Goals

- Do not implement broad workspace rewrites.
- Do not add `delete_file`.
- Do not mutate workflow assets in this phase.
- Do not record or learn from human edits in this phase.
- Do not generate proposals automatically.
- Do not auto-apply proposals.

## Phase 6.4 - Human Edit Observation Intake

### Scope

Add a narrow human edit observation intake path that records structured user edits for future proposal generation without changing rules, workflows, templates, task state, proposal status, or existing proposal content.

### Entry Points

- Command such as `playspec evolution record-edit`.
- Core validation and storage methods in `src/evolution/`.

### Data And State Updates

- Store human edit observations under `.playspec/evolution/human-edits/{editId}.yaml`.
- Define a human edit observation schema with edit ID, source task or proposal ID when available, target path, summary, rationale, timestamp, and optional before/after references.
- Target paths must be workspace-relative, validated, and non-escaping.
- Observation records are append-only except for explicit status changes such as `ignored` or `superseded`.
- Human edit observations may later be referenced by `evidenceRefs`, but this phase does not update proposals automatically.

### Propagation, Callback, And Event Behavior

- Human edit records may be read by future proposal-generation work, but Phase 6.4 does not generate proposals from them.
- Recording an edit must not trigger prompt rendering changes, proposal update, proposal apply, workflow edits, or task completion behavior.

### Reset And Clear Behavior

- No destructive clear behavior.
- Mark unwanted records ignored rather than deleting them.

### User-Visible Outcome

- Users can record why they manually changed a PlaySpec-owned asset, creating auditable input for later evolution work.

### Tests

- Human edit records validate and persist without mutating workflows, templates, rules, proposals, or task state.
- Workspace-escaping target paths are rejected.
- Ignored/superseded status changes keep the original observation file.
- Recording a human edit does not update proposal revision or evidence refs.

### Dependencies

- Phase 6.3 apply reports and proposal status model.

### Non-Goals

- Do not generate proposals from human edit records.
- Do not auto-apply based on human edit records.
- Do not mutate workflow, template, rule, proposal, or task files from `record-edit`.

## Phase 6.5 - Evolution Prompt Surfacing

### Scope

Attach stored evolution context to prompt and completion paths through explicit opt-in controls without adding proposal generation or mutation. This phase covers read-only pending/refining proposal summaries in prompt rendering and opt-in completion-time evolution context snapshots.

### Entry Points

- Core prompt rendering path for `playspec prompt` and `playspec next`, gated by explicit render options.
- Core completion path for `playspec complete`, gated by explicit completion options.
- CLI flags such as `playspec prompt --with-evolution-context`, `playspec next --with-evolution-context`, and `playspec complete --with-evolution-context`.
- Optional MCP prompt/complete arguments only when they use explicit task/session context and `resolveMcpTaskId()`.
- Proposal and human edit read APIs from `src/evolution/`.

### Data And State Updates

- Store completion-time evolution context snapshots under `.playspec/evolution/context/{taskId}/{phaseId}-{timestamp}.yaml` only when evolution context is explicitly requested.
- Snapshot records should include task ID, phase ID, proposal IDs considered, human edit observation IDs considered, omitted counts, generated timestamp, and generation source.
- Do not mutate proposal status, human edit status, workflow assets, templates, rules, or task records from this phase.
- Keep prompt summaries compact: proposal ID, status, revision, updatedAt, source task/result refs, evidence ref count, target files, and risk level only.

### Propagation, Callback, And Event Behavior

- Evolution surfacing is default-off for normal prompt rendering, `next`, completion, and MCP calls.
- Prompt rendering should surface pending/refining proposal summaries only when the caller explicitly requests evolution context, and then only for the explicit task plus explicit archived references.
- Completion should collect a read-only evolution context snapshot after phase result persistence and before generating a next prompt only when the caller explicitly requests evolution context.
- Malformed stored proposal or human edit records should fail only requests that enabled evolution context; normal prompt rendering, `next`, completion, and MCP calls without evolution context must remain available.
- MCP prompt surfacing must not fall back to `.playspec/HEAD`.

### Reset And Clear Behavior

- No destructive reset behavior.
- Any future clear command may remove generated evolution context snapshots only when persisted proposal and human edit records remain intact.

### User-Visible Outcome

- Users can see relevant pending/refining proposal summaries while preparing prompts.
- Completion records which proposal and human edit context was considered for the next phase without applying changes.

### Tests

- Prompt rendering surfaces pending/refining proposals without mutation only when evolution context is explicitly requested.
- Prompt rendering without the explicit evolution option does not load proposal or human edit records.
- Completion writes evolution context snapshots without changing proposal or human edit records only when evolution context is explicitly requested.
- Completion without the explicit evolution option writes no evolution context snapshot.
- Malformed evolution records produce explicit errors only when evolution context is requested.
- MCP prompt surfacing uses explicit task/session context and has no HEAD fallback.
- Snapshot records validate and preserve source proposal/human edit IDs.

### Dependencies

- Phase 6.4 human edit observation storage and Phase 6 proposal storage.

### Non-Goals

- Do not generate proposals from prompt or completion behavior.
- Do not apply proposals.
- Do not update proposal revisions, evidence refs, human edit records, workflow, template, rule, or task state.
- Do not add autonomous retry or harness behavior.

## Phase 7 - Automation Safety Harness

### Scope

Add harness state for repeated agent attempts without creating unbounded loops or hiding blocked states. Harness state is stored outside `TaskRecord` in this phase so existing task schema and active task loading remain stable.

### Entry Points

- Harness-oriented CLI commands: `playspec harness status --task <taskId>`, `playspec harness attempt --task <taskId> --phase <phaseId> --result <success|failure> [--reason <text>]`, and `playspec harness reset --task <taskId> [--reason <text>]`.
- Core methods for attempt recording and safety checks.
- Optional MCP harness status tools with explicit task/session context.

### Data And State Updates

- Store harness records under `.playspec/tasks/active/{taskId}/harness.yaml`.
- Define a harness record schema with task ID, phase ID, attempt count, retry budget, last result, last failure reason, blocked flag, circuit-breaker flag, updated timestamp, and reset events.
- Reset events are append-only entries with timestamp, task ID, previous blocked/circuit state, reason, and actor/source when available.
- Validate harness records through zod schemas before write.
- Keep normal phase history intact.

### Propagation, Callback, And Event Behavior

- Completion and prompt rendering should consult harness state only when harness mode is active.
- Circuit breakers should block additional automated attempts until reset or human action.
- Harness failures should surface as user-visible state, not silent retries.
- `harness attempt` increments attempt count only for failure results; success clears transient failure reason but does not delete reset history.

### Reset And Clear Behavior

- `harness reset` should require explicit task context and record the reset event.
- Reset should clear blocked/circuit state without deleting phase history or evidence.
- Reset should not delete `harness.yaml`; it should preserve counters and append the reset event while clearing blocked/circuit fields for the next attempt window.

### User-Visible Outcome

- Automated runs stop predictably when budgets are exhausted or repeated failures occur.
- Users can inspect why a task is blocked.

### Tests

- Retry budget increments and blocks at limit.
- Circuit breaker blocks repeated failures.
- Harness reset event persists with previous blocked/circuit state.
- Reset clears blocked state without deleting evidence.
- MCP no-HEAD-fallback regression.

### Dependencies

- Phase 6.5, with Phase 6.3 apply reports available for harness safety checks.

### Non-Goals

- Do not build a general autonomous runner.
- Do not change routing semantics beyond safety gates.

## Phase 7.1 - Automatic Proposal Generation

### Scope

Add the first guarded automatic proposal-generation path only after proposal schema/storage, CLI intake, update/merge, auditable apply, prompt surfacing, and harness safety exist. This phase may draft a new proposal or update one existing `pending`/`refining` proposal from explicit evidence inputs, but it must never apply a proposal automatically.

### Entry Points

- Command such as `playspec evolution generate --task <taskId> --from-evidence <path> [--proposal <proposalId>]`.
- Core generation orchestration in `src/evolution/` that produces proposal YAML and then reuses the Phase 6.1 propose path or Phase 6.2 update path.
- Harness safety checks from Phase 7 before any automated generation attempt.
- No MCP generation tool in this phase unless a later plan patch defines explicit task/session context and `resolveMcpTaskId()` behavior.

### Data And State Updates

- Generated output must validate through `EvolutionProposalSchema` before storage.
- When `--proposal <proposalId>` is supplied, generation may update only `pending` or `refining` proposals and must preserve prior revisions under `.playspec/evolution/proposals/{proposalId}/revisions/`.
- Without `--proposal`, generation may create one new proposal only when no active matching proposal exists; duplicate active proposals for the same improvement area should be rejected with guidance to update the existing proposal.
- Generated records must include source task/result refs, evidence refs, generation source, revision number, `updatedAt`, and validation metadata.
- Generation must not create apply reports or backups.

### Propagation, Callback, And Event Behavior

- Proposal generation is explicit-command-only and default-off.
- Generation must not run from normal prompt rendering, completion, MCP calls, migration, or workflow commands.
- Generated proposals follow the same lifecycle as manually proposed records and require explicit human review before apply.
- Generation must not mutate workflows, templates, rules, task records, migration state, source code, tests, package configuration, or arbitrary workspace files.

### Reset And Clear Behavior

- No destructive reset or clear command.
- Bad generated output fails validation without changing the stored proposal.
- Previous revisions remain available when generation updates an existing proposal.

### User-Visible Outcome

- Users can request a draft or refinement from explicit evidence after safety foundations are in place.
- The result is still a proposal requiring review, update/merge, and explicit apply approval.

### Tests

- Generation validates output before storage.
- Generation updates only `pending` or `refining` proposals.
- Duplicate active proposal detection prefers updating an existing proposal over stale proposal buildup.
- Generation writes revision history when updating an existing proposal.
- Generation does not apply proposals or mutate workflow/template/rule assets.
- Harness blocked state prevents generation.
- No MCP generation tool is registered unless explicitly added by a later plan patch.

### Dependencies

- Phase 6.2 proposal update/merge.
- Phase 6.3 auditable apply.
- Phase 6.5 prompt surfacing.
- Phase 7 harness safety.

### Non-Goals

- Do not auto-apply generated proposals.
- Do not generate proposals during prompt rendering or completion by default.
- Do not mutate arbitrary workspace files.
- Do not add MCP generation without explicit no-HEAD-fallback design.

## Phase 8 - Token And Context Modes

### Scope

Add explicit context inclusion modes so prompt rendering can trade off completeness and token volume without hiding critical refs accidentally. This phase also introduces one shared prompt artifact metadata writer used by every prompt write path, but the work must be implemented in the ordered slices below so each artifact path is independently testable.

### Entry Points

- `playspec prompt --context-mode <compact|strict|full>` and matching compatibility behavior for `playspec next`.
- Core prompt-rendering options.
- Template/variable resolver changes for context summaries.
- Optional MCP prompt arguments for context mode.
- Shared prompt artifact metadata helper used by CLI prompt generation, CLI `next` fallback prompt writes, and completion-generated prompt snapshots. MCP prompt tools use the same render options, but write sidecar metadata only when a future MCP call explicitly writes a prompt artifact path.

### Data And State Updates

- Add context mode configuration only if needed; prefer per-command explicit mode first.
- Store generated prompt metadata identifying the context mode used in sidecar YAML files next to generated prompt markdown.
- Add a narrow prompt metadata schema and writer in the prompt/core boundary rather than duplicating sidecar writes in individual commands.
- Keep existing prompt markdown filenames compatible: timestamp prompt snapshots, `next-prompt-*` fallback prompts, and `snapshots/phase{phaseId}_prompt.md` completion snapshots must keep their existing naming scheme.
- Name sidecar files by appending `.meta.yaml` to the exact prompt filename, such as `prompts/2026-...md.meta.yaml`, `prompts/next-prompt-2026-...md.meta.yaml`, and `snapshots/phaseimplementation_prompt.md.meta.yaml`.
- Sidecar metadata should include prompt artifact path, context mode, generation source (`prompt`, `next`, or `complete`), task ID, phase ID when available, generated timestamp, and omitted context summary for compact mode.
- Existing prompt markdown without sidecar metadata remains valid and readable.
- Keep `contextRefs` as references, not embedded state.
- Define context mode behavior concretely:
  - `full`: include every existing explicit `contextRefs` file body and required task/workflow variables; fail on any missing context reference; do not omit evidence or snapshots that current rendering would include.
  - `strict`: include required task/workflow variables and explicit `contextRefs` file bodies only; fail on any missing context reference; include evidence/snapshot references as paths plus concise metadata unless the template explicitly requires the full body.
  - `compact`: include required task/workflow variables, context reference path/title/role/source metadata, and short generated summaries where available; do not embed full evidence/snapshot bodies by default; record every omitted context file/evidence body in sidecar `omittedContext`.
- Missing explicit `contextRefs` remain errors in all modes because current Core validates them before rendering; compact mode may omit file bodies, but it must not ignore missing referenced files.

### Implementation Order

1. Add the core context-mode option and render behavior without changing artifact filenames.
2. Add the shared metadata schema/writer and wire it into `playspec prompt`.
3. Wire the same metadata writer into `playspec next` fallback prompt writes.
4. Wire the same metadata writer into completion-generated prompt snapshots.
5. Add MCP rendered-text parity for context modes, with no sidecar write unless an explicit artifact path is introduced.

Each slice must keep existing prompt markdown output compatible before the next slice begins.

### Propagation, Callback, And Event Behavior

- Completion-generated next prompts should record the selected or default context mode.
- `playspec prompt`, `playspec next`, completion-generated snapshots, and MCP prompt generation must pass context mode into the same core render options.
- Artifact-writing paths must call the shared metadata writer after the markdown artifact path is known. Current MCP prompt tools return text only, so MCP must not create sidecar metadata unless the phase also adds an explicit MCP artifact-write option with a known artifact path.
- If no context mode is provided, all entry points must use the same default mode. Artifact-writing paths must record that default in sidecar metadata.
- Prompt rendering should fail clearly if strict/full mode requires a missing file.
- Compact mode must still surface enough metadata to discover omitted detail.

### Reset And Clear Behavior

- No destructive reset behavior.
- Any cached summaries must be invalidated or regenerated when source files change.

### User-Visible Outcome

- Users can choose compact prompts for routine work and full prompts for review-heavy work.
- Prompt snapshots show which context mode produced them.

### Tests

- Compact/strict/full mode rendering.
- Missing context behavior by mode.
- Prompt snapshot metadata.
- Backward compatibility for existing prompt markdown without sidecar metadata.
- Metadata sidecar creation for prompt snapshots, fallback next prompts, and completion prompt snapshots.
- Shared metadata writer coverage across CLI prompt, CLI next fallback, and completion snapshot paths.
- MCP prompt mode parity for rendered text, plus a regression proving text-only MCP prompt calls do not try to write sidecar metadata without an artifact path.

### Dependencies

- Phase 7.1 generation gate, so automation can select context modes safely.

### Non-Goals

- Do not remove full-log escape hatches.
- Do not implement viewer behavior.

## Phase 8.1 - Workflow Editing Tools

### Scope

Provide validated workflow editing commands for installed workflow assets so users do not need direct YAML edits for common changes. This phase does not edit built-in preset assets in place.

### Entry Points

- `playspec workflow add-phase --workflow <id> --after <phaseId> --id <newPhaseId> --title <title> --template <templatePath>`.
- `playspec workflow remove-phase --workflow <id> --id <phaseId> [--replacement <phaseId>]`.
- `playspec workflow reorder-phase --workflow <id> --id <phaseId> --after <phaseId>`.
- `playspec workflow set-template --workflow <id> --phase <phaseId> --template <templatePath>`.
- Workflow validation in `src/workflow/`.
- Workflow editing primitives that a later phase-plan patch may allow evolution apply to call; Phase 6.3 itself does not mutate workflows.

### Data And State Updates

- Mutate only installed workflow assets under `.playspec/workflows/{workflowId}/workflow.yaml`.
- Built-in preset workflow assets under `src/preset/assets/` are read-only for these commands.
- Store workflow edit reports under `.playspec/workflows/.reports/{workflowId}-{timestamp}.yaml`.
- Store workflow edit backups under `.playspec/workflows/.backups/{workflowId}-{timestamp}/workflow.yaml`.
- Mutate installed workflow assets only after backup and schema validation.
- Preserve built-in preset assets unless an explicit install/export/edit target is selected.
- Write reports for command-driven workflow changes.
- Reports must include command name, workflow ID, target path, backup path, before/after phase IDs, active task compatibility result, and validation result.
- Active task compatibility is computed only for active tasks whose workflow ID matches the edited workflow.

### Propagation, Callback, And Event Behavior

- Edited workflows should be visible to subsequent prompt rendering.
- Before write, load active tasks using the edited workflow and reject edits that remove or rename any active task's current phase.
- `remove-phase --replacement` may be accepted only when no active task currently references the removed phase; in this phase it is report/diagnostic metadata for humans and must not mutate task records or make otherwise-invalid active tasks renderable.
- Reorder operations must preserve all phase IDs and only change ordering.
- `set-template` must require an existing template path and must validate the workflow after substitution.
- `add-phase` must reject duplicate phase IDs and missing template paths before backup or write.
- `remove-phase` must reject removal of any phase referenced by an active task's `currentPhase`, even if `--replacement` is supplied.
- Future evolution apply support may reuse workflow editing primitives, not direct YAML string edits, only after a later phase-plan patch explicitly allows workflow targets.

### Reset And Clear Behavior

- Provide backup metadata and restore guidance for workflow edits.
- Reject edits that would orphan an active task's current phase.

### User-Visible Outcome

- Common workflow changes are reviewed and validated through CLI commands.
- Future evolution proposals have a safer primitive available if a later phase explicitly enables workflow mutations.

### Tests

- Add/remove/reorder phase validation.
- Reject removing an active current phase, including when `--replacement` is supplied.
- Reject duplicate phase IDs and missing template paths.
- Verify `--replacement` is recorded only for non-active-current removals and does not mutate active task records.
- Validate edited workflow loads.
- Backup/report creation.
- Report and backup path creation under `.playspec/workflows/.reports/` and `.playspec/workflows/.backups/`.
- Built-in preset assets remain unchanged.

### Dependencies

- Phase 8 context mode behavior.
- Phase 6.3 apply backup/report patterns may be reused, but Phase 8.1 must not depend on Phase 6.3 allowing workflow mutations.

### Non-Goals

- Do not implement DAG execution.
- Do not mutate built-in preset assets in place by default.

## Phase 9 - Markdown Viewer

### Scope

Add a local viewer for PlaySpec markdown artifacts and task documents.

### Entry Points

- New command such as `playspec view`.
- Viewer module for rendering markdown and opening local output.
- Read-only access to task docs, evidence, snapshots, results, specs, phase plans, and archived docs.

### Data And State Updates

- Viewer may create generated preview output under a cache or temp path.
- Viewer must not mutate task records, workflow files, templates, rules, proposals, or archive state.

### Propagation, Callback, And Event Behavior

- Viewer should follow explicit task/file arguments.
- Viewer should not participate in completion, prompt rendering, migration, archive, or evolution apply callbacks.

### Reset And Clear Behavior

- Provide a cache clear path if viewer output is cached.
- Clearing viewer cache must not delete source docs.

### User-Visible Outcome

- Users can inspect PlaySpec markdown artifacts in a readable local interface.

### Tests

- View explicit markdown file.
- View task artifact by task ID and artifact type.
- Reject workspace-escaping paths.
- Confirm viewer commands do not mutate task state.

### Dependencies

- Phase 8.1 workflow editing commands; viewer should remain read-only.

### Non-Goals

- Do not create a web app dashboard.
- Do not edit markdown through the viewer.

## Phase 10 - DAG And Subtask Schema Preparation

### Scope

Prepare schemas and validation boundaries for future DAG/subtask workflows without implementing DAG execution.

### Entry Points

- Workflow schema validation.
- Workflow inspection commands.
- Tests that load future-shaped workflow files and reject unsupported execution modes.

### Data And State Updates

- Add schema fields only as preparation, such as dependency metadata or subtask descriptors, if they can be validated without execution.
- Existing linear workflows must remain compatible.
- Persist no DAG execution state.

### Propagation, Callback, And Event Behavior

- Prompt, phase resolution, and completion must continue to execute only supported linear workflows.
- Unsupported DAG execution requests should fail with explicit recovery guidance.

### Reset And Clear Behavior

- No DAG reset behavior because DAG execution is not implemented.
- Invalid experimental workflow metadata should be rejected before task mutation.

### User-Visible Outcome

- Users and future implementers can distinguish valid future DAG metadata from unsupported DAG execution.
- Linear workflows remain stable.

### Tests

- Linear workflow regression tests.
- Schema accepts documented preparatory metadata when supported.
- CLI rejects DAG execution mode clearly.
- Phase resolver does not attempt topological execution.

### Dependencies

- Phase 9 viewer, so users can inspect docs before future execution planning.

### Non-Goals

- Do not implement DAG execution.
- Do not implement subtask scheduling.
- Do not introduce Project/Stage hierarchy.

## Dependencies

Phase order is intentionally strict:

1. Phase 4.2 must run before feature work because it confirms the validation baseline and reconciles the stale total-spec alias warning if current validation passes.
2. Phase 5 must establish archive storage and close semantics before archived artifacts can become reusable context.
3. Phase 5.1 must add archive listing/inspection and explicit archived artifact references before evolution proposals can reference archived/completed work safely.
4. Phase 6 must store proposals before Phase 6.1 can expose CLI intake/list/show/skip behavior.
5. Phase 6.2 must add proposal update/merge before apply so mono-spec runs can refine one proposal instead of creating stale competing records.
6. Phase 6.3 must apply proposals only after Phase 6.2 has revision history and stable update behavior.
7. Phase 6.4 must record human edit observations after the proposal/apply status model exists, without feeding automatic apply behavior.
8. Phase 6.5 must add prompt surfacing and completion snapshots only after proposal and human edit records exist.
9. Phase 7 must define automation safety before automatic generation or token/context compression is used in automated paths.
10. Phase 7.1 may add automatic proposal generation only after update/merge, auditable apply, prompt surfacing, and harness safety exist.
11. Phase 8.1 should reuse Phase 6.3 backup/report patterns where useful, but proposal-driven workflow edits remain disabled until a later phase-plan patch explicitly enables them.
12. Phase 9 remains deferred until after workflow and token tools.
13. Phase 10 must remain schema-only until a later approved total spec adds DAG execution.

## Validation Gates

Each phase-execution task should pass these gates before completion:

- `pnpm build`
- Targeted tests for the changed module.
- Regression tests for prompt rendering and completion when the phase touches workflow, task, proposal, or context behavior.
- MCP no-HEAD-fallback tests when adding or touching MCP tools.
- Schema validation tests for any persisted YAML.
- Artifact mutation tests proving backups/reports exist before reviewed apply paths mutate files.
- Documentation update for any new command or stored artifact path.

Phase-specific hard gates:

- Phase 4.2: runtime-bin alias parity must pass, and the phase result must state whether the total-spec warning was stale or required a code fix.
- Phase 5: migration-local archive behavior must remain unchanged.
- Phase 5.1: archive-aware context references must require explicit paths and must not affect active task resolution.
- Phase 6: proposals must be stored without mutation.
- Phase 6.1: proposal CLI intake must expose list/show/skip behavior without mutation beyond proposal status.
- Phase 6.2: proposal update/merge must update only pending/refining proposals, revalidate every update, and preserve previous revisions.
- Phase 6.3: proposal apply must reject disallowed targets, including workflow assets, before mutation, and must write backups/reports with before/after hashes and validation results.
- Phase 6.4: human edit observations must not mutate proposals, workflows, templates, rules, or task state.
- Phase 6.5: prompt surfacing and completion snapshots must be explicitly requested, read-only, and must not mutate proposal or human edit records.
- Phase 7: retry budget and circuit breaker tests must demonstrate blocked-state behavior.
- Phase 7.1: automatic generation must remain explicit-command-only, must use update/merge instead of duplicate proposals when applicable, and must never apply proposals.
- Phase 8: full context mode must remain available.
- Phase 8.1: workflow edits must validate the resulting workflow before final write.
- Phase 9: viewer commands must be read-only.
- Phase 10: DAG execution must be explicitly rejected.

## Risk Register

| Risk | Affected phases | Mitigation |
|---|---|---|
| Stale baseline warning makes future validation ambiguous | 4.2 | Re-run runtime-bin validation and document whether the total-spec alias warning is stale or required a narrow fix |
| Migration apply is mistaken for evolution apply | 6.3 | Keep a separate evolution apply runner with stricter allow-lists |
| Archive semantics split between migration and general tasks | 5 | Use `.playspec/tasks/archived/{taskId}/` with explicit archive store APIs; do not reuse migration archive paths |
| Stale proposal buildup hides the active improvement plan | 6.2, 7.1 | Prefer update/merge for pending/refining proposals, preserve revisions, and reject duplicate active proposals for the same improvement area |
| Evolution becomes a broad file mutation engine | 6.3 | Require action schemas, target allow-lists, backups, reports, approval, and defer workflow mutations until workflow editing primitives exist |
| Human edit observations become automatic behavior | 6.4 | Persist observations only; do not generate proposals, mutate assets, or auto-apply from them |
| MCP accidentally gains HEAD fallback | 5, 6, 7, 8 | Require `resolveMcpTaskId()` in every MCP tool and regression tests |
| Token modes hide required evidence | 8 | Keep full mode, strict missing-file failures, compact omission metadata, and sidecar metadata compatibility |
| Harness creates unbounded loops | 7 | First-class retry budgets, blocked states, and reset events |
| Workflow edits break active tasks | 8.1 | Mutate only installed workflow assets with backups/reports and reject edits that remove any active task's current phase before write |
| Viewer scope expands into editing/dashboard work | 9 | Keep viewer read-only and artifact-focused |
| DAG schema implies execution support | 10 | Reject DAG execution explicitly and test the rejection |

## Handoff Notes

- Future phase-execution tasks should cite this phase plan and the approved total spec.
- Treat the old root-level `docs/playspec_total_spec.md` and `docs/playspec_phase_plan.md` as legacy context only.
- Preserve the completed Phase 4 and Phase 4.1 boundaries: MCP explicit context only, migration validated before apply, no `delete_file`, and archive gated by `--with-archive`.
- Begin with Phase 4.2 before creating implementation tasks for archive or evolution, even if it is validation-only.
- Keep `docs/features/playspec_evolution/result.md` unchanged during phase-plan creation unless a later validation step requires a planning warning.
