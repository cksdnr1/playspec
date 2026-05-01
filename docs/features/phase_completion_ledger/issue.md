# Issue: Add Git-Like Phase Completion Ledger And Markdown Records

## Summary

PlaySpec currently tracks the active task phase and appends completed phases to `task.yaml` `phaseHistory`. It also writes snapshots, evidence, reviews, and rollback safe-point metadata during completion.

What is missing is a Git-commit-status-like completion ledger: every completed workflow phase should have a durable typed status record, and every completion event should have a human-readable markdown file that can be inspected, copied, cached, and used as rollback/evidence context.

## User Problem

Users need to know exactly what has completed in a task, in order, with the result type that caused the next transition.

Example desired timeline:

1. `tech_spec_draft` complete
   - type: `draft_completed`
2. `tech_spec_validate` complete
   - type: `needs_revision`
   - next: `tech_spec_patch`
3. `tech_spec_patch` complete
   - type: `patch_completed`
   - next: `tech_spec_validate`
4. `tech_spec_validate` complete
   - type: `approved`
   - next: `implementation_plan_create`
5. `implementation_plan_create` complete
   - type: `plan_created`

This should feel similar to `git log`: each completion event is an immutable checkpoint with metadata, evidence links, rollback references, and a markdown body.

## Current Behavior

Verified from the current codebase:

- `TaskRecord.phaseHistory` stores completed phase entries.
- `PhaseHistoryEntry.result` can store gate results such as `approved` or `needs_revision`.
- `PlaySpecCore.completePhase()` writes evidence, snapshots, optional review files, `stateSync`, and `rollback.lastSafePoint`.
- `RollbackSafePoint` stores one last safe point, including the phase, Git HEAD, task snapshot file, and optional prompt snapshot file.
- Evidence and snapshots are stored under each task inside `.playspec/tasks/active/<taskId>/`.

Current limitations:

- There is no first-class completion event ID.
- There is no append-only completion ledger file.
- There is no per-completion markdown file.
- `rollback.lastSafePoint` points only to the latest safe point, not a queryable completion history.
- Phase history is structured state, but not convenient for humans to copy, review, or archive.

## Proposed Feature

Add a per-task phase completion ledger stored on the user side inside `.playspec`.

Suggested storage:

```text
.playspec/tasks/active/<taskId>/
  completions/
    index.yaml
    0001-tech_spec_draft.md
    0002-tech_spec_validate-needs_revision.md
    0003-tech_spec_patch.md
    0004-tech_spec_validate-approved.md
    0005-implementation_plan_create.md
```

The files can be treated as cache-like PlaySpec artifacts. They live under `.playspec` and may be cleaned up by future cache/archive commands, but they must not be silently deleted during normal completion.

## Completion Event Contract

Each completed phase should create one completion event.

Suggested fields:

```ts
interface CompletionEvent {
  id: string;
  sequence: number;
  taskId: string;
  phase: string;
  phaseTitle: string;
  completedAt: string;
  type: string;
  result?: string;
  previousPhase: string | null;
  nextPhase: string | null;
  statusAfterCompletion: 'active' | 'completed' | 'archived';
  gitHead: string | null;
  evidenceFiles: string[];
  snapshotFiles: string[];
  reviewFile?: string;
  rollbackSafePointId?: string;
  markdownFile: string;
}
```

## Completion Type Rules

Completion type should be explicit and stable.

Suggested default mapping:

- Gate phase with result `approved`: `approved`
- Gate phase with result `needs_revision`: `needs_revision`
- Patch phase: `patch_completed`
- Draft phase: `draft_completed`
- Plan creation phase: `plan_created`
- Implementation phase: `implementation_completed`
- Test phase: `tests_completed`
- Refactor phase: `refactor_completed`
- PR phase: `pr_prepared`
- Unknown/default phase: `phase_completed`

The exact mapping should come from workflow metadata when possible, with a safe fallback derived from phase ID.

Optional workflow extension:

```yaml
phases:
  tech_spec_draft:
    completion:
      eventType: draft_completed
  tech_spec_validate:
    gate:
      results:
        - approved
        - needs_revision
      eventTypes:
        approved: approved
        needs_revision: needs_revision
```

## Markdown File Template

Each completion markdown file should be copy-paste friendly.

```md
# Completion 0002: tech_spec_validate

- Task: <taskId>
- Phase: tech_spec_validate
- Title: Technical spec validation
- Completed at: 2026-04-29T00:00:00.000Z
- Type: needs_revision
- Result: needs_revision
- Previous phase: tech_spec_validate
- Next phase: tech_spec_patch
- Git HEAD: <sha-or-null>
- Rollback safe point: <safePointId-or-none>

## Evidence

- .playspec/tasks/active/<taskId>/evidence/phase-tech_spec_validate-...

## Snapshots

- .playspec/tasks/active/<taskId>/snapshots/phase-tech_spec_validate-before-complete.yaml
- .playspec/tasks/active/<taskId>/snapshots/phase-tech_spec_validate-prompt.md

## Review

- .playspec/tasks/active/<taskId>/reviews/phase-tech_spec_validate-...

## Rollback Notes

Use the rollback safe point above for state rollback context. This markdown is an audit/evidence artifact and should not itself mutate task state.
```

## CLI Behavior

Add read-only commands:

```text
playspec log [--task <taskId>]
playspec log --markdown [--task <taskId>]
playspec show-completion <completionId> [--task <taskId>]
```

Expected output:

```text
0005 implementation_plan_create plan_created     2026-04-29T00:00:00Z
0004 tech_spec_validate        approved         2026-04-29T00:00:00Z
0003 tech_spec_patch           patch_completed  2026-04-29T00:00:00Z
0002 tech_spec_validate        needs_revision   2026-04-29T00:00:00Z
0001 tech_spec_draft           draft_completed  2026-04-29T00:00:00Z
```

Optional write command for cache cleanup:

```text
playspec completion-cache clean --task <taskId> --older-than <duration>
```

Cleanup must only delete generated completion markdown/cache artifacts, not `task.yaml`, source docs, evidence required by current rollback safe points, or files outside `.playspec`.

## Rollback And Evidence Requirements

- Every completion event must reference the evidence files created during that completion.
- Every completion event must reference snapshot files created during that completion.
- Every completion event should reference the rollback safe point created during that completion, if available.
- State rollback should continue to use validated snapshots and existing rollback safety gates.
- Completion markdown files are audit/evidence records, not the source of truth for rollback mutation.
- Markdown records must be preserved during normal task completion and phase rewind.

## Storage Requirements

- Store under `.playspec/tasks/active/<taskId>/completions/`.
- Use relative paths inside persisted task metadata where possible.
- Do not hardcode absolute paths.
- Use atomic writes for `index.yaml` and markdown files.
- Append new completion events during `PlaySpecCore.completePhase()` after evidence/snapshot paths are known and before final task state is saved, or in the same locked completion section.
- Completion event creation must be covered by the same task write lock used for completion metadata.

## Out Of Scope

- Markdown viewer UI.
- Auto-applying evolution proposals.
- Deleting files outside `.playspec`.
- Destructive Git operations.
- Replacing existing `phaseHistory`; the ledger should complement it.
- Storing completion records outside the user project unless explicitly configured later.

## Acceptance Criteria

- Completing any phase creates exactly one completion event in `.playspec/tasks/active/<taskId>/completions/index.yaml`.
- Completing any phase creates exactly one markdown file for that event.
- Gate results such as `approved` and `needs_revision` are stored as completion event type/result.
- Patch and draft phases receive useful non-gate completion types.
- `playspec log` shows completion events newest-first.
- `playspec show-completion <id>` prints the markdown file content or path.
- Existing rollback behavior continues to work.
- Existing evidence and snapshot files are still created.
- Existing tests for `complete`, `rollback`, `evidence`, and `snapshot` continue to pass.
- New tests cover normal completion, gate completion, revision loop completion, final task completion, and markdown/index consistency.

## Implementation Notes

Likely files to inspect or modify:

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/index.ts`
- new `src/cli/commands/log.ts`
- new `src/cli/commands/show-completion.ts`
- tests around `completePhase()` and CLI logging

Keep Core task-explicit. CLI may resolve `.playspec/HEAD`, but Core APIs should receive explicit `taskId`.
