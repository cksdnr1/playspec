# Issue 52 PlaySpec Update 6.3 Technical Spec

## Scope

Implement only PlaySpec Evolution Phase 6.3: reviewed proposal diff and apply for existing evolution proposals.

This phase adds an auditable evolution apply path that can mutate only allow-listed PlaySpec-owned assets after explicit approval. It must create backups before mutation, write apply reports, record before/after hashes, validate changed artifacts, and update proposal status to `applied` or `failed` according to the Phase 6.3 contract.

Out of scope:

- Prompt surfacing and completion-time evolution snapshots.
- Human edit observation intake.
- Automatic proposal generation.
- Workflow asset mutation.
- Migration apply reuse or migration state mutation.
- Broad workspace rewrites, source/test/package edits as proposal targets, delete/move/chmod/shell/package/git actions, and automatic rollback commands.

## Use Case Alignment

A user has already reviewed or refined a stored evolution proposal. They need to inspect the concrete diff and explicitly apply approved changes to PlaySpec-owned templates or rules. After apply, the user must be able to audit exactly what changed, what was backed up, which validations ran, and whether the proposal reached `applied` or `failed`.

## High-Level Current Implementation Summary

Verified behavior:

- `src/evolution/` already contains proposal schemas, types, and `EvolutionProposalStore`.
- Proposal lifecycle currently supports `pending`, `refining`, `skipped`, `applied`, and `failed`.
- CLI commands currently support `evolution propose`, `list`, `show`, `update`, `append-evidence`, and `skip`.
- Proposal actions are currently planning-only: `propose_file_change`, `propose_section_change`, and `propose_context_reference`.
- Proposal update/merge preserves prior revisions under `.playspec/evolution/proposals/{proposalId}/revisions/`.
- Proposal validation checks schema shape and existence of artifact/evidence refs, but does not yet validate apply-safe target roots or write apply reports/backups.

Inferred behavior:

- Phase 6.3 can build on the existing proposal store and status model without adding a new module alias.
- The current proposal action schema must be extended for Phase 6.3 executable actions instead of guessing executable behavior from the old planning-only action names.

## Relevant Files Reviewed

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md` - authoritative Phase 6.3 scope.
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md` - apply audit model and lifecycle constraints.
- `src/evolution/types.ts` - proposal status/action/report type surface.
- `src/evolution/schemas.ts` - proposal schemas and workspace-relative path validation.
- `src/evolution/proposal-store.ts` - proposal load/list/update/status persistence.
- `src/cli/commands/evolution.ts` - existing evolution command handlers.
- `src/cli/index.ts` - evolution subcommand registration.
- `src/utils/paths.ts` - evolution proposal path helpers; needs reports/backups helpers.
- `src/utils/fs.ts` - text IO and atomic write helpers.
- `src/template/template-renderer.ts` - existing template include and placeholder validation behavior.
- `tests/integration/evolution-proposal-store.test.ts` - proposal store/schema regression coverage.
- `tests/cli.test.ts` - CLI command surface coverage.

## Active Entry Points And Bypasses

Active entry points to add:

- `playspec evolution diff <proposalId>`
- `playspec evolution apply <proposalId> --yes`

Potential interactive approval can be added for TTY use, but the required non-interactive approval path must be explicit. Apply without `--yes` must fail or prompt before mutation; tests should cover non-interactive rejection.

Bypasses to block:

- Applying proposals with status other than `pending` or `refining`.
- Applying old planning-only actions, including `propose_file_change`, `propose_section_change`, and `propose_context_reference`.
- Applying to `.playspec/workflows/`, `.playspec/tasks/`, `.playspec/evolution/proposals/`, `.playspec/migrations/`, `src/`, `tests/`, package config, docs, or arbitrary workspace files.
- Applying target paths that are absolute or workspace-escaping.
- Applying without initialized backup/report metadata.
- Reusing migration action runners.

## Current Architecture

Verified flow today:

```text
playspec evolution propose/update/append-evidence/skip
  -> src/cli/commands/evolution.ts
  -> EvolutionProposalStore
  -> .playspec/evolution/proposals/{proposalId}/proposal.yaml
  -> validation.yaml and revisions/
```

Proposed Phase 6.3 flow:

```text
playspec evolution diff/apply
  -> evolution apply runner
  -> load current proposal revision
  -> validate status, actions, and target allow-list
  -> initialize report metadata
  -> create backups for every target file
  -> apply file/section changes
  -> compute before/after hashes and changed files
  -> validate changed templates/rules
  -> write success or failure report
  -> update proposal status to applied or failed
```

## Verified Behavior

- `EvolutionProposalStore.saveProposal()` rejects `applied` and `failed` during proposal intake.
- `updateProposal()` and `appendEvidence()` already reject terminal proposal statuses.
- `skipProposal()` marks proposals skipped without changing the validation report.
- CLI help currently intentionally omits `apply`; this must be updated for Phase 6.3.
- Existing tests assert the older Phase 6.2 command surface excludes apply, so those assertions must be revised.

## Problems

- No `diff` or `apply` CLI commands exist.
- No apply report/backups path helpers exist.
- No apply report schema/type exists.
- No target allow-list exists for evolution apply.
- No template/rule post-apply validation contract exists in `src/evolution/`.
- Current proposal action names are proposal-oriented; Phase 6.3 requires executable action schemas for `replace_file`, `append_section`, and `replace_section`.
- Proposal status cannot currently be set to `applied` or `failed` through a dedicated apply path.

## Proposed Direction

Add a small evolution apply module under `src/evolution/`, separate from migration:

- Define apply report types and zod schema.
- Extend `EvolutionProposalActionSchema` with executable Phase 6.3 action types:
  - `replace_file` with `targetPath`, `content`, `summary`, and `rationale`.
  - `append_section` with `targetPath`, `sectionName`, `content`, `summary`, and `rationale`.
  - `replace_section` with `targetPath`, `sectionName`, `content`, `summary`, and `rationale`.
- Add path helpers for `.playspec/evolution/reports/{proposalId}-{timestamp}.yaml` and `.playspec/evolution/backups/{proposalId}-{timestamp}/`.
- Add a runner that supports preview diff and explicit apply.
- `diff` and `apply` must reject old planning-only action types before mutation because they are proposals, not approved executable actions.
- Validate target roots before reading or writing:
  - allow `.playspec/templates/`
  - allow `.playspec/rules/`
  - reject `.playspec/workflows/` and everything else
- Create backups before mutation for all unique target files.
- Write failure reports for rejected or failed apply attempts where a report path can be initialized safely.
- On success, update proposal status to `applied`, preserve revision number, update `updatedAt`, and record the latest report path if the type surface supports it.
- On failure after report initialization, update proposal status to `failed` only after writing the failure report.

Apply report contract:

- `proposalId`
- `proposalRevision`
- `createdAt`
- `approvalSource`
- `targetFiles`
- `actions`
- `beforeHashes`
- `afterHashes`
- `changedFiles`
- `validation`
- `status`
- `failedAction`
- `partialApply`
- `recoveryGuidance`
- `backupPath`

The report must be written for successful applies and for failed applies after report initialization succeeds. If report initialization or backup creation cannot complete, apply must fail before mutation and leave proposal status unchanged.

Template validation:

- For `.playspec/templates/` targets, use the existing `TemplateRenderer` against the changed file with representative variables for common mono-spec/total-plan placeholders.
- Validate include paths through the renderer.
- Reject unresolved placeholders except the intentionally supported include syntax.

Rule validation:

- For `.playspec/rules/` targets, add a narrow validation contract requiring readable non-empty UTF-8 markdown/text content.
- Keep this contract local and conservative until a broader rule schema exists.

## File-By-File Plan

- `src/evolution/types.ts`: add executable action types, apply report/result types, and optional latest apply report metadata if needed.
- `src/evolution/schemas.ts`: add executable action schemas, apply report schemas, and explicit apply action/validation status enums.
- `src/evolution/proposal-store.ts`: add a narrow status update method for apply outcomes.
- `src/evolution/apply-runner.ts`: new runner for diff, apply, backups, hashes, target validation, file/section mutation, post-apply validation, and report writing.
- `src/cli/commands/evolution.ts`: add `runEvolutionDiff()` and `runEvolutionApply()`.
- `src/cli/index.ts`: register `evolution diff <proposalId>` and `evolution apply <proposalId> --yes`.
- `src/utils/paths.ts`: add evolution reports/backups helpers.
- `tests/integration/evolution-proposal-store.test.ts`: add schema/store coverage for executable action validation, apply reports, and status transitions.
- `tests/cli.test.ts`: update command surface expectations and add CLI coverage for diff/apply approval, rejected targets/actions/statuses, backups, reports, and validation.

## Validation Patch Ledger

Latest Step 2 score: 88/100.

Resolved issues:

- Executable action ambiguity is resolved by requiring explicit `replace_file`, `append_section`, and `replace_section` action schemas.
- Old planning-only action handling is resolved by requiring `diff` and `apply` to reject those actions before mutation.
- Apply report metadata is enumerated so implementation does not invent report fields during coding.
- Report/backup initialization behavior is explicit: if either cannot be initialized, fail before mutation and leave proposal status unchanged.

Downgraded issues:

- Last apply report display is useful but not required for correctness if status, reports, and report paths are printed by `apply`; `show` should display it if proposal metadata stores it.

Remaining non-blockers:

- Template validation uses representative variables and cannot prove every future workflow variable set.
- No automatic rollback command is required; reports and backups provide recovery evidence.

## Risks And Open Questions

- The Phase 6.3 plan names allowed actions `replace_file`, `append_section`, and `replace_section`, while the current Phase 6 proposal schema stores proposal actions as `propose_file_change`, `propose_section_change`, and `propose_context_reference`. This implementation must add the explicit executable actions and keep old planning-only actions non-executable for apply.
- Template validation with representative variables can catch include and placeholder errors, but it is not proof that every workflow-specific variable set is valid.
- No automatic rollback command is required; backups and reports must be sufficient for manual recovery.

## Reader Aids

Status terms:

- Verified: directly read from current code/docs.
- Inferred: conservative conclusion from current code shape.
- Proposed: intended Phase 6.3 implementation direction, not yet present until implementation completes.
