Fixes #281

## Summary

- Adds `playspec_create_task` to the MCP server so MCP-only clients can create tasks for installed workflows.
- Moves normal task creation into a shared helper used by both CLI create and MCP create.
- Supports workflow variables, source problem text/files, optional explicit task IDs, task links, explicit workspace roots, and optional session binding.
- Adds MCP integration coverage for mono-spec, total-plan, prompt rendering, missing variables, and explicit project workspace writes.

## Why this PR

MCP automation could list, read, bind, render, and complete existing PlaySpec tasks, but it could not start a workflow lifecycle because there was no MCP equivalent to `playspec create`. That forced MCP-only automation to fall back to the CLI before rendering the first prompt.

## Problem

Task creation behavior lived inside `src/cli/commands/create.ts`. MCP tools in `src/mcp/server.ts` only accepted existing task context, so workflows such as `mono-spec`, `total-plan`, and `issue-scope-create` could not be started entirely through MCP.

## How it was fixed

- `src/core/task-creation.ts` now contains shared normal task creation logic: workspace initialization checks, workflow resolution, task ID validation, source problem storage, context refs, link resolution, initial phase required-variable validation, `YamlTaskStore` persistence, and HEAD updates.
- `src/cli/commands/create.ts` now routes normal and interactive create flows through the shared helper while leaving phase-execution creation unchanged.
- `src/mcp/server.ts` registers `playspec_create_task`, resolves `workspaceRoot` with the existing MCP workspace resolver, calls the shared helper, optionally binds `bindSessionId`, and returns created task metadata plus diagnostics.
- `tests/integration/mcp-server.test.ts` covers MCP task creation with source text, total-plan variables, immediate prompt rendering, clear missing-variable errors, registration, and explicit project workspace creation.

## Changed files

- `src/core/task-creation.ts`
- `src/cli/commands/create.ts`
- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue-281-mcp-create/spec.md`
- `docs/features/issue-281-mcp-create/plan.md`
- `docs/features/issue-281-mcp-create/result.md`
- `docs/features/issue-281-mcp-create/pr.md`

## Validation

- Passed: `pnpm test -- tests/integration/mcp-server.test.ts`
- Passed: `pnpm build`
- Passed: `pnpm test`

No validation commands were skipped.

## PlaySpec task id

`expose_task_creation_through_playspec_mcp`

## Risks / follow-ups

- MCP errors still use the existing text-first MCP error envelope; missing-variable details are clear in the returned error text but not exposed as a separate structured error code.
- Phase-execution creation remains CLI-only and unchanged by design.

## Reusable agent guidance

No new reusable agent guidance is needed. The implementation follows existing MCP workspace resolution and shared-core extraction patterns.
