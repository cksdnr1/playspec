# Implementation Plan

## Ordered Steps

1. Verify the current implementation path.
   - Inspect `src/core/playspec-core.ts`.
   - Confirm `renderNextPrompt()` and `renderExplicitPhasePrompt()` call `assertContextRefsExist()` before prompt rendering.
   - Confirm `assertContextRefsExist()` rejects absolute refs and uses separator-aware workspace containment.
   - Confirm `addContextRef()` and persisted-ref validation share the same `isWithinWorkspace()` helper.

2. Verify regression coverage.
   - Inspect `tests/integration/init-create-next.test.ts`.
   - Confirm a test constructs a temp workspace plus sibling directory whose path shares the workspace prefix.
   - Confirm the task stores a relative escape path to that sibling directory.
   - Confirm `renderNextPrompt()` rejects with `MissingContextRefError`.
   - Confirm valid in-workspace context refs remain covered by the existing context-mode rendering tests.

3. Run validation.
   - Run the targeted integration test file with Vitest.
   - Run the repository build.
   - Run the full test suite if targeted validation passes.

4. Decide implementation action.
   - If validation passes and no vulnerable `startsWith(path.resolve(this.workspaceRoot))` guard remains, make no production/test change.
   - If validation fails, patch `assertContextRefsExist()` to call the separator-aware helper and update/add the sibling-prefix regression test.

5. Record result.
   - Write `result.md` with exact commands, outcome, changed files, and whether the issue was already resolved on `origin/master`.
   - If no production/test changes are needed, report the blocker: a draft PR would be code-empty or documentation-only and the issue appears stale.

## Files To Edit

Expected:
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/spec.md`
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/plan.md`
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/result.md`

Conditional only if validation disproves the current implementation:
- `src/core/playspec-core.ts`
- `tests/integration/init-create-next.test.ts`

## Tests To Add Or Update

Expected:
- No new test if the existing sibling-prefix regression test passes.

Conditional:
- Add or update an integration test in `tests/integration/init-create-next.test.ts` only if the existing test does not satisfy issue #179.

## Old Paths, Bypasses, And Partial Migration Risks

- Old vulnerable path: direct prefix checks such as `resolved.startsWith(path.resolve(this.workspaceRoot))`.
- Bypass path: persisted `contextRefs` created outside `addContextRef()`.
- Migration risk: migrated tasks may carry invalid refs, so render-time validation must continue to reject them before prompt context variables are rendered.

## Risks

- Low implementation risk if no code change is needed.
- Process risk: the issue may be stale because `origin/master` already contains the requested guard and regression test.
- PR risk: creating a PR with only workflow documentation does not materially implement the issue.

## Rollback Notes

- Documentation-only PlaySpec artifacts can be removed without affecting runtime behavior.
- If a conditional code patch is made, rollback is limited to `src/core/playspec-core.ts` and the related integration test.

## Completion Criteria

- Targeted context-ref rendering tests pass.
- Build passes.
- Full test suite passes or any failure is clearly unrelated and reported.
- Final report includes exact validation commands and whether a draft PR was created or blocked by no-op/stale issue state.
