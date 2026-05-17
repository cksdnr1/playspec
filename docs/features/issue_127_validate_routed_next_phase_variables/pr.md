# Draft PR

Fixes #127

## Summary

- Adds a preflight in `PlaySpecCore.completePhase()` that validates the computed next phase's required variables before completion artifacts or task state are written.
- Reuses the same variable resolution and `assertRequiredVariables()` semantics used by prompt rendering.
- Adds core and CLI regressions for routed completion into a phase missing `CUSTOM_REQUIRED`.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/integration/routing.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_127_validate_routed_next_phase_variables/spec.md`
- `docs/features/issue_127_validate_routed_next_phase_variables/plan.md`
- `docs/features/issue_127_validate_routed_next_phase_variables/result.md`
- `docs/features/issue_127_validate_routed_next_phase_variables/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/routing.test.ts tests/cli.test.ts`
- `pnpm test`
- `pnpm build`

## PlaySpec Task

- `issue_127_validate_routed_next_phase_variables`

## Risk Notes

- The preflight only checks required variables; it intentionally does not render the target prompt or perform unrelated context reads.
- MCP completion is covered through the core `completePhase()` path.
- Reusable agent guidance: no new guidance needed; this is a localized core validation fix.
