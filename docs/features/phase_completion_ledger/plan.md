# phase_completion_ledger Implementation Plan

## Ordered Steps

1. Add core types and schemas.
   - Extend `PhaseDefinition.completion` with `eventType`.
   - Extend `PhaseDefinition.gate` with `eventTypes`.
   - Add `CompletionEvent` and `CompletionLedger` types.
   - Add zod validation for completion event/index files.

2. Add path helpers and ledger storage.
   - Add completion path helpers to `src/utils/paths.ts`.
   - Create `src/storage/completion-ledger-store.ts`.
   - Missing `index.yaml` reads as an empty ledger.
   - `appendEvent()` validates and atomically writes markdown, then atomically writes `index.yaml`.
   - The store does not acquire locks; callers use the existing task-root lock.

3. Integrate completion event creation in core.
   - Instantiate the ledger store in `PlaySpecCore`.
   - Add read-only core methods for list/show behavior.
   - In `completePhase()`, after snapshots/evidence/review/rollback metadata are known, build the completion event and markdown inside the existing `withWriteLock()`.
   - Write ledger artifacts before `TaskStore.completePhase()` writes `task.yaml`.
   - Return the completion event in `CompletionResult`.

4. Add event type mapping.
   - Prefer gate `eventTypes[result]`.
   - Then prefer phase `completion.eventType`.
   - Then use gate result.
   - Then derive fallback from phase ID: patch, draft, plan_create, implementation, test, refactor, pr, default.

5. Add CLI commands.
   - `src/cli/commands/log.ts`: resolve task at CLI boundary, print newest-first table, or concatenate markdown newest-first for `--markdown`.
   - `src/cli/commands/show-completion.ts`: resolve task at CLI boundary, print markdown for exact event ID.
   - Register both in `src/cli/index.ts`.

6. Add tests.
   - Core completion creates exactly one event and one markdown file.
   - Gate completions store `approved`/`needs_revision` type and result.
   - Revision loop has ordered sequence IDs and distinct markdown files.
   - Final completion records `statusAfterCompletion: completed`.
   - Markdown/index consistency for evidence, snapshots, review, rollback, and markdown path.
   - CLI `log`, `log --markdown`, and `show-completion`.
   - Existing completion, rollback, evidence, snapshot, routing, and CLI tests remain green.

## Files To Edit

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/utils/paths.ts`
- `src/storage/completion-ledger-store.ts`
- `src/storage/index.ts`
- `src/cli/index.ts`
- `src/cli/commands/log.ts`
- `src/cli/commands/show-completion.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/routing.test.ts`
- `tests/cli.test.ts`
- `docs/features/phase_completion_ledger/result.md`

## Entry Point Trace

- CLI/MCP/human completion calls `PlaySpecCore.completePhase(taskId, options)`.
- Core resolves phase and routing, writes existing completion artifacts, builds rollback metadata.
- Core writes completion markdown and ledger index under `.playspec/tasks/active/<taskId>/completions/`.
- Core writes task state via `TaskStore.completePhase()`.
- CLI read commands resolve HEAD only at CLI boundary and then call core with explicit task IDs.
- User sees `playspec log`, `playspec log --markdown`, and `playspec show-completion`.

## Old Paths And Bypass Risks

- Manual `playspec evidence` and `playspec snapshot` stay artifact-only and must not create completion events.
- `TaskStore.completePhase()` remains lower-level task state persistence; event creation belongs in core completion flow, not generic storage.
- `rewind` and rollback must not delete completion artifacts.
- Archived tasks are not required for this issue; read commands can target active/completed tasks in active storage.

## Risks

- Partial write between markdown/index/task.yaml: mitigated by existing task-root lock and ordering markdown -> index -> task.yaml.
- Future workflow metadata: optional schema fields are backwards compatible.
- Repeated gate loops: sequence IDs prevent filename collisions.
- CLI output stability: tests will document exact table/markdown behavior.

## Rollback Notes

No destructive git operations are needed. If implementation fails, revert only this branch's code/doc changes. Runtime rollback behavior remains based on validated task snapshots and `rollback.lastSafePoint`, not completion markdown.

## Completion Criteria

- `pnpm build` passes.
- Relevant targeted tests pass during implementation.
- Full `pnpm test` passes before commit.
- Completion ledger artifacts are created once per successful completion and read by CLI commands newest-first.
