# Implementation Result

## Files Changed

- `src/core/playspec-core.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/spec.md`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/plan.md`

## Behavior Implemented

- Terminal completion now preflights finalized artifact resolution before completion artifacts and task state are written.
- Finalized artifact path variable resolution now uses `resolveAndAssertRequiredVariables()` with artifact path placeholders as additional demanded variables.
- Missing required variables needed by finalized artifact paths now return the existing missing-required-variable MCP error instead of producing unresolved placeholder paths.
- Valid finalized artifact metadata remains unchanged, including declaration-default-backed paths such as `{{RESULT_FILE}}`.

## Verification

- `pnpm vitest run tests/integration/mcp-server.test.ts`
- `pnpm vitest run tests/unit/variable-resolver.test.ts`
- `pnpm build`

## Tests Changed

- Added MCP integration coverage for terminal completion rejecting a missing required variable referenced by a finalized artifact path.
- Kept existing positive MCP terminal finalized artifact coverage for declaration-default-backed artifact paths.

## Test Notes

- Initial MCP integration run failed because the new test asserted an internal `currentPhase` value for a newly created active task. The assertion was narrowed to the required state invariant: the failed terminal completion leaves the task `active`.
- Final targeted runs passed.

## Safe Refactor Review

- Ran `git diff --check`; no whitespace or patch formatting issues were found.
- No additional refactor was applied because the implementation is already limited to the existing completion helper path and one focused integration test.

## PR Preparation

- Draft PR notes written in `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/pr.md`.
- Reusable agent guidance was not added because this change uses existing core validation patterns and does not introduce a new durable agent rule.
- Draft PR: https://github.com/cksdnr1/playspec/pull/292

## Remaining Risks

- Workflows that previously completed with unresolved required artifact placeholders now fail earlier at terminal completion. This is intentional and matches prompt rendering behavior.
