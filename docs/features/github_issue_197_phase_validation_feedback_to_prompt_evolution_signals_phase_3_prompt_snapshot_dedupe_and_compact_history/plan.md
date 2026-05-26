# GitHub Issue #197 Implementation Plan

## Ordered Steps

1. Extend feedback persistence contracts.
   - Edit `src/evolution/types.ts`.
   - Add prompt snapshot, semantic dedupe key, compact overflow summary, updater input/result types.
   - Add `dedupeKey`, `dedupeKeyHash`, optional `historyOverflowSummary`, and event `promptSnapshot` fields.
   - Keep `mutationStrategy: manual_review_only`; do not introduce proposal generation.

2. Mirror contracts in zod.
   - Edit `src/evolution/schemas.ts`.
   - Validate SHA-256 snapshots, semantic dedupe data, overflow counters, and updater-compatible persisted thread shape.
   - Preserve existing path safety and duplicate the new fields in tests.

3. Add source and target resolver.
   - Add `src/evolution/feedback-workflow-source-resolver.ts`.
   - Input: workspace root, `ResolvedWorkflow`, `PhaseFeedbackConfig`.
   - Output: `workflowSource`, `targetPromptTemplate`, `targetPath`, `targetWritable`.
   - Project workflows under `.playspec/workflows` are workspace-relative and writable.
   - User workflows under `PLAY_SPEC_USER_WORKFLOWS` or `~/.playspec/workflows` are user-home-relative and writable only when they are effective user workflows.
   - Builtin workflows are package-relative `bundled_preset`, `presetId: default`, and non-writable.
   - External roots are `external` and non-writable by default.

4. Add prompt snapshot hasher.
   - Add `src/evolution/prompt-snapshot-hasher.ts`.
   - Input: task, resolved workflow, target phase ID, prompt render dependencies.
   - Render the target phase prompt through `TemplateRenderer` and `VariableResolver`.
   - Hash the fully rendered prompt with `node:crypto` SHA-256.
   - Return hash metadata with target phase, root template path, rendered length, algorithm, and timestamp.

5. Add feedback thread updater.
   - Add `src/evolution/feedback-thread-updater.ts`.
   - Input: task, resolved workflow, feedback config, signal details.
   - Compute a canonical semantic dedupe object and SHA-256 `dedupeKeyHash`; exclude prompt snapshot hashes.
   - Load existing threads through `EvolutionFeedbackThreadStore.listThreads()` and match by `dedupeKeyHash`.
   - Create deterministic thread ID for new threads.
   - Append event with prompt snapshot.
   - Enforce compact history after append by retaining first plus latest configured entries and folding omitted middle events into `historyOverflowSummary`.
   - Recompute trend counters from retained events plus overflow summary.
   - Set `readinessState` only to `not_ready` or `ready_for_review`.
   - Upsert the thread; do not write raw observations unless the caller uses the existing explicit raw observation API.

6. Export new entry points.
   - Add or update `src/evolution/index.ts` if absent.
   - Export resolver, hasher, updater, and public types needed by tests/consumers.

7. Add focused tests.
   - Add `tests/integration/feedback-workflow-source-resolver.test.ts`.
   - Add `tests/integration/evolution-feedback-thread-updater.test.ts`.
   - Update `tests/integration/evolution-feedback-thread-store.test.ts` fixtures for required new schema fields.

## Test Plan

- `pnpm test tests/integration/feedback-workflow-source-resolver.test.ts`
- `pnpm test tests/integration/evolution-feedback-thread-updater.test.ts`
- `pnpm test tests/integration/evolution-feedback-thread-store.test.ts`
- `pnpm build`
- `pnpm test`

## Risks And Controls

- Required variables during target prompt hashing can fail. Treat this as updater failure and do not persist a partial thread when snapshots are required.
- Workflow config may contain stale metadata. Resolve actual effective workflow source first; use config only as fallback where runtime data is unavailable.
- Compact history can lose trend state if counts are derived only from retained events. Always include overflow summary counts.
- Deterministic IDs can collide if canonicalization changes. Use a versioned semantic dedupe object and SHA-256 hash.

## Old Paths And Bypasses To Close

- Existing tests construct feedback threads manually; update fixtures so schema changes are enforced.
- Existing store `upsertThread()` should remain a low-level persistence primitive; semantic dedupe belongs in the updater.
- Prompt rendering paths remain unchanged; Phase 3 adds library entry points and tests, not automatic completion capture.

## Completion Criteria

- Target prompt snapshots are hashed at capture time.
- Project-local, user-global, bundled preset, and external source metadata resolve in tests.
- Bundled/read-only targets are non-writable.
- Repeated semantic signals update the same thread.
- Prompt hash changes update history on the same thread, not a new thread.
- Compact history preserves first/latest evidence plus overflow summaries.
- Trend and readiness are computed without auto-setting `proposal_candidate`.
- Focused tests, build, and full test suite pass.
