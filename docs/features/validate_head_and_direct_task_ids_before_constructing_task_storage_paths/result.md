# Implementation Result

## Files Changed

- `src/core/errors.ts`
- `src/utils/task-id.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/active-task-resolver.ts`
- `src/cli/commands/use.ts`
- `tests/cli.test.ts`
- `tests/integration/task-store.test.ts`
- `docs/features/validate_head_and_direct_task_ids_before_constructing_task_storage_paths/spec.md`
- `docs/features/validate_head_and_direct_task_ids_before_constructing_task_storage_paths/plan.md`

## Behavior Implemented

- Added `UnsafeTaskIdError` with an actionable hint to list tasks and recover with `playspec use <TASK_ID>`.
- Added shared task ID validation in `src/utils/task-id.ts` using `/^[a-z0-9_]+$/`.
- Guarded active and archived `YamlTaskStore` path construction before caller-provided task IDs reach `path.join()`.
- Guarded `ActiveTaskResolver` explicit and HEAD-derived task IDs before store lookup.
- Preserved existing `playspec use` title/prefix suggestion behavior while still rejecting traversal/path-like inputs when no valid suggestion applies.

## Verification Performed

- `pnpm test -- tests/integration/task-store.test.ts tests/integration/active-task-resolver.test.ts`
- `pnpm test -- tests/cli.test.ts -t use`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## Refactor Review

- Ran `git diff --check`; no whitespace issues were reported.
- Reviewed the implementation diff against `origin/master`; no safe local refactor was needed beyond the already-scoped changes.
- Intentionally skipped broader path helper redesign because the issue calls for a small guard at task ID resolution/storage boundaries.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/265
- Branch: `agent/issue-264-validate-task-id`
- Reusable agent guidance: no new guidance needed; this was a narrow lifecycle/storage boundary fix.

## Remaining Risks

- Manually created task directories with IDs outside PlaySpec-generated lowercase/number/underscore slug format are now rejected by guarded lifecycle APIs. This matches the accepted safety tradeoff from the issue scope.
