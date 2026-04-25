# PlaySpec Phase 3.5 Implementation Spec

## 1. How to read this spec

This is a first-draft, implementation-ready technical spec for Dev Phase `3.5` only.

Treat `docs/playspec_total_spec.md` as architecture truth and `docs/playspec_phase_plan.md` as phase-boundary truth. This phase is limited to compact CLI task visibility for `next`, `status`, and `complete`, plus `--quiet` suppression. It does not authorize Task Relay, automatic context binding, conditional routing, MCP, archive, viewer, harness, or project-level state.

The phase plan mentions `attempt`, `target`, and `contextRefs` as displayable header fields when they exist. Current code does not yet model those fields in `TaskRecord`; Phase `3.5` must not implement Phase `3.6` binding or later attempt tracking just to populate them. The header may display those fields only when they are present in `task.yaml` and accepted by the schema.

## 2. Phase boundary alignment

### Locked Phase 3.5 goal

Add a compact Context Header to the top of `playspec next`, `playspec status`, and `playspec complete` output so the user can quickly see the active task and current workflow position.

### Why this phase exists

The current CLI can render prompts and complete phases, but users must infer task state from prompt body text, `current`, or raw `task.yaml`. Phase `3.5` provides a short, consistent summary before important CLI output without changing workflow semantics.

### In scope

- Context Header on:
  - `playspec next`
  - `playspec status`
  - `playspec complete`
- Header maximum of 5 lines by default.
- Header values derived only from `task.yaml`.
- Display fields:
  - task title
  - current workflow phase
  - attempt count only when greater than `1` and present in task state
  - target phase only when present in task state
  - `contextRefs` count or short path only when present in task state
- `--quiet` suppresses the Context Header.
- `status` owns full task detail; `next` and `complete` should not duplicate full status output.

### Out of scope

- Project-level state or `project.yaml`
- Multi-task dashboard
- HTML/web viewer
- MCP output
- Task Relay or smart context binding from Phase `3.6`
- Adding `contextRefs` validation or missing-file render refusal from Phase `3.6`
- Conditional routing from Phase `3.7`
- Attempt recording from later harness/retry phases
- Changing Core prompt rendering semantics

### Dependencies

- Phase `1.x` active task resolution and prompt rendering.
- Phase `2` completion engine.
- Phase `3` desync warning before `next`; header must coexist with that warning.
- `task.yaml` remains the single source of truth for task visibility.

### What must be complete before the next phase can safely begin

- `next`, `complete`, and `status` all use one shared header formatter or equivalent single implementation.
- `--quiet` suppresses only the header, not the command's essential output or errors.
- `status` exists as a real command or the phase explicitly aliases it to the existing `current` behavior while preserving the documented `playspec status` UX.
- The header is derived from the resolved `TaskRecord` / task YAML data, not workflow files, Git state, session files, or project-level state.
- Existing `next` high-desync warning remains observable and is not hidden by `--quiet`.

### Visible capability introduced

After this phase, a reviewer can run:

```bash
playspec next
playspec next --quiet
playspec status
playspec complete
playspec complete --quiet
```

and observe a short task header on normal interactive output, with header suppression when `--quiet` is provided.

### What would make this phase unsafe even if partially implemented

- `next` prints a header but `complete` or `status` uses a different format or stale logic.
- `--quiet` suppresses warnings, completion results, prompt output, or errors instead of suppressing only the header.
- Header fields are computed from workflow files, session state, Git state, or a new project-level file.
- Phase `3.6` responsibilities leak in, such as automatic context binding, `create --phase`, or missing `contextRefs` guards.
- Current users see two competing visibility paths: `current` says one thing and `status` says another.

## 3. Phase Outcome at a Glance

### After this phase, you can

- See the current task title before `next` prompt output.
- See current workflow phase position before `next`, `status`, and `complete`.
- Suppress the header with `--quiet` for script-friendly `next` and `complete` output.
- Use `playspec status` for fuller task detail with the same compact header at the top.

### After this phase, you still cannot

- Auto-bind planning context into execution tasks.
- Require `contextRefs` before rendering.
- Track attempts unless a task already has a supported task.yaml field.
- Route phases by result.
- Use MCP or viewer surfaces for task status.
- Inspect a multi-task dashboard.

### This phase is ready to implement / hand off when

- The active CLI output points are known.
- The `status` command decision is explicit.
- Header behavior is testable through CLI output.
- Optional fields are handled defensively and only from task YAML.

## 4. Current implementation vs proposed direction

### Verified current behavior

- `src/cli/index.ts` registers `next`, `phase`, `complete`, `evidence`, `snapshot`, `desync-check`, and `rollback`.
- `src/cli/index.ts` does not register `status`.
- `src/cli/commands/current.ts` prints task ID, title, workflow, status, and phase. It is the closest existing status-like command.
- `src/cli/commands/next.ts` resolves a task, prints a high desync warning when needed, renders the next prompt, and prints the prompt.
- `src/cli/commands/next.ts` supports `--task` and `--write`, but not `--quiet`.
- `src/cli/commands/complete.ts` resolves a task, calls `PlaySpecCore.completePhase()`, then prints completion result, next phase/status, snapshot files, evidence files, and optional review file.
- `src/cli/commands/complete.ts` supports `--task` and `--with-review`, but not `--quiet`.
- `src/core/types.ts` `TaskRecord` includes `id`, `title`, `workflowType`, `status`, `workflowMode`, `currentPhase`, paths, variables, `phaseHistory`, optional `stateSync`, and optional `rollback`.
- `src/core/types.ts` does not include `attempt`, `target`, or `contextRefs`.
- `src/core/schemas.ts` `TaskRecordSchema` rejects unknown fields by default zod object behavior only as strip behavior; unmodeled fields are not preserved through parse/save paths.
- `src/storage/yaml-task-store.ts` loads task data through `TaskRecordSchema.parse(raw)` and writes validated task records.

### Inferred but not fully verified

- A compact header can be implemented entirely in CLI code using the resolved `TaskRecord`.
- To show `Phase: 2 / 5`, CLI code may need workflow phase count. The phase plan says header derives only from `task.yaml`; therefore the safest Phase `3.5` implementation is either `Phase: 2` or a task-yaml-derived current phase until phase count is explicitly available from task state. If implementation reads workflow solely for display, that conflicts with the phase's "task.yaml only" rule and should be avoided unless the phase owner accepts the ambiguity.
- Since Phase `3.6` later adds `target.phaseNumber` and `contextRefs`, Phase `3.5` may need schema fields for preserving/displaying those values if they already exist in task YAML. It must not implement their creation workflow.

### Proposed Phase 3.5 direction

Add a localized CLI visibility layer:

- Create a small header formatter that accepts a `TaskRecord` and returns header lines.
- Call the formatter from `next`, `complete`, and `status`.
- Register a `status` command in `src/cli/index.ts`.
- Either keep `current` unchanged as a legacy focused command or make it delegate to the same status display without removing it.
- Add `--quiet` to `next`, `complete`, and `status`; quiet suppresses only the compact header.
- Keep header generation read-only and task-yaml-based.

Avoid adding a general presentation framework. A small CLI helper is enough.

## 5. Use Case Alignment for this Phase

| Use case | Current status | Phase 3.5 expected result | Observable result |
|---|---:|---|---|
| User runs `playspec next` and wants to know the task before reading the prompt | partial | header appears before prompt content | stdout starts with `Task:` / `Phase:` before prompt body, except desync warning may precede both |
| User scripts `playspec next` and wants prompt only | missing | `--quiet` suppresses header | stdout contains rendered prompt without header lines |
| User runs `playspec complete` and wants confidence about which task is being completed | missing | header appears before completion flow output | stdout includes header before `Completed phase ...` |
| User scripts `playspec complete` | missing | `--quiet` suppresses header only | completion result still prints |
| User wants full task detail | missing for `status` | `playspec status` exists and includes header plus fuller details | stdout includes compact header and detail fields |
| Task YAML has no attempt/target/contextRefs | blocked by absence of data | omit those lines | header remains short and does not invent values |
| Task YAML has target/contextRefs from future-compatible schema | partial / schema-dependent | display them if preserved by schema | header includes `Target:` and `Context:` lines |

## 6. Relevant files reviewed

### must-read

- `docs/playspec_phase_plan.md`
- `docs/playspec_total_spec.md`
- `src/cli/index.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/complete.ts`
- `src/cli/commands/current.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `tests/cli.test.ts`

### maybe-read

- `src/core/active-task-resolver.ts`
- `src/core/playspec-core.ts`
- `src/workflow/phase-resolver.ts`
- `src/workflow/workflow-loader.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/task-store.test.ts`

### ignore-for-now

- `src/template/**`
- `src/preset/**` except fixture setup if tests need it
- `src/core/rollback-manager.ts`
- `src/core/state-desync-detector.ts`
- `src/cli/commands/evidence.ts`
- `src/cli/commands/snapshot.ts`
- MCP, archive, viewer, evolution, harness, DAG files

## 7. Active entry points and possible bypasses

| Entry point / call site | Current behavior | Status | Why it matters to this phase |
|---|---|---:|---|
| `src/cli/index.ts` `program.command('next')` | wires `--task`, `--write` to `runNext()` | partial | Must accept `--quiet` and pass it through. |
| `src/cli/commands/next.ts` `runNext()` | prints desync warning, prompt | partial | Main visible header location; ordering with desync warning must be explicit. |
| `src/cli/index.ts` `program.command('complete')` | wires `--task`, `--with-review` to `runComplete()` | partial | Must accept `--quiet` and pass it through. |
| `src/cli/commands/complete.ts` `runComplete()` | prints completion result after state mutation | partial | Header should print after task resolution and before completion mutation/output. |
| `src/cli/index.ts` status command | absent | missing | Phase plan explicitly names `playspec status`. |
| `src/cli/commands/current.ts` `runCurrent()` | prints current task detail | partial | Existing old path can confuse users if it diverges from `status`. |
| `src/core/playspec-core.ts` `renderNextPrompt()` | returns prompt only | done for Core boundary | Header is CLI presentation, not Core prompt rendering. |
| Direct Core callers | receive no header | done for Core boundary | Not a bypass if header is intentionally CLI-only. |

### Old-path / bypass-path risks

- Old path: `playspec current` already provides task detail. If `status` is added separately, keep output semantics consistent enough that users do not get conflicting phase/status text.
- Bypass path: `playspec phase` renders prompt output without a header. This is acceptable because Phase `3.5` names `next/status/complete`, not `phase`.
- Bypass path: direct `PlaySpecCore.renderNextPrompt()` callers receive prompt only. This is acceptable because Core must stay decoupled from CLI presentation.
- Partial migration risk: adding header logic directly to `next` and `complete` without a shared helper can cause format drift and inconsistent optional-field handling.

## 8. Verified behavior and constraints

- Header must not mutate task state.
- Header must not create or require project-level state.
- `--quiet` must not suppress errors.
- `--quiet` must not suppress Phase `3` high-desync warnings unless explicitly accepted as a separate CLI quiet policy. The Phase `3.5` boundary says quiet suppresses the Context Header.
- `complete` should print the header before mutating the task so the user sees the task/phase about to be completed.
- `next` high-desync warning currently prints before prompt rendering. If a header is added, acceptable ordering is:
  - desync warning, blank line, header, prompt; or
  - header, blank line, desync warning, prompt.
  The implementation must choose one and test it. Do not let the header hide the warning.
- Current task schema lacks `target`, `contextRefs`, and attempts. Do not invent values.

## 9. What is already implemented vs what still needs verification

### Already implemented

- Task title is available in `TaskRecord.title`.
- Current workflow phase is available as `TaskRecord.currentPhase`, with `null` meaning not started / first phase resolution.
- `current` can show basic task details from HEAD.
- `next` and `complete` already resolve the active or explicit task.
- CLI tests already exercise `next`, `complete`, desync warning before `next`, and completed-task errors.

### Still needs implementation or verification

- `playspec status` command.
- Shared compact header formatter.
- `--quiet` options for `next`, `status`, and `complete`.
- Header omission of attempt/target/context lines when task YAML lacks those values.
- Decision on whether `Phase: N / total` is allowed without reading workflow data.
- Future-compatible schema shape if Phase `3.5` decides to preserve/display `target` or `contextRefs`.

## 10. Proposed implementation direction for this phase

### Header helper

Add a small CLI helper, for example `src/cli/context-header.ts` or `src/cli/commands/context-header.ts`.

Suggested interface:

```ts
interface ContextHeaderOptions {
  includeFullDetail?: boolean;
}

function formatContextHeader(task: TaskRecord): string[];
```

Keep it pure and easy to unit test if useful.

Suggested default output:

```text
Task: Login System Phase 1 Execution
Phase: 2
```

Optional lines:

```text
Phase: 3 (attempt 2)
Target: Phase 1
Context: 2 refs linked
```

Only include optional lines when data is present in validated task state.

### Status command

Add `src/cli/commands/status.ts` and register `program.command('status')`.

Suggested behavior:

- Resolve task with `ActiveTaskResolver`.
- Print compact header unless `--quiet`.
- Print fuller details below:
  - ID
  - workflow
  - status
  - created/updated timestamps if useful
  - state sync / rollback details only if already present and concise
- Avoid turning `status` into a dashboard.

### Next command

Update `runNext()` signature to accept a quiet/header option.

- Resolve task.
- Perform existing active-task and desync behavior.
- Print header unless quiet.
- Print prompt.
- Preserve `--write` behavior.

### Complete command

Update `runComplete()` signature to accept quiet/header option.

- Resolve task.
- Print header unless quiet.
- Then call `completePhase()`.
- Print existing completion result.

### Task data model

Minimum viable Phase `3.5` does not need new task fields. If optional display of `target` and `contextRefs` is required now, add only schema/type fields needed to preserve and display task-yaml data:

```yaml
target:
  phaseNumber: "1"
contextRefs:
  - path: docs/features/login_system/total_spec.md
    role: planning-context
    source: login_system
```

Do not add creation, binding, validation, or missing-file enforcement for those fields in this phase.

## 11. Testable outcomes

| Test scenario | Entry point | Required setup | Expected observable result | Status | Out-of-phase failure acceptable |
|---|---|---|---|---:|---:|
| `next` prints header before prompt | `playspec next` | active task | stdout includes `Task:` and `Phase:` before prompt body | testable | no |
| `next --quiet` suppresses header | `playspec next --quiet` | active task | stdout contains prompt, not compact header lines | testable | no |
| high desync still warns with header | `playspec next` | completed phase, high desync | warning and header both appear before prompt | testable | no |
| `complete` prints header before mutation output | `playspec complete` | active task in git repo | stdout includes header before `Completed phase` | testable | no |
| `complete --quiet` suppresses header only | `playspec complete --quiet` | active task in git repo | stdout includes completion result, no compact header | testable | no |
| `status` exists | `playspec status` | active task | exit 0 and prints header plus fuller task detail | testable | no |
| optional fields omitted | `playspec status` | task without attempt/target/contextRefs | no `Target:` or `Context:` line | testable | no |
| optional contextRefs displayed | `playspec status` | task YAML/schema supports contextRefs | `Context:` line summarizes refs | partially testable until schema decision | yes |
| reviewer demo | `next`, `status`, `complete --quiet` | active multi-spec task | visible header on normal commands; quiet output remains script-friendly | testable | no |

## 12. Example review / demo scenarios

1. Create an active task and run `playspec status`.
   - Expected: compact header appears first, followed by fuller task detail.

2. Run `playspec next`.
   - Expected: compact header appears before the rendered prompt.

3. Run `playspec next --quiet`.
   - Expected: prompt renders without header lines.

4. Initialize git, run `playspec complete`.
   - Expected: header appears before completion result and artifact list.

5. Run `playspec complete --quiet` on a separate task.
   - Expected: completion result remains, header is omitted.

## 13. Risks / open questions

- `medium risk`: The phase plan example says `Phase: 2 / 5`, but the header source rule says task YAML only. Current task YAML stores `currentPhase`, not total phase count. Smallest safe fix: display only the current phase unless total count is already present in task state, or explicitly document a narrow exception before implementation.
- `medium risk`: `status` is specified but not implemented, while `current` already exists. Smallest safe fix: add `status` and keep `current` either unchanged or delegating to the same detail renderer.
- `medium risk`: Optional fields from later phases can cause scope drift. Smallest safe fix: display `target/contextRefs/attempt` only when already present; do not implement creation/binding/attempt tracking.
- `low risk`: Header formatting can drift across commands. Smallest safe fix: use a shared formatter.
- `low risk`: `--quiet` could be interpreted as fully silent mode. Smallest safe fix: document and test that it suppresses only the Context Header in Phase `3.5`.

## 14. Mermaid diagrams

No Mermaid diagram is needed for this phase. The control flow is a short CLI presentation layer around existing task resolution.
