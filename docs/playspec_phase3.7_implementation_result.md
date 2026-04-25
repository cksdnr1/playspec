# Phase 3.7 Implementation Result: Simple Conditional Routing with Human Selection

## Phase summary

Phase 3.7 adds simple result-based routing inside one PlaySpec task. A workflow phase can declare allowed result values, map those results to next phases, and cap repeated visits with `maxVisits`. The result is always human-authoritative: either selected interactively or passed as `--result`.

## Intended scope vs actual scope

**Intended:** Workflow routing fields, result validation in Core, visit counting, loop guard, interactive/non-interactive CLI selection, `phaseHistory` persistence, `playspec next` follows `currentPhase` set by completion.

**Actual:** All intended scope items are implemented. No future-phase work was pulled in. DAG, parallel execution, AI-driven selection, and MCP routing are absent.

## Changed files

| File | Change |
|---|---|
| `src/core/types.ts` | Added `results`, `nextByResult`, `maxVisits` to `PhaseDefinition`; added `result`, `visitCount` to `PhaseHistoryEntry`; added `result`, `visitCount` to `CompletePhaseInput` |
| `src/core/schemas.ts` | Extended `PhaseDefinitionSchema` with optional routing fields; extended `PhaseHistoryEntrySchema` with `result` and `visitCount` |
| `src/core/errors.ts` | Added `MissingResultError`, `InvalidResultError`, `MissingResultMappingError`, `InvalidRoutingTargetError`, `LoopGuardError`, `UnexpectedResultError` |
| `src/core/playspec-core.ts` | Extended `completePhase` options with `result?`; added `resolveRoutedCompletion` private method; routing validation runs before `renderResolvedPhase` |
| `src/storage/yaml-task-store.ts` | `buildPhaseHistory` no longer deduplicates completed entries for the same phase; persists `result` and `visitCount` |
| `src/cli/index.ts` | Added `--result <value>` option to `complete` command |
| `src/cli/commands/complete.ts` | Added interactive selection menu for TTY; non-interactive guard requiring `--result`; passes result to Core |
| `tests/integration/routing.test.ts` | New test file: 15 tests covering all spec scenarios |

## Changed classes/functions

| Location | Item | Change |
|---|---|---|
| `src/core/types.ts` | `PhaseDefinition` | Added `results?`, `nextByResult?`, `maxVisits?` |
| `src/core/types.ts` | `PhaseHistoryEntry` | Added `result?`, `visitCount?` |
| `src/core/types.ts` | `CompletePhaseInput` | Added `result?`, `visitCount?` |
| `src/core/schemas.ts` | `PhaseDefinitionSchema` | Added optional routing fields |
| `src/core/schemas.ts` | `PhaseHistoryEntrySchema` | Added `result`, `visitCount` |
| `src/core/playspec-core.ts` | `PlaySpecCore.completePhase` | Options extended; routing validation before render |
| `src/core/playspec-core.ts` | `PlaySpecCore.resolveRoutedCompletion` | New private method: authoritative routing validation and visit count |
| `src/storage/yaml-task-store.ts` | `YamlTaskStore.buildPhaseHistory` | Stops deduplicating completed entries; stores result/visitCount |
| `src/cli/commands/complete.ts` | `runComplete` | Added `resultOption` param; interactive prompt; non-interactive guard |

## Implementation-plan step coverage

| Spec section | Status |
|---|---|
| 10.1 Data model (types + schemas) | Done |
| 10.2 Completion API (Core validation, routing, visitCount) | Done |
| 10.3 CLI behavior (`--result`, interactive, non-interactive) | Done |
| 10.4 Routing resolution (nextByResult lookup, linear fallback) | Done |
| 10.5 Visit counting and history (no dedup, append, visitCount) | Done |
| 10.6 Old/bypass/dual path risks | Addressed |

## Spec coverage before vs after

| Requirement | Before | After |
|---|---|---|
| Workflow YAML accepts `results`, `nextByResult`, `maxVisits` | Missing | Done |
| `completePhase` requires result for result-bearing phases | Missing | Done |
| Invalid result rejected before mutation | Missing | Done |
| Missing `nextByResult` mapping rejected before mutation | Missing | Done |
| Invalid mapped target rejected before mutation | Missing | Done |
| `maxVisits` enforced before any writes | Missing | Done |
| Visit count calculated from completed history entries | Missing | Done |
| Repeated visits append new history entries | Missing | Done |
| `result` and `visitCount` persisted in `phaseHistory` | Missing | Done |
| `playspec next` renders routed phase after completion | Missing | Done (completion sets `currentPhase` to routed target) |
| Interactive result selection in TTY mode | Missing | Done |
| Non-interactive: `--result` required | Missing | Done |
| `--result` on non-routed phase rejected | Missing | Done |
| Linear workflows unaffected | Done | Still done |

## Build/compile validation

- Command: `npm run build`
- Target: full TypeScript compile (`tsc`) + alias resolution + asset copy
- Result: **success** (zero errors)
- Blocking: no

## Test validation

- Command: `npm test`
- Result: **101/101 tests pass** (86 pre-existing + 15 new Phase 3.7 tests)
- Pre-existing pass rate unchanged: 86/86

## End-to-end validation

| Check | Status |
|---|---|
| Active entry point `playspec complete --result <value>` exists | Done |
| Active path: CLI -> Core.completePhase -> resolveRoutedCompletion -> TaskStore -> task.currentPhase | Done |
| Old/bypass path: linear `resolveNextPhaseId` used only for non-routed phases | Done |
| Routing validation before any artifact write | Done |
| `phaseHistory.result` is authoritative source of truth | Done |
| `routing.currentResult` NOT introduced | Done (deferred per spec) |
| Visit count derived from completed history entries only | Done |
| `maxVisits` guard fires before snapshot/evidence/state writes | Done |
| `playspec next` renders routed phase (via `currentPhase`) | Done |
| Linear workflows pass all pre-existing tests | Done |

## Remaining old/bypass/partial path issues

None. The linear `resolveNextPhaseId` is correctly delegated to only for non-routed phases. Result validation is in Core (not CLI-only), so direct `PlaySpecCore.completePhase` calls also enforce the guard.

## Unresolved blockers or ambiguities

None.

## Intentionally deferred items

- Interactive recommendation hint (`(recommended)` marker) — spec says optional; not implemented per minimal scope.
- `routing.currentResult` field in `task.yaml` — spec explicitly defers this.
- MCP adapter for routing — Phase 4 scope.

## Next-phase readiness recommendation

Phase 4 MCP work can safely begin. Routed completion behavior is fully available through Core with explicit task IDs. MCP does not need to inspect CLI prompts or HEAD to determine route state.

## Deviations from spec

None. Implementation follows the spec exactly.
