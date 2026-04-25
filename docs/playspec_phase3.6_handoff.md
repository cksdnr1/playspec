# PlaySpec Phase 3.6 Handoff

## Phase summary

Dev Phase `3.6` adds Task Relay and Smart Context Binding.

It connects a completed Planning Task to a new Execution Task without introducing Project/Stage state. The execution task records its target phase and linked planning context files in `task.yaml`.

## Current goal

Enable:

```bash
playspec create phase-execution "Login System" --phase 1
playspec create phase-execution "Login System" --phase 1 --from login_system
```

The resulting task should have a normalized execution title, `target.phaseNumber`, `contextRefs`, visible CLI output listing linked files, and a render-time guard for missing linked files.

`phase-execution` is a real default workflow id for this phase. Add a loadable default preset workflow file with `id: phase-execution`; do not treat the command as a hidden alias for another workflow.

## Locked file set

### must-read

- `docs/playspec_phase_plan.md`
- `docs/playspec_total_spec.md`
- `src/cli/index.ts`
- `src/cli/commands/create.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/status.ts`
- `src/cli/context-header.ts`
- `src/core/playspec-core.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/errors.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/template/variable-resolver.ts`
- `tests/cli.test.ts`
- `tests/integration/task-store.test.ts`

### maybe-read

- `src/core/active-task-resolver.ts`
- `src/workflow/workflow-loader.ts`
- `src/workflow/phase-resolver.ts`
- `src/template/template-renderer.ts`
- `src/cli/commands/list.ts`
- `src/cli/commands/current.ts`
- `src/cli/commands/use.ts`
- `src/utils/paths.ts`
- `src/utils/fs.ts`
- `src/utils/slug.ts`
- `src/preset/assets/default/workflows/multi-spec.yaml`
- `src/preset/assets/default/templates/multi-spec/phase_template.md`
- `tests/integration/init-create-next.test.ts`
- `tests/helpers/createTempWorkspace.ts`

### ignore-for-now

- `src/core/rollback-manager.ts`
- `src/core/git-state.ts`
- `src/core/state-desync-detector.ts`
- `src/cli/commands/rollback.ts`
- `src/cli/commands/evidence.ts`
- `src/cli/commands/snapshot.ts`
- MCP, archive, viewer, evolution, harness, DAG files

## Verified facts

- Phase `3.6` boundary is locked in `docs/playspec_phase_plan.md:496`.
- The current create command accepts only `<workflowType> <title>` in `src/cli/index.ts:62`.
- `runCreate()` accepts only `workspaceRoot`, `workflowType`, and `title` in `src/cli/commands/create.ts:8`.
- `runCreate()` derives task id from the raw title and immediately calls `YamlTaskStore.createTask()` in `src/cli/commands/create.ts:21`.
- `YamlTaskStore.createTask()` creates only the basic task record in `src/storage/yaml-task-store.ts:73`.
- `TaskRecord` has no `target` or `contextRefs` in `src/core/types.ts:24`.
- `CreateTaskInput` has no relay metadata in `src/core/types.ts:65`.
- `TaskRecordSchema` has no `target` or `contextRefs` in `src/core/schemas.ts:40`.
- `YamlTaskStore.listActiveTasks()` filters to `status === 'active'` in `src/storage/yaml-task-store.ts:46`, so it cannot discover completed planning tasks.
- `runNext()` calls `PlaySpecCore.renderNextPrompt()` in `src/cli/commands/next.ts:37`.
- `PlaySpecCore.renderNextPrompt()` renders without context-ref validation in `src/core/playspec-core.ts:53`.
- `VariableResolver` does not expose target/context refs to templates in `src/template/variable-resolver.ts:25`.
- Phase `3.5` header currently prints only task and current phase.

## Key control flow

### Current `playspec create`

1. CLI parses `create <workflowType> <title>`.
2. `runCreate()` validates `.playspec` exists.
3. `runCreate()` slugifies raw title.
4. `YamlTaskStore.createTask()` writes task directories, `task.yaml`, and `memory.yaml`.
5. `runCreate()` writes `.playspec/HEAD`.
6. CLI prints created task and HEAD.

Phase `3.6` insertion point: extend this path only when `--phase` is present. The old create path should remain unchanged.

### Intended `playspec create --phase`

1. Parse `--phase` and optional `--from`.
2. Normalize final execution title.
3. Resolve planning source by priority: `--from`, unique completed match, interactive selector, error.
4. Discover required planning context files.
5. Print linked file list and confirm when interactive auto-binding is used.
6. Call the Core-owned creation/persistence path to create the task with `target` and `contextRefs`.
7. Set HEAD after successful creation.

Required planning context files are resolved only from the selected planning task:

- `featureSlug = planningTask.variables.FEATURE_SLUG ?? planningTask.id`
- `<planningTask.paths.projectDocRoot>/<featureSlug>_total_spec.md`
- `<planningTask.paths.projectDocRoot>/<featureSlug>_phase_plan.md`

Store those paths workspace-relative in `contextRefs`. Do not fall back to literal `total_spec.md` / `phase_plan.md`, repo-root docs, or filesystem search; fail before creating the execution task if either required file is missing.

### Current `playspec next`

1. Resolve task.
2. Print Phase `3.5` header unless quiet.
3. Run desync check.
4. Call `PlaySpecCore.renderNextPrompt()`.
5. Print prompt.

Phase `3.6` insertion point: Core render should validate stored `contextRefs` before template rendering.

## Known constraints

- `task.yaml` is the single source of truth for `target` and `contextRefs`.
- `contextRefs` are references, not workflow state.
- Do not add `project.yaml`.
- Do not create Project/Stage hierarchy.
- Do not add DAG execution or automatic spawning.
- Do not guess among multiple planning candidates.
- Do not mutate state before interactive confirmation succeeds.
- Store context paths as workspace-relative paths, not absolute paths.
- Keep new fields optional so existing task YAML remains readable.
- Keep selector and confirmation I/O in CLI, but keep normalized execution-task persistence Core-owned so future adapters do not duplicate relay rules.
- Add a default preset workflow file for `phase-execution` and keep its YAML `id` equal to `phase-execution`.

## Active entry points

- `src/cli/index.ts` `program.command('create')`
- `src/cli/commands/create.ts` `runCreate()`
- `src/storage/yaml-task-store.ts` `YamlTaskStore.createTask()`
- `src/storage/yaml-task-store.ts` task listing/read methods
- `src/core/schemas.ts` `TaskRecordSchema`
- `src/core/types.ts` `TaskRecord` and `CreateTaskInput`
- `src/cli/commands/next.ts` `runNext()`
- `src/core/playspec-core.ts` `renderNextPrompt()` and `renderExplicitPhasePrompt()`
- `src/cli/context-header.ts` `formatContextHeader()`
- `src/cli/commands/status.ts` `runStatus()`

## Possible bypasses

- Old create path: `playspec create multi-spec "Title"` must not require `--phase`, `--from`, planning docs, or confirmation.
- Direct Core prompt rendering can bypass CLI; put missing-context validation in Core.
- `playspec phase` uses explicit prompt rendering; it should not render a task whose `contextRefs` are broken.
- `listActiveTasks()` cannot find completed planning tasks; a new task-listing path is needed.
- Schema-only changes are not enough; fields must persist through create/get/save/update.
- CLI-only relay logic is a future bypass risk; place durable creation semantics in Core or a Core-owned helper.

## Phase outcome at a glance

### After this phase, you can

- Create an execution task for a specific target phase.
- Bind planning total spec and phase plan files automatically or via `--from`.
- See linked context paths in CLI output.
- Confirm auto-linked context before task creation finalizes.
- Refuse prompt rendering when linked context files disappear.

### After this phase, you still cannot

- Auto-create execution tasks from planning tasks.
- Run DAGs.
- Use project/stage state.
- Route phases by completion result.
- Use MCP context migration.
- Archive or view linked context through later UI features.

## Enabled use cases

- User starts implementation from completed planning work without manually adding `contextRefs`.
- User specifies the exact planning source with `--from`.
- User sees what PlaySpec linked before trusting the execution task.
- Reviewer can inspect `task.yaml` and confirm `target.phaseNumber` and `contextRefs`.
- Missing referenced planning docs block `next` before an LLM receives an under-context prompt.

## Still-blocked or deferred use cases

- Automatic task spawning is deferred.
- Conditional routing is deferred to Phase `3.7`.
- MCP migration/promotion is deferred to Phase `4.1`.
- Archive/knowledge-base context is deferred to Phase `5`.
- Prompt inclusion of full context file contents is not guaranteed by this phase unless templates are explicitly updated.

## Concrete testable outcomes

| Scenario | Entry point | Expected result |
|---|---|---|
| Old create still works | `playspec create multi-spec "Feature"` | basic task created, no relay metadata |
| Explicit relay create | `playspec create phase-execution "Login System" --phase 1 --from login_system` | normalized execution task, target/context refs saved, HEAD set |
| Workflow availability | `playspec create phase-execution ...` / workflow loader | default preset contains loadable `phase-execution` workflow |
| Unique match binding | `playspec create phase-execution "Login System" --phase 1` | one completed planning task is linked |
| Multiple non-interactive matches | same without `--from` | error asks for `--from`, no task created |
| Missing planning files | create with `--from` | error before task creation |
| Store persistence | `YamlTaskStore.createTask()` then `getTask()` | `target/contextRefs` round-trip |
| Missing ref guard | `playspec next` | exits before prompt if a stored context path is missing |
| Header/status visibility | `playspec status` | shows target/context summary when fields exist |

## Reviewer demo checklist

- Initialize workspace.
- Create or prepare a completed planning task named `Login System`.
- Put required planning docs at `planningTask.paths.projectDocRoot/<featureSlug>_total_spec.md` and `planningTask.paths.projectDocRoot/<featureSlug>_phase_plan.md`.
- Run `playspec create phase-execution "Login System" --phase 1 --from login_system`.
- Confirm CLI prints linked context files.
- Inspect execution `task.yaml`.
- Confirm `target.phaseNumber` is `"1"`.
- Confirm two `contextRefs` exist with `role: planning-context` and `source: login_system`.
- Run `playspec next`.
- Delete one linked context file.
- Run `playspec next` again.
- Confirm prompt rendering is refused.
- Run plain `playspec create multi-spec "Plain Task"` and confirm old behavior still works.

## Implementation Status

**Status:** Complete  
**Date:** 2026-04-26

### Migration Status

All active entry points migrated:
- `src/cli/index.ts` create command: `--phase` and `--from` options added
- `src/cli/commands/create.ts` runCreate: phase-execution branch added; old path unchanged
- `src/storage/yaml-task-store.ts` createTask: persists `target`/`contextRefs`; `listCompletedTasks()` added
- `src/core/schemas.ts` TaskRecordSchema: `target`/`contextRefs` schemas added
- `src/core/types.ts` TaskRecord/CreateTaskInput: `target`/`contextRefs` fields added
- `src/core/playspec-core.ts` renderNextPrompt/renderExplicitPhasePrompt: `assertContextRefsExist` guard active

No old/bypass paths remain for migrated responsibilities.

### Verifier Result

39/39 spec requirements verified done. See `playspec_phase3.6_implementation_result.md`.

### Build Validation

`pnpm build`: success, zero errors.  
`pnpm test`: 83/86 passed. 3 pre-existing rollback timeout failures unchanged. 5 new Phase 3.6 tests all pass.

### Unresolved Blockers

None.

### Active Entry Points and Remaining Old/Bypass Paths

| Entry point | Status |
|---|---|
| `playspec create ... --phase N [--from ID]` | active, complete |
| `playspec create <type> "Title"` (old path) | active, unchanged, no relay behavior |
| `PlaySpecCore.renderNextPrompt()` | guarded by assertContextRefsExist |
| `PlaySpecCore.renderExplicitPhasePrompt()` | guarded by assertContextRefsExist |
| `YamlTaskStore.listCompletedTasks()` | active, returns completed tasks |

## Open questions

No architecture/spec-level open questions remain.

## Next phase dependency

Phase `3.7` can safely begin only after Phase `3.6` has a coherent relay path:

- execution tasks have target phase metadata,
- context refs persist and validate,
- ambiguous planning sources are never guessed,
- `next` cannot render with missing linked context,
- old task creation remains stable.

Conditional routing should build on the explicit target/context state, not compensate for missing relay behavior.
