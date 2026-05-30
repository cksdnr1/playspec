# Issue #276 Manual Artifact Uniqueness Plan

## Ordered Implementation Steps

1. Add deterministic manual suffix selection in `src/core/playspec-core.ts`.
   - Add a private helper that receives a task and candidate task-relative artifact path builder.
   - Check candidate paths under `this.getAbsoluteTaskRoot(task)`.
   - Return `'_manual'` when no base files exist, then `'_manual2'`, `'_manual3'`, and so on.

2. Update manual evidence collection.
   - In `collectEvidence()`, keep phase resolution unchanged.
   - Inside `withWriteLock(taskRoot, ...)`, choose the manual evidence suffix by checking all three evidence paths as one set.
   - Pass that suffix into `writeEvidence()`.
   - Leave completion calls to `writeEvidence()` unchanged.

3. Update manual snapshot collection.
   - Preserve the existing manual first filename `snapshots/phase${phaseId}_manual_task.yaml`.
   - Add a manual snapshot suffix path through `writeSnapshots()` or select the filename before writing.
   - Ensure the second call returns `snapshots/phase${phaseId}_manual2_task.yaml`.
   - Leave completion mode snapshot and prompt artifact behavior unchanged.

4. Update focused integration coverage in `tests/integration/completion-engine.test.ts`.
   - Keep the single-call phase mutation assertion.
   - Add consecutive `collectEvidence()` calls and assert:
     - returned path arrays differ,
     - both first and second returned files can be read after the second call,
     - first call keeps the existing readable `_manual` names,
     - second call uses deterministic `_manual2` names.
   - Add consecutive `createSnapshot()` calls and assert:
     - returned path arrays differ,
     - both first and second returned files can be read after the second call,
     - first call keeps `phase1_manual_task.yaml`,
     - second call uses `phase1_manual2_task.yaml`.

5. Run validation.
   - Focused suite: `pnpm vitest run tests/integration/completion-engine.test.ts`
   - Build: `pnpm build`
   - Full tests if focused/build expose no blockers and time permits: `pnpm test`

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/completion-engine.test.ts`

## Tests To Add Or Update

- Update `creates manual evidence and snapshot artifacts without phase mutation` or add adjacent tests in `tests/integration/completion-engine.test.ts`.
- The tests must read files from both returned path sets, not just assert returned strings.
- Existing routed completion artifact tests stay unchanged.

## Old Paths And Bypasses

Old paths to preserve for first manual collection:

- `evidence/phase1_manual_git_status.txt`
- `evidence/phase1_manual_git_diff_stat.txt`
- `evidence/phase1_manual_changed_files.txt`
- `snapshots/phase1_manual_task.yaml`

Bypasses to avoid changing:

- `completePhase()` visit-count suffixing.
- Completion prompt metadata writes.
- CLI and MCP command contracts.

## Risks

- A suffix helper that checks only one evidence file could miss partial artifact sets. Check the full set and move to the next suffix if any candidate file exists.
- Suffix selection must run inside `withWriteLock()` to avoid selecting the same suffix twice for overlapping calls in the same task root.
- Manual snapshot changes must not produce a prompt metadata side effect, since manual snapshots currently return only the task YAML file.

## Rollback Notes

The implementation is limited to path selection and tests. Reverting the code returns manual artifacts to fixed filenames; no task schema migration or ledger migration is involved.

## Completion Criteria

- Two consecutive manual evidence collections return different task-relative paths.
- Two consecutive manual snapshot collections return different task-relative paths.
- First returned files still exist and are readable after the second collection.
- Completion artifact visit suffix behavior remains unchanged.
- Focused completion-engine integration suite passes.
