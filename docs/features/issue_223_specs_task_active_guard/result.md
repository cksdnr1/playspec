# Implementation Result

## Files Changed

- `src/cli/commands/specs.ts`
- `tests/cli.test.ts`
- `docs/features/issue_223_specs_task_active_guard/spec.md`
- `docs/features/issue_223_specs_task_active_guard/plan.md`
- `docs/features/issue_223_specs_task_active_guard/result.md`

## Behavior Implemented

`runSpecs()` now rejects any resolved task whose status is not `active`, regardless of whether the task was resolved from HEAD or from `--task`. The guard runs before workflow loading, phase resolution, and relevant-file discovery, so completed explicit tasks cannot emit relevant file paths through `--path-only`.

## Regression Coverage

Added a CLI regression that:

- Creates an active mono-spec task with a relevant spec file.
- Marks that task completed while it remains loadable from active task storage.
- Runs `playspec specs --task <completedTaskId> --path-only`.
- Asserts non-zero exit, `Task "<id>" is not active` in stderr, the existing active-task recovery hint in stderr, and no completed-task spec path in stdout.

## Verification Performed

- `pnpm vitest run tests/cli.test.ts -t specs`
- `pnpm build`
- `pnpm test`

All validation commands passed.

## Test Phase Notes

Focused coverage was added in `tests/cli.test.ts` for the completed explicit-task rejection path. No additional test gaps remain for the requested scope: active explicit task behavior, HEAD mutation safety, path-only stdout safety, and existing print/binary/large/missing/interactivity paths are covered by the focused specs test selection and full suite.

## Refactor Phase Notes

Reviewed the branch diff against `origin/master`. No refactor was applied because the implementation is already the smallest local change: one guard condition and one focused regression. Re-ran `pnpm vitest run tests/cli.test.ts -t specs` after the refactor review; it passed with 7 tests.

## PR Preparation Notes

Draft PR notes were written to `docs/features/issue_223_specs_task_active_guard/pr.md`. Draft PR created: https://github.com/cksdnr1/playspec/pull/224. No reusable agent guidance needs to be documented because this fix follows the existing command-local active-task guard pattern.

## Remaining Risks

The intentional compatibility change remains: `specs --task <completed>` no longer works as a read-only shortcut. No archive, migration, MCP, storage schema, or broader lifecycle behavior was changed.
