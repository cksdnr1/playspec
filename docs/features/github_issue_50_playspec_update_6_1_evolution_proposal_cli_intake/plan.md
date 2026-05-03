# Implementation Plan

## Ordered Steps

1. Add proposal listing support in `src/evolution/proposal-store.ts`.
   - Use `getEvolutionProposalsRoot()` and proposal directories as the source of truth.
   - Return only entries that contain a valid `proposal.yaml`.
   - Sort deterministically by `createdAt`, then `id`.

2. Add `src/cli/commands/evolution.ts`.
   - `runEvolutionPropose(workspaceRoot, filePath)`: parse YAML, validate through `EvolutionProposalStore`, store proposal, write validation report, print proposal ID/status and stored paths.
   - `runEvolutionList(workspaceRoot)`: print empty state or one line per proposal with ID, status, risk, created time, and action count.
   - `runEvolutionShow(workspaceRoot, proposalId)`: print proposal detail, source refs, target files, actions, skip metadata, and validation summary when present.
   - `runEvolutionSkip(workspaceRoot, proposalId, reason)`: call `updateProposalStatus(..., 'skipped')`, write timestamp/reason metadata, and print confirmation.

3. Register the `evolution` command group in `src/cli/index.ts`.
   - Add `propose --file <proposal.yaml>`.
   - Add `list`.
   - Add `show <proposalId>`.
   - Add `skip <proposalId> [--reason <text>]`.

4. Update CLI tests in `tests/cli.test.ts`.
   - Replace the Phase 6 absence assertion with help/registration coverage.
   - Add `propose --file` storage/report assertions.
   - Add `list`, `show`, and `skip` assertions covering pending/skipped status.
   - Assert skip preserves `proposal.yaml` and `validation.yaml`.

5. Keep existing regression tests unchanged for deferred behavior.
   - Prompt rendering ignores proposals.
   - Completion creates no evolution snapshots.
   - MCP registers no proposal intake tools.

## Files To Edit

- `src/evolution/proposal-store.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_50_playspec_update_6_1_evolution_proposal_cli_intake/result.md`
- `docs/features/github_issue_50_playspec_update_6_1_evolution_proposal_cli_intake/pr.md`

## Tests To Run

- `pnpm build`
- `pnpm test -- tests/cli.test.ts tests/integration/evolution-proposal-store.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
- `pnpm test`

## End-To-End Trace

`playspec evolution propose --file` reads external YAML, validates with `EvolutionProposalSchema`, checks workspace artifact refs, persists `proposal.yaml`, writes `validation.yaml`, and prints stored paths. It does not touch tasks, prompts, workflows, templates, MCP, migration, or apply reports.

`playspec evolution list/show` reads stored proposal records only and prints human-readable state.

`playspec evolution skip` updates only the stored proposal status plus skip metadata. Reset/clear behavior is intentionally absent; skipped proposals remain stored and inspectable.

## Risks

- Invalid external YAML must fail cleanly without partially stored proposal data.
- `show` should tolerate a missing validation report by reporting that it is absent, but `propose` must write one for newly stored proposals.
- Listing must not crash when `.playspec/evolution/proposals` does not exist.

## Rollback Notes

The change is isolated to the evolution store list API, CLI registration/handlers, tests, and task docs. Reverting those files removes the public command group and leaves existing Phase 6 storage behavior intact.

## Completion Criteria

- Users can create, list, show, and skip stored proposals through the CLI.
- Proposal and validation files are preserved after skip.
- No apply report or backup directory is produced.
- Prompt/completion/MCP deferred behavior tests still pass.
- Build and tests pass.
