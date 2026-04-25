# PlaySpec Phase 3.5 Handoff

## Phase summary

Dev Phase `3.5` adds compact task visibility to the CLI. The visible behavior is a short Context Header for `playspec next`, `playspec status`, and `playspec complete`, plus `--quiet` suppression for scripts.

This is presentation-layer work. It must not introduce project-level state, Task Relay, context auto-binding, conditional routing, MCP, viewer, archive, harness, or attempt tracking.

## Current goal

Make the active task and current workflow phase obvious before the user reads a prompt or completes a phase.

The header must be derived only from task YAML / the resolved `TaskRecord`. Optional fields such as attempts, target phase, and `contextRefs` may be shown only when supported and present. Do not invent them.

## Locked file set

### must-read

- `docs/playspec_phase_plan.md`
- `docs/playspec_total_spec.md`
- `src/cli/index.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/complete.ts`
- `src/cli/commands/current.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `tests/cli.test.ts`

### maybe-read

- `src/core/active-task-resolver.ts`
- `src/core/playspec-core.ts`
- `src/workflow/phase-resolver.ts`
- `src/workflow/workflow-loader.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/task-store.test.ts`

### ignore-for-now

- `src/template/**`
- `src/preset/**` except fixture setup if needed by tests
- `src/core/rollback-manager.ts`
- `src/core/state-desync-detector.ts`
- `src/cli/commands/evidence.ts`
- `src/cli/commands/snapshot.ts`
- MCP, archive, viewer, evolution, harness, DAG files

## Verified facts

- `src/cli/index.ts` registers `next`, `phase`, `complete`, `evidence`, `snapshot`, `desync-check`, and `rollback`.
- `src/cli/index.ts` does not register `status`.
- `src/cli/commands/current.ts` is the closest existing status-style command.
- `runNext()` resolves a task, runs the Phase `3` high-desync check, renders the prompt, prints the prompt, and optionally writes a prompt file.
- `runComplete()` resolves a task, calls `PlaySpecCore.completePhase()`, then prints completion result lines.
- `next` and `complete` do not support `--quiet`.
- `TaskRecord` has task title and current phase data.
- `TaskRecord` does not currently include attempt, target, or `contextRefs`.
- `YamlTaskStore.getTask()` validates through `TaskRecordSchema.parse(raw)`.
- `YamlTaskStore.saveTask()` writes validated task records.

## Key control flow

### `playspec next`

1. CLI parses `next --task --write`.
2. `runNext()` creates `YamlTaskStore`.
3. `ActiveTaskResolver.resolveTask()` resolves explicit task or `.playspec/HEAD`.
4. `runNext()` rejects HEAD-based completed tasks.
5. `PlaySpecCore.checkTaskDesync()` runs.
6. High desync warning is printed when applicable.
7. `PlaySpecCore.renderNextPrompt()` renders prompt.
8. Prompt is printed.

Phase `3.5` insertion point: print compact header after task resolution and before prompt output. Keep high-desync warning visible.

### `playspec complete`

1. CLI parses `complete --task --with-review`.
2. `runComplete()` resolves explicit task or `.playspec/HEAD`.
3. `PlaySpecCore.completePhase()` mutates phase state and writes artifacts.
4. Completion summary is printed.

Phase `3.5` insertion point: print compact header after task resolution and before `completePhase()` mutates state.

### `playspec status`

Current code has no `status` command. `current` prints ID/title/workflow/status/phase.

Phase `3.5` needs a real `status` command or an explicit alias/delegation decision. The phase plan names `playspec status`, so the implementation target should be a registered command.

## Known constraints

- Header source must be task YAML only.
- No project-level state.
- No `project.yaml`.
- Do not implement Phase `3.6` `create --phase`, `--from`, smart binding, or missing-context guards.
- Do not implement Phase `3.7` result routing.
- Do not move header rendering into Core prompt rendering; Core should stay CLI-agnostic.
- `--quiet` suppresses the Context Header only.
- Errors and Phase `3` desync warnings must remain visible.

## Active entry points

- `src/cli/index.ts` `program.command('next')`
- `src/cli/commands/next.ts` `runNext()`
- `src/cli/index.ts` `program.command('complete')`
- `src/cli/commands/complete.ts` `runComplete()`
- new `src/cli/commands/status.ts` `runStatus()` expected
- existing `src/cli/commands/current.ts` `runCurrent()`

## Possible bypasses

- `playspec current` can remain a legacy detail path. It should not contradict `status`.
- `playspec phase` is not in Phase `3.5` scope and may continue rendering without a header.
- Direct `PlaySpecCore.renderNextPrompt()` callers get prompt only; that is acceptable because the header is CLI presentation.
- Direct `PlaySpecCore.completePhase()` callers get structured results only; that is acceptable for Core.

## Phase outcome at a glance

### After this phase, you can

- Run `playspec next` and see a compact task header before prompt output.
- Run `playspec status` and see the compact header plus fuller task detail.
- Run `playspec complete` and see which task/phase is about to be completed.
- Use `--quiet` to suppress the header for script-friendly output.

### After this phase, you still cannot

- Auto-link planning context.
- Enforce missing `contextRefs` guards.
- Record attempts.
- Route by completion result.
- Use MCP or viewer status surfaces.
- See a multi-task dashboard.

## Enabled use cases

- Reviewer can identify task title and phase before reading `next` output.
- User can confirm task identity before `complete` mutates state.
- Script can call `next --quiet` and receive prompt output without added header lines.
- User can call `status` for more detail without opening `task.yaml`.

## Still-blocked or deferred use cases

- Showing `Target:` requires task state support for `target`.
- Showing `Context:` requires task state support for `contextRefs`.
- Showing attempt count requires task state support for attempt data.
- Auto-populating target/context belongs to Phase `3.6`.
- Attempt recording belongs to later retry/harness phases.

## Concrete testable outcomes

| Scenario | Entry point | Expected result |
|---|---|---|
| Header on next | `playspec next` | stdout includes compact `Task:` and `Phase:` lines before rendered prompt |
| Quiet next | `playspec next --quiet` | stdout includes prompt and omits compact header |
| Desync coexistence | `playspec next` after high desync setup | desync warning and header both appear before prompt |
| Header on complete | `playspec complete` | stdout includes header before `Completed phase ...` |
| Quiet complete | `playspec complete --quiet` | completion result still prints, header omitted |
| Status command | `playspec status` | command exists and prints header plus fuller task detail |
| Optional omission | `playspec status` on normal current schema task | no invented `Target:` or `Context:` line |

## Reviewer demo checklist

- Create or reuse an active task.
- Run `playspec status`.
- Confirm header is at the top and detail follows.
- Run `playspec next`.
- Confirm header appears before prompt content.
- Run `playspec next --quiet`.
- Confirm prompt content remains and header is absent.
- Initialize git if needed, then run `playspec complete`.
- Confirm header appears before completion output.
- Run a separate `complete --quiet` scenario.
- Confirm completion output remains and header is absent.

## Implementation status

**Complete.** All Phase 3.5 acceptance criteria met.

## Migration status

No migrations required. Phase 3.5 adds new CLI presentation layer only; no old paths were migrated or retired.

## Verifier result summary

All 11 spec requirements: done. No partial or missing items.

## Build validation summary

- `npm run build`: **success**
- `npm test`: **81/81 tests pass** (8 new Phase 3.5 tests added)

## Unresolved blockers

None.

## Next-phase readiness

Phase 3.6 can safely begin:

- `status` exists and works.
- `next/status/complete` share `formatContextHeader` from `src/cli/context-header.ts`.
- `--quiet` tested including desync-warning passthrough.
- Header safely omits target/context/attempt (not in schema; formatter only emits `Task:` and `Phase:`).
- No project-level state, no Phase 3.6+ logic, no new schema fields introduced.

## Active entry points and remaining old/bypass paths

| Entry point | Status |
|---|---|
| `playspec next` | uses shared header; `--quiet` wired |
| `playspec complete` | uses shared header; `--quiet` wired |
| `playspec status` | new command; uses shared header; `--quiet` wired |
| `playspec current` | legacy detail command; unchanged; does not conflict with `status` |
| `playspec phase` | no header (out of Phase 3.5 scope); acceptable bypass |
| `PlaySpecCore.renderNextPrompt()` | no header (Core stays CLI-agnostic); acceptable bypass |
