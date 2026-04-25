# PlaySpec Phase 1 Implementation Spec

## 1. How to Read This Spec

This is a Phase 1-only implementation spec derived from:

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)

Use this document in four layers:

1. Treat `docs/playspec_phase_plan.md` as the phase boundary.
2. Treat `docs/playspec_total_spec.md` as the architecture truth.
3. Treat the current repository contents as implementation truth.
4. Treat this document as the smallest safe build plan for Phase 1 only.

Important current-state fact: this repository is documentation-only at the time of writing. No TypeScript source, CLI entry point, tests, or storage implementation exists yet. All code-path findings below are therefore grounded as `missing` unless explicitly noted otherwise.

## 2. Phase Boundary Alignment

### Locked Phase 1 goal

Phase 1 exists to enable first-use setup, task creation, active-task selection, workflow phase lookup, variable resolution, and prompt rendering for a human CLI workflow.

### What this phase is trying to enable

The user can:

```bash
playspec init --preset default
playspec create multi-spec "Feature Name"
playspec current
playspec use TASK_ID
playspec next
playspec phase 3
```

### What must be complete before Phase 2 can safely begin

- A TypeScript CLI exists and parses the Phase 1 commands.
- `.playspec` can be initialized from the `default` preset.
- A YAML-backed `TaskStore` exists.
- Task folders are created under `.playspec/tasks/active/{taskId}`.
- `.playspec/HEAD` exists and is updated by human CLI flows.
- Core APIs accept explicit `taskId` and do not depend on global `HEAD`.
- `next` can resolve the active or explicit task, load its workflow, compute a target phase, resolve variables, render the template, and return a prompt or clear error.
- `phase N` can resolve an explicit workflow phase and render it.

### What is intentionally deferred

Deferred by the phase plan and `AGENTS.md`:

- MCP
- rollback
- archive
- evidence collection
- state desync detection
- evolution
- harness mode
- markdown viewer
- SQLite
- DAG execution
- lock manager behavior, even though the master spec defines a later lock policy

### Visible capability or safety property introduced by this phase

Phase 1 introduces one coherent user-visible capability:

- a human can initialize PlaySpec, create a task, select or inspect the active task, and render the next or explicit phase prompt without manually tracking `FEATURE_SLUG`, phase files, or task paths

It also introduces one safety boundary:

- `HEAD` fallback is allowed only in the CLI adapter; Core must resolve from explicit `taskId` first

### What would make this phase unsafe even if partially implemented

- CLI commands exist but bypass Core and mutate YAML/files ad hoc
- Core depends on `.playspec/HEAD` instead of receiving `taskId`
- `next` renders prompts without validated workflow/phase/template resolution
- `init` installs incomplete preset assets, causing later commands to silently fail
- `phase` and `next` use different resolution paths, creating dual behavior

### Dependencies

- Dev Phase 0 bootstrap work is a prerequisite baseline, and the current repo already contains the minimum bootstrap scaffold to start Phase 1: package manager config, TypeScript config, test runner, and project structure
- `docs/playspec_total_spec.md` task/workflow/template model
- `docs/playspec_phase_plan.md` Phase 1 milestone boundaries

### Ambiguities to call out explicitly

- The master spec uses `playspec` and `.playspec`, while this repository is named PlaySpec and `AGENTS.md` uses `playspec` and `.playspec`. This Phase 1 spec assumes the repository-local naming is authoritative for implementation: `playspec` CLI and `.playspec` workspace.

## 3. Phase Outcome at a Glance

### After this phase, you can

- initialize `.playspec` with a default preset
- create a task for a known workflow type
- list active tasks
- read the current active task
- change the active task with `use`
- render the next phase prompt from the active or explicit task
- render a specific phase prompt from the active or explicit task

### After this phase, you still cannot

- complete or lock a phase
- collect evidence
- rollback
- archive tasks
- run via MCP, OpenClaw, or harness
- use DAG workflows
- view prompts in a dedicated viewer

### This phase is ready to implement / hand off when

- the build plan is limited to the modules and file paths below
- each command maps to one concrete Core entry point
- Core/CLI responsibility boundaries are fixed before coding
- the `.playspec` file layout for preset, tasks, sessions, and `HEAD` is explicit
- negative cases produce explicit recoverable errors
- the Phase 1 test matrix below is accepted as the completion target

## 4. Initial Phase Summary

### Intended capability of this phase

A minimal but real end-to-end workflow engine for single-user CLI operation: initialize workspace, create/select a task, resolve workflow context, and render prompts.

### What is still unclear before deep verification

Because the runtime is currently not yet implemented, the remaining unknowns are implementation details rather than unresolved Phase 1 contracts:

- exact TypeScript file names
- exact CLI command option shapes
- exact YAML schema fields to include immediately versus leave optional
- exact optional prompt-persistence file naming under `prompts/` if Phase 1 writes a copy in addition to stdout

### After this phase, you can

- work from a task-backed `.playspec` workspace using CLI commands only

### After this phase, you still cannot

- persist completion/evidence/review/snapshot/rollback state

## 5. High-Level Pre-Read Summary

### What Phase 1 is trying to achieve

Phase 1 is the first usable slice of the product. It must make the CLI operational enough that a user can create a task and render the next or explicit phase prompt from workflow metadata and templates installed by a preset.

### What the current implementation likely does at a high level

Only bootstrap scaffolding and placeholder modules exist. No operational Phase 1 runtime path is implemented yet.

### What still needs confirmation from code

All runtime behavior still needs confirmation from code because there is no current code path for:

- command parsing
- task storage
- `HEAD` resolution
- session resolution
- workflow loading
- phase resolution
- variable resolution
- template rendering
- preset installation

### What real workflow this phase unlocks

A reviewer or implementer can create a new task and generate the prompt for the next or an explicit phase without manually editing filenames or tracking task folders.

### What workflow remains intentionally deferred

Any workflow requiring completion state, rollback safety, evidence, archive/history, MCP, or multi-agent execution.

### What should be testable if the phase is grounded correctly

- slug generation
- variable resolution
- phase resolution
- template rendering
- task create/use/current
- an end-to-end `init -> create -> next`

## 6. Minimal File Scan

### must-read

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)

### maybe-read

- [README.md](/volume2/PJ/playspec/README.md)

### ignore-for-now

- all future generated Phase 1 spec/handoff files after creation
- any future implementation files outside the Phase 1 module set until coding begins

## 7. Relevant Files Reviewed

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)
- [README.md](/volume2/PJ/playspec/README.md)

## 8. Current Implementation vs Proposed Direction

### Verified current behavior

- The repository contains no runtime implementation.
- The repository contains no `src/`, tests, `package.json`, or TypeScript project bootstrap files.
- Phase scope is defined in docs only.

### Inferred but not fully verified points

- The implementation should use the repository-local naming convention: `playspec` CLI and `.playspec` workspace.
- The default preset must install workflows, templates, and rules because both the phase plan and total spec require it.

### Intended Phase 1 behavior

Build the minimal project and module set required for:

- CLI parsing for `init`, `create`, `list`, `current`, `use`, `next`, `phase`
- preset installation to `.playspec`
- YAML-backed task persistence
- active-task resolution through explicit `taskId` first, CLI `HEAD` fallback second
- workflow load and phase lookup
- variable resolution including `FEATURE_SLUG`, `PHASE_NUMBER`, `PHASE_SPEC_FILE`, `PHASE_HANDOFF_FILE`
- Handlebars-based template rendering with include and unresolved-variable validation

### Smallest safe implementation direction

Use a narrow layered structure:

```text
src/
  cli/
  core/
  storage/
  workflow/
  template/
  preset/
  utils/
```

The module responsibilities above are mandatory for Phase 1. Exact file names may vary if the dependency direction, testability, and CLI/Core boundary remain intact.

Do not add framework-like abstractions beyond:

- `TaskStore` interface
- `YamlTaskStore` implementation
- explicit resolver/services for task context, workflow phases, variables, and templates

## 9. Active Entry Points and Possible Bypasses

### Entry point audit

| Entry point / call site | Current behavior | Status | Why it matters to this phase |
|---|---|---|---|
| `playspec init --preset default` | No CLI exists | missing | Must create `.playspec`, install preset assets, and seed session files required by later commands |
| `playspec create <workflowType> <title>` | No CLI exists | missing | Must create task folder, `task.yaml`, `memory.yaml`, task subdirectories, and update `HEAD` |
| `playspec list` | No CLI exists | missing | Must expose stored active tasks so `create/use/current` is reviewable |
| `playspec current` | No CLI exists | missing | Must resolve active task using CLI rules and show failure clearly when none exists |
| `playspec use <taskId>` | No CLI exists | missing | Must update `HEAD` and likely `sessions/cli.default.yaml` coherently |
| `playspec next [--task TASK_ID]` | No CLI exists | missing | Main Phase 1 outcome: active task resolution, workflow load, next-phase calculation, variable/template rendering |
| `playspec phase <phaseNumber> [--task TASK_ID]` | No CLI exists | missing | Must render a concrete workflow phase using the same Core path as `next`, except phase selection |
| Core render API with explicit `taskId` | No Core exists | missing | Phase boundary requires Core support without relying on `HEAD` |

### Possible bypasses to explicitly avoid

- old path risk: implementing command handlers that read/write YAML directly instead of going through Core and `TaskStore`
- bypass risk: reading `.playspec/HEAD` inside Core render functions
- dual path risk: `next` using one phase-resolution path while `phase N` uses another
- partial migration risk: creating task folders directly in CLI while only some later reads go through `YamlTaskStore`

## 10. Verified Behavior and Constraints

### Verified behavior from docs

- `.playspec/HEAD` is a human-CLI convenience pointer.
- Explicit `taskId` must take priority over `HEAD`.
- The task root is `.playspec/tasks/active/{taskId}`.
- Phase 1 requires a YAML `TaskStore`.
- The default preset must install workflows, templates, and rules.
- Template includes are restricted to `.playspec` content.
- Missing includes and unresolved placeholders must fail clearly.

### Verified constraints from repository guidance

- Do not add MCP before Phase 4.
- Do not add viewer before Phase 10.
- Do not rely on global `HEAD` inside Core.
- Human CLI may resolve `HEAD`, but Core must receive explicit `taskId` where possible.
- Keep functions testable.
- Use `zod`, `yaml`, `handlebars`, `commander`, and `vitest`.

### Phase 1 safety constraints

- archive/reset/rollback paths are intentionally absent, so failure handling must be fail-fast and non-destructive
- if `.playspec` is missing or incomplete, commands must stop with actionable setup guidance
- if task resolution is ambiguous, do not guess

## 11. What Is Already Implemented vs What Still Needs Verification

### Already implemented

- product architecture docs
- phase boundary docs
- repository-level implementation guidance

### Still missing from codebase

- TypeScript bootstrap
- CLI parser
- preset manager
- schemas
- storage layer
- resolvers
- renderer
- tests

### Still needs verification after implementation begins

- whether `current` and `use` keep `HEAD` authoritative while leaving `sessions/cli.default.yaml` scaffold-only
- whether `next` and `phase` share the same render pipeline
- whether prompt output is observable on stdout, with any optional persisted copy matching the same rendered content

## 12. Use Case Alignment for This Phase

| Use case | Current status | End-of-phase expectation | Final observable result |
|---|---|---|---|
| First-time setup with `playspec init --preset default` | blocked | enabled | `.playspec` exists with config, sessions, workflows, templates, rules |
| Create a task for `multi-spec` | blocked | enabled | task folder exists with YAML files and task subdirectories |
| Inspect active task | blocked | enabled | `playspec current` prints active task id/title or a clear no-active-task error |
| Switch active task | blocked | enabled | `HEAD` changes and subsequent `current`/`next` use the new task |
| Render next phase prompt | blocked | enabled | `playspec next` prints a fully rendered prompt for the next workflow phase to stdout |
| Render explicit phase prompt | blocked | enabled | `playspec phase 3` resolves that phase and renders it |
| Complete a phase | out-of-phase | deferred | not available in Phase 1 |
| Rollback/archive/evidence | out-of-phase | deferred | not available in Phase 1 |

Do not mark `next` or `phase` as enabled unless the full path below works together:

- task resolution
- workflow loading
- phase selection
- variable resolution
- template include resolution
- unresolved-placeholder validation
- observable rendered result

## 13. Proposed Implementation Direction for This Phase

### Module set

Minimum Phase 1 module set:

```text
src/
  cli/
    index.ts
    commands/
      init.ts
      create.ts
      list.ts
      current.ts
      use.ts
      next.ts
      phase.ts
  core/
    types.ts
    errors.ts
    playspec-core.ts
    active-task-resolver.ts
    session-resolver.ts
  storage/
    task-store.ts
    yaml-task-store.ts
  workflow/
    workflow-schema.ts
    workflow-loader.ts
    phase-resolver.ts
  template/
    template-loader.ts
    template-renderer.ts
    variable-resolver.ts
  preset/
    preset-manager.ts
    assets/default/...
  utils/
    slug.ts
    paths.ts
    fs.ts
```

This module list locks responsibilities, not literal filenames. Small file-layout adjustments are acceptable if the same dependency direction is preserved: CLI -> Core -> storage/workflow/template/preset/utils, with Core never depending on CLI.

### Core data files to create

```text
.playspec/
  HEAD
  config.yaml
  sessions/
    cli.default.yaml
  tasks/
    active/
      {taskId}/
        task.yaml
        memory.yaml
  workflows/
  templates/
  rules/
```

`prompts/` may be created lazily only if prompt persistence is enabled. Future-phase directories such as `evidence/`, `snapshots/`, `rollback/`, and `human-edits/` are out of scope for Phase 1 and should not be required in the initial task layout.

### Core interfaces and responsibilities

#### `TaskStore`

Phase 1 must introduce a narrow interface aligned with the master spec:

```ts
interface TaskStore {
  getTask(taskId: string): Promise<TaskRecord>;
  saveTask(task: TaskRecord): Promise<void>;
  listActiveTasks(): Promise<TaskSummary[]>;
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  updateTask(taskId: string, patch: TaskPatch): Promise<TaskRecord>;
}
```

Phase 1 can omit archive methods in the concrete interface if they are not used yet, but the implementation must not block later expansion.

#### `YamlTaskStore`

Responsibilities:

- map task ids to `.playspec/tasks/active/{taskId}`
- read/write `task.yaml`
- create `memory.yaml`
- create required subdirectories
- validate task file contents with `zod`

#### `ActiveTaskResolver`

Responsibilities:

- resolve from explicit `taskId` first
- allow CLI `HEAD` fallback only in CLI flows
- return explicit failure when nothing is resolvable

#### `SessionResolver`

Responsibilities:

- load `.playspec/sessions/cli.default.yaml`
- provide scaffold-only session defaults for later phases
- do not become a second current-task authority in Phase 1

#### `WorkflowLoader` and `PhaseResolver`

Responsibilities:

- load `.playspec/workflows/{workflowType}.yaml`
- validate `phaseOrder`
- resolve `next` from the first entry in `phaseOrder` when the task has no explicit current or pending phase marker
- allow an explicit current or pending phase marker in `task.yaml` to override the first-phase default if Phase 1 needs deterministic resume behavior
- resolve explicit phase by id
- fail with clear file-path-rich errors on unknown workflow or phase

#### `VariableResolver`

Minimum Phase 1 variables:

- `FEATURE_SLUG`
- `PHASE_NUMBER`
- `PHASE_SPEC_FILE`
- `PHASE_HANDOFF_FILE`

Reasonable Phase 1 derived values:

- `TASK_ID`
- `TASK_TITLE`
- `WORKFLOW_TYPE`

#### `TemplateRenderer`

Responsibilities:

- load template referenced by workflow phase
- expand `{{include:...}}` recursively inside `.playspec`
- detect circular includes
- render with Handlebars
- fail on unresolved placeholders

### CLI-to-Core contract

CLI responsibilities:

- parse arguments/options
- resolve human CLI fallback context from `HEAD`
- print friendly errors

Core responsibilities:

- operate on explicit `taskId`
- never read `HEAD` implicitly
- implement task/workflow/template logic

### Observable output decision

Phase 1 requires one stable observable output mode for `next` and `phase`:

- print the rendered prompt to stdout
- optionally persist the same rendered content under `{taskRoot}/prompts/`

If both are implemented, the same rendered content must be used. Do not create separate render paths.

## 14. Testable Outcomes

### End-of-phase test matrix

| Test scenario | Entry point | Required setup | Expected observable result | Status | Failure acceptable as out-of-phase |
|---|---|---|---|---|---|
| Initialize workspace | `playspec init --preset default` | empty temp workspace | `.playspec`, preset assets, `sessions/cli.default.yaml`, `HEAD` policy files exist | not yet testable in current repo | no |
| Create task | `playspec create multi-spec "Feature Name"` | initialized workspace | slugged task folder, `task.yaml`, `memory.yaml`, task directories, `HEAD` updated | not yet testable in current repo | no |
| Show current task | `playspec current` | initialized workspace with active task | prints current task | not yet testable in current repo | no |
| Switch active task | `playspec use TASK_ID` | initialized workspace with multiple tasks | `HEAD` changes and `current` reflects it | not yet testable in current repo | no |
| Resolve next phase | `playspec next` | active task with workflow and no explicit current/pending phase marker | rendered prompt for the first workflow phase is printed to stdout | not yet testable in current repo | no |
| Resolve explicit phase | `playspec phase 3` | active task with workflow | rendered prompt for phase `3` is printed to stdout | not yet testable in current repo | no |
| Variable resolution | Core variable resolver unit test | task/workflow fixture | `FEATURE_SLUG` and phase file variables resolve deterministically | not yet testable in current repo | no |
| Template include success | Core template renderer unit test | template + include fixtures | include expansion succeeds | not yet testable in current repo | no |
| Template include cycle failure | Core template renderer unit test | cyclic include fixtures | explicit circular-include error | not yet testable in current repo | no |
| Unknown workflow failure | `playspec create` or workflow loader | invalid workflow type | actionable error naming missing workflow file/type | not yet testable in current repo | no |
| No active task failure | `playspec next` | initialized workspace without active task | actionable error tells user to create or use a task | not yet testable in current repo | no |

## 15. Example Review / Demo Scenarios

### Reviewer demo 1: first working flow

1. Run `playspec init --preset default`.
2. Confirm `.playspec/workflows`, `.playspec/templates`, `.playspec/rules`, and `.playspec/sessions/cli.default.yaml` exist.
3. Run `playspec create multi-spec "Feature Name"`.
4. Confirm `.playspec/HEAD` points to the new task.
5. Run `playspec current`.
6. Run `playspec next`.
7. Confirm the rendered prompt contains resolved variables and no unresolved placeholders.

### Reviewer demo 2: explicit phase path

1. Run `playspec phase 3`.
2. Confirm the phase is resolved from workflow metadata, not from hardcoded template naming.
3. Confirm output uses the same renderer as `next`.

### Reviewer demo 3: failure behavior

1. Remove or rename a referenced template.
2. Run `playspec next`.
3. Confirm the error includes the failing file path and recovery hint.

## 16. Risks / Open Questions

### Narrow maintainability risks

- medium risk: direct file writes from CLI create a bypass around `TaskStore`
  Smallest safe fix: require CLI command handlers to call Core/service methods for all task mutations.

- medium risk: `next` and `phase` can diverge if they build prompts differently
  Smallest safe fix: both commands must share one render pipeline and differ only in phase selection.

### Open questions

No architecture/spec-level open questions remain.

## 17. Current Implementation vs Proposed Direction Summary

Current state is bootstrap scaffolding plus placeholders, so every operational Phase 1 runtime path is still missing. The proposed direction is to add only the smallest layered modules needed to make `init/create/list/current/use/next/phase` work coherently, with `HEAD` confined to the CLI boundary and all actual task/workflow/template logic in Core plus `YamlTaskStore`.

## 18. Use Case and Testability Summary

Phase 1 should unlock one real workflow: initialize the workspace, create/select a task, and render next or explicit phase prompts from preset-installed workflow assets. Today none of those paths are testable because no operational code exists; at end of phase they must be testable through both focused unit tests and one end-to-end CLI demo flow.
