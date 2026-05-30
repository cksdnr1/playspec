Fixes #264

## Summary

- Adds a shared task ID safety guard that rejects non-generated, path-like, or traversal task IDs before storage path construction.
- Applies the guard to HEAD-based resolution and active/archived YAML task storage lookups.
- Preserves existing `playspec use` suggestion behavior for title-like input while rejecting unsafe path-like values.
- Adds CLI and storage regression tests for unsafe HEAD, unsafe `use`, and traversal-style active/archived store lookups.

## Why This PR

PlaySpec accepted task IDs from `.playspec/HEAD` and direct CLI input before proving they were safe single path segments. Those values could reach storage helpers that construct paths under `.playspec/tasks/active/<taskId>/task.yaml` or `.playspec/tasks/archived/<taskId>/task.yaml`.

## Problem

Before this change, manually edited HEAD content or direct lifecycle inputs such as `playspec use ../outside` could influence a storage path before task ID validation. Schema validation limited many accidental successes, but storage boundary safety still depended on convention.

## How It Was Fixed

- `src/core/errors.ts` adds `UnsafeTaskIdError` with a recovery hint to list tasks and select one with `playspec use <TASK_ID>`.
- `src/utils/task-id.ts` adds `TASK_ID_PATTERN`, `isSafeTaskId()`, and `assertSafeTaskId()` using the generated task ID-compatible pattern `/^[a-z0-9_]+$/`.
- `src/storage/yaml-task-store.ts` validates active and archived task IDs before constructing task YAML paths or archive roots.
- `src/core/active-task-resolver.ts` validates explicit task IDs and trimmed HEAD content before store lookup.
- `src/cli/commands/use.ts` still offers suggestions for title-like input, but unsafe path-like input without a valid suggestion fails with `UnsafeTaskIdError`.

## Changed Files

- `src/core/errors.ts`
- `src/utils/task-id.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/active-task-resolver.ts`
- `src/cli/commands/use.ts`
- `tests/cli.test.ts`
- `tests/integration/task-store.test.ts`
- `docs/features/validate_head_and_direct_task_ids_before_constructing_task_storage_paths/spec.md`
- `docs/features/validate_head_and_direct_task_ids_before_constructing_task_storage_paths/plan.md`
- `docs/features/validate_head_and_direct_task_ids_before_constructing_task_storage_paths/result.md`

## Validation

- Passed: `pnpm test -- tests/integration/task-store.test.ts tests/integration/active-task-resolver.test.ts`
- Passed: `pnpm test -- tests/cli.test.ts -t use`
- Passed: `pnpm test -- tests/cli.test.ts`
- Passed: `pnpm build`
- Passed: `pnpm test`
- Skipped: none

## PlaySpec Task

- `validate_head_and_direct_task_ids_before_constructing_task_storage_paths`

## Risks / Follow-Ups

- Manually created task directories with IDs outside PlaySpec-generated lowercase/number/underscore slug format are now rejected by guarded lifecycle APIs. This is intentional for lifecycle storage safety.
- Reusable agent guidance: no new guidance needed; this was a narrow lifecycle/storage boundary fix.
