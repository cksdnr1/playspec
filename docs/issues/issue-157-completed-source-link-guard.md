# GitHub Issue #157

URL: https://github.com/cksdnr1/playspec/issues/157

Title: playspec link and unlink should reject completed source tasks before mutating links

## Problem

`playspec link` and `playspec unlink` can mutate the `links` field on a completed source task. Completed tasks remain readable through `YamlTaskStore.getTask()`, and the link mutation path does not enforce the same active-task guard used by other lifecycle-sensitive mutations.

## Context

`src/core/playspec-core.ts` calls `assertTaskIsActive()` before `completePhase()`, `setCurrentPhase()`, `collectEvidence()`, `createSnapshot()`, and harness mutations. In contrast, `addTaskLink()` and `removeTaskLink()` load the source task, validate the target exists, and then call `taskStore.updateTask()` without checking `source.status`.

`src/cli/commands/link.ts` and `src/cli/commands/unlink.ts` allow the source task to come from an explicit argument or from HEAD through `--to`. Both paths pass the source task ID into the core link mutation methods without a completed-task guard.

## Acceptance Criteria

- `playspec link <completedSource> <target> --as <type>` exits non-zero and reports that the source task is not active.
- `playspec unlink <completedSource> <target>` exits non-zero and reports that the source task is not active.
- `playspec link --to <target> --as <type>` rejects when HEAD resolves to a completed task.
- `playspec unlink --to <target>` rejects when HEAD resolves to a completed task.
- In all rejected cases, the completed source task's `links` field is unchanged.

## Test Requirements

- Add focused CLI tests in `tests/cli.test.ts` or focused core tests that create a completed source task, attempt link/unlink mutations, and assert both the failure message and unchanged task record.
- Include coverage for at least one explicit-source path and one HEAD/`--to` path.
