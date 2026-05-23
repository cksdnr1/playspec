# Draft PR: Issue 149 Context Ref Boundary

Fixes #149

## Summary

- Shared workspace-boundary validation between add-time and render-time context ref checks.
- Hardened `assertContextRefsExist()` so sibling paths that merely share the workspace path prefix are rejected before context files are read.
- Added an integration regression for a manually stored `../<workspace>-sibling/context.md` ref in the prompt rendering path.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_149_context_ref_boundary/spec.md`
- `docs/features/issue_149_context_ref_boundary/plan.md`
- `docs/features/issue_149_context_ref_boundary/result.md`
- `docs/features/issue_149_context_ref_boundary/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/init-create-next.test.ts`
- `pnpm test`
- `pnpm build`

Skipped: none.

## PlaySpec Task

- `issue_149_context_ref_boundary`

## Risk Notes

- Render-time boundary failures still surface as `MissingContextRefError` to preserve existing CLI/MCP caller handling.
- Manually edited task YAML that references files outside the workspace will now fail at prompt rendering, which is the intended correctness behavior.

## Reusable Agent Guidance

No reusable agent guidance needs to be added. The fix is a narrow path-boundary validation change covered by a focused regression.
