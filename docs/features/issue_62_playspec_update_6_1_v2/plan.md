# Issue #62 PlaySpec Update 6.1 v2 Implementation Plan

## Ordered Steps

1. Update evolution proposal schema and types.
   - Add `refining` to the proposal status union.
   - Add required `revision: number` and `updatedAt: string` fields.
   - Keep apply/update/merge/evidence behavior out of scope.

2. Extend `EvolutionProposalStore`.
   - Add `listProposals()` that reads `.playspec/evolution/proposals/*/proposal.yaml`, validates each record, and returns a deterministic ID-sorted list.
   - Add or adjust status update behavior so skipped updates also refresh `updatedAt`.
   - Preserve `validation.yaml` during skip.
   - Keep duplicate directory collision behavior and do not add reopen/reset APIs for CLI use.

3. Add `src/cli/commands/evolution.ts`.
   - Implement `runEvolutionPropose(workspaceRoot, filePath)`.
   - Parse YAML as an object, normalize missing `id`, `status`, `revision`, `createdAt`, and `updatedAt`, validate, save `proposal.yaml`, then save `validation.yaml`.
   - On duplicate IDs, fail with recovery guidance pointing to the later update command.
   - Implement read-only `runEvolutionList()` and `runEvolutionShow(proposalId)`.
   - Implement `runEvolutionSkip(proposalId, reason)` as the only public status mutation.

4. Register the CLI group in `src/cli/index.ts`.
   - Add `playspec evolution propose --file <proposal.yaml>`.
   - Add `playspec evolution list`.
   - Add `playspec evolution show <proposalId>`.
   - Add `playspec evolution skip <proposalId> [--reason <text>]`.
   - Do not register apply/update/merge/evidence/MCP commands.

5. Update tests.
   - Update schema/store fixtures to include `revision` and `updatedAt`.
   - Add store list coverage and `refining` status coverage.
   - Replace old CLI "no evolution command" assertions with assertions for the narrow 6.1 command group.
   - Add CLI integration tests for propose success, invalid file rejection, duplicate rejection with guidance, list/show status output, skip timestamp/reason, and preserved validation report.
   - Keep existing prompt, completion, and MCP non-goal tests intact.

6. Run focused and full validation.
   - Focused tests: `pnpm test -- tests/integration/evolution-proposal-store.test.ts tests/cli.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`.
   - Full tests: `pnpm test`.
   - Build: `pnpm build`.

## Files To Edit

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-store.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_62_playspec_update_6_1_v2/result.md`
- `docs/features/issue_62_playspec_update_6_1_v2/pr.md`

## Risks

- Broadening proposal lifecycle too far would enter later phases. Only `refining`, `revision`, and `updatedAt` are needed now.
- CLI normalization must still validate through `EvolutionProposalSchema`; it must not write partially accepted invalid proposals.
- `skip` must not become a general status command because Phase 6.1 has no reset/reopen semantics.
- Proposal listing must not affect prompt rendering, completion, or MCP registration.

## Rollback Notes

The change is additive except for schema field requirements and tests. Reverting the CLI registration plus schema/store/test updates restores Phase 6 behavior. No production or external state is touched.

## Completion Criteria

- `playspec evolution propose --file` validates YAML, stores `proposal.yaml`, stores `validation.yaml`, initializes `revision: 1`, `createdAt`, and `updatedAt`, and rejects duplicate IDs with update-command guidance.
- `playspec evolution list` and `show` display `pending`, `refining`, and `skipped` proposals.
- `playspec evolution skip` marks a proposal skipped with timestamp/reason and keeps stored files.
- Prompt rendering, completion, and MCP behavior remain unchanged.
- Focused tests, full tests, and build pass.
