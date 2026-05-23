# Issue 149 Context Ref Boundary Implementation Plan

## Ordered Steps

1. Add a private workspace-boundary helper in `src/core/playspec-core.ts`.
   - Helper input: resolved absolute path and resolved workspace root.
   - Helper result: true only when the path equals the workspace root or starts with `workspaceRoot + path.sep`.

2. Align `addContextRef()` with the helper.
   - Preserve existing behavior and errors.
   - Keep rejecting absolute input paths before resolving.
   - Keep throwing `ContextPathEscapesWorkspaceError` for add-time escape attempts.

3. Harden `assertContextRefsExist()`.
   - Keep rejecting absolute stored refs with `MissingContextRefError`.
   - Resolve the stored ref against `workspaceRoot`.
   - Reject refs outside the workspace with `MissingContextRefError` before `access()`.
   - Keep missing-file behavior unchanged.

4. Add integration regression coverage in `tests/integration/init-create-next.test.ts`.
   - Create a temp workspace and initialize the default preset.
   - Create a sibling directory whose name shares the workspace root string prefix.
   - Write a context file in the sibling directory.
   - Store a task `contextRefs` path that reaches the sibling through `../<sibling>/context.md`.
   - Assert `core.renderNextPrompt(taskId)` rejects with `MissingContextRefError`.

5. Run focused and broad validation.
   - Focused: `pnpm vitest run tests/integration/init-create-next.test.ts`.
   - Broad: `pnpm test`.
   - Build: `pnpm build`.

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/init-create-next.test.ts`

## Tests To Add Or Update

- Add one regression integration test near the existing `renderNextPrompt` context-ref tests.
- Existing valid context rendering coverage should remain unchanged and passing.

## Old Paths, Bypasses, And Partial Migration Risks

- Old vulnerable path: stored `contextRefs` entries that bypass `addContextRef()` through direct YAML writes or `YamlTaskStore.updateTask()`.
- Add-time path is already safe; refactoring it to the helper prevents future drift.
- No migration is needed. Existing out-of-workspace manual refs will fail at render time, which is desired.

## Risks

- The `MissingContextRefError` message remains generic for boundary failures. This preserves existing caller compatibility but is less descriptive than `ContextPathEscapesWorkspaceError`.
- Path separator behavior is platform-sensitive; using `path.sep` matches the existing add-time semantics.

## Rollback Notes

- Revert the helper usage and regression test if needed.
- No persistent storage schema or migration changes are introduced.

## Completion Criteria

- Render-time validation rejects sibling-prefix workspace escapes.
- Valid in-workspace context refs still render.
- `addContextRef()` and `assertContextRefsExist()` use consistent boundary semantics.
- Focused integration test, full test suite, and build pass.
