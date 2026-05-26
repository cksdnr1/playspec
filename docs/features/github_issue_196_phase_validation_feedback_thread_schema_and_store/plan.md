# Implementation Plan

## Ordered Steps

1. Add feedback thread path helpers in `src/utils/paths.ts`.
   - `getEvolutionFeedbackRoot(workspaceRoot)`
   - `getEvolutionFeedbackThreadsRoot(workspaceRoot)`
   - `getEvolutionFeedbackThreadPath(workspaceRoot, threadId)`
   - `getEvolutionFeedbackObservationsRoot(workspaceRoot)`
   - `getEvolutionFeedbackTaskObservationsRoot(workspaceRoot, taskId)`
   - `getEvolutionFeedbackObservationPath(workspaceRoot, taskId, phaseId, timestamp)`
   - Keep all paths under `.playspec/evolution/feedback`.

2. Add schemas in `src/evolution/schemas.ts`.
   - Add `FeedbackThreadIdSchema` with filesystem-safe constraints.
   - Add feedback result, approval result, cause category, confidence, trend direction, readiness state, and mutation strategy enums.
   - Add metadata schemas for workflow source, target prompt template, compact history policy, proposal readiness policy, cause classification, thread events, trend state, raw observation events, and canonical threads.
   - Reuse `WorkspaceRelativePathSchema` for stored target paths and raw observation references.

3. Add types in `src/evolution/types.ts`.
   - Mirror the new schemas with exported types/interfaces.
   - Keep event `approvalResult` and `feedbackResult` separate.
   - Model raw observations separately from canonical thread events.

4. Implement `src/evolution/feedback-thread-store.ts`.
   - Follow existing evolution store patterns: parse/stringify YAML, zod validation, `readTextFile`, `writeTextFileAtomic`, and missing-directory tolerant `listThreads()`.
   - `saveThread(thread)` creates a canonical thread file and rejects duplicate IDs.
   - `upsertThread(thread)` validates and writes to the same canonical thread file for the ID.
   - `loadThread(threadId)` validates the ID and parsed YAML.
   - `saveRawObservation(event)` validates and writes only when explicitly called.
   - Normalize raw observation timestamps for filenames so the helper writes portable `{phaseId}-{timestamp}.yaml` paths.

5. Add integration tests in `tests/integration/evolution-feedback-thread-store.test.ts`.
   - Store writes and reloads a valid thread.
   - Store updates an existing thread by ID without creating an additional thread file.
   - Thread paths are rooted under workspace-local `.playspec/evolution/feedback/threads`.
   - Events preserve `approvalResult` and `feedbackResult` separately.
   - Cause classification, trend state, proposal readiness policy, workflow source metadata, mutation strategy, target path kind, and target writability survive reload.
   - Saving/upserting a thread does not create raw observation files.
   - Explicit raw observation save writes under `.playspec/evolution/feedback/observations/{taskId}`.

## Files To Edit

- `src/utils/paths.ts`
- `src/evolution/schemas.ts`
- `src/evolution/types.ts`
- `src/evolution/feedback-thread-store.ts`
- `tests/integration/evolution-feedback-thread-store.test.ts`
- `docs/features/github_issue_196_phase_validation_feedback_thread_schema_and_store/result.md`
- `docs/features/github_issue_196_phase_validation_feedback_thread_schema_and_store/pr.md`

## Tests To Run

- `pnpm test tests/integration/evolution-feedback-thread-store.test.ts`
- `pnpm build`
- `pnpm test`

## Old Paths, Bypasses, And Partial Migration Risks

- Existing proposal and human edit stores remain unchanged; this phase must not migrate existing evolution records.
- No CLI/MCP/phase-completion entry point should start writing threads yet.
- Manual writes under `.playspec/evolution/feedback` are outside the store contract, but store APIs must validate IDs and schema shape on read/write.
- Raw observations are a bypass risk if implicitly written by thread save/update; only `saveRawObservation()` may create those files.

## Rollback Notes

Rollback is limited to removing the new schemas/types/store/path helpers/tests/docs. No migration of existing data is introduced, and no existing runtime path depends on the new store in this phase.

## Completion Criteria

- New schemas/types compile.
- Feedback thread store can save, reload, list, and upsert canonical threads.
- Raw observation persistence is explicit only.
- Focused integration tests pass.
- Full build and full test suite pass.
