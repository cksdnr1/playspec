# Issue 45 - Phase 5 Archive Storage And Close Technical Spec

## Scope

Implement only PlaySpec Update 5 / Phase 5: completed active tasks can be explicitly closed into canonical archive storage.

In scope:

- `.playspec/tasks/archived/{taskId}/` canonical archived task roots.
- Active and archived task path helpers.
- `TaskStore` and `YamlTaskStore` APIs: `getArchivedTask(taskId)` and `archiveCompletedTask(taskId)`.
- `PlaySpecCore` archive/close method that delegates storage mutation without CLI coupling.
- One CLI command path: `playspec close --task <taskId>`.
- Tests for archive success, active-task rejection, destination collision, active lookup isolation, MCP non-expansion, no archive list/show commands, and unchanged prompt/context behavior.

Out of scope:

- Archive list/show/inspection.
- Restore/unarchive.
- MCP archived lookup tools.
- Archive-aware `contextRefs`.
- Evolution proposals, viewer, DAG, harness, token modes, or later phase work.
- Migration-local `archive_file` behavior changes.

## Use Case Alignment

A user finishes a PlaySpec task through the existing workflow and then explicitly removes it from the active task store while preserving all task artifacts. The source of truth remains the archived task directory and `task.yaml`; no archive index is introduced in this phase.

## Current Implementation Summary

Current task storage is active-root only. `YamlTaskStore` reads and writes `.playspec/tasks/active/{taskId}/task.yaml`; `listActiveTasks()` and `listCompletedTasks()` scan the active root. `TaskStatus` and `TaskRecordSchema` already allow `archived`, but no general archive movement API exists.

CLI command registration is centralized in `src/cli/index.ts`, with command adapters under `src/cli/commands/`. Core logic lives in `PlaySpecCore`, and storage is abstracted through `TaskStore`. MCP currently registers active/completed task tools only and resolves task context through `resolveMcpTaskId()`.

## Relevant Files Reviewed

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md`
- `src/utils/paths.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/core/active-task-resolver.ts`
- `src/cli/index.ts`
- `src/mcp/server.ts`
- `tests/integration/task-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`

## Active Entry Points And Bypasses

Verified active paths:

- Human CLI active lookup: command adapter -> `ActiveTaskResolver` where appropriate -> `TaskStore.getTask()`.
- Core prompt/completion paths: `PlaySpecCore` -> active `TaskStore.getTask()`.
- MCP paths: `buildMcpServer()` -> `resolveMcpTaskId()` for context-bearing tools -> active task/core APIs.
- Migration archive path: `src/migration/*` moves arbitrary files under `.playspec/migrations/archived`; this is separate and must remain unchanged.

Bypasses and partial migrations:

- Direct edits under `.playspec/tasks/*` can bypass validation.
- `TaskStatus` includes `archived`, but no archived root or API exists.
- Existing `getTask()` must remain active-only so archived tasks do not affect active resolution.

## Current Architecture

Verified flow:

```text
CLI command
  -> command adapter
  -> ActiveTaskResolver when HEAD fallback is allowed
  -> PlaySpecCore
  -> TaskStore
  -> .playspec/tasks/active/{taskId}/task.yaml
```

Proposed Phase 5 close flow:

```text
playspec close --task <taskId>
  -> runClose()
  -> PlaySpecCore.closeTask(taskId)
  -> TaskStore.archiveCompletedTask(taskId)
  -> rename active task root to .playspec/tasks/archived/{taskId}
  -> update task.yaml status=archived and paths.taskRoot archived path
```

## Verified Behavior

- Active task creation writes task artifacts under `.playspec/tasks/active/{taskId}/`.
- `completePhase()` sets task status to `completed` only when no next phase remains.
- Active prompt rendering validates existing `contextRefs` as workspace-relative paths and should remain unchanged.
- MCP tools currently include task list/get/session/prompt/complete/evidence/desync/rollback-state; no archive-specific tool exists.
- CLI has no `close`, `archive list`, or `archive show` command.

## Problems

1. Completed tasks cannot be moved out of active storage through a validated API.
2. Path helpers assume `.playspec/tasks/active` is the only task root.
3. `TaskStore` has no explicit archived task read API.
4. `getTask()` and active resolvers would risk ambiguity if archive lookup were mixed into active reads.

## Proposed Direction

Add explicit archived path helpers and keep active helpers backward-compatible. Implement `archiveCompletedTask()` as an atomic-enough filesystem move with preflight checks:

- Load active task through `getTask(taskId)`.
- Require `status === "completed"`.
- Require active source exists and archived destination does not exist.
- Rename active directory to archived destination.
- Rewrite archived `task.yaml` with `status: archived`, updated `updatedAt`, and `paths.taskRoot: .playspec/tasks/archived/{taskId}`.
- Return the validated archived `TaskRecord`.

Add `getArchivedTask(taskId)` that reads only from the archived root and validates with `TaskRecordSchema`.

Add `PlaySpecCore.closeTask(taskId)` as the core API. Add `playspec close --task <taskId>` as the only user-facing command in this phase.

## File-By-File Plan

- `src/utils/paths.ts`: add `getActiveTasksRoot()`, `getActiveTaskRoot()`, `getArchivedTasksRoot()`, and `getArchivedTaskRoot()`. Preserve `getTasksRoot()` and `getTaskRoot()` as active aliases for compatibility.
- `src/storage/task-store.ts`: add `getArchivedTask()` and `archiveCompletedTask()`.
- `src/storage/yaml-task-store.ts`: implement archived read and close/archive movement.
- `src/core/playspec-core.ts`: add `closeTask(taskId)`.
- `src/cli/commands/close.ts`: add a narrow command adapter.
- `src/cli/index.ts`: register `close --task <id>` only.
- `tests/integration/task-store.test.ts`: storage archive success, rejection, collision, active lookup isolation.
- `tests/integration/init-create-next.test.ts`: CLI close path and no archive list/show command surface.
- `tests/integration/mcp-server.test.ts`: no archive lookup tool registration regression.

## Risks And Open Questions

- If updating `task.yaml` after directory rename fails, files have already moved. The implementation should preflight as much as possible and use the same existing filesystem primitives as the rest of the store.
- `HEAD` may still point at a closed task. This phase does not define HEAD cleanup or selection behavior; active commands should fail through existing active lookup semantics after close.
- Archive listing is deliberately deferred to Phase 5.1, so tests should assert no list/show archive commands are introduced.

## Reader Aids

- "Active lookup" means `getTask()`, `ActiveTaskResolver`, normal CLI task commands, prompt rendering, and MCP task tools that currently operate on active task records.
- "Archived lookup" means only `getArchivedTask()` and the result returned by `archiveCompletedTask()` in this phase.
