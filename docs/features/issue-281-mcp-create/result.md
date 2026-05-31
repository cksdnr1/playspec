# Implementation Result

## Files Changed

- `src/core/task-creation.ts`: added shared non-interactive normal task creation.
- `src/cli/commands/create.ts`: routed CLI normal and interactive create flows through the shared helper while preserving output.
- `src/mcp/server.ts`: registered `playspec_create_task` with workspace scoping, source input, variables, links, and optional session binding.
- `tests/integration/mcp-server.test.ts`: added MCP integration coverage for task creation, rendering, missing variables, and explicit workspace creation.
- `docs/features/issue-281-mcp-create/spec.md`: technical spec.
- `docs/features/issue-281-mcp-create/plan.md`: implementation plan.

## Behavior Implemented

- MCP clients can create PlaySpec tasks without CLI fallback using `playspec_create_task`.
- The create tool supports `title`, `workflow`, optional `taskId`, string variables, source problem text, source problem file, parent/after links, explicit `workspaceRoot`, and optional `bindSessionId`.
- Created source problem text is stored at the task-local `sources/source_problem.md` path and exposed through `SOURCE_PROBLEM_FILE` plus a `source-problem` context ref.
- CLI create and MCP create share the same workspace initialization, workflow resolution, initial phase required-variable validation, task persistence, source storage, link resolution, and HEAD update path.
- Explicit MCP workspace creation writes tasks, source files, HEAD, and session bindings under the explicit project workspace rather than the MCP server workspace.

## Verification Performed

- `pnpm test -- tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

All validation commands passed.

## Focused Test Coverage

- Added MCP handler tests for creating a `mono-spec` task with source problem text.
- Added MCP handler tests for creating a `total-plan` task with required variables.
- Added MCP prompt rendering coverage for a newly created task.
- Added MCP missing required-variable coverage using a project-local workflow and verified no task is persisted.
- Added explicit workspace coverage to verify task, source, HEAD, and session writes stay under the provided project workspace.

## Safe Refactor

- Removed the dead CLI-local normal task creation, link resolution, and initial required-variable validation helpers after the CLI was routed through the shared helper.
- Kept phase-execution creation in `src/cli/commands/create.ts` unchanged.
- Skipped broader CLI cleanup because it would not change the MCP task creation behavior and would increase review surface.
- Re-ran `pnpm test -- tests/integration/mcp-server.test.ts`, `pnpm build`, and `pnpm test`; all passed after the cleanup.

## Remaining Risks

- MCP error responses still use the existing text-first MCP error envelope. Missing-variable messages are clear and structured by workflow/phase/variable in the text, but there is no separate machine-readable error code field yet.
- The shared helper intentionally covers normal task creation only. Phase-execution creation remains CLI-only and unchanged.
