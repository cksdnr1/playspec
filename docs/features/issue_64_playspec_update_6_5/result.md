# PlaySpec Update 6.5 Result

## Behavior Implemented

- Added explicit opt-in evolution context surfacing for `playspec prompt`, deprecated `playspec next`, `playspec complete`, and MCP prompt/complete tools.
- Kept default prompt, next, complete, and MCP behavior evolution-store-free unless `withEvolutionContext` / `--with-evolution-context` is set.
- Added compact pending/refining proposal summaries with only allowed metadata fields.
- Added recorded human edit observation consideration by active task or included proposal ID.
- Added validated completion-time evolution context snapshots under `.playspec/evolution/context/{taskId}/{phaseId}-{timestamp}.yaml`.
- Preserved MCP explicit task/session resolution through `resolveMcpTaskId()`.

## Files Changed

- `src/evolution/context-reader.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/utils/paths.ts`
- `src/core/types.ts`
- `src/core/playspec-core.ts`
- `src/cli/index.ts`
- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/complete.ts`
- `src/mcp/server.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_64_playspec_update_6_5/spec.md`
- `docs/features/issue_64_playspec_update_6_5/plan.md`
- `docs/features/issue_64_playspec_update_6_5/result.md`

## Verification

- `pnpm build` passed.
- `pnpm test -- --run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts` passed.
- `pnpm test -- --run tests/cli.test.ts` passed.
- `pnpm test` passed: 20 files, 351 tests.

## Remaining Risks

- CLI test suite is slow in this environment, but it passed.
- Phase 6.5 intentionally does not add proposal generation, proposal apply, harness behavior, or Phase 8 context modes.

## Refactor Pass

- Post-implementation refactor guard found no out-of-scope changes.
- One scope-tightening cleanup was applied: completion no longer includes evolution context in the pre-completion prompt snapshot; evolution context is written to the dedicated snapshot and included in the next prompt only when requested.
- No broader refactors were made.

## PR Preparation

- PR body drafted in `docs/features/issue_64_playspec_update_6_5/pr.md`.
- Reusable agent guidance: no AGENTS.md update needed; existing guidance already covers phase boundaries and MCP explicit context.
- PR link: https://github.com/cksdnr1/playspec/pull/69
