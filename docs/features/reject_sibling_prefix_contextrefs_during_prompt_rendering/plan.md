# Implementation Plan

## Ordered Steps

1. Confirm current production boundary behavior.
   - File: `src/core/playspec-core.ts`
   - Verify `assertContextRefsExist()` uses `isWithinWorkspace()` before any context body reads.
   - Verify `isWithinWorkspace()` accepts only the workspace root itself or paths starting with `workspaceRoot + path.sep`.
   - Expected result: no production edit unless focused tests fail.

2. Add focused archived positive integration coverage.
   - File: `tests/integration/init-create-next.test.ts`
   - Add a test near the existing context ref prompt-rendering tests.
   - Create `.playspec/tasks/archived/done_task/outputs/result.md` inside the temp workspace.
   - Store that workspace-relative archived artifact path in an active task `contextRefs`.
   - Render compact, strict, and full context modes via `PlaySpecCore.renderNextPrompt()`.
   - Assert compact output includes the path and compact summary section without fenced full content.
   - Assert strict/full output includes `## Context Files`, the archived path, and the archived artifact content.

3. Run focused validation.
   - Command: `pnpm test -- --run tests/integration/init-create-next.test.ts -t "contextRef|context refs|context modes|archived"`
   - If the test name filter is too broad or misses the new case, run the full file instead.

4. Run repository validation.
   - Command: `pnpm build`
   - Command: `pnpm test -- --run tests/integration/init-create-next.test.ts`
   - Add broader `pnpm test` only if the focused file exposes cross-suite risk.

5. Record results.
   - File: `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/result.md`
   - Include production-code status, changed files, and exact validation commands.

6. Prepare PR notes.
   - File: `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/pr.md`
   - Include `Fixes #162`, summary, changed files, tests run, PlaySpec task id, and risk notes.

## Files To Edit

- `tests/integration/init-create-next.test.ts`
- `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/result.md`
- `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/pr.md`

Production file `src/core/playspec-core.ts` is in review scope but not expected to change because the stricter helper is already present.

## Tests To Add Or Update

- Add one integration test proving explicit archived workspace-relative context refs under `.playspec/tasks/archived/...` render successfully in compact, strict, and full modes.
- Keep the existing sibling-prefix rejection test unchanged.
- Keep the existing normal workspace-relative context mode test unchanged.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path risk: stored YAML `contextRefs` can bypass `addContextRef()`.
- Closure: render-time `assertContextRefsExist()` already guards these stored refs before prompt body reads.
- Migration risk: migration-added refs can be stored directly.
- Closure: the same render-time guard applies.
- Archived refs: explicit archived artifact paths are normal workspace-relative paths and should remain valid.

## Rollback Notes

The implementation is test-only unless validation discovers a production regression. Rollback would remove the added integration test and generated feature docs.

## Completion Criteria

- Focused integration coverage includes sibling-prefix rejection, normal context mode rendering, and explicit archived context mode rendering.
- `renderNextPrompt()` continues to reject invalid stored context refs with `MissingContextRefError`.
- `pnpm build` passes.
- Focused integration test command passes.
- PR notes include changed files, tests, PlaySpec task id, and risk notes.
