# List Tasks Uninitialized Hint Spec

## Scope

Fix one first-run CLI usability bug: `playspec list-tasks` must not report `No active tasks.` when the current directory has not been initialized with `.playspec`.

In scope:
- Detect an uninitialized workspace before listing tasks.
- Reuse the existing `WorkspaceNotInitializedError` message and hint.
- Add a CLI regression test for the real user-visible command path.

Out of scope:
- Changing task storage semantics.
- Changing `YamlTaskStore` list behavior for internal callers.
- Changing task-link behavior or recent lightweight task-link documentation.
- Adding viewer, MCP, migration, rollback, archive, or evolution behavior.

## Use Case

A new user may run `playspec list-tasks` to inspect work before remembering to run `playspec init --preset default`. Today, from a directory without `.playspec`, the command prints:

```text
No active tasks.
```

That is misleading because the workspace is not initialized. The CLI should instead tell the user the workspace is missing and give the existing recovery command:

```text
Run `playspec init --preset default` to initialize the workspace.
```

## Current Behavior

Observed from an uninitialized temporary directory:

```text
$ playspec list-tasks
No active tasks.
```

Root cause:
- `src/cli/commands/list-tasks.ts` constructs `YamlTaskStore` and calls `listActiveTasks()`.
- `YamlTaskStore.listActiveTasks()` returns an empty list when the active task directory cannot be read.
- That empty result is correct for internal tolerance of missing task directories, but at the CLI boundary it hides the difference between "initialized with zero active tasks" and "not initialized".

## Acceptance Criteria

- In an uninitialized directory, `playspec list-tasks` exits non-zero.
- The error includes `Workspace not initialized at:`.
- The hint includes `Run \`playspec init --preset default\` to initialize the workspace.`
- In an initialized workspace with zero active tasks, `playspec list-tasks` still exits zero and prints `No active tasks.`
- Existing initialized list behavior, HEAD marking, phase display, and read-only behavior remain unchanged.

## Relevant Files

- `src/cli/commands/list-tasks.ts`
- `src/core/errors.ts`
- `src/utils/paths.ts`
- `tests/cli.test.ts`

## Quality Gate

Pre-implementation score: 96/100.

Rationale:
- The problem is a concrete user-facing first-run failure.
- The change has one CLI entry point and a narrow acceptance contract.
- Existing error type and hint avoid new copy or architecture.
- Testing can validate the command path exactly as a user invokes it.

