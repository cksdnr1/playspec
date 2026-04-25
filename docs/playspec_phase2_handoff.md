# PlaySpec Phase 2 Handoff

## Implementation Status

Phase `2` implementation is complete on the active CLI/Core/store path.

Implemented:

- `playspec complete`
- `playspec complete --with-review`
- `playspec evidence`
- `playspec snapshot`
- completion persistence in `task.yaml`
- phase-scoped evidence/snapshot/review artifacts
- final-phase terminal completion
- `completion.validationTemplate` resolved-reference persistence
- default `HEAD`-based `next` / `phase` rejection for non-active tasks

## Migration Status

- active completion path is now `CLI -> ActiveTaskResolver -> PlaySpecCore -> TaskStore.completePhase()`
- completion no longer depends on generic `updateTask()` as the active mutation path
- older unlocked write paths still exist outside Phase 2 completion:
  - `src/cli/commands/create.ts`
  - `src/cli/commands/use.ts`
  - `src/preset/preset-manager.ts`
  - `src/cli/commands/next.ts --write`

## Verifier Result Summary

- pre-implementation: CLI surface, completion core path, lock-aware writes, review/evidence/snapshot persistence, and lifecycle guard were missing or partial
- post-implementation: Phase 2 requirements are covered in code and exercised by:
  - `tests/integration/completion-engine.test.ts`
  - `tests/cli.test.ts`
- post-test follow-up: direct CLI coverage now also verifies:
  - terminal final-phase `playspec complete`
  - `playspec complete` without `--with-review` leaves review artifact absent
- remaining non-codebase items are only deferred later-phase features:
  - rollback
  - desync engine
  - archive
  - MCP
  - evolution

## Build Validation Summary

- `corepack pnpm build`: success
- `npx tsc --noEmit`: success
- targeted `vitest`: success (`37` tests passed)
- focused test follow-up: `corepack pnpm test -- tests/cli.test.ts` success (`8` tests passed)
- non-blocking note: build emitted a Node engine warning because the environment was `Node v20.20.2` while `package.json` requests `>=22.0.0`

## Unresolved Blockers

- none for Phase `2`

## Next-Phase Readiness

Ready for Dev Phase `3`.

Why:

- completion state mutation is grounded end-to-end
- Phase 2 writes are lock-protected and atomic
- completion artifacts are observable and phase-scoped
- terminal task completion is coherent

## Active Entry Points and Remaining Old / Bypass Paths

### active entry points

- `src/cli/index.ts`
  - `complete`
  - `evidence`
  - `snapshot`
- `src/cli/commands/next.ts`
  - default `HEAD` rejection on non-active task
- `src/cli/commands/phase.ts`
  - default `HEAD` rejection on non-active task

### active paths covered by tests

- `complete --with-review`
- `complete` terminal final-phase completion
- `complete` without `--with-review`
- `evidence`
- `snapshot`
- default `HEAD`-based `next` rejection on non-active task
- default `HEAD`-based `phase` rejection on non-active task

### active paths not covered by this focused follow-up

- `complete --task <id>`
- `evidence --task <id>`
- `snapshot --task <id>`
- CLI-formatted lock-timeout output

### remaining old / bypass paths

- unlocked `HEAD` writes in:
  - `src/cli/commands/create.ts`
  - `src/cli/commands/use.ts`
  - `src/preset/preset-manager.ts`
- unlocked prompt export path in:
  - `src/cli/commands/next.ts --write`

These remain known non-Phase-2 gaps but do not invalidate the active Phase 2 completion path.
