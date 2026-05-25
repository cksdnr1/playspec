# Issue 215 Implementation Plan

## Ordered Steps

1. Add failing resolver coverage.
   - Edit `tests/unit/variable-resolver.test.ts`.
   - Add a workflow with `TARGET_BRANCH.default: origin/main` and a phase that requires `TARGET_BRANCH`.
   - Assert a task without `TARGET_BRANCH` resolves `origin/main`.
   - Assert a task with non-empty `TARGET_BRANCH` resolves the task value over workflow and phase defaults.

2. Make `TARGET_BRANCH` fallback late and explicit.
   - Edit `src/template/variable-resolver.ts`.
   - Introduce a `TARGET_BRANCH_FALLBACK = 'origin/master'` constant.
   - Keep `TARGET_BRANCH` present in engine variables as an empty value during declaration default resolution so declaration defaults can populate it.
   - After `resolvedDefaults` and non-empty task variables are prepared, produce final variables in this order:
     - engine variables,
     - explicit fallback `{ TARGET_BRANCH: TARGET_BRANCH_FALLBACK }`,
     - resolved declaration defaults,
     - non-empty task variables.
   - This keeps the fallback when no declaration exists, lets workflow/phase defaults override it, and lets task variables remain highest precedence.

3. Validate mono-spec behavior.
   - Existing mono-spec unit and integration assertions should still resolve/render `origin/master` because mono-spec declares that same default.
   - No workflow file changes are expected.

4. Run focused then full validation.
   - `pnpm test -- tests/unit/variable-resolver.test.ts`
   - `pnpm test -- tests/integration/init-create-next.test.ts`
   - `pnpm build`
   - `pnpm test`

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_215_target_branch_workflow_default/result.md`
- `docs/features/issue_215_target_branch_workflow_default/pr.md`

## Tests To Add Or Update

- Add focused unit coverage for workflow `TARGET_BRANCH.default: origin/main`.
- Add focused unit coverage that explicit non-empty task `TARGET_BRANCH` wins over declaration defaults.
- Rely on existing integration coverage in `tests/integration/init-create-next.test.ts` for mono-spec render-path `origin/master` unless the focused tests expose a required-variable path gap.

## Active Entry Point Trace

Render path:

1. `PlaySpecCore.renderExplicitPhasePrompt()` or `renderNextPrompt()`.
2. `renderResolvedPhase()`.
3. `resolveAndAssertRequiredVariables()`.
4. `VariableResolver.resolve()`.
5. `assertRequiredVariables()` receives resolved `TARGET_BRANCH`.
6. `TemplateRenderer.render()` renders prompts with the selected branch.

Direct resolver path:

1. Unit tests and helper code call `VariableResolver.resolve()` directly.
2. The same late fallback rule applies.

## Old Paths And Bypasses

- Old path: `resolveDeclaredDefaults()` saw `TARGET_BRANCH=origin/master` as already resolved and skipped declaration defaults.
- Bypass risk: changing required-variable validation alone would not fix direct resolver callers. The resolver must own the precedence fix.
- Partial migration risk: making all engine variables late-overridable would create broad churn. Only `TARGET_BRANCH` should change behavior.

## Risks

- Low: Final spread order could accidentally make the fallback override declaration defaults. Tests must assert `origin/main`.
- Low: Empty task variables must continue to allow declaration defaults. Existing tests cover this behavior.
- Low: Mono-spec prompts must stay at `origin/master`. Existing tests cover this behavior.

## Rollback Notes

Rollback is a normal git revert of the resolver and test changes. No data migration or persisted task format change is involved.

## Completion Criteria

- Workflow default `TARGET_BRANCH.default: origin/main` resolves as `origin/main` without a task override.
- Non-empty task `TARGET_BRANCH` remains highest precedence.
- Mono-spec continues to resolve and render `origin/master`.
- Focused and full validation commands pass.
