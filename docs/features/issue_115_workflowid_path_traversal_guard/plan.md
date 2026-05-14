# Implementation Plan

## Ordered Steps

1. Add a workflow path guard in `src/workflow/workflow-registry.ts`.
   - Export a small `assertSafeWorkflowId(workflowId: string): void` helper.
   - Reject null bytes, absolute paths, and any path segment equal to `..`.
   - Preserve valid IDs containing hyphens, underscores, and dots.
   - Call it at the top of `WorkflowRegistry.resolve()` before any source iteration or filesystem access.

2. Apply the guard at loader entry points in `src/workflow/workflow-loader.ts`.
   - Call `assertSafeWorkflowId()` in `load()` and `resolve()`.
   - Keep `load()` delegating to `resolve()` after validation.
   - Use `path.join()`/`path.resolve()` instead of string interpolation for `workflow.yaml` and `templates`.

3. Harden `WorkflowLoader.resolveFromDirectory(rootDir)`.
   - Resolve the input directory to an absolute normalized path.
   - Compare it against registry project, user, and builtin workflow roots.
   - Accept only direct children of those roots.
   - Reject absolute paths outside known roots, traversal-resolved paths outside known roots, nested invalid structures, and null bytes.
   - Derive and validate the workflow ID from the final directory name.
   - Return the matched source instead of always returning `user`.

4. Extend `tests/integration/workflow-loader.test.ts`.
   - Add malicious workflow ID rejection tests for `../`, `../../etc`, null byte, and absolute paths against `WorkflowRegistry.resolve()` and `WorkflowLoader.load()`.
   - Assert rejection happens before filesystem access by creating an escaped workflow-shaped directory and confirming it is still rejected.
   - Add `resolveFromDirectory()` tests for project/user/builtin source labeling.
   - Add invalid structure tests for nested workflow directories, outside directories, and traversal paths.
   - Keep existing precedence tests unchanged.

5. Run validation.
   - `pnpm test tests/integration/workflow-loader.test.ts`
   - `pnpm test`
   - `pnpm build`

## Files To Edit

- `src/workflow/workflow-registry.ts`
- `src/workflow/workflow-loader.ts`
- `tests/integration/workflow-loader.test.ts`
- `docs/features/issue_115_workflowid_path_traversal_guard/result.md`
- `docs/features/issue_115_workflowid_path_traversal_guard/pr.md`

## Tests To Add Or Update

- Registry/loader validation rejects traversal workflow IDs.
- Loader validation rejects null bytes and absolute workflow IDs.
- `resolveFromDirectory()` labels `project`, `user`, and `builtin` sources correctly.
- `resolveFromDirectory()` rejects directories that are not direct workflow roots under known source roots.
- Existing happy path and precedence tests remain passing.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: `WorkflowRegistry.rootFor()` currently joins raw IDs. The new guard must run before `rootFor()`.
- Bypass path: direct `WorkflowLoader.load()` callers should get the same validation as direct `WorkflowRegistry.resolve()` callers.
- Bypass path: direct `resolveFromDirectory()` callers should not be able to load arbitrary filesystem directories.
- Partial migration risk: leaving string-interpolated path construction in `resolveFromDirectory()` would keep avoidable normalization ambiguity.

## Risks

- Overly strict validation could reject existing valid workflow IDs. Guard only the requested unsafe cases.
- `resolveFromDirectory()` behavior changes from always returning `user` to actual source labeling. Tests must lock in expected labels.
- Error messages should be explicit but should not leak extra filesystem details.

## Rollback Notes

Revert the workflow guard helper, loader normalization, and new integration tests. No persisted data migration is involved.

## Completion Criteria

- Malicious workflow IDs throw before workflow file access.
- Direct directory loading is restricted to direct workflow directories under known project, user, or builtin roots.
- All new and existing workflow loader tests pass.
- Full test suite and build pass.
