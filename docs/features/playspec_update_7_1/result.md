# PlaySpec Update 7.1 Implementation Result

## Summary

Implemented Phase 7.1 automatic proposal generation as an explicit CLI-only path:

- `playspec evolution generate --task --from-evidence --target --summary --rationale`
- optional `--proposal` to refine an existing active proposal;
- optional `--id` for new generated proposal IDs;
- optional `--risk low|medium|high`.

Generation is deterministic and local. It creates or updates schema-valid evolution proposal records from explicit evidence and does not call an LLM provider, apply proposals, create backups, create apply reports, or mutate target files.

Draft PR: https://github.com/cksdnr1/playspec/pull/71

## Behavior Implemented

- Added generated proposal metadata:
  - `source.generationSource: cli`
  - evidence ref `source: generated`
- Added `src/evolution/proposal-generator.ts`.
- Generation checks `PlaySpecCore.getHarnessStatus(taskId)` before writing proposal state and rejects blocked/circuit-breaker tasks.
- New generated proposals validate through `EvolutionProposalStore.validateProposal()`, then persist through `saveProposal()` and `saveValidationReport()`.
- Existing generated refinements use `EvolutionProposalStore.updateProposal()`, preserving prior revisions under `revisions/revision-{n}.yaml`.
- New generated proposals reject overlapping target files from active `pending`/`refining` proposals and guide users to `--proposal`.
- MCP generation remains absent.

## Files Changed

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-generator.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/integration/evolution-proposal-generator.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/routing.test.ts`
- `docs/features/playspec_update_7_1/spec.md`
- `docs/features/playspec_update_7_1/plan.md`
- `docs/features/playspec_update_7_1/result.md`

## Validation

Commands run:

- `pnpm vitest run tests/integration/evolution-proposal-generator.test.ts tests/integration/mcp-server.test.ts`
  - Passed: 24 tests.
- `pnpm vitest run tests/cli.test.ts -t "proposes, lists, shows, and skips an evolution proposal from YAML|generates and refines evolution proposals from explicit CLI evidence" --reporter verbose`
  - Passed: 2 tests.
- `pnpm vitest run tests/cli.test.ts`
  - Passed: 144 tests.
- `pnpm vitest run tests/integration/mcp-server.test.ts tests/integration/init-create-next.test.ts`
  - Passed: 42 tests.
- `pnpm build && pnpm test`
  - Passed: 22 test files, 366 tests.

## Test Harness Notes

During full-suite validation, clean `origin/master` also timed out on an existing CLI proposal-intake test when using `npx tsx`. The issue branch now uses the local `tsx` binary in CLI-spawn tests and gives intentionally multi-command CLI integration tests realistic timeout budgets. These are test harness changes only; runtime CLI behavior is unchanged.

## Remaining Risks

- Duplicate active proposal detection is intentionally conservative: target-file overlap requires users to refine with `--proposal`.
- Generated proposal content is a reviewable draft built from explicit CLI fields, not an autonomous LLM-generated plan.
- The CLI suite is still slow because it intentionally executes many full CLI subprocesses.
