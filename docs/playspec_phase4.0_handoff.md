# PlaySpec Dev Phase 4.0 Handoff - MCP Adapter

## Implementation Status

**COMPLETE** — 2026-04-26

- All 10 Phase 4.0 MCP tools registered and tested
- No HEAD fallback in MCP context resolver (verified by tests)
- Session write path implemented (`McpSessionStore`)
- Build: zero errors
- Tests: 115/115 (14 new Phase 4.0 tests + 101 pre-existing)
- Phase 4.1 dependency requirements satisfied

## Phase Summary

Dev Phase 4.0 adds an MCP stdio adapter so Claude Code, Codex, and OpenClaw can call PlaySpec Core with explicit task context.

The central safety rule is strict: MCP must receive `taskId` or `sessionId`; MCP must not fall back to `.playspec/HEAD`.

## Current Goal

Expose the existing taskId-based Core capabilities through a thin MCP server:

- list/get tasks
- render next prompt
- render explicit phase prompt
- complete phase
- collect evidence
- run desync check
- perform state-only rollback
- set/get session task

## Locked File Set

Must-read:

- `docs/playspec_phase_plan.md`
- `docs/playspec_total_spec.md`
- `package.json`
- `tsconfig.json`
- `src/core/playspec-core.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/errors.ts`
- `src/core/session-resolver.ts`
- `src/core/active-task-resolver.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/index.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/phase.ts`
- `src/cli/commands/complete.ts`
- `src/cli/commands/evidence.ts`
- `src/cli/commands/desync-check.ts`
- `src/cli/commands/rollback.ts`
- `tests/cli.test.ts`
- `tests/integration/active-task-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`

Maybe-read:

- `src/core/state-desync-detector.ts`
- `src/core/rollback-manager.ts`
- `src/core/git-state.ts`
- `src/utils/paths.ts`
- `src/utils/fs.ts`
- `src/preset/assets/default/sessions/cli.default.yaml`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/task-store.test.ts`

Ignore-for-now:

- `src/template/**`
- `src/workflow/**`
- `src/preset/**` except the default session fixture
- Phase 4.1 migration docs
- Archive, evolution, harness, viewer, SQLite, DAG files or docs

## Verified Facts

- Phase 4.0 is MCP Adapter, not migration or archive.
- `PlaySpecCore` already exposes explicit `taskId` methods for the main phase behaviors.
- `YamlTaskStore` already supports active/completed task lists and task lookup.
- `SessionRecord` and `SessionRecordSchema` exist.
- `SessionResolver.loadSession()` reads session YAML but cannot write/update it.
- CLI commands use `ActiveTaskResolver`, which reads `.playspec/HEAD` when no task id is provided.
- `package.json` does not include `@modelcontextprotocol/sdk`.
- No MCP server or MCP tool files currently exist.

## Key Control Flow

Recommended MCP flow:

1. MCP server receives tool input.
2. Tool input is validated with zod.
3. Context resolver checks `taskId`.
4. If no `taskId`, context resolver checks `sessionId`.
5. Session path reads `.playspec/sessions/{sessionId}.yaml`.
6. Missing context or null `currentTaskId` fails before Core call.
7. Tool calls `PlaySpecCore` or `YamlTaskStore`.
8. Tool returns JSON-compatible result.

Do not route MCP through CLI command functions.

## Known Constraints

- Core must remain independent of CLI and MCP.
- Human CLI may keep HEAD fallback.
- MCP, OpenClaw, and harness-style callers may not use HEAD fallback.
- State-changing tools require unambiguous task context.
- Session writes must stay inside `.playspec/sessions`.
- Phase 4.0 should expose state-only rollback, not broad confirmed git rollback, unless the phase owner explicitly expands the scope.

## Active Entry Points

- `PlaySpecCore.renderNextPrompt(taskId)`
- `PlaySpecCore.renderExplicitPhasePrompt(taskId, phaseId)`
- `PlaySpecCore.completePhase(taskId, options)`
- `PlaySpecCore.collectEvidence(taskId)`
- `PlaySpecCore.checkTaskDesync(taskId)`
- `PlaySpecCore.rollbackStateOnly(taskId)`
- `PlaySpecCore.planRollback(taskId)` if rollback preview is included
- `YamlTaskStore.listActiveTasks()`
- `YamlTaskStore.listCompletedTasks()`
- `YamlTaskStore.getTask(taskId)`
- `SessionResolver.loadSession(sessionId)`

## Possible Bypasses

- Old path: CLI command wrappers allow missing task id and then read HEAD.
- Bypass path: MCP importing `runNext`, `runComplete`, `runEvidence`, `runDesyncCheck`, or `runRollback` can accidentally read HEAD.
- Dual path risk: MCP reimplementing render/completion logic can diverge from Core behavior.
- Partial migration risk: Adding only schemas or only a server shell without executable, tested tools is not phase completion.

## Phase Outcome at a Glance

After this phase, MCP clients can:

- start PlaySpec over stdio
- list/get tasks
- bind a session to a task
- render prompts by task or session
- complete a phase by task or session
- collect evidence
- check desync
- restore state from the last safe point

After this phase, MCP clients still cannot:

- migrate old markdown context
- archive tasks
- inspect archived context
- run harness/evolution tools
- infer task context from HEAD

## Enabled Use Cases

- Codex asks PlaySpec for the next prompt for `taskId`.
- Claude Code binds `sessionId: mcp.claude-code` to a task and renders follow-up prompts by session.
- OpenClaw lists active tasks and lets a user select one.
- An MCP client completes a phase and receives structured completion details.
- An MCP client checks desync before asking for the next prompt.
- An MCP client performs state-only rollback after a bad completion.

## Still-Blocked or Deferred Use Cases

- Bulk markdown migration: Phase 4.1.
- Archive and archived context reads: Phase 5.
- Evolution proposal/apply tools: Phase 6.
- Harness attempt/retry tools: later automation safety phase.
- Markdown viewer: later viewer phase.
- SQLite multi-agent store: future storage phase.

## Concrete Testable Outcomes

- Server start test: MCP stdio entry point starts without crashing.
- Missing context test: `render_next_prompt` without `taskId`/`sessionId` fails even when HEAD points to a valid task.
- Explicit task render test: MCP prompt equals `PlaySpecCore.renderNextPrompt(taskId)`.
- Session set/get test: session YAML is written and read back with `currentTaskId`.
- Session render test: MCP prompt uses session task, not HEAD.
- Complete phase test: MCP completion advances `task.yaml` and writes evidence/snapshot files.
- Evidence test: MCP evidence collection writes manual evidence files without phase mutation.
- Desync test: MCP desync check returns expected severity and file lists.
- Rollback test: MCP state rollback restores `task.yaml` and leaves source files untouched.

## Reviewer Demo Checklist

- Start MCP server over stdio.
- Create two tasks and point HEAD at task B.
- Call `playspec_render_next_prompt` with task A.
- Confirm task A prompt is returned.
- Call the same tool with no context.
- Confirm it fails instead of using HEAD task B.
- Set `sessionId: mcp.codex` to task A.
- Render with only `sessionId`.
- Complete a phase with the same session.
- Inspect `task.yaml` and artifacts.

## Open Questions

- Should `playspec_get_task` support `sessionId`, or should direct task reads require `taskId` only?
- Should rollback preview be exposed alongside state-only rollback in Phase 4.0?
- Should session files be created automatically when setting a session, or must a session already exist?

Recommended defaults:

- `playspec_get_task` requires `taskId`.
- Expose state-only rollback first; optionally expose rollback preview if it does not add confirmed git rollback.
- Create session files on `playspec_use_session_task` after validating the task exists.

## Next Phase Dependency

Phase 4.1 depends on Phase 4.0 having a working MCP stdio server, reliable tool registration, explicit context resolution, and stable structured tool results. Phase 4.1 must not begin from a partial MCP shell that lacks real task/session execution paths.

