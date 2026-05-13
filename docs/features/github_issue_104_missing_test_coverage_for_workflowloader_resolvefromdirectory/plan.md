# Implementation Plan

## Goal

Add direct integration coverage for `WorkflowLoader.resolveFromDirectory()` and pin the builtin workflow root path expectation.

## Files To Edit

- `tests/integration/workflow-loader.test.ts`

No source files are expected to change.

## Ordered Steps

1. Add a test-local helper for explicit directory workflows.
   - Create `workflow.yaml` directly inside a supplied root directory.
   - Create `templates/start.md` under the same root.
   - Keep the existing `writeWorkflow(root, id, description)` helper for registry-root tests.

2. Add the valid `resolveFromDirectory()` test.
   - Build a custom workflow root under `workspace.dir`.
   - Call `new WorkflowLoader(workspace.dir).resolveFromDirectory(customRoot)`.
   - Assert:
     - `workflow.id`
     - `workflow.rootDir`
     - `workflow.templateDir`
     - `workflow.source`
     - representative parsed definition fields such as description, mode, and phase template.

3. Add the missing `workflow.yaml` test.
   - Create an empty directory under `workspace.dir`.
   - Call `resolveFromDirectory(emptyRoot)`.
   - Assert that the promise rejects. Avoid brittle platform-specific filesystem error text unless existing helpers expose stable error wording.

4. Add the direct builtin root assertion.
   - Instantiate `WorkflowRegistry`.
   - Compare the normalized path suffix with `dist/preset/assets/workflows`.
   - Keep this near other registry tests.

5. Validate.
   - Run focused integration test: `pnpm vitest run tests/integration/workflow-loader.test.ts`.
   - Run full build: `pnpm build`.
   - Run full test suite: `pnpm test`.

## Old Paths, Bypass Paths, Partial Migration Risks

- Old path: registry-backed `WorkflowLoader.resolve()` already has coverage and should remain unchanged.
- Bypass path: explicit directory loading bypasses `WorkflowRegistry`, so it needs direct coverage.
- Partial migration risk: none. This is a test-only change.

## Risks

- Path assertions can be platform-sensitive. Normalize path separators before checking the builtin root suffix.
- Filesystem rejection messages can vary. Use a broad rejection assertion for missing `workflow.yaml`.

## Rollback Notes

Revert the added tests in `tests/integration/workflow-loader.test.ts` if validation reveals the assumptions are wrong. No runtime behavior will need rollback because no source change is planned.

## Completion Criteria

- `tests/integration/workflow-loader.test.ts` directly exercises `resolveFromDirectory()` success and missing-file behavior.
- The test suite directly verifies `WorkflowRegistry.getBuiltinRoot()` points to the built preset workflow assets directory.
- Focused and full validation commands pass.
