# Draft PR: Fix Current Task Phase Display

Fixes #93

## Summary

- Align `current-task` and `get-task` human output with `list-tasks` by printing resolved workflow position as `Phase:` instead of `Step:`.
- Add `Phase ID:` to deprecated `current` output when a resolved phase ID is available.
- Update CLI regression coverage for mono-spec phase labels and the deprecated `current` command.

## Changed Files

- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `src/cli/commands/get-task.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_93_playspec_current_task/spec.md`
- `docs/features/github_issue_93_playspec_current_task/plan.md`
- `docs/features/github_issue_93_playspec_current_task/result.md`
- `docs/features/github_issue_93_playspec_current_task/pr.md`

## Tests Run

- `pnpm install --frozen-lockfile`
- `pnpm test` - failed due local interactive PTY harness failures: `script: -c: No such file or directory`; focused non-interactive suites had passed before the CLI PTY failures, and the one new assertion issue was fixed.
- `pnpm exec vitest run tests/cli.test.ts -t "current shows deprecation warning|prints mono-spec phase metadata|prints mono-spec next route on current-task|current-task shows effective first phase|get-task shows effective first phase|list-tasks shows effective first phase"` - passed.
- `pnpm build` - passed.
- `pnpm exec tsx src/cli/index.ts list-tasks` - passed manual check.
- `pnpm exec tsx src/cli/index.ts current-task` - passed manual check.
- `pnpm exec tsx src/cli/index.ts current` - passed manual check.

## PlaySpec Task

- `github_issue_93_playspec_current_task`

## Risk Notes

- Human-readable output changes from `Step`/`Step ID` to `Phase`/`Phase ID` for affected detail commands.
- `get-task --json` is unchanged for machine-readable consumers.
- Full `pnpm test` could not pass in this local environment because interactive PTY tests failed before completing; focused regression coverage and build passed.

## Reusable Agent Guidance

No reusable guidance update is needed. This was a narrow CLI display parity fix.
