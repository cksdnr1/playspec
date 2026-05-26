# Implementation result

## Files Changed

- `src/cli/commands/specs.ts`
- `tests/cli.test.ts`
- `docs/features/issue_225_specs_completed_task_guard/spec.md`
- `docs/features/issue_225_specs_completed_task_guard/plan.md`
- `docs/features/issue_225_specs_completed_task_guard/result.md`

## Behavior Implemented

- `playspec specs` now rejects any resolved non-active task before workflow loading, phase resolution, relevant-file discovery, or output handling.
- The explicit `--task <taskId>` path now uses the same `TaskNotActiveError` lifecycle boundary as the HEAD-based path.
- Active explicit-task behavior is preserved, including not changing HEAD.

## Verification Performed

- `pnpm vitest run tests/cli.test.ts -t "specs"`: passed, 7 matching tests.
- `pnpm build`: passed.
- `pnpm test`: passed, 24 test files and 524 tests.

## Tests Changed

- Added `tests/cli.test.ts` coverage for `specs --task <completedTaskId> --path-only`.
- The regression asserts non-zero exit, `Task "<id>" is not active` on stderr, and no relevant file path on stdout.

## Skipped Validation

- No repository-relevant validation commands were skipped.

## Refactor Review

- Reviewed the branch diff against `origin/master`.
- No refactor was applied because the implementation is already a one-line command guard plus one focused regression test.
- Skipped broader resolver-level consolidation because it would change behavior for commands outside issue scope.

## PR Preparation

- Draft PR notes written to `docs/features/issue_225_specs_completed_task_guard/pr.md`.
- Reusable agent guidance update: not needed; this was a local command lifecycle guard and existing repository guidance is sufficient.
- PR link: https://github.com/cksdnr1/playspec/pull/226

## Remaining Risks

- Users who used `specs --task <completed>` for ad hoc inspection will now receive the existing active-task error. This is intentional per issue scope.
- The GitHub issue title did not match the issue body; implementation followed the detailed body, acceptance criteria, and test requirements.
