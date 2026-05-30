# Issue #276 Manual Artifact Uniqueness Result

## Files Changed

- `src/core/playspec-core.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_276_manual_artifact_uniqueness/spec.md`
- `docs/features/issue_276_manual_artifact_uniqueness/plan.md`
- `docs/features/issue_276_manual_artifact_uniqueness/result.md`

## Behavior Implemented

- Manual evidence collection now chooses the first available deterministic suffix while holding the task write lock.
- The first manual evidence call keeps the existing readable `_manual` filenames.
- Later manual evidence calls use `_manual2`, `_manual3`, and so on when any file in the candidate evidence set already exists.
- Manual snapshot collection uses the same deterministic suffix pattern.
- The first manual snapshot keeps `snapshots/phase1_manual_task.yaml`; the second uses `snapshots/phase1_manual2_task.yaml`.
- Completion artifact naming and routed visit-count suffix behavior remain unchanged.

## Verification Performed

- `pnpm vitest run tests/integration/completion-engine.test.ts`
  - Passed: 28 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 32 test files, 663 tests.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied because the implementation is already limited to the core artifact path helper and the focused integration test.
- Skipped broader cleanup of `writeSnapshots()` because completion snapshot behavior and prompt metadata writes are out of scope for this issue.

## Pull Request

- Draft PR: https://github.com/cksdnr1/playspec/pull/277
- Reusable agent guidance: not needed; the change follows existing artifact-writing patterns and does not introduce a new workflow convention.

## Remaining Risks

- No known implementation risk remains for the scoped behavior.
- Existing tasks that already contain partial manual artifact sets will skip the collided suffix and write to the next available suffix, which is intentional to avoid overwrites.
