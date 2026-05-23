# Issue 156 Implementation Plan

## Ordered Steps

1. Extend workflow types and schema.
   - Edit `src/core/types.ts` to add `WorkflowBuiltinShadow` metadata on `ResolvedWorkflow` and `WorkflowDefinition`.
   - Edit `src/core/schemas.ts` to parse optional `builtinShadow.accepted`.

2. Add same-id built-in shadow detection in `WorkflowLoader`.
   - In `src/workflow/workflow-loader.ts`, resolve the normal location as today.
   - If the normal location source is `project` or `user`, check whether a built-in workflow with the same id exists.
   - Parse and validate both definitions.
   - Compare effective assets: parsed workflow definition with `builtinShadow` ignored, plus all files under each `templates` directory.
   - If different and not accepted, return the built-in workflow as the selected render source with metadata that identifies the shadowing local source and fallback.
   - If different and accepted, return the local workflow with metadata that identifies the accepted override.
   - If identical, return the local workflow with identical shadow metadata.

3. Surface the metadata in workflow inspection.
   - Edit `src/cli/commands/workflow.ts` so `workflow show <id>` prints source, selected source when fallback occurs, and a concise built-in shadow status.
   - Keep `workflow list` output stable unless the loader metadata can be shown without breaking existing tests.

4. Cover prompt rendering behavior.
   - Add an integration test in `tests/integration/workflow-loader.test.ts` that mutates project-local `issue-scope-create` templates to stale content, creates an `issue-scope-create` task, renders the prompt through `PlaySpecCore`, and asserts current built-in duplicate-replacement text is present while stale local text is absent.
   - Add a generic loader test proving an unaccepted stale project shadow falls back to built-in and an accepted override remains usable.

5. Cover workflow inspection visibility.
   - Update `tests/cli.test.ts` to assert `workflow show` reports project override shadow metadata and selected built-in fallback when a same-id project workflow differs from the built-in.

6. Validate.
   - Run focused tests first: `pnpm test -- tests/integration/workflow-loader.test.ts tests/cli.test.ts`.
   - Run `pnpm build`.
   - Run full `pnpm test` if focused tests/build pass.

## Files To Edit

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/workflow/workflow-loader.ts`
- `src/cli/commands/workflow.ts`
- `tests/integration/workflow-loader.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_156_stale_workflow_shadowing/result.md`
- `docs/features/issue_156_stale_workflow_shadowing/pr.md`

## Old Paths, Bypasses, And Migration Risks

- Old path: `WorkflowRegistry.resolve()` still returns project before built-in. The implementation must not change registry precedence globally.
- Bypass: `resolveFromDirectory()` is explicit validation, not normal id resolution, and should not fallback to built-in.
- Partial migration risk: `WorkflowLoader.load()` returns only `WorkflowDefinition`; prompt metadata must rely on `resolve()` when it needs source metadata, but prompt content is protected because `load()` delegates to `resolve()`.
- User-visible path: `workflow show` must expose the shadow/fallback status so operators can diagnose why built-in content is selected.

## Risks

- Comparing raw workflow files would mark accepted metadata as a content difference. The comparison must normalize away `builtinShadow` and compare rendered assets that affect execution.
- Fallback must not make custom workflows unavailable when no built-in id exists.
- Accepted local overrides should remain explicit and easy to audit from `workflow show`.

## Rollback Notes

The change is confined to workflow loading, type/schema parsing, CLI inspection output, and tests. Reverting those files restores existing source precedence behavior.

## Completion Criteria

- Stale same-id project workflow prompts no longer silently render stale project templates.
- `workflow show issue-scope-create` identifies a project/user built-in shadow and whether it is identical, accepted, or falling back to built-in.
- Explicitly accepted project overrides remain usable.
- Focused tests, build, and full test suite pass or any failure is reported with exact command output.
