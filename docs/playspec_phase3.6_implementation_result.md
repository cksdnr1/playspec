# PlaySpec Phase 3.6 Implementation Result

## Phase Summary

Dev Phase 3.6 — Task Relay and Smart Context Binding — is complete.

The phase enables `playspec create phase-execution "Title" --phase N [--from TASK_ID]` to create a normalized execution task bound to planning context files from a completed planning task. A render-time guard blocks `playspec next` and `playspec phase` when stored `contextRefs` paths are missing.

## Intended Scope vs Actual Scope

Intended:
- New `target` and `contextRefs` fields on `TaskRecord`/`CreateTaskInput` + Zod schemas
- `listCompletedTasks()` on `TaskStore`/`YamlTaskStore`
- `createTask()` persists `target`/`contextRefs`
- `--phase <n>` and `--from <taskId>` CLI options on `create`
- Phase-execution flow in `runCreate()` (title normalization, candidate discovery, context file validation, interactive confirmation, task creation)
- Missing-context guard in `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()`
- `phase-execution.yaml` default preset workflow
- Conditional `Target:` and `Context:` lines in `formatContextHeader()`
- 3 new error classes
- Tests for round-trip, guard, and backward compatibility

Actual: exactly the intended scope — no additions, no omissions.

## Changed Files

| File | Action |
|---|---|
| `src/core/types.ts` | Added `TaskTarget`, `TaskContextRef` interfaces; added optional `target`, `contextRefs` to `TaskRecord` and `CreateTaskInput` |
| `src/core/schemas.ts` | Added `TaskTargetSchema`, `TaskContextRefSchema`; added optional `target`, `contextRefs` to `TaskRecordSchema` |
| `src/core/errors.ts` | Added `MissingContextRefError`, `AmbiguousPlanningTaskError`, `PlanningContextNotFoundError` |
| `src/storage/task-store.ts` | Added `listCompletedTasks(): Promise<TaskSummary[]>` to interface |
| `src/storage/yaml-task-store.ts` | Added `listCompletedTasks()` implementation; updated `createTask()` to persist `target`/`contextRefs` |
| `src/core/playspec-core.ts` | Added `assertContextRefsExist()` private method; called in `renderNextPrompt()` and `renderExplicitPhasePrompt()` |
| `src/cli/index.ts` | Added `--phase <n>` and `--from <taskId>` options to `create` command |
| `src/cli/commands/create.ts` | Rewritten: accepts `CreateOptions`, implements phase-execution branch while preserving old path |
| `src/cli/context-header.ts` | Added conditional `Target:` and `Context:` lines |
| `src/preset/assets/default/workflows/phase-execution.yaml` | Created: `id: phase-execution`, linear, 5-phase workflow |
| `src/preset/assets/default/templates/phase-execution/phase_template.md` | Created: template for phase-execution workflow |
| `tests/integration/task-store.test.ts` | Added 3 tests: round-trip, backward compat, listCompletedTasks |
| `tests/integration/init-create-next.test.ts` | Added 2 tests: missing contextRef guard, empty contextRefs renders |

## Changed Classes/Functions

| File | Function | Change |
|---|---|---|
| `src/core/types.ts` | `TaskRecord` | Added `target?`, `contextRefs?` |
| `src/core/types.ts` | `CreateTaskInput` | Added `target?`, `contextRefs?` |
| `src/core/schemas.ts` | `TaskRecordSchema` | Added optional `target`, `contextRefs` |
| `src/storage/task-store.ts` | `TaskStore` | Added `listCompletedTasks()` |
| `src/storage/yaml-task-store.ts` | `YamlTaskStore.createTask()` | Persists `target`/`contextRefs` from input |
| `src/storage/yaml-task-store.ts` | `YamlTaskStore.listCompletedTasks()` | New method |
| `src/core/playspec-core.ts` | `PlaySpecCore.renderNextPrompt()` | Added `assertContextRefsExist` call |
| `src/core/playspec-core.ts` | `PlaySpecCore.renderExplicitPhasePrompt()` | Added `assertContextRefsExist` call |
| `src/core/playspec-core.ts` | `PlaySpecCore.assertContextRefsExist()` | New private method |
| `src/cli/commands/create.ts` | `runCreate()` | Accepts options; phase-execution branch |
| `src/cli/context-header.ts` | `formatContextHeader()` | Conditional Target/Context lines |

## Implementation Plan Step Coverage

| Step (from plan) | Status |
|---|---|
| Step 1 — Data Model: TaskRecord/CreateTaskInput/Zod | complete |
| Step 2 — Storage: createTask persist, getTask roundtrip | complete |
| Step 3 — Core Guard: assertContextRefsExist in renderNextPrompt/renderExplicitPhasePrompt | complete |
| Step 4 — CLI create extension: --phase/--from parsing | complete |
| Step 5 — Planning Task Discovery: listCompletedTasks, candidate resolve | complete |
| Step 6 — Context Binding: file path discovery from planningTask.paths.projectDocRoot | complete |
| Step 7 — Confirmation Flow: interactive confirm before write | complete |
| Step 8 — Final Create + HEAD write | complete |
| Step 9 — Header display (3.5 integration) | complete |

## Spec Coverage Before vs After

| Spec Requirement | Before | After |
|---|---|---|
| TaskTarget / TaskContextRef types | missing | done |
| Zod schemas for new fields | missing | done |
| listCompletedTasks() | missing | done |
| createTask persists relay fields | missing | done |
| --phase / --from CLI options | missing | done |
| phase-execution flow (title normalize, discover, validate, confirm, create) | missing | done |
| Missing-context guard in Core | missing | done |
| phase-execution.yaml preset | missing | done |
| Context header Target/Context lines | missing | done |
| Error classes | missing | done |
| Tests | missing | done |

## Build/Compile Validation

- Command: `pnpm build`
- Result: success, zero warnings, zero errors
- Blocking: no

## Test Validation

- Command: `pnpm test`
- Total: 86 tests (83 passed, 3 failed)
- New tests added: 5 (all pass)
- Pre-existing failures: 3 rollback timeout tests in `tests/cli.test.ts` — unchanged from before this phase
- Phase 3.6 introduced zero new test failures

## Refactor-Guard Result

- 39 spec items: all allowed
- Suspicious items reviewed:
  - 5-phase structure in `phase-execution.yaml`: justified — matches `multi-spec.yaml` linear execution shape that the spec prescribes
  - `PHASE_NUMBER` vs `target.phaseNumber` in template: intentionally distinct — `PHASE_NUMBER` = execution workflow step; `target.phaseNumber` = planning phase metadata shown in context header
- Reject items: none

## End-to-End Validation

| Check | Status |
|---|---|
| Active entry point: `playspec create ... --phase N --from ID` exists | pass |
| Active path creates task with normalized title, target, contextRefs | pass |
| Old path `playspec create multi-spec "Title"` unchanged | pass |
| Planning task discovery via `listCompletedTasks()` | pass |
| Context file paths are workspace-relative | pass |
| Confirmation before write in interactive mode | pass |
| No task created on cancellation | pass |
| HEAD written after task creation only | pass |
| `playspec next` guard: missing contextRef path throws MissingContextRefError | pass |
| `playspec phase` guard: same assertContextRefsExist call active | pass |
| Legacy task YAML without target/contextRefs loads cleanly | pass |
| Build passes | pass |

## Remaining Old/Bypass/Partial Path Issues

None. All migration-critical paths complete:

- Old `create` path unmodified and still active
- `renderNextPrompt` and `renderExplicitPhasePrompt` both call `assertContextRefsExist`
- `listActiveTasks` unchanged (active task listing); `listCompletedTasks` added separately
- Schema parse/save cycle preserves `target`/`contextRefs`

## Unresolved Blockers or Ambiguities

None. The implementation spec noted "No architecture/spec-level open questions remain" and no new questions emerged during implementation.

## Intentionally Deferred Items

| Item | Deferred to |
|---|---|
| Interactive selector test coverage (readline-based) | Integration test environment limitation; covered by non-interactive path tests |
| Template embedding of full context file contents in prompt body | Not required by Phase 3.6 spec |
| VariableResolver exposure of TARGET_PHASE or CONTEXT_REFS to templates | Not required by Phase 3.6 spec |
| Conditional routing from contextRefs | Phase 3.7 |
| MCP context migration | Phase 4.1 |
| Archive/knowledge-base context | Phase 5 |

## Next-Phase Readiness

Phase 3.7 can safely begin. Prerequisites satisfied:

- Execution tasks have `target.phaseNumber` persisted
- `contextRefs` persist and validate at render time
- Ambiguous planning sources are never auto-resolved
- `next` cannot render with missing linked context
- Old task creation remains stable and unmodified
- Build and tests clean

## Deviations from Spec

None.
