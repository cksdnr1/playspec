# Issue 200 Implementation Plan

## Goal

Implement explicit feedback thread evidence attachment to existing pending/refining evolution proposals. The implementation must require both `proposalId` and `threadId`, use compact thread summaries, and avoid proposal matching by target path or raw event ID.

## Ordered Steps

1. Add the service layer in `src/evolution/feedback-updater.ts`.
   - Export `appendFeedbackThreadEvidence(workspaceRoot, input)`.
   - Define/use `AppendFeedbackThreadEvidenceInput` and `AppendFeedbackThreadEvidenceResult`.
   - Load the thread with `EvolutionFeedbackThreadStore.loadThread(threadId)`.
   - Compute `evidencePath` as `.playspec/evolution/feedback/threads/<threadId>.yaml` relative to the workspace.
   - Build the bounded line-based `evidenceNote` from thread metadata, trend, retained event summaries, overflow summary, and target strategy.
   - Call `EvolutionProposalStore.appendEvidence(proposalId, { path: evidencePath, note: evidenceNote })`.
   - Return the proposal write result plus `threadId`, `threadPath`, `evidencePath`, and `evidenceNote`.

2. Add type exports in `src/evolution/types.ts`.
   - Add `AppendFeedbackThreadEvidenceInput`.
   - Add `AppendFeedbackThreadEvidenceResult` in terms of `EvolutionProposalWriteResult`-compatible fields without importing store internals into types if avoidable.
   - Keep `EvolutionEvidenceReference.source` unchanged.

3. Export the service from `src/evolution/index.ts`.
   - Preserve existing exports.

4. Add CLI support.
   - In `src/cli/commands/evolution.ts`, add `runEvolutionAppendThreadEvidence(workspaceRoot, proposalId, threadId)`.
   - Print:
     - `Thread evidence appended: <proposalId>`
     - `Status: <status>`
     - `Revision: <revision>`
     - `Thread ID: <threadId>`
     - `Thread path: <threadPath>`
     - `Evidence file: <evidencePath>`
     - `Evidence note: <evidenceNote>`
     - revision/proposal/validation file paths.
   - In `src/cli/index.ts`, register `playspec evolution append-thread-evidence <proposalId> <threadId>`.
   - Do not modify generic `append-evidence` behavior.

5. Add MCP support.
   - In `src/mcp/server.ts`, import the service.
   - Register `playspec_append_evolution_thread_evidence` with required `proposalId` and `threadId`.
   - Return `ok(await appendFeedbackThreadEvidence(...))`.
   - Do not use task/session resolution, `ActiveTaskResolver`, `.playspec/HEAD`, event ID, or target path.

6. Add focused service tests.
   - New `tests/integration/evolution-feedback-updater.test.ts`.
   - Cover successful append to pending proposal.
   - Cover successful append to refining proposal.
   - Cover skipped/applied/failed proposal rejection with no new revision.
   - Cover missing proposal and missing thread rejection.
   - Cover that a proposal with matching `targetFiles` is not touched unless its explicit ID is supplied.
   - Cover note content for compact summaries, overflow, writable target strategy, and read-only/bundled target strategy.
   - Cover duplicate explicit attachment appends a second evidence ref.

7. Add CLI tests in `tests/cli.test.ts`.
   - Verify help includes `append-thread-evidence`.
   - Verify the command appends thread evidence and prints the thread/evidence fields.
   - Verify terminal proposal rejection uses existing change hint path.

8. Add MCP tests in `tests/integration/mcp-server.test.ts`.
   - Verify tool registration includes `playspec_append_evolution_thread_evidence`.
   - Verify handler appends by explicit IDs.
   - Verify handler schema does not accept event ID or target path alternatives.

## Files To Edit

- `src/evolution/feedback-updater.ts` new file.
- `src/evolution/types.ts`.
- `src/evolution/index.ts`.
- `src/cli/commands/evolution.ts`.
- `src/cli/index.ts`.
- `src/mcp/server.ts`.
- `tests/integration/evolution-feedback-updater.test.ts` new file.
- `tests/cli.test.ts`.
- `tests/integration/mcp-server.test.ts`.
- `docs/features/issue_200_thread_based_proposal_evidence_attachment/result.md`.
- `docs/features/issue_200_thread_based_proposal_evidence_attachment/pr.md`.

## End-To-End Chain

- CLI user runs `playspec evolution append-thread-evidence <proposalId> <threadId>`.
- CLI handler calls the new service.
- Service validates thread/proposal existence by loading exact IDs.
- Proposal store enforces pending/refining status and writes revision, proposal, and validation files.
- CLI prints proposal revision, thread path, and evidence note.
- MCP callers use `playspec_append_evolution_thread_evidence` with the same required IDs and receive the same result object.

## Bypasses And Partial Migration Risks

- Existing generic `append-evidence` remains available for arbitrary explicit file evidence; this is not a bypass because it also requires explicit proposal ID.
- Existing `generateEvolutionProposal()` must not be called by the new service.
- Target path overlap logic in `proposal-generator.ts` is not used for thread attachment.
- Raw thread event IDs are not accepted by CLI, MCP, or service input.
- Core completion feedback capture remains thread-only and must not auto-attach evidence.

## Risks And Rollback Notes

- Evidence notes can be noisy. Keep the note builder bounded to at most three retained event summaries and one overflow line.
- Type cycles are possible if service result types import store-specific interfaces. Keep result types structurally defined or localize the store import to the service implementation.
- MCP tests may need local handler access patterns already used in `mcp-server.test.ts`; reuse existing helpers.
- Rollback is straightforward: remove the new service, CLI command, MCP tool, tests, and docs. Existing proposal/thread storage schemas remain unchanged.

## Completion Criteria

- Explicit thread attachment appends evidence only to the supplied pending/refining proposal.
- Terminal or missing proposals fail before mutation.
- Missing threads fail before mutation.
- Matching target paths alone do not attach evidence.
- No code path auto-flips readiness or auto-generates/applies proposals.
- Read-only/bundled/external targets produce note guidance for override/copy strategies, not direct mutations.
- Focused tests, build, and full test suite pass.
