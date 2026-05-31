# Draft PR

Fixes #291

## Summary

- Validate finalized workflow artifact path variables with the existing required-variable assertion path.
- Preflight terminal finalized artifact resolution before completion writes and task state mutation.
- Add MCP integration coverage for missing required variables in finalized artifact paths.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/spec.md`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/plan.md`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/result.md`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/mcp-server.test.ts`
- `pnpm vitest run tests/unit/variable-resolver.test.ts`
- `pnpm build`

## PlaySpec Task ID

`issue_291_validate_required_variables_before_rendering_finalized_artifact_paths`

## Risk Notes

- Workflows that previously completed with unresolved required artifact placeholders now fail at terminal completion. This is intentional and aligns finalized artifact validation with prompt rendering.

## Reusable Agent Guidance

No reusable agent guidance needs to be added. This change follows existing core helper patterns and does not introduce a new workflow rule.
