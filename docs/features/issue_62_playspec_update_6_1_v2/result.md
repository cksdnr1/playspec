# Issue #62 PlaySpec Update 6.1 v2 Result

## Behavior Implemented

- Added the Phase 6.1 public CLI group:
  - `playspec evolution propose --file <proposal.yaml>`
  - `playspec evolution list`
  - `playspec evolution show <proposalId>`
  - `playspec evolution skip <proposalId> [--reason <text>]`
- Proposal intake now parses YAML, normalizes missing ID/timestamp/status metadata, validates through `EvolutionProposalSchema`, stores `proposal.yaml`, and writes `validation.yaml`.
- Duplicate proposal IDs are rejected with recovery guidance to use a later update command.
- Proposal records now support `pending`, `refining`, and `skipped`, plus `revision` and `updatedAt`.
- Listing and show commands expose proposal status without mutating proposal state.
- Skip marks a proposal skipped with timestamp/reason while preserving proposal and validation files.
- Safe-refactor review tightened scope so intake always creates `pending` proposals and the store exposes a skip-only status mutation for this phase.
- Prompt rendering, completion, and MCP proposal-intake behavior remain unchanged.

## Files Changed

- `src/cli/index.ts`
- `src/cli/commands/evolution.ts`
- `src/evolution/proposal-store.ts`
- `src/evolution/schemas.ts`
- `src/evolution/types.ts`
- `tests/cli.test.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_62_playspec_update_6_1_v2/spec.md`
- `docs/features/issue_62_playspec_update_6_1_v2/plan.md`
- `docs/features/issue_62_playspec_update_6_1_v2/result.md`

## Verification

Commands run:

```text
pnpm test -- tests/integration/evolution-proposal-store.test.ts tests/cli.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts
pnpm test
pnpm build
```

Results:

- Initial focused tests passed: 4 test files, 175 tests.
- Initial full test suite passed: 19 test files, 317 tests.
- After safe-refactor tightening, focused tests passed: 4 test files, 176 tests.
- After safe-refactor tightening, full test suite passed: 19 test files, 318 tests.
- Build passed.

Skipped validation:

- No package install was run because dependencies were already available and `pnpm-lock.yaml` is present.

## Pull Request

- Draft PR: https://github.com/cksdnr1/playspec/pull/63

## Remaining Risks

- Phase 6.1 intentionally does not implement proposal update/merge, evidence append, apply, generation, prompt surfacing, completion snapshots, or MCP intake.
- The store still has a general status-update helper for internal use, but the public CLI exposes only the skip transition in this phase.
