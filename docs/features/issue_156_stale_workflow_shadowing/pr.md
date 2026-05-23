# Draft PR Notes

Fixes #156

## Summary

- Detect project/user workflows that shadow a same-id built-in workflow.
- Fall back to built-in assets for unaccepted stale shadows so prompt rendering does not silently lose newer built-in instructions.
- Surface shadow status in `playspec workflow show`.
- Keep explicit project workflow editing and explicitly accepted overrides usable.

## Changed Files

- `src/workflow/workflow-loader.ts`
- `src/workflow/workflow-editor.ts`
- `src/cli/commands/workflow.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `tests/integration/workflow-loader.test.ts`
- `tests/cli.test.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_156_stale_workflow_shadowing/spec.md`
- `docs/features/issue_156_stale_workflow_shadowing/plan.md`
- `docs/features/issue_156_stale_workflow_shadowing/result.md`
- `docs/features/issue_156_stale_workflow_shadowing/pr.md`

## Tests Run

- `pnpm test -- tests/integration/workflow-loader.test.ts tests/cli.test.ts`
- `pnpm test -- tests/integration/completion-engine.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
- `pnpm test -- tests/integration/workflow-editor.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_156_stale_workflow_shadowing`

## Risk Notes

- Operators accept an intentional same-id built-in shadow by setting `builtinShadow.accepted: true` in `workflow.yaml`.
- `workflow list` remains compact; detailed shadow/fallback diagnostics are in `workflow show`.

## Reusable Agent Guidance

No reusable agent guidance needs to be documented. The behavior is repository logic with focused tests.
