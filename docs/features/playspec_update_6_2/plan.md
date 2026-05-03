# PlaySpec Update 6.2 Implementation Plan

## Goal

Implement Phase 6.2 only: proposal update/merge and evidence append for existing evolution proposals.

## Ordered Steps

1. Extend proposal data model.
   - Edit `src/evolution/types.ts` and `src/evolution/schemas.ts`.
   - Add rejection-only statuses `applied` and `failed`.
   - Add top-level `EvolutionEvidenceReference` and `evidenceRefs` defaulting to `[]`.
   - Evidence refs must contain workspace-relative `path`, non-empty `note`, ISO `addedAt`, and `source: "append-evidence"`.

2. Add revision path helpers.
   - Edit `src/utils/paths.ts`.
   - Add helpers for `.playspec/evolution/proposals/{proposalId}/revisions/` and deterministic `revision-{n}.yaml` paths.

3. Implement store update APIs.
   - Edit `src/evolution/proposal-store.ts`.
   - Add `updateProposal()` and `appendEvidence()`.
   - Reject existing proposals in `skipped`, `applied`, or `failed`.
   - Reject `saveProposal()` input whose status is `applied` or `failed`; only future apply code may create those transitions.
   - Build and validate merged proposal plus validation report before writing.
   - For `updateProposal()`, allow incoming status only when it is `pending` or `refining`; it may keep the current active status or switch between those two.
   - For `appendEvidence()`, preserve all proposal fields except `evidenceRefs`, `revision`, and `updatedAt`.
   - Preserve previous canonical proposal as `revisions/revision-{oldRevision}.yaml` only after validation succeeds.
   - Write validation YAML before canonical YAML after the revision file is written, so a validation-write failure cannot leave a new canonical proposal without matching validation metadata.
   - Rewrite canonical `proposal.yaml` atomically last.

4. Add CLI handlers.
   - Edit `src/cli/commands/evolution.ts`.
   - Add `runEvolutionUpdate()` and `runEvolutionAppendEvidence()`.
   - Normalize update input from YAML while forcing route ID, existing `createdAt`, incremented revision, and current timestamp in store logic.
   - Show evidence refs in `show` output.

5. Register CLI commands.
   - Edit `src/cli/index.ts`.
   - Add `evolution update <proposalId> --file <proposal.yaml>`.
   - Add `evolution append-evidence <proposalId> --file <path> --note <text>`.
   - Do not add apply/diff/generation/MCP commands.

6. Add focused tests.
   - Extend `tests/integration/evolution-proposal-store.test.ts` for update, evidence append, terminal rejection, validation report rewrite, revision file creation, and invalid-update no-write behavior.
   - Update `tests/cli.test.ts` for command help and CLI update/evidence behavior.
   - Keep existing prompt/completion/MCP regression tests unchanged.

## Active Entry Point To User Outcome

- CLI command parses route and file options.
- Store loads current proposal and validates active lifecycle status.
- Update command validates incoming full proposal; append command validates evidence path.
- Store builds the merged proposal in memory, validates it, and prepares validation metadata.
- Store writes previous revision, validation report, and canonical proposal only after validation succeeds; canonical YAML is the last write.
- User sees updated proposal ID, status, revision, proposal file path, validation file path, and evidence details through `show`.

## Validation Findings Resolved

- Latest Step 5 score: 88/100.
- Evidence contract is now explicit: `evidenceRefs` is top-level and separate from `source.artifactRefs`.
- Write ordering is now explicit: validate in memory first, then write revision, validation, and canonical proposal last.
- Terminal status intake is guarded: `saveProposal()` rejects `applied` and `failed`, and Phase 6.2 commands cannot transition into terminal statuses.
- Remaining risks: direct manual edits to proposal YAML remain a known bypass outside the command path.

## Files To Edit

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/utils/paths.ts`
- `src/evolution/proposal-store.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/cli.test.ts`

## Tests To Run

- `pnpm test -- --run tests/integration/evolution-proposal-store.test.ts tests/cli.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

## Risks

- Invalid update atomicity: guard by validating before any write and testing that revision files are not created on invalid input.
- Status drift: allow only existing active proposals and incoming `pending`/`refining` status.
- Phase drift: do not add apply behavior, apply statuses transitions, prompt surfacing, completion hooks, MCP tools, or generated proposals.
- Direct manual edits remain a bypass path; this phase adds a supported safe path but does not block manual filesystem mutation.

## Rollback Notes

All changes are source and test changes plus generated PlaySpec feature docs. Reverting this branch removes Phase 6.2 behavior. Runtime proposal data created by the new commands is under `.playspec/evolution/proposals/{proposalId}/` and can be inspected manually.

## Completion Criteria

- Update and append-evidence commands exist and are covered by tests.
- Pending/refining proposals can be revised with preserved revisions and validation metadata.
- Skipped/applied/failed proposals reject update and append.
- Invalid update files leave canonical proposal, validation report, and revisions unchanged.
- Prompt rendering, completion, migration, workflow, and MCP behavior remain unchanged.
