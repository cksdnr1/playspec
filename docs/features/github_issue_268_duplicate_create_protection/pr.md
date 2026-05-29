Fixes #268

## Summary

- Rejects duplicate active task IDs in `YamlTaskStore.createTask()` before task lifecycle files are written.
- Surfaces a clear `TaskAlreadyExistsError` through the CLI with an actionable recovery hint.
- Adds regression coverage proving duplicate `playspec create` attempts do not mutate `task.yaml`, `memory.yaml`, source content, variables, lifecycle fields, timestamps, or `.playspec/HEAD`.
- Keeps successful creation for different task titles unchanged.

## Why This PR

`playspec create` derived task IDs from title slugs and passed them directly to storage. Because storage used recursive directory creation and unconditional YAML writes, rerunning create with the same title could reset an existing active task in place. That can erase lifecycle-critical state while leaving the task directory and HEAD in misleading states.

## Problem

Before this change, `.playspec/tasks/active/<taskId>` could already exist and `YamlTaskStore.createTask()` would still recreate subdirectories and overwrite `task.yaml` and `memory.yaml`. Normal CLI creation would then continue to write optional source content and `.playspec/HEAD`.

## How It Was Fixed

- `src/core/errors.ts`: added `TaskAlreadyExistsError` with duplicate task ID context and a hint to choose a different title or inspect existing tasks.
- `src/storage/yaml-task-store.ts`: added a pre-write active task root existence check at the start of `YamlTaskStore.createTask()`.
- `tests/cli.test.ts`: added CLI regression coverage for duplicate `playspec create` with replacement `--var` values and source input, plus storage-level coverage for direct duplicate `YamlTaskStore.createTask()` calls.

## Validation

- `pnpm test -- tests/cli.test.ts` failed before the guard on the new duplicate storage expectation.
- `pnpm test -- tests/cli.test.ts` passed after implementation, 208 tests.
- `pnpm build` passed.
- `pnpm test` passed, 32 test files / 649 tests.
- `git diff --check` passed.

Skipped checks: none.

## Risks / Follow-Ups

- This is pre-write duplicate protection, not a cross-process exclusive create lock. A future atomic mkdir/lock hardening can be considered if concurrent same-ID creates are reported.
- Scripts that intentionally reused duplicate `playspec create` as an implicit reset will now fail; that is intentional for this safety hardening.

Reusable agent guidance: no new reusable guidance is needed.
