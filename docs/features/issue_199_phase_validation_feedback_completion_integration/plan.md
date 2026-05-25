# Issue 199 Implementation Plan

## Ordered Steps

1. Extend completion feedback types.
   - Edit `src/core/types.ts`.
   - Add serializable feedback metadata types for success and failure.
   - Add optional `feedback?: CompletionFeedbackResult` to `CompletionResult` and `CompletionEvent`.
   - Keep all fields optional so no-feedback completions serialize exactly as before.

2. Extend completion schemas.
   - Edit `src/core/schemas.ts`.
   - Add matching zod schemas for optional completion feedback metadata.
   - Preserve backwards compatibility for existing ledgers without feedback fields.

3. Wire feedback capture into `PlaySpecCore.completePhase()`.
   - Edit `src/core/playspec-core.ts`.
   - Instantiate `ValidationFeedbackExtractor` and `FeedbackThreadUpdater`.
   - Add a private helper that:
     - returns `undefined` when `definition.feedback` is missing or disabled,
     - requires a `reviewFile` for enabled feedback,
     - reads the review artifact,
     - extracts validation feedback with the core completion result,
     - updates the feedback thread,
     - maps success into completion metadata.
   - Catch failures in the helper and apply `feedback.onFailure`.
   - For `fail_completion`, throw before ledger write and task phase mutation.
   - For `warn_and_continue` and `record_failure`, return failure metadata and continue.
   - Pass feedback metadata into `writeCompletionEvent()`.
   - Render a `## Feedback` section in completion markdown when metadata exists.

4. Surface feedback metadata in CLI output.
   - Edit `src/cli/commands/complete.ts`.
   - Print feedback thread path/id on success.
   - Print feedback failure policy/stage/message on failure.
   - Do not add extraction logic to CLI.

5. Preserve MCP delegation.
   - No new logic should be added to `src/mcp/server.ts`.
   - Ensure the returned core result includes the feedback metadata for MCP callers.

6. Add focused integration tests.
   - Edit `tests/integration/completion-engine.test.ts`.
   - Add a feedback-enabled workflow fixture with a validation review template that emits `playspecFeedback`.
   - Cover:
     - no-feedback completion remains unchanged,
     - enabled feedback creates a thread and records completion metadata,
     - repeated completion with the same dedupe key updates the same thread path,
     - approval result and feedback threshold result remain independent,
     - required `fail_completion` failure does not advance task or append ledger event,
     - `warn_and_continue` or `record_failure` continues with failure metadata.
   - Edit `tests/cli.test.ts` for CLI output of success/failure metadata.
   - Edit `tests/integration/mcp-server.test.ts` only if current harness can assert tool result shape without broad server rewrites; otherwise rely on core delegation plus existing registration coverage.

7. Update result documentation.
   - Edit `docs/features/issue_199_phase_validation_feedback_completion_integration/result.md` after implementation and validation.
   - Record commands run and any skipped validation with reasons.

## Files To Edit

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/complete.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts` if needed for MCP result parity
- `docs/features/issue_199_phase_validation_feedback_completion_integration/result.md`
- `docs/features/issue_199_phase_validation_feedback_completion_integration/pr.md`

## Old Paths And Bypasses

- `TaskStore.completePhase()` remains a storage primitive and must not gain feedback behavior.
- CLI result prompting remains CLI-only; feedback capture starts only after core has a validated completion result.
- MCP must continue resolving task context through `resolveMcpTaskId()` and then call core.
- Prompt rendering and evolution proposal commands must not trigger feedback capture.

## Risks

- Feedback capture uses review artifacts for this phase. A feedback-enabled phase without a review artifact must fail by policy instead of silently falling back to unrelated files.
- Required failures can leave pre-completion snapshot/evidence/review artifacts. Tests should assert state and ledger are unchanged, not that pre-completion artifacts are absent.
- The branch is stacked on #198 and its dependency chain. PR target should be the dependency branch unless the stack merges.

## Rollback Notes

All implementation changes are additive and optional for no-feedback workflows. Rollback is a normal git revert of the issue commit; existing ledgers without feedback fields remain valid because schemas keep feedback optional.

## Completion Criteria

- Core completion with no feedback config has no feedback metadata.
- Core completion with feedback config creates a feedback thread and records thread references.
- Repeated completions with the same dedupe key update the same thread path.
- Approval and feedback threshold results are stored independently.
- Required `fail_completion` failures do not advance the phase or append completion ledger events.
- CLI and MCP completion share the same core result shape.
- Focused tests, build, and full test suite pass.
