# Implementation Result: Current Task Phase Display

## Files Changed

- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `src/cli/commands/get-task.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_93_playspec_current_task/spec.md`
- `docs/features/github_issue_93_playspec_current_task/plan.md`
- `docs/features/github_issue_93_playspec_current_task/result.md`

## Behavior Implemented

- `playspec current-task` now prints the resolved workflow position as `Phase:` for mono-spec tasks instead of switching the field name to `Step:`.
- `playspec current-task` now prints `Phase ID:` when the resolved phase ID is available.
- Deprecated `playspec current` now also prints `Phase ID:` when available.
- `playspec get-task --task <id>` uses the same `Phase:` and `Phase ID:` terminology for human output.
- JSON task output remains unchanged.

## Verification Performed

- `pnpm exec vitest run tests/cli.test.ts -t "current shows deprecation warning|prints mono-spec phase metadata|prints mono-spec next route on current-task|current-task shows effective first phase|get-task shows effective first phase|list-tasks shows effective first phase"`: passed, 6 tests.
- `pnpm build`: passed.
- `pnpm exec tsx src/cli/index.ts list-tasks`: passed manual check; showed `phase: 7. 기술 구현`.
- `pnpm exec tsx src/cli/index.ts current-task`: passed manual check; showed `Phase: 7. 기술 구현` and `Phase ID: implementation`.
- `pnpm exec tsx src/cli/index.ts current`: passed manual check; showed `Phase: 7. 기술 구현` and `Phase ID: implementation`.

## Full Test Run Note

- `pnpm test` was run.
- Result: failed because 9 interactive PTY tests failed in this local environment with `script: -c: No such file or directory`, plus one issue in the new assertion.
- Follow-up: the new assertion was fixed and the focused non-interactive CLI regression tests passed. The remaining PTY failures are environment/tooling-related and unrelated to the changed output code.

## Remaining Risks

- Human-readable CLI output changed from `Step`/`Step ID` to `Phase`/`Phase ID` for affected detail commands. Machine-readable `get-task --json` output is unchanged.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/95

## Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied. The implementation is already local to the three CLI display commands and the adjacent regression tests.
- Intentionally skipped broader cleanup of `computeEffectivePhaseDisplay()` because the shared resolver still serves list, prompt, selector, and compact-summary call sites.
