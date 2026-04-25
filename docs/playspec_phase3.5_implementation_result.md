# PlaySpec Phase 3.5 Implementation Result

## Phase summary

Dev Phase 3.5 — Compact Context Header and Task Visibility.

Adds a shared compact Context Header to `playspec next`, `playspec complete`, and the new `playspec status` command. Provides `--quiet` suppression for script-friendly output. Header is derived exclusively from the resolved `TaskRecord` (task.yaml). No Core semantics changed.

---

## Intended scope vs actual scope

| Item | Intended | Actual |
|---|---|---|
| Shared header formatter | yes | yes |
| `--quiet` on `next` | yes | yes |
| `--quiet` on `complete` | yes | yes |
| `status` command | yes | yes |
| `--quiet` on `status` | yes | yes |
| Header before prompt in `next` | yes | yes |
| Header before mutation in `complete` | yes | yes |
| `--quiet` does not suppress desync warning | yes | yes |
| Optional fields (target/contextRefs/attempt) omitted | yes | yes (not in schema; formatter emits only `Task:` and `Phase:`) |
| Phase 3.6+ behavior (smart binding, create --phase) | out of scope | not introduced |
| Phase 3.7+ behavior (result routing) | out of scope | not introduced |
| New task schema fields | out of scope | not introduced |

---

## Changed files

| File | Change |
|---|---|
| `src/cli/context-header.ts` | New. Shared `formatContextHeader(task: TaskRecord): string[]` |
| `src/cli/commands/status.ts` | New. `runStatus()` with header + full detail output |
| `src/cli/commands/next.ts` | Updated: added `quiet?: boolean` param, header block before desync check |
| `src/cli/commands/complete.ts` | Updated: added `quiet?: boolean` param, header block before `completePhase()` |
| `src/cli/index.ts` | Updated: `--quiet` option wired to `next` and `complete`; `status` command registered |
| `tests/cli.test.ts` | Updated: 8 new test cases for Phase 3.5 behaviors |

---

## Changed classes/functions

| Symbol | File | Change |
|---|---|---|
| `formatContextHeader` | `src/cli/context-header.ts` | New. Returns `['Task: <title>', 'Phase: <currentPhase>']` |
| `runStatus` | `src/cli/commands/status.ts` | New. Resolves task, prints header (unless quiet), then ID/Workflow/Status/Created/Updated/Completed phases |
| `runNext` | `src/cli/commands/next.ts` | Added `quiet?: boolean` param; header emitted before desync check and prompt |
| `runComplete` | `src/cli/commands/complete.ts` | Added `quiet?: boolean` param; header emitted before `completePhase()` |
| `program.command('next')` | `src/cli/index.ts` | Added `--quiet` option, wired to `runNext` |
| `program.command('complete')` | `src/cli/index.ts` | Added `--quiet` option, wired to `runComplete` |
| `program.command('status')` | `src/cli/index.ts` | New. Registered with `--task` and `--quiet` options |

---

## Implementation-plan step coverage

| Step | Description | Status |
|---|---|---|
| 1 | Create shared header formatter | done |
| 2 | Add `--quiet` to `next` in index.ts | done |
| 3 | Update `runNext()` with quiet + header | done |
| 4 | Update `runComplete()` with quiet + header | done |
| 5 | Create `status` command | done |
| 6 | Register `status` in index.ts | done |
| 7 | Tests for all new behaviors | done |

---

## Spec coverage before vs after

| Requirement | Before | After |
|---|---|---|
| Header on `next` | missing | done |
| `--quiet` on `next` | missing | done |
| Header on `complete` | missing | done |
| `--quiet` on `complete` | missing | done |
| `status` command | missing | done |
| `--quiet` on `status` | missing | done |
| `--quiet` does not suppress desync warning | missing (no test) | done |
| Optional fields omitted when absent | missing | done |
| Shared formatter | missing | done |

---

## Build/compile validation summary

- Command: `npm run build` (tsc + tsc-alias + asset copy)
- Target: full project
- Result: **success** — no errors
- Blocking: no

---

## Test results

- Command: `npm test` (vitest run)
- All 81 tests pass (11 test files)
- 8 new Phase 3.5 tests in `tests/cli.test.ts`
- All pre-existing tests continue to pass

---

## End-to-end validation result

| Check | Status |
|---|---|
| Active entry point exists (`status` registered) | pass |
| `next` active path uses header formatter | pass |
| `complete` active path uses header formatter | pass |
| `--quiet` suppresses header only (not errors/warnings) | pass |
| Desync warning visible under `--quiet` | pass |
| Header derived from `TaskRecord` only | pass |
| Old/bypass paths (`current`, `phase`) unchanged | pass |
| No new task schema fields | pass |
| No Phase 3.6+ logic introduced | pass |
| Build validation succeeds | pass |
| All tests pass | pass |

---

## Remaining old/bypass/partial path issues

None. `playspec current` remains as a legacy detail command and does not conflict with `status`. `playspec phase` renders without a header per spec (Phase 3.5 names only `next/status/complete`). Direct `PlaySpecCore.renderNextPrompt()` callers receive prompt only; this is correct (header is CLI presentation only).

---

## Unresolved blockers or ambiguities

- The phase plan example shows `Phase: 2 / 5`, but the "task.yaml only" rule means total phase count is not available without reading workflow data. Implemented as `Phase: 2` (current phase only). This matches the "smallest safe fix" from the spec's risk section.
- `playspec current` stays as a legacy focused command. Outputs do not conflict with `status` (both show phase; `status` adds workflow/timestamps/completed-phases).

---

## Intentionally deferred items

- `Target:` and `Context:` header lines deferred to Phase 3.6 (requires `target.phaseNumber` and `contextRefs` schema fields, which Phase 3.6 introduces).
- Attempt count display deferred to later retry/harness phases.
- `Phase: N / total` format deferred until total phase count is available from task state.

---

## Next-phase readiness recommendation

Phase 3.6 can safely begin. All Phase 3.5 acceptance criteria are met:

- `status` exists and shows compact header + detail.
- `next`, `complete`, and `status` share the same formatter.
- `--quiet` suppression is tested including the desync warning passthrough case.
- No project-level state, no Phase 3.6+ binding logic, no new schema fields introduced.

---

## Deviations from spec

None. Implementation follows the spec and handoff exactly.
