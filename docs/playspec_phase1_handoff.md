# PlaySpec Phase 1 Handoff

## Phase Summary

Phase 1 is the first usable CLI slice. It must deliver `.playspec` initialization, YAML-backed task creation and selection, active-task resolution, workflow/phase lookup, variable resolution, and prompt rendering for `next` and `phase`.

Current repo state: Phase 0-style bootstrap scaffolding exists, but the Phase 1 runtime is currently not yet implemented. This handoff is therefore a build spec for the first real runtime slice, not a refinement of working command behavior.

## Current Goal

Implement only the minimum code required to make this user flow real:

```bash
playspec init --preset default
playspec create multi-spec "Feature Name"
playspec current
playspec use TASK_ID
playspec next
playspec phase 3
```

Do not add Phase 2+ features.

## Locked File Set

### must-read

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)

### maybe-read

- [README.md](/volume2/PJ/playspec/README.md)

### ignore-for-now

- rollback/archive/evidence/viewer/MCP designs outside Phase 1
- future DAG-related workflow design
- any speculative abstraction beyond the Phase 1 module set

## Phase Outcome at a Glance

### After this phase, you can

- initialize `.playspec` from the default preset
- create/list/select an active task
- resolve workflow phases
- render prompts for `next` and `phase N`

### After this phase, you still cannot

- complete a phase
- collect evidence
- rollback
- archive
- use MCP/OpenClaw/harness
- use DAG execution

### This phase is ready to implement / hand off when

- the CLI/Core/storage/workflow/template split is fixed
- `HEAD` is locked as the only Phase 1 human-CLI fallback source and remains limited to the CLI boundary
- `sessions/cli.default.yaml` is treated as scaffold-only in Phase 1, not as a second current-task authority
- `next` resolves the first workflow phase unless task state carries an explicit current/pending phase marker
- `next` and `phase` share one render pipeline
- stdout is the required observable output for rendered prompts; file persistence is optional only if it reuses the exact same rendered content
- the test/demo scenarios below are accepted as the completion target

## Verified Facts

- Repository contains bootstrap scaffolding and placeholder modules, but no Phase 1 runtime path is implemented yet.
- Phase 1 requires `playspec init --preset default`, task creation, `HEAD`, `create/list/current/use`, workflow loading, phase resolving, variable resolving, template rendering, and `playspec next`.
- `HEAD` is allowed only as a human CLI convenience; Core must prefer explicit `taskId`.
- The default preset must install workflows, templates, and rules.
- Template include resolution must stay inside `.playspec`, reject cycles, and fail on unresolved placeholders.
- MCP, rollback, archive, evidence, evolution, viewer, SQLite, and DAG are out of scope.

## Key Control Flow

### `playspec init --preset default`

1. CLI parses command.
2. Preset manager creates `.playspec`.
3. Preset assets are copied or materialized into:
   - `config.yaml`
   - `sessions/cli.default.yaml`
   - `workflows/`
   - `templates/`
   - `rules/`
4. Command exits with a stable observable result.

### `playspec create <workflowType> <title>`

1. CLI parses command.
2. Core validates workspace and workflow type.
3. Slug generator creates `taskId`.
4. `YamlTaskStore.createTask` creates task folder, `task.yaml`, `memory.yaml`, and subdirectories.
5. CLI updates `HEAD` to the new task.
6. `current` and `next` can now resolve the task.

### `playspec next`

1. CLI resolves explicit `--task` first, otherwise human CLI `HEAD`.
2. Core loads task from `TaskStore`.
3. Workflow loader loads the task workflow.
4. Phase resolver selects the first workflow phase when no explicit current/pending phase marker exists in task state.
5. Variable resolver computes prompt variables.
6. Template renderer resolves includes and renders the template.
7. CLI prints the rendered prompt to stdout and may optionally persist the exact same rendered content under `{taskRoot}/prompts/`.

### `playspec phase <phaseNumber>`

Same as `next`, except the phase selector is explicit instead of computed. It must reuse the same render pipeline.

## Known Constraints

- No Phase 2+ functionality may leak into the code.
- Do not couple Core logic to the CLI.
- Do not read `HEAD` inside Core render methods.
- Do not create separate render implementations for `next` and `phase`.
- Do not treat scaffolding-only code as phase completion; the prompt render path must be end-to-end observable.
- Fail fast with explicit errors when workspace, task, workflow, or template resolution is incomplete.

## Active Entry Points

| Entry point | Status | Why it matters |
|---|---|---|
| `playspec init --preset default` | missing | required to create `.playspec` and install assets |
| `playspec create` | missing | required to create a real task and set active context |
| `playspec list` | missing | required to expose `TaskStore` results |
| `playspec current` | missing | required to show the active task |
| `playspec use` | missing | required to switch active task |
| `playspec next` | missing | main observable Phase 1 outcome |
| `playspec phase N` | missing | explicit phase rendering path |
| Core render API with explicit `taskId` | missing | required safety boundary for later non-CLI adapters |

## Possible Bypasses

- CLI writes task YAML directly instead of using `YamlTaskStore`
- Core reads `.playspec/HEAD` directly
- `next` and `phase` diverge into separate resolution/render paths
- session state and `HEAD` drift into dual current-task sources without a clear owner

## Enabled Use Cases

Target end-of-phase enabled use cases:

- first-time workspace setup
- task creation for known workflow types
- active task inspection and switching
- next-phase prompt rendering
- explicit-phase prompt rendering

## Still-Blocked or Deferred Use Cases

- phase completion
- rollback
- archive
- evidence collection
- state desync checks
- MCP and agent execution
- viewer flows

## Concrete Testable Outcomes

- `playspec init --preset default` creates the expected `.playspec` structure in a temp workspace
- `playspec create multi-spec "Feature Name"` creates a slugged task folder and updates `HEAD`
- `playspec current` returns the active task after create/use
- `playspec use TASK_ID` switches the active task
- `playspec next` prints the first computed phase prompt to stdout when no explicit current/pending phase marker exists
- `playspec phase 3` prints the explicit phase prompt to stdout
- template include cycles and unresolved placeholders fail with actionable errors

## Reviewer Demo Checklist

1. Run `playspec init --preset default` in an empty temp workspace.
2. Confirm `.playspec/workflows`, `.playspec/templates`, `.playspec/rules`, `.playspec/HEAD`, and `.playspec/sessions/cli.default.yaml` exist.
3. Run `playspec create multi-spec "Feature Name"`.
4. Confirm the task folder and YAML files exist under `.playspec/tasks/active/`.
5. Run `playspec current`.
6. Run `playspec next`.
7. Confirm stdout contains the first resolved phase prompt and no raw unresolved placeholders.
8. Run `playspec phase 3`.
9. Break a template include and confirm the error points to the failing file path.

## Open Questions

No architecture/spec-level open questions remain.

## Next Phase Dependency

Phase 2 must not begin until Phase 1 has one coherent prompt-rendering path based on explicit task resolution in Core and human-CLI `HEAD` fallback only at the adapter boundary. If that boundary is violated, later lock/snapshot/complete/evidence work will inherit the wrong ownership model.

## Reader Aids

### How to read this spec

Use [docs/playspec_phase1_implementation_spec.md](/volume2/PJ/playspec/docs/playspec_phase1_implementation_spec.md) for full design and this handoff for execution focus.

### Use case alignment

Only count the phase as complete when a reviewer can run `init -> create -> current -> next -> phase` successfully in a temp workspace.

### Testable outcomes

The minimum test surface is slug generation, variable resolution, phase resolution, template rendering, and task create/use/current, plus one CLI-level end-to-end flow.

### What is already implemented vs what still needs verification

Implemented now: docs only.

Still needs verification after coding: every runtime path, especially `HEAD` ownership and shared `next`/`phase` rendering.

### Active entry points and possible bypasses

All active entry points are currently missing; the main bypass risks are direct CLI file writes, Core-level `HEAD` reads, and duplicate render pipelines.
