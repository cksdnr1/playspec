# Issue 52 PlaySpec Update 6.3 Implementation Plan

## Goal

Implement Phase 6.3 only: evolution proposal diff/apply with explicit approval, allow-listed target mutation, backups, reports, hashes, post-apply validation, and proposal status updates.

## Ordered Steps

1. Extend evolution type/schema surface.
   - Add executable actions: `replace_file`, `append_section`, `replace_section`.
   - Add apply report, validation result, hash, and action summary types.
   - Keep old planning-only actions valid for proposal storage, but make `diff`/`apply` reject them.

2. Add path helpers.
   - Add `.playspec/evolution/reports/{proposalId}-{timestamp}.yaml`.
   - Add `.playspec/evolution/backups/{proposalId}-{timestamp}/`.

3. Add proposal store apply helpers.
   - Add a method to persist apply reports with schema validation.
   - Add a method to mark proposal status `applied` or `failed`, preserving revision and updating `updatedAt`.
   - Do not allow proposal intake/update paths to store `applied` or `failed`.

4. Add `src/evolution/apply-runner.ts`.
   - Load proposal by ID.
   - Validate status is `pending` or `refining`.
   - Validate all actions are executable Phase 6.3 actions.
   - Validate all target files are workspace-relative and under `.playspec/templates/` or `.playspec/rules/`.
   - Reject `.playspec/workflows/`, task state, migration state, evolution proposals, source/tests/package files, docs, and arbitrary workspace files before mutation.
   - For `diff`, compute before/after content and print a concise file/action diff without mutating.
   - For `apply`, require explicit approval from CLI, initialize report metadata, create backups for every target before mutation, apply changes, compute before/after hashes, validate changed artifacts, write report, and update proposal status.

5. Implement mutation behavior.
   - `replace_file`: replace full target content with `content`.
   - `append_section`: append a markdown section if the named heading is not already present; fail without mutation if the section exists.
   - `replace_section`: replace the markdown section matching `sectionName`; fail if it is missing.
   - Failed mutations after some writes must produce `partialApply: true` and name the failed action.

6. Implement validation behavior.
   - `.playspec/templates/` targets: render with `TemplateRenderer` using representative task/workflow variables and the target directory as template root.
   - `.playspec/rules/` targets: validate readable, non-empty UTF-8 text/markdown content.
   - Reports must list validation checks per changed artifact.

7. Wire CLI.
   - Add `runEvolutionDiff()` and `runEvolutionApply()` in `src/cli/commands/evolution.ts`.
   - Register `playspec evolution diff <proposalId>`.
   - Register `playspec evolution apply <proposalId> --yes`.
   - In non-interactive mode, applying without `--yes` must fail before mutation.

8. Add tests.
   - Schema/store tests for executable action types and apply report persistence.
   - CLI help test updated to include `diff` and `apply`.
   - CLI diff test for no mutation.
   - Apply approval test.
   - Success test proving backup, report, hashes, changed files, validation, and `applied` status.
   - Rejection tests for workflow targets, arbitrary targets, old planning-only actions, skipped/applied/failed statuses.
   - Failure report test with partial-apply metadata.
   - Regression test that migration report/backup paths are untouched.

## Files To Edit

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-store.ts`
- `src/evolution/apply-runner.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `src/utils/paths.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/cli.test.ts`

## Old Paths And Bypass Paths

- Old planning-only proposal actions must remain stored but non-executable.
- Migration runner/actions must not be imported or called.
- Direct writes outside `.playspec/templates/` and `.playspec/rules/` must be rejected before mutation.
- Workflow assets under `.playspec/workflows/` must be rejected before mutation.

## Risks

- Template validation is representative, not exhaustive across every workflow variable set.
- Section replacement needs a deterministic markdown heading matcher; keep it simple and fail closed.
- Partial failure reporting must be written after report initialization and before marking proposal `failed`.

## Rollback Notes

No automatic rollback command is part of Phase 6.3. Every apply must copy original target files to the backup directory before mutation and write recovery guidance in the report.

## Completion Criteria

- `playspec evolution diff <proposalId>` previews executable proposal changes without mutating files.
- `playspec evolution apply <proposalId> --yes` applies only allow-listed executable actions.
- Reports and backups are written in the Phase 6.3 locations.
- Proposal status changes to `applied` on success and `failed` only after a failure report is written.
- Disallowed targets/actions/statuses fail before mutation.
- Build and relevant tests pass.
