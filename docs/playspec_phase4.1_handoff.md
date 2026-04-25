# Dev Phase 4.1 Handoff — MCP-Driven Context Migration and State Promotion

## Implementation Status

**Status: Complete (with test follow-up)**

- build: zero errors (tsc --noEmit)
- tests: 133/133 (18 Phase 4.1 tests + 115 pre-existing, all green)
  - 16 original Phase 4.1 tests
  - +2 added in test follow-up: `remove_context_ref` execution, `renderNextPrompt` downstream
- `playspec migrate` command registered and wired end-to-end
- All acceptance criteria verified
- See `docs/playspec_phase4.1_test_result.md` for test follow-up detail

## Migration Status

No old path existed. No migration away from a legacy path was required.

## Verifier Result Summary

All Phase 4.1 acceptance criteria are met with test coverage:
- `playspec migrate` defaults to review mode ✅
- `--mode dry-run` generates plan/report, mutates nothing ✅
- `--mode auto` skips/downgrades medium-confidence state promotions ✅
- `MigrationPlanSchema` rejects `delete_file` ✅
- `archive_file` fails without `--with-archive` ✅
- Approved `add_context_ref` creates backup and updates `task.yaml` ✅
- Duplicate `contextRefs` are not added ✅
- Migration-added refs are accepted by `store.getTask()` ✅
- `remove_context_ref` action executes and removes ref from task.yaml ✅
- `renderNextPrompt` succeeds after migration adds ref to existing file ✅ (added in test follow-up)
- Existing MCP no-HEAD-fallback tests remain green (14/14) ✅

## Build Validation Summary

- Command: `npx tsc --noEmit`
- Result: success, zero errors
- Blocking: no

## Next-Phase Readiness

Phase 5 (Archive & Knowledge Base) may start. Phase 4.1 archive behavior is local to `.playspec/migrations/archived/`, gated by `--with-archive`, and is not coupled to the Phase 5 general archive model.

## Active Entry Points and Remaining Old/Bypass Paths

| Entry point | Phase path | Old path active | Status |
|---|---|---|---|
| `src/cli/index.ts` → migrate | `runMigrate()` → `MigrationRunner.run()` | none | done |
| `src/mcp/server.ts` | no migration MCP tool (spec: none in this phase) | n/a | intentionally deferred |

---


## Phase Summary

Phase 4.1 adds a guarded migration workflow for converting historical PlaySpec markdown documents into structured PlaySpec state. Claude/MCP may analyze and propose; PlaySpec must validate, preview, persist, back up, and apply only authorized actions.

This is not an implementation-code phase in this handoff. The handoff defines the implementation-ready boundary and the minimum code paths to inspect when implementation starts.

## Current Goal

Implement `playspec migrate` for Phase 4.1 only:

- default `review` mode;
- `dry-run` mode with no mutation;
- explicit `auto` mode limited to low-risk validated actions;
- validated `MigrationPlan` schema;
- persisted plans/reports under `.playspec/migrations/`;
- backup before mutation;
- guarded task state/contextRefs promotion;
- optional migration-local archive only with `--with-archive`;
- no `delete_file` action type.

## Locked File Set

must-read:

- `docs/playspec_phase_plan.md`
- `docs/playspec_total_spec.md`
- `docs/playspec_phase4.1_implementation_spec.md`
- `src/cli/index.ts`
- `src/mcp/server.ts`
- `src/mcp/context.ts`
- `src/mcp/session-store.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/playspec-core.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/integration/task-store.test.ts`

maybe-read:

- `src/cli/commands/create.ts`
- `src/utils/fs.ts`
- `src/utils/paths.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`

ignore-for-now:

- General archive system beyond migration-local `archive_file`.
- Rollback manager except as conceptual backup reference.
- Evolution, harness, viewer, DAG, Project/Stage, and later-phase MCP tools.

## Verified Facts

- `src/cli/index.ts` registers no `migrate` command today.
- `src/mcp/server.ts` registers no migration MCP tool today.
- `src/mcp/context.ts#resolveMcpTaskId()` requires `taskId` or `sessionId` and does not read `.playspec/HEAD`.
- `tests/integration/mcp-server.test.ts` verifies MCP no-HEAD-fallback behavior.
- `TaskRecord` already has `title`, `currentPhase`, `target`, and `contextRefs`.
- `TaskRecordSchema` already validates `target` and `contextRefs`.
- `YamlTaskStore.updateTask()` can patch task state, but migration still needs backup, review gate, and preferably atomic write.
- `PlaySpecCore` rejects missing, absolute, or workspace-escaping `contextRefs` during prompt rendering.
- `playspec create --phase --from` already creates `contextRefs`, so migration must avoid duplicate refs.

## Key Control Flow

Target flow:

1. User runs `playspec migrate`.
2. CLI resolves target task. Human CLI may use HEAD fallback if implemented deliberately; MCP must not.
3. Migration reads/discovers source markdown files.
4. Claude or a provided proposal produces a serialized `MigrationPlan`.
5. PlaySpec validates the plan with Zod.
6. PlaySpec persists plan/report under `.playspec/migrations/` before mutation.
7. Review mode previews each actionable diff/state change and applies only approved actions.
8. Dry-run mode persists plan/report and exits without mutation.
9. Auto mode applies only low-risk validated actions and refuses/downgrades ambiguous state promotion.
10. Before every mutation, migration writes a backup.
11. Applied actions update task state through validated task records or mutate docs through backup-aware file operations.

## Known Constraints

- Claude must not directly mutate files.
- PlaySpec applies only validated plan actions.
- `delete_file` must not exist in the action union.
- `archive_file` requires `--with-archive`.
- State promotions require preview and review unless confidence is `deterministic` and explicit auto policy allows it.
- `contextRefs` are references, not workflow state or dependencies.
- `TaskContextRef.role` currently only supports `planning-context`.
- `task.yaml.routing` is not represented in current `TaskRecord`; do not implement routing migration unless current code support is added intentionally in this phase.
- Do not introduce Project/Stage hierarchy.

## Active Entry Points

- `src/cli/index.ts` — add `migrate` command.
- `src/cli/commands/migrate.ts` — expected command runner.
- `src/migration/*` — recommended new localized module for schema, persistence, and runner.
- `src/storage/task-store.ts` / `src/storage/yaml-task-store.ts` — task state mutation path.
- `src/mcp/context.ts#resolveMcpTaskId()` — required resolver for any MCP migration entry.
- `src/core/playspec-core.ts#assertContextRefsExist()` — downstream observable validation for migrated context refs.

## Possible Bypasses

- Direct YAML string edits to `task.yaml` would bypass `TaskRecordSchema`.
- MCP migration apply that calls `ActiveTaskResolver` or reads `.playspec/HEAD` would violate Phase 4 rules.
- Applying an action before plan/report persistence would make migration non-auditable.
- Adding `archive_file` without `--with-archive` would violate the phase boundary.
- Adding `delete_file` as a tolerated unknown action would violate the phase boundary.
- Duplicating refs from `playspec create --phase --from` would create state drift/noise.

## Phase Outcome at a Glance

After this phase, you can:

- Generate and inspect migration plans from legacy docs.
- Dry-run migration safely.
- Review and approve task/context/document updates.
- Persist plans, reports, and backups.
- Promote selected master docs into `contextRefs`.

After this phase, you still cannot:

- Delete files through migration.
- Silently auto-apply ambiguous inferred state.
- Use migration as a general archive/knowledge-base system.
- Rely on MCP HEAD fallback.
- Introduce Project/Stage state.

## Enabled Use Cases

- A repo with `playspec_total_spec.md`, `playspec_phase_plan.md`, and historical phase result files can create a reviewable migration plan.
- An active task can receive approved `contextRefs` pointing at existing master docs.
- A reviewer can see proposed `task.yaml` changes before approving them.
- Operators can prove dry-run safety by comparing unchanged files with persisted plan/report output.

## Still-Blocked or Deferred Use Cases

- General archive management is deferred to Phase 5.
- Evolution proposal generation/application is deferred to Phase 6.
- Markdown viewer is deferred to the viewer phase.
- File deletion is out of scope.
- Project/Stage hierarchy is out of scope.

## Concrete Testable Outcomes

- `playspec migrate` defaults to review mode.
- `playspec migrate --mode dry-run` writes plan/report and mutates no target.
- `playspec migrate --mode auto` refuses or downgrades medium/low confidence `update_task_state`.
- `MigrationPlanSchema` rejects `delete_file`.
- `archive_file` fails without `--with-archive`.
- Approved `add_context_ref` creates a backup and updates `task.yaml`.
- Duplicate `contextRefs` are not added.
- Migration-added refs are accepted by `playspec next --task TASK_ID` when files exist.
- Existing MCP no-HEAD-fallback tests remain green.

## Reviewer Demo Checklist

- Create a temp workspace and active task.
- Add legacy docs under `docs/`.
- Run `playspec migrate --mode dry-run --source docs --task TASK_ID`.
- Confirm `.playspec/migrations/plans/` and `.playspec/migrations/reports/` contain outputs.
- Confirm `task.yaml` and docs are unchanged after dry-run.
- Run review mode and approve one `add_context_ref`.
- Confirm backup exists under `.playspec/migrations/backups/`.
- Confirm `task.yaml.contextRefs` contains exactly one new ref.
- Run `playspec next --task TASK_ID` and confirm no missing-context error for the new ref.
- Try a plan containing `delete_file` and confirm validation fails before mutation.

## Open Questions

- Should the first implementation accept a Claude-produced plan file, add a dedicated MCP proposal tool, or both? If an MCP tool is added, it must use `resolveMcpTaskId()` and share the same validation/apply runner.
- Should migration widen `TaskContextRef.source` to support migration IDs, or should migration-created refs use the target/source task ID to preserve the current schema? The smallest safe path is to keep the current schema.
- Should `YamlTaskStore.saveTask()` be switched to atomic writes, or should migration use a migration-specific atomic task write after validation? The smallest local fix is migration-specific atomic write if changing shared store behavior feels too broad.

## Next Phase Dependency

Phase 5 archive/knowledge-base work should start only after Phase 4.1 can prove migration-local archive behavior is explicit, reversible, reported, and not coupled to a general archive model. Phase 4.1 must not create silent archive/delete behavior that Phase 5 would need to unwind.
