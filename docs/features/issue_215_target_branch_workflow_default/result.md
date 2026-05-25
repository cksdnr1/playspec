# Issue 215 Implementation Result

## Files Changed

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_215_target_branch_workflow_default/spec.md`
- `docs/features/issue_215_target_branch_workflow_default/plan.md`
- `docs/features/issue_215_target_branch_workflow_default/result.md`

## Behavior Implemented

- `TARGET_BRANCH` now remains empty while declaration defaults are resolved, so workflow and phase declaration defaults can populate it.
- The resolver applies `origin/master` as an explicit final fallback only when no declaration default or non-empty task variable supplies `TARGET_BRANCH`.
- Non-empty task variables still override workflow and phase defaults because task variables remain the final spread in the returned variable map.
- Mono-spec behavior remains unchanged because mono-spec declares `TARGET_BRANCH.default: origin/master`.

## Verification Performed

- Added a failing unit test proving `TARGET_BRANCH.default: origin/main` was previously ignored in favor of `origin/master`.
- Added unit coverage that non-empty task `TARGET_BRANCH` overrides workflow and phase defaults.
- Added render-path integration coverage where a phase requires `TARGET_BRANCH` and the workflow declaration default is `origin/main`.

Commands run:

- `pnpm test -- tests/unit/variable-resolver.test.ts` failed before implementation with expected `origin/master` vs `origin/main`.
- `pnpm test -- tests/unit/variable-resolver.test.ts` passed after implementation.
- `pnpm test -- tests/integration/init-create-next.test.ts` passed after implementation.
- `pnpm build` passed.
- `pnpm test` passed: 24 test files, 526 tests.

## Remaining Risks

- No known functional risks remain.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied. The resolver change is intentionally small, and the `TARGET_BRANCH` spread order is the behavior under test.
- Skipped unrelated cleanup in tests and workflow docs to keep the change scoped to issue #215.

## PR Preparation

- Draft PR notes written to `docs/features/issue_215_target_branch_workflow_default/pr.md`.
- Reusable agent guidance update: not needed. Existing repository guidance covers the relevant boundaries and this change adds no new recurring workflow rule.
