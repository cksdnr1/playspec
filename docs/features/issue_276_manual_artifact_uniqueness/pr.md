# PR Body

Fixes #276

## Summary

- Preserves repeated manual evidence collections by assigning deterministic task-relative suffixes before writing artifacts.
- Preserves repeated manual snapshot collections with the same suffix pattern.
- Keeps first-call manual filenames unchanged for readability and compatibility.
- Adds integration coverage that calls both manual APIs twice and reads every returned artifact path.

## Why This PR

Manual evidence and snapshot collection are used by CLI/MCP workflows for audit and recovery support. Before this change, collecting manual artifacts twice for the same task phase silently rewrote the first collection files, removing the earlier task-state evidence from the task directory.

## Problem

`PlaySpecCore.collectEvidence()` always wrote evidence with the fixed `_manual` suffix, and `PlaySpecCore.createSnapshot()` always wrote `snapshots/phase<phase>_manual_task.yaml`. Repeated calls for the same phase returned the same paths and overwrote the prior files.

## How It Was Fixed

- `src/core/playspec-core.ts`
  - Added deterministic manual suffix selection that checks existing task-relative candidate files while holding the task write lock.
  - Kept first-call filenames unchanged, then uses `_manual2`, `_manual3`, and later suffixes when collisions exist.
  - Reused the evidence path builder for both collision checks and writes so the returned paths match the written files.
  - Left routed completion visit suffix behavior unchanged.

- `tests/integration/completion-engine.test.ts`
  - Updated manual artifact coverage to call `collectEvidence()` twice and `createSnapshot()` twice.
  - Asserts first and second returned path sets differ.
  - Reads all returned files after the second calls to prove the first collection was not overwritten.

## Validation

- Passed: `pnpm vitest run tests/integration/completion-engine.test.ts`
- Passed: `pnpm build`
- Passed: `pnpm test`
- Skipped: none.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_276_manual_artifact_uniqueness/spec.md`
- `docs/features/issue_276_manual_artifact_uniqueness/plan.md`
- `docs/features/issue_276_manual_artifact_uniqueness/result.md`
- `docs/features/issue_276_manual_artifact_uniqueness/pr.md`

## PlaySpec Task

- `issue_276_manual_artifact_uniqueness`

## Risks / Follow-Ups

- None known for the scoped behavior.
- Existing tasks with partial manual artifact sets will skip the collided suffix and write to the next available suffix, which is intentional to avoid overwrites.

## Reusable Agent Guidance

No reusable agent guidance is needed. The change follows existing artifact-writing patterns and does not introduce a new workflow convention.
