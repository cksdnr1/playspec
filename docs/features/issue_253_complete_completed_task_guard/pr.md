Fixes #253

## Summary

- Rejects completed tasks in `playspec complete` before printing the normal task context header.
- Covers both HEAD-selected completed tasks and explicit `--task <id>` completed tasks.
- Keeps the existing core-level `completePhase()` active-task guard unchanged.

## Why This PR

`playspec complete` could emit normal-looking context output for a completed task before failing inside `PlaySpecCore.completePhase()`. Automation that interprets stdout as successful command context could see partial success output from a command that ultimately failed.

## Problem

`runComplete()` resolved the task and printed `formatContextHeader(task)` before checking whether the task was active. Completed tasks were rejected only later by core logic, after stdout had already been polluted.

## How It Was Fixed

- `src/cli/commands/complete.ts`
  - Imports `TaskNotActiveError`.
  - Checks `task.status` immediately after `ActiveTaskResolver.resolveTask()`.
  - Throws the standard non-active-task error before context output, gate result selection, or completion side effects.
- `tests/cli.test.ts`
  - Adds HEAD-based completed-task regression coverage for `playspec complete`.
  - Adds explicit completed-task regression coverage for `playspec complete --task <id>`.
  - Asserts the standard error and recovery hint while ensuring stdout does not contain the context header.

## Validation

- `pnpm exec vitest run tests/cli.test.ts -t "complete"`: passed.
- `pnpm build`: passed.
- `pnpm test`: passed, 30 test files and 607 tests.

Skipped checks: none. This repo uses `pnpm-lock.yaml`; no `package-lock.json` path was used.

## PlaySpec Task

- `issue_253_complete_completed_task_guard`

## Risks / Follow-Ups

Low compatibility risk: callers that depended on partial context stdout from failed completed-task `complete` calls will no longer receive it. This is the intended lifecycle-safety behavior.

Reusable agent guidance: no new reusable guidance is needed; this follows the existing neighboring CLI guard pattern.
