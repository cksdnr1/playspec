# Issue #237 implementation plan

## Ordered implementation steps

1. Add a regression test in `tests/unit/variable-resolver.test.ts`.
   - Construct workflow `unused-cycle` with `FEATURE_SLUG` required and unused workflow variables `A: "{{B}}"`, `B: "{{A}}"`.
   - Active phase `start` should require only `FEATURE_SLUG`.
   - Assert `VariableResolver.resolve()` succeeds, keeps `FEATURE_SLUG`, and leaves `A` and `B` undefined.

2. Preserve demanded-cycle coverage.
   - Keep the existing `throws a clear error for circular default references` test where `requiredVariables: ["A"]`.
   - No behavior change is expected for demanded variables or demanded dependency chains.

3. Update `src/template/variable-resolver.ts`.
   - In `resolveDeclaredDefaults()`, extend the existing non-demanded default deferral path.
   - Suppress `CircularVariableDefaultError` only when the root default currently being resolved is not demanded.
   - Continue throwing `CircularVariableDefaultError` for demanded roots and for cycles reached by demanded defaults.

4. Run focused validation first.
   - `pnpm test -- tests/unit/variable-resolver.test.ts`

5. Run repository validation.
   - `pnpm build`
   - `pnpm test`

## Files to edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`

## Tests to add or update

- Add one unit test for a non-demanded workflow-level circular default cycle.
- Keep existing demanded cycle test as acceptance coverage.
- No `PlaySpecCore` integration test is needed unless implementation changes demand calculation outside `VariableResolver`.

## Active path trace

Entry point: prompt rendering or tests call `VariableResolver.resolve()`.

State/data update: resolver builds `resolved` defaults from engine variables, task variables, and declarations.

Propagation: resolved variables are returned to template rendering and required-variable checks.

Reset/clear: not applicable; resolver is stateless per call.

User-visible behavior: an unrelated active phase prompt renders instead of failing on unused future defaults.

## Old paths, bypass paths, and partial migration risks

- Old path: all declarations are still iterated eagerly; this stays unchanged.
- Bypass path: non-empty task variables still bypass defaults.
- Bypass path: reserved engine variables still cannot be overridden by task variables.
- Partial migration risk: suppressing circular errors without checking demand would hide required bad defaults. The implementation must keep the existing demanded flag as the boundary.

## Risks

- Main risk: incorrectly suppressing demanded cycles. Covered by the existing demanded-cycle unit test.
- Secondary risk: changing unknown dependency behavior. Avoided by only adding `CircularVariableDefaultError` to the existing non-demanded suppression condition.

## Rollback notes

The change is limited to one resolver catch condition and one unit test. Rollback is a normal git revert of the commit if validation finds unexpected demand behavior.

## Completion criteria

- Unused `A -> B -> A` workflow defaults no longer block resolving a phase that only demands `FEATURE_SLUG`.
- Demanded `A -> B -> A` defaults still throw `CircularVariableDefaultError`.
- Focused unit tests pass.
- Full build and test suite pass.
