# PlaySpec UX Hotfix — Handoff File

## Feature Summary

Small UX and safety hotfix that adds task discovery commands, a safe context-addition command, clipboard copy for rendered prompts, and a clearer phase validation error. No workflow redesign, no MCP changes, no migration features.

## Current Goal

**Implementation complete.** All spec items are wired and verified end-to-end.

---

## Locked File Set

### Must-read

| File | Why |
|---|---|
| `src/cli/index.ts` | All new commands registered here |
| `src/cli/commands/next.ts` | `--copy` flag added |
| `src/cli/commands/list.ts` | Existing analog — left unchanged |
| `src/cli/commands/current.ts` | Existing analog — left unchanged |
| `src/core/playspec-core.ts` | `validateCurrentPhase` guard + `addContextRef` method |
| `src/workflow/phase-resolver.ts` | No changes — verified null handling correct |
| `src/storage/yaml-task-store.ts` | `workflowType` added to `listActiveTasks` and `listCompletedTasks` |

### New files (all implemented)

| File | Why |
|---|---|
| `src/cli/commands/list-tasks.ts` | New `runListTasks()` |
| `src/cli/commands/current-task.ts` | New `runCurrentTask()` |
| `src/cli/commands/get-task.ts` | New `runGetTask()` |
| `src/cli/commands/add-context.ts` | New `runAddContext()` |
| `src/utils/clipboard.ts` | `copyToClipboard()` wrapper |

### Maybe-read

| File | Why |
|---|---|
| `src/core/errors.ts` | 4 new error classes added; `TaskNotFoundError` hint updated |
| `src/core/types.ts` | `TaskSummary.workflowType` added |
| `src/core/schemas.ts` | `TaskSummarySchema.workflowType` added |
| `src/core/active-task-resolver.ts` | Used by `current-task` — unchanged |

### Ignore-for-now

- `src/cli/commands/complete.ts`
- `src/cli/commands/migrate.ts`
- `src/mcp/`
- `src/migration/`
- `src/workflow/workflow-loader.ts` (no changes; used read-only in `list-tasks` and `current-task`)
- `src/template/`

---

## Implementation Status

**All spec items: done**

| Item | Status |
|---|---|
| `playspec list-tasks` | Done — registered, workflowType shown, INVALID phase warning |
| `playspec current-task` | Done — registered, phase title resolved, contextRefs count shown |
| `playspec get-task --task <id>` | Done — registered with `--task` required, no HEAD fallback |
| `playspec add-context <file> --task <id>` | Done — routes through `PlaySpecCore.addContextRef()` |
| `playspec next --copy` | Done — clipboard write with fallback-to-print |
| `InvalidCurrentPhaseError` with allowed values | Done — in Core guard, PhaseResolver unchanged |
| `TaskSummary` / `TaskSummarySchema` with workflowType | Done — type + schema + store all updated |

---

## Verifier Result Summary

22/25 spec line items were **done** on first pass. Two fixes applied:

1. `TaskNotFoundError` hint: updated from `playspec list` → `playspec list-tasks` (`src/core/errors.ts`)
2. `addContextRef` deduplication: uses `path.normalize()` on both sides to match `./docs/foo.md` vs `docs/foo.md` (`src/core/playspec-core.ts`)

After fixes: **all items done**.

---

## Refactor-Guard Result Summary

- `list-tasks` invalid-phase warning (WorkflowLoader in CLI handler) → **allowed** — spec §8 P7 + R3 "Accepted" explicitly require this.
- `get-task` `Created`/`Updated` timestamp output → **rejected and removed** — not in spec; removed in fix pass.

Final verdict: **allowed** on all remaining implementation.

---

## Active Entry Points

| Entry point | Old path | Current path | Status |
|---|---|---|---|
| `playspec list` | `runList()` — minimal | Unchanged | Left as-is per spec |
| `playspec list-tasks` | Missing | `runListTasks()` | Done |
| `playspec current` | `runCurrent()` — minimal | Unchanged | Left as-is per spec |
| `playspec current-task` | Missing | `runCurrentTask()` | Done |
| `playspec get-task --task <id>` | Missing | `runGetTask()` | Done |
| `playspec add-context <file> --task <id>` | Missing | `runAddContext()` → `core.addContextRef()` | Done |
| `playspec next --copy` | `--copy` undeclared | `runNext(…, copy)` → clipboard | Done |
| Phase validation (invalid non-null) | `PhaseNotFoundError` from PhaseResolver | `InvalidCurrentPhaseError` from Core guard | Done |
| Context validation in rendering | `assertContextRefsExist` in Core | Unchanged — shared path | Done |
| MCP `renderNextPrompt` | Same Core path | Inherits `validateCurrentPhase` guard | Done (inherited) |

**No old paths or bypass paths remain.**

---

## Remaining Issues

None. All spec items implemented and verified.

---

## Known Constraints (carried forward for future reference)

- `clipboardy` v5.3.1 added to `package.json`; ESM-compatible (`"type": "module"` confirmed).
- `TaskContextRef.role` is `z.literal('planning-context')` — `addContextRef` always writes `role: 'planning-context'`.
- All mutations go through `PlaySpecCore` — `add-context` CLI never calls `store.updateTask()` directly.
- `PhaseResolver.resolveCurrentPhase()` unchanged — UX-level validation lives in `PlaySpecCore.validateCurrentPhase()` only.
