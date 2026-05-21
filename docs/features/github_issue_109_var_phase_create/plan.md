# Implementation Plan: Issue #109

## Ordered Steps

1. Update phase-execution creation in `src/cli/commands/create.ts`.
   - Remove the explicit rejection for non-empty `options.var` in the `--phase` branch.
   - Parse phase-execution variables with existing `parseTaskVariables(options.var)`.
   - Pass the parsed `variables` map into `store.createTask({ ... })`.
   - Print `Variables set: <count>` after task creation when variables were supplied.

2. Add CLI regression coverage in `tests/cli.test.ts`.
   - Keep the existing normal creation `--var` test intact to guard the non-phase path.
   - Add a phase-execution test that:
     - initializes a temp workspace,
     - creates a completed planning task with a workflow whose artifacts resolve to total spec and phase plan files,
     - writes those planning artifact files,
     - runs `playspec create <title> --workflow phase-execution --phase 1 --from <planningTaskId> --var TARGET_REPOSITORY=... --var ISSUE_SCOPE=...`,
     - verifies the resulting task stores the supplied variables in `task.variables`,
     - verifies `FEATURE_SLUG`, `target.phaseNumber`, and planning context refs still exist.

3. Validate behavior.
   - Run targeted Vitest for `tests/cli.test.ts`.
   - Run full `pnpm test`.
   - Run `pnpm build`.

4. Finish workflow and PR prep.
   - Complete PlaySpec implementation and review phases after evidence exists.
   - Commit changes on `agent/issue-109-var-phase-create`.
   - Push the branch and create a draft PR.

## Files To Edit

- `src/cli/commands/create.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_109_var_phase_create/*` for PlaySpec deliverables

## Tests To Add Or Update

- Add one integration-style CLI test for `create --phase ... --var`.
- Existing normal `--var` test already confirms the non-phase path persists variables; keep it and rely on it as regression coverage.

## Risks

- Behavior changes from rejecting `--var` in phase-execution tasks to accepting and persisting it. This is intentional for the bug fix.
- The phase-execution path requires valid completed planning artifacts; the test must build only the minimum fixture needed for that path.
- No eager validation for all workflow `requiredVariables` will be added; prompt rendering remains the validation boundary.

## Rollback Notes

- Revert the `create.ts` change to restore the explicit rejection.
- Remove the new phase-execution CLI test if the behavior is intentionally reverted.

## Completion Criteria

- `playspec create --phase <n> --var KEY=VALUE` persists variables in the created YAML task file.
- Normal `playspec create --var KEY=VALUE` behavior remains covered and passing.
- Targeted test, full test, and build results are reported.
