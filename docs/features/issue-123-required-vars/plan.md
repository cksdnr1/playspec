# Implementation plan

## Ordered Steps

1. Add a shared required-variable assertion helper in `src/core/required-variables.ts`.
   - Inputs: workflow id, phase id, phase definition, workflow-level variable declarations, resolved variable map.
   - Behavior: combine workflow declarations, phase declarations, and `phase.requiredVariables`; throw `MissingRequiredVariablesError` using the existing message format when any resolved value is `undefined` or `''`.

2. Update `src/core/playspec-core.ts`.
   - Import the helper.
   - Remove the private duplicate assertion method.
   - Keep prompt rendering behavior unchanged by calling the helper from `renderResolvedPhase`.

3. Add normal-create preflight in `src/cli/commands/create.ts`.
   - Build the would-be persisted variables before `YamlTaskStore.createTask`, including `SOURCE_PROBLEM_FILE` when source input exists.
   - Build the would-be context refs and links.
   - Resolve the selected workflow and initial phase using `WorkflowLoader` and `PhaseResolver`.
   - Resolve variables with `VariableResolver`.
   - Call the shared required-variable assertion.
   - Only persist the task, write source content, and update HEAD after the assertion passes.

4. Add CLI integration tests.
   - Missing custom first-phase variable fails.
   - Failed create leaves previous HEAD unchanged and does not create the new active task directory.
   - Complete `--var` set succeeds and stores task variables.
   - Workflow default and phase default satisfy required variables without explicit `--var`.

5. Run targeted and full validation.
   - `pnpm test -- tests/integration/init-create-next.test.ts`
   - `pnpm build`
   - `pnpm test`

## Files To Edit

- `src/core/required-variables.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/create.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue-123-required-vars/result.md`
- `docs/features/issue-123-required-vars/pr.md`

## Tests To Add Or Update

- Use a temporary workflow in `.playspec/workflows/multi-spec/workflow.yaml` with first phase `CUSTOM_REQUIRED`.
- Invoke the CLI create command rather than calling Core directly for create-time coverage.
- Assert stderr contains the existing missing-variable text with workflow id, phase id, and variable name.
- Assert previous HEAD content remains unchanged and the rejected task directory is absent.
- Assert successful create stores user-provided variables in `task.yaml`.
- Add separate workflows or test cases for workflow default and phase default satisfaction.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: prompt rendering already validates required variables. It must continue to use the same helper.
- Bypass: normal create currently persists before validation. Preflight must run before all writes in `createNormalTask`.
- Partial migration risk: interactive create calls `createNormalTask`; the same preflight will cover it.
- Out-of-scope bypass: phase-execution create remains unchanged.

## Rollback Notes

The change is localized to required-variable validation and normal create. Rollback is a clean revert of the helper, create preflight, and tests. No data migration is introduced.

## Completion Criteria

- Missing first-phase variables fail before persistence.
- HEAD is unchanged on failed create.
- Valid `--var` creates still succeed.
- Workflow and phase defaults satisfy first-phase required variables.
- Existing prompt/Core missing-variable tests pass.
- Build and test commands pass.
