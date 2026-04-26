# ux update copy and head - Handoff

## Feature Summary

This feature is a CLI UX and reliability update. It should make HEAD/current-task context more visible, make context linking safer for humans, and make prompt copy/output reliable in environments without clipboard tools.

The source problem file is `.playspec/tasks/active/ux_update_copy_and_head/sources/source_problem.md`.

## Scope

This handoff covers the next implementation phase for CLI UX and copy reliability only. It should not introduce MCP HEAD fallback, Core global HEAD reads, viewer behavior, migration changes, rollback/archive changes, or unrelated workflow changes.

## Use Case Alignment

The intended user experience is that human CLI users can identify the current HEAD task from list output, inspect linked docs from current-task output, safely add context to the HEAD task after confirmation, see the phase `next` is about to render, and always recover the rendered prompt even when clipboard access is unavailable.

## Locked File Set

Files expected to be edited in the next phase:
- `src/cli/index.ts`
- `src/cli/commands/add-context.ts`
- `src/cli/commands/list.ts`
- `src/cli/commands/list-tasks.ts`
- `src/cli/commands/current.ts`
- `src/cli/commands/current-task.ts`
- `src/cli/commands/next.ts`
- `src/utils/clipboard.ts`
- `tests/cli.test.ts`

Files that may be edited only if needed for clean reuse/testing:
- `src/cli/context-header.ts`
- `src/core/errors.ts`
- `src/utils/fs.ts`
- `src/utils/paths.ts`

Files that should not be edited for this feature:
- `src/mcp/**`, except tests proving MCP still has no HEAD fallback if existing coverage is insufficient.
- `src/core/playspec-core.ts`, unless adding an explicit-task-id read helper is clearly necessary.
- Migration, rollback, viewer, preset assets, and workflow definitions.

## Verified Facts

Verified code behavior:
- `add-context` currently requires `--task <id>` at CLI registration, blocking the requested omitted-task interactive path (`src/cli/index.ts:144`).
- `runAddContext()` mutates context refs through `PlaySpecCore.addContextRef()` with an explicit task id (`src/cli/commands/add-context.ts:4`).
- `PlaySpecCore.addContextRef()` validates path safety/existence, detects duplicates, and updates `contextRefs` (`src/core/playspec-core.ts:75`).
- `list` and `list-tasks` do not read HEAD and do not mark the current task (`src/cli/commands/list.ts:3`, `src/cli/commands/list-tasks.ts:5`).
- `current` prints basic HEAD task fields only (`src/cli/commands/current.ts:4`).
- `current-task` prints phase title when resolvable and a context ref count, not paths (`src/cli/commands/current-task.ts:5`).
- `next` supports `--copy` and `--write`, but not `--out` (`src/cli/index.ts:169`).
- `runNext()` prints the compact context header, checks desync, renders the prompt, then handles copy/stdout/write (`src/cli/commands/next.ts:12`).
- `copyToClipboard()` only calls `clipboardy.write()` (`src/utils/clipboard.ts:3`).
- MCP uses `resolveMcpTaskId()` and does not read `.playspec/HEAD` (`src/mcp/context.ts:4`).

Inferred behavior:
- The existing boolean clipboard utility gives too little detail for good UX messages and backend-specific testing.
- The existing `--write` prompt snapshot path can be reused as inspiration for automatic fallback files, but user-facing `--out` needs a specific file path.
- The current/current-task distinction is user-visible but underspecified.

Finalized patch decisions:
- `add-context` omitted-task confirmation is allowed only when `process.stdin.isTTY === true`, `process.stdout.isTTY === true`, `process.env.CI` is unset, and `PLAY_SPEC_NON_INTERACTIVE` is unset or explicitly `0`/`false`.
- Non-interactive omitted-task `add-context` must fail before reading HEAD or mutating state and must tell the user to pass `--task <id>`.
- Confirmation accepts only `y` or `yes`, case-insensitive after trimming. Everything else cancels without mutation.
- `current` is the compact view. `current-task` is the rich view. Both show context paths when present; `current-task` additionally shows role/source/path detail and docs root.
- `list` and `list-tasks` use `[HEAD]` as the stable marker. Missing or stale HEAD omits the marker; any warning must be stderr-only and non-fatal.
- `--out <file>` resolves relative paths against the workspace. User-provided absolute paths are allowed only after normalization and escape/symlink validation. Create parent directories.
- `--write` remains a task-local snapshot. `--out` is user-selected output. If both are supplied, write both.
- OSC52 is TTY-only and best-effort. Do not claim success unless the backend reports it; fall through to file fallback when needed.
- Platform clipboard commands need timeout, stdin close, and handled child pipe errors.
- Process stdout `EPIPE` must be handled in CLI bootstrap or a shared safe writer, not only in `src/utils/clipboard.ts`.

## Control Flow

Current `add-context --task` path:
- CLI parses `add-context <file> --task <id>`.
- `runAddContext()` constructs `YamlTaskStore` and `PlaySpecCore`.
- `PlaySpecCore.addContextRef(taskId, filePath)` validates the path and reads the task.
- Existing `contextRefs` are checked for a normalized duplicate.
- `YamlTaskStore.updateTask()` persists the new ref.
- CLI prints `Context linked.` or `Context already linked.`

Proposed omitted-task path:
- CLI parses `add-context <file>` with no `--task`.
- If not interactive by the finalized detector above, fail before HEAD read or mutation with a clear "pass --task <id>" hint.
- If interactive, resolve HEAD through `ActiveTaskResolver` in CLI code.
- Print task id/title and normalized file path.
- Ask for confirmation.
- On yes, call `PlaySpecCore.addContextRef(resolvedTask.id, filePath)`.
- On no, exit without mutation.

Current `next --copy` path:
- CLI resolves task through explicit `--task` or HEAD.
- Header/desync output happens before prompt render.
- Prompt render uses `PlaySpecCore.renderNextPrompt(task.id)`.
- `copyToClipboard(prompt)` attempts `clipboardy.write()`.
- On false, CLI prints the full prompt to stdout.
- `--write` writes a timestamped prompt under the task prompts directory after copy/stdout handling.

Proposed `next` output path:
- Resolve task and resolved upcoming phase in CLI/Core explicit-task-id code.
- Render prompt.
- If `--out` is present, write the prompt to that file.
- If `--copy` is present, attempt clipboard backends in order.
- If copy fails and no `--out` was supplied, write an automatic fallback file.
- Print concise status lines naming the phase, copy method/failure, and output path.

Final `next` stream contract:
- Plain `next` prints the existing compact header unless `--quiet`, the resolved phase line, then the full prompt to stdout.
- `next --quiet` suppresses only the compact header; it still prints the resolved phase line and prompt.
- `next --out <file>` prints status lines only to stdout, including resolved phase and `Prompt written: <path>`. It must not print the full prompt.
- `next --copy` success prints status lines only to stdout, including resolved phase and copy method. It must not print the full prompt.
- `next --copy` failure prints status lines only to stdout, prints an expected clipboard warning to stderr, writes `.playspec/tasks/active/<task>/prompts/next-prompt-<timestamp>.md`, and prints that fallback path. It must not dump the full prompt.
- `next --copy --out <file>` always writes `--out`; clipboard failure is a warning and does not require an extra fallback file.
- `--write` is independent and may be combined with any of the above.
- Desync warnings and fatal errors remain stderr/error-channel concerns according to existing CLI patterns; `--quiet` must not suppress warnings or required output/fallback paths.

## Current Architecture

The current architecture keeps HEAD resolution in the CLI layer through `ActiveTaskResolver`, keeps task persistence behind `YamlTaskStore`, and keeps prompt rendering/context mutation in `PlaySpecCore` with explicit task ids. User-visible CLI output is printed directly by command functions; there is no event or callback propagation layer for this feature.

## Constraints

Hard constraints from project instructions:
- Do not implement future phases.
- MCP context resolution must use `resolveMcpTaskId()` and must never call `ActiveTaskResolver` or read `.playspec/HEAD`.
- Core logic must not rely on global HEAD.
- Human CLI may resolve HEAD, but Core must receive explicit `taskId` where possible.
- Do not couple Core logic to CLI.
- Do not perform destructive git operations.
- Do not delete files outside `.playspec`.
- Use path aliases for cross-module imports; avoid `../../` across module boundaries.

Feature constraints:
- `playspec add-context <file> --task <id>` must remain supported for scripts.
- Non-interactive omitted-task `add-context` must fail clearly.
- Interactive omitted-task `add-context` must print task id/title and file path, then confirm before mutation.
- `playspec next --copy` must not crash when clipboard tools are unavailable.
- Clipboard fallback order is native library, platform command, OSC52, file fallback.
- `playspec next --out <file>` and `playspec next --copy --out <file>` must be supported.
- `playspec next | head` must exit cleanly on stdout `EPIPE`. Only `EPIPE` should be swallowed; other stream errors remain failures.

## Active Entry Points

- `src/cli/index.ts`
  - `add-context <file>`
  - `next`
  - `list`
  - `list-tasks`
  - `current`
  - `current-task`

- `src/cli/commands/*.ts`
  - `runAddContext()`
  - `runNext()`
  - `runList()`
  - `runListTasks()`
  - `runCurrent()`
  - `runCurrentTask()`

- `src/utils/clipboard.ts`
  - `copyToClipboard()`

- `src/core/active-task-resolver.ts`
  - CLI-only task resolution via explicit id or `.playspec/HEAD`.

- `src/core/playspec-core.ts`
  - `renderNextPrompt(taskId)`
  - `addContextRef(taskId, contextPath)`

## Bypasses and Alternate Paths

- Explicit `--task <id>` bypasses HEAD and should remain the automation path.
- `get-task` is intentionally explicit-task-only and should not gain HEAD behavior.
- MCP has its own session/task context path and must not use HEAD.
- `status` already provides a richer task view but is not a substitute for source-requested `current/current-task` updates.
- `--quiet` bypasses the compact header on `next`, but should not suppress warnings or required status lines about output files if those are necessary for reliability.
- `--write` remains a task-local prompt snapshot behavior and should not be silently repurposed into `--out`.

## Problems

- HEAD is not visible in list output.
- Linked docs/context paths are not visible from current/current-task output.
- Omitted-task `add-context` cannot reach an interactive confirmation path because Commander requires `--task`.
- `next` does not support `--out`.
- `next --copy` uses only `clipboardy` and has no platform command, OSC52, or file fallback.

## Proposed Direction

Keep the implementation in CLI command modules plus `src/utils/clipboard.ts`. Add minimal helpers only where they reduce duplication, preserve explicit task-id Core calls, and keep MCP untouched. Add focused CLI tests for output and mutation behavior plus clipboard tests that avoid depending on the host clipboard. Add CLI-level stdout `EPIPE` handling in `src/cli/index.ts` or route command output through a shared safe writer; do not treat clipboard utility changes as sufficient for process-level pipe closure.

## Resolved Validation Issues

- `current`/`current-task` distinction is no longer open: compact versus rich.
- `--out <file>` path policy is no longer open: workspace-relative by default, normalized absolute user paths allowed with escape validation and parent directory creation.
- Fallback filename is no longer open: task-local `prompts/next-prompt-<timestamp>.md`.
- OSC52 policy is no longer open: TTY-only, best-effort fallback.
- `add-context` yes parsing is no longer open: only `y`/`yes`.
- `next --copy` output behavior is no longer open: do not dump prompt on copy failure; write a durable fallback path and report it.

## Remaining Blockers

None after this patch, assuming the next implementation follows the finalized non-interactive detector, `next` stream contract, and CLI-level stdout `EPIPE` handling.

## Next Phase Goal

Implement the narrow CLI UX update and copy hardening described in the technical spec:
- HEAD marker in list commands.
- Context/docs visibility in current commands.
- Interactive, confirmed HEAD fallback for `add-context`.
- Resolved phase visibility for `next`.
- Durable prompt output through `--out` and file fallback.
- Ordered clipboard fallback without crashes.
- Focused Vitest coverage and build validation.

## Risks and Test Focus

Primary risks:
- Interactive confirmation changing script behavior if non-interactive detection is loosened.
- Host-dependent clipboard tests becoming flaky unless backends are injected or mocked.
- Output ordering regressions around `next` header/desync/prompt rendering and the new status-only modes.
- Accidentally moving HEAD resolution into Core or MCP.
- Duplicating phase resolution for the resolved phase line; prefer an explicit-task-id read-only helper or a single render pipeline source.
- Clipboard platform command fallback hanging if timeout/stdin close is missed.

Recommended test focus:
- Non-interactive `add-context` omitted `--task` fails.
- Interactive omitted `--task` confirms before mutation and cancellation leaves task unchanged.
- Explicit `--task` still works without confirmation.
- `list` and `list-tasks` mark HEAD and tolerate missing/stale HEAD.
- `current` and `current-task` show context paths when present.
- `next --out` writes exact content.
- `next --copy --out` writes even when copy succeeds or fails.
- `next --copy` failure writes fallback file and does not print the full prompt to stdout.
- `next --out` does not print the full prompt to stdout.
- CLI stdout `EPIPE` is handled cleanly for downstream pipe closure.
- Clipboard fallback can be tested with injected/mocked backend behavior rather than real system clipboard.
- MCP tests continue to reject missing `taskId`/session context without reading HEAD.

## Reader Aids

- HEAD means `.playspec/HEAD`, the CLI-side current task pointer.
- Context refs are `TaskRecord.contextRefs[]` entries with `path`, `role`, and `source`.
- Resolved phase means the phase selected by workflow state for prompt rendering.
- `--write` is the existing task-local prompt snapshot behavior; `--out` is the proposed user-selected output file behavior.
