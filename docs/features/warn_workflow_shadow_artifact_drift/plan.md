# Warn Workflow Shadow Artifact Drift Implementation Plan

## Ordered Steps

1. Update `src/core/types.ts`.
   - Add `WorkflowDiagnostic`, `WorkflowDiagnosticDetail`, and a warning code type for `workflow_builtin_shadow_artifact_drift`.
   - Add `diagnostics?: WorkflowDiagnostic[]` to `ResolvedWorkflow`.
   - Keep `WorkflowBuiltinShadow` as metadata only; remove fallback semantics from its fields or stop setting fallback-only fields.

2. Update `src/workflow/workflow-loader.ts`.
   - Ensure `resolve()` always returns the registry-selected project/user workflow when source precedence selects it.
   - Compare selected project/user workflows against same-ID built-ins using only `version`, workflow `artifacts`, and each phase `outputs`.
   - Attach a diagnostic warning when those fields differ.
   - Include workflow ID, active source/root, built-in source/root, and field-level drift details.
   - Add `listWithDiagnostics()` that loads every effective location from `WorkflowRegistry.list()` and applies the same diagnostic attachment logic.
   - Remove full template comparison and built-in fallback behavior from the resolution path.

3. Keep `src/workflow/workflow-registry.ts` precedence unchanged.
   - Do not load YAML or templates in the registry.
   - Do not alter `resolve()` or `list()` source ordering.

4. Update `tests/integration/workflow-loader.test.ts`.
   - Replace stale fallback expectations with diagnostics-only expectations.
   - Add project shadow and user shadow warning tests.
   - Add a negative test where artifact/output/version fields match but prompt/template content differs.
   - Add an `issue-scope-create` regression using a copied older project workflow definition with differing artifact/output paths.
   - Add `listWithDiagnostics()` coverage that exposes warnings while retaining effective source precedence.
   - Keep existing project-before-user-before-builtin tests passing, adjusted only where prior tests used `builtinShadow.accepted` to avoid fallback.

## Files To Edit

- `src/core/types.ts`
- `src/workflow/workflow-loader.ts`
- `tests/integration/workflow-loader.test.ts`
- `docs/features/warn_workflow_shadow_artifact_drift/result.md`
- `docs/features/warn_workflow_shadow_artifact_drift/pr.md`

## Tests To Run

- `pnpm test -- tests/integration/workflow-loader.test.ts`
- `pnpm build`
- `pnpm test`

## Risks

- Existing tests encode earlier fallback behavior. Update them to issue #228's precedence-preserving contract, not to both behaviors.
- Diagnostics must avoid comparing full templates; prompt-only customizations should not warn.
- Drift details must be stable enough for assertions without overfitting to object serialization order.

## Rollback Notes

The change is local to workflow loading types/tests. Reverting the commit restores the previous fallback behavior and test expectations. No migration or installed workflow mutation is involved.

## Completion Criteria

- `WorkflowLoader.resolve()` returns the active project/user workflow when it shadows a built-in workflow.
- `ResolvedWorkflow.diagnostics` contains a stale artifact/output/version warning only when diagnostic fields differ.
- `WorkflowLoader.listWithDiagnostics()` exposes equivalent warning metadata for effective workflow listing.
- Matching artifact/output/version definitions produce no warning even when templates differ.
- `issue-scope-create` stale project copy is covered by regression tests.
- Targeted workflow-loader tests, full test suite, and build pass.
