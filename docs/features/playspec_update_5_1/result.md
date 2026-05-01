# PlaySpec Update 5.1 Result

## Summary

Implemented Phase 5.1 archive inspection and explicit archived context reference coverage.

- Added archived task listing to the storage interface and YAML store.
- Added `playspec archive list`.
- Added `playspec archive show --task <taskId>`.
- Preserved active-only task lookup and active list behavior.
- Added regression tests proving explicit archived artifact paths can be linked to active prompt context and missing archived artifact refs fail explicitly.
- Did not add restore/unarchive, MCP archive lookup, automatic archived context inclusion, or evolution proposal behavior.

Draft PR: https://github.com/cksdnr1/playspec/pull/48

## Changed Files

- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/commands/archive.ts`
- `src/cli/index.ts`
- `tests/integration/task-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/cli.test.ts`
- `docs/features/playspec_update_5_1/spec.md`
- `docs/features/playspec_update_5_1/spec_validation.md`
- `docs/features/playspec_update_5_1/plan.md`
- `docs/features/playspec_update_5_1/plan_validation.md`
- `docs/features/playspec_update_5_1/result.md`

## Verification

Passed:
- `pnpm build`
- `pnpm test -- --run tests/integration/task-store.test.ts`
- `pnpm test -- --run tests/integration/init-create-next.test.ts -t "lists and shows archived tasks"`
- `pnpm test -- --run tests/cli.test.ts -t "archived artifact context"`
- `pnpm test -- --run tests/integration/mcp-server.test.ts`

Additional build-validator checks passed:
- `pnpm exec tsc --noEmit`

Attempted but not used as passing evidence:
- `pnpm test -- --run tests/integration/task-store.test.ts tests/integration/init-create-next.test.ts tests/cli.test.ts`
  - Result: stopped after `tests/cli.test.ts` hung in unrelated existing subprocess/clipboard-heavy cases such as `next --copy`.
- `pnpm test`
  - Result from build validator: full suite hung/timed out in unrelated integration suites including `completion-engine.test.ts`, `mcp-server.test.ts`, `routing.test.ts`, and `init-create-next.test.ts`.

Skipped:
- No destructive git, restore/unarchive, MCP archive lookup, viewer, harness, token/context mode, or evolution proposal validation tests were added because those behaviors are out of Phase 5.1 scope.
- Full `pnpm test` was not rerun after the build-validator timeout because the same suite-wide hang was already reproduced and recorded.

## Remaining Risks

- The full Vitest suite has pre-existing or environment-sensitive subprocess hangs, so focused passing tests are the reliable validation evidence for this slice.
- `archive show` is intentionally read-only and does not expose restore/unarchive affordances.

## Safe Refactor Review

No additional refactor was applied after implementation. The diff is already local to archive storage, archive CLI registration/output, focused tests, and task documentation. Broader CLI test harness cleanup was intentionally skipped as unrelated to Phase 5.1.
