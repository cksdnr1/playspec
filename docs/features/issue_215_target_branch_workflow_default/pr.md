# PR: Let workflow TARGET_BRANCH defaults override fallback

Fixes #215

## Summary

- Makes the resolver treat `origin/master` as a late `TARGET_BRANCH` fallback instead of a pre-resolved engine value.
- Allows workflow or phase `TARGET_BRANCH.default` declarations, such as `origin/main`, to drive prompt rendering and required-variable validation.
- Keeps non-empty task `TARGET_BRANCH` values as the highest precedence.
- Keeps built-in mono-spec behavior at `origin/master`.

## Changed Files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_215_target_branch_workflow_default/spec.md`
- `docs/features/issue_215_target_branch_workflow_default/plan.md`
- `docs/features/issue_215_target_branch_workflow_default/result.md`
- `docs/features/issue_215_target_branch_workflow_default/pr.md`

## Tests Run

- `pnpm test -- tests/unit/variable-resolver.test.ts`
- `pnpm test -- tests/integration/init-create-next.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_215_target_branch_workflow_default`

## Risk Notes

- The behavior change is intentionally scoped to `TARGET_BRANCH`; other engine variables keep their existing precedence.
- No persisted task format, workflow schema, MCP behavior, migration behavior, or git branch detection changed.

## Reusable Agent Guidance

No reusable agent guidance update is needed. The repository guidance already says to use path aliases and to keep Core independent from CLI; this change follows those rules.
