# Issue 156 Implementation Result

## Behavior Implemented

- `WorkflowLoader.resolve()` now detects project/user workflows that shadow a same-id built-in workflow.
- If the local shadow differs from built-in assets and is not explicitly accepted with `builtinShadow.accepted: true`, prompt resolution uses the built-in workflow and attaches shadow metadata.
- If the local shadow differs and is explicitly accepted, the local project/user workflow remains usable.
- `workflow show <id>` reports built-in shadow status, acceptance, and built-in fallback selection.
- Workflow edit commands continue to edit explicit project workflow directories instead of being redirected by normal built-in fallback resolution.

## Files Changed

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/workflow/workflow-loader.ts`
- `src/workflow/workflow-editor.ts`
- `src/cli/commands/workflow.ts`
- `tests/integration/workflow-loader.test.ts`
- `tests/cli.test.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/init-create-next.test.ts`

## Verification Performed

- `pnpm test -- tests/integration/workflow-loader.test.ts tests/cli.test.ts` passed.
- `pnpm test -- tests/integration/completion-engine.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts` passed.
- `pnpm test -- tests/integration/workflow-editor.test.ts` passed.
- `pnpm build` passed.
- `pnpm test` passed: 24 test files, 498 tests.

## Remaining Risks

- Explicit acceptance is a YAML field, not a guided CLI command. Operators can still accept by editing `workflow.yaml`.
- `workflow list` remains compact; detailed shadow diagnostics are exposed through `workflow show`.

## PR Preparation

- Reusable agent guidance documented: no. This is project behavior covered by code and regression tests.
- PR link: https://github.com/cksdnr1/playspec/pull/172
