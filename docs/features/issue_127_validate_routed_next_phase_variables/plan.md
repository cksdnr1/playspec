# Implementation plan

## Ordered Steps

1. Add shared required-variable validation in `src/core/playspec-core.ts`.
   - Extract the variable-resolution plus `assertRequiredVariables()` portion of `renderResolvedPhase()` into a private helper.
   - Keep `renderResolvedPhase()` using that helper so prompt rendering behavior stays unchanged.

2. Preflight the computed next phase in `PlaySpecCore.completePhase()`.
   - After `resolveRoutedCompletion()` returns `{ nextPhase }`, call the helper when `nextPhase !== null`.
   - Resolve the next phase definition from `workflow.definition.phases[nextPhase]`.
   - Throw the existing `MissingRequiredVariablesError` if variables are absent.
   - Do this before rendering the current prompt snapshot and before `withWriteLock()`.

3. Add core integration coverage in `tests/integration/routing.test.ts`.
   - Use a routed workflow where `approved` targets `implementation`.
   - Make `implementation` require `CUSTOM_REQUIRED`.
   - Assert `core.completePhase(taskId, { result: 'approved' })` rejects with `MissingRequiredVariablesError`.
   - Assert `currentPhase`, `phaseHistory`, `stateSync`, and `rollback` are unchanged.
   - Assert no snapshot/evidence files or completion ledger are written.

4. Add CLI coverage in `tests/cli.test.ts`.
   - Create a small gated workflow in a temp workspace where `approved` routes to a required-variable target.
   - Run `playspec complete --result approved`.
   - Assert exit code `1`, stderr includes the missing-variable error, stdout does not report successful completion, and the task stays on the original phase with no history.

5. Run validation.
   - Focused: `pnpm vitest run tests/integration/routing.test.ts tests/cli.test.ts`.
   - Full test suite: `pnpm test`.
   - Build: `pnpm build`.

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/routing.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_127_validate_routed_next_phase_variables/result.md`
- `docs/features/issue_127_validate_routed_next_phase_variables/pr.md`

## Old Paths And Bypasses

- CLI post-completion render warning remains useful for non-preflight render failures, but missing next-phase required variables should no longer reach that path.
- MCP completion delegates to core completion, so no MCP-specific edit is needed.
- Manual `phase` recovery remains out of scope.

## Risks

- The preflight must not duplicate required-variable rules; it must call the same assertion helper used by prompt rendering.
- The preflight should not render templates or append context sections.
- Artifact absence assertions should check for no artifact files, not necessarily absent directories.

## Rollback Notes

The implementation is localized. Rollback is a simple code/test revert of the helper/preflight and the new tests.

## Completion Criteria

- Core completion rejects before writes when routed next phase variables are missing.
- CLI completion exits non-zero for the same case.
- Successful routed completion tests continue to pass.
- Focused tests, full tests, and build pass.
