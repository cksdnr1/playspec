# Issue 149 Context Ref Boundary Result

## Files Changed

- `src/core/playspec-core.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_149_context_ref_boundary/spec.md`
- `docs/features/issue_149_context_ref_boundary/plan.md`
- `docs/features/issue_149_context_ref_boundary/result.md`

## Behavior Implemented

- Added a shared private workspace-boundary predicate in `PlaySpecCore`.
- Aligned `addContextRef()` and `assertContextRefsExist()` to accept only the workspace root itself or descendants separated by `path.sep`.
- Kept render-time rejection on absolute, missing, or escaping stored context refs as `MissingContextRefError`.
- Added an integration regression for a sibling directory whose absolute path shares the workspace root string prefix.

## Verification Performed

- `pnpm vitest run tests/integration/init-create-next.test.ts`
  - Passed: 43 tests.
- `pnpm test`
  - Passed: 24 test files, 484 tests.
- `pnpm build`
  - Passed.

## Tests Changed

- Added `renderNextPrompt refuses a sibling contextRef path that shares the workspace path prefix` in `tests/integration/init-create-next.test.ts`.

## Safe Refactor Review

- The only refactor is the local `isWithinWorkspace()` helper in `PlaySpecCore`, shared by add-time and render-time context validation.
- No additional cleanup was applied because the current diff is already narrow and scope-bound.

## Pull Request

- Draft PR: https://github.com/cksdnr1/playspec/pull/168

## Remaining Risks

- Boundary failures still use the existing generic `MissingContextRefError` wording. This preserves existing caller handling and matches the issue acceptance criteria, but the message is not as specific as add-time `ContextPathEscapesWorkspaceError`.
