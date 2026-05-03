# PlaySpec Update 7.1 Implementation Plan

## Ordered Steps

1. Extend generated proposal metadata.
   - Edit `src/evolution/types.ts` and `src/evolution/schemas.ts`.
   - Add `generationSource` metadata on proposal source with a narrow enum value for CLI generation.
   - Allow evidence refs with `source: generated` while preserving existing `append-evidence` behavior.

2. Add generation orchestration.
   - Add `src/evolution/proposal-generator.ts`.
   - Inputs: task ID, evidence path, target path, summary, rationale, optional risk level, optional generated ID, optional existing proposal ID.
   - Read harness status through `PlaySpecCore.getHarnessStatus(taskId)` and reject blocked/circuit-breaker records before building any proposal.
   - Build a deterministic non-executable `propose_file_change` proposal.
   - Validate via `EvolutionProposalStore.validateProposal()` and workspace validation through save/update paths.
   - For new proposals, list active proposals and reject pending/refining target-file overlap with guidance to use `--proposal`.
   - For updates, call `EvolutionProposalStore.updateProposal()` so prior revisions are preserved.

3. Wire CLI command.
   - Edit `src/cli/commands/evolution.ts` to export `runEvolutionGenerate()`.
   - Edit `src/cli/index.ts` to register `playspec evolution generate`.
   - Require `--task`, `--from-evidence`, `--target`, `--summary`, and `--rationale`.
   - Support optional `--proposal`, `--id`, and `--risk <low|medium|high>`.
   - Print proposal ID, status, revision, proposal path, validation path, and revision path when applicable.

4. Add focused tests.
   - Update `tests/integration/evolution-proposal-store.test.ts` or add a generator integration test for generated schema/storage, duplicate rejection, update-only active statuses, revision preservation, and no apply report/backup creation.
   - Update `tests/cli.test.ts` for command help and basic CLI generate/update flows.
   - Update `tests/integration/harness-store.test.ts` or generator tests for blocked harness rejection.
   - Update `tests/integration/mcp-server.test.ts` to ensure no `generate` evolution MCP tool is registered.

5. Validate and document.
   - Run targeted tests first, then `pnpm build` and `pnpm test`.
   - Write `docs/features/playspec_update_7_1/result.md`.
   - Generate or write `docs/features/playspec_update_7_1/pr.md`.

## Files To Edit

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-generator.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/playspec_update_7_1/result.md`
- `docs/features/playspec_update_7_1/pr.md`

## Tests

Required targeted tests:

- generated output validates before storage;
- generated update writes prior revision and updates only `pending`/`refining`;
- duplicate active target overlap rejects new proposal creation;
- blocked harness state prevents generation;
- generated proposal does not create apply reports/backups or mutate target files;
- MCP generation tool remains absent.

Full validation:

- `pnpm build`
- `pnpm test`

## Risks

- Target-file overlap duplicate detection is intentionally conservative and may require users to pass `--proposal` for unrelated work in the same file.
- Deterministic local generation produces a draft proposal, not provider-authored content.
- Schema changes must preserve existing proposal YAML compatibility where evidence refs still use `append-evidence`.

## Rollback Notes

The implementation does not add destructive reset/clear behavior. Rollback is limited to reverting the new command/module/schema/test changes. Generated proposal state is user data under `.playspec/evolution/proposals/`; generation itself should not mutate target files.

## Completion Criteria

- `playspec evolution generate` exists and is explicit-command-only.
- New proposals are schema-valid and persisted through existing proposal store paths.
- Existing proposal refinement uses `updateProposal()` and preserves revisions.
- Harness blocked/circuit-breaker state prevents generation.
- Duplicate active target overlap is rejected with update guidance.
- No MCP generation tool is registered.
- Build and tests pass.
