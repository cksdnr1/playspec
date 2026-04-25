# PlaySpec Phase 1.5 Implementation Spec

## 1. How to Read This Spec

This is a Phase `1.5`-only implementation spec.

Use the documents in this order:

1. [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md) for the locked phase boundary.
2. [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md) for architecture and product intent.
3. The current repository code for verified implementation truth.
4. This document for the smallest safe implementation direction for Phase `1.5`.

Important boundary note: the user prompt text refers to "Minimal Markdown Preview", but the actual `Dev Phase 1.5` entry in the phase plan is `Template Renderer Hardening`. This spec follows the phase plan, per instruction.

Important current-state note: the repo already contains a working Phase `1.1` to `1.4` runtime path for `next` and `phase`. Phase `1.5` therefore hardens that existing shared render pipeline rather than inventing a separate path, and it must stay inside the Phase `1.x` render boundary without pulling in Phase `2+` behavior.

## 2. Phase Boundary Alignment

### What this phase is trying to enable

Phase `1.5` exists to make prompt rendering safe and reviewable rather than best-effort. It hardens the render path used by `playspec next` so that template resolution, includes, variable requirements, and placeholder completeness fail explicitly instead of producing a broken prompt.

### What must be complete before the next phase can safely begin

- One real prompt-rendering path exists for `next`, and explicit `phase` rendering stays on the same shared Core/template pipeline.
- The path loads a template, resolves includes, validates required variables, renders with Handlebars, and rejects unresolved placeholders.
- Template and workflow failures surface explicit file-path-based errors.
- `next` is observable end-to-end from CLI entry point to rendered stdout output.
- The render path is reusable for `phase N` rather than duplicated.

### What is intentionally deferred

- Markdown preview or browser viewer
- MCP
- completion, lock, evidence, rollback, archive
- state desync checks
- evolution
- SQLite
- DAG execution
- any Phase `2+` state progression behavior

### Visible capability or safety property introduced by this phase

Visible capability:

- `playspec next` can render a real prompt from workflow and template data.

Safety property:

- broken templates, missing includes, unresolved placeholders, and missing required variables fail before a prompt is shown to the user.

### What would make this phase unsafe even if partially implemented

- `next` prints partially rendered output with raw `{{placeholder}}` tokens still present
- include resolution is added without circular-include protection
- template validation exists in one code path but `next` bypasses it
- `next` and `phase` diverge into separate renderer implementations
- missing template and workflow errors do not identify the failing file path

### Dependencies

- The existing Dev Phase `1.1` to `1.4` CLI/task/workflow/variable baseline already present in code
- The shared Core render path used by `renderNextPrompt` and `renderExplicitPhasePrompt`
- Localized hardening in workflow schema, template include handling, and render validation only

### Blockers / open questions from current code

- No prerequisite blocker remains: current code already implements `next`, `phase`, workflow loading, task resolution, variable resolution, and one shared Core render path.
- Safe interpretation: Phase `1.5` should harden that existing shared render pipeline, not reclassify normal in-phase renderer work as blocked, not add viewer work, and not add Phase `2+` state advancement.

## 3. Phase Outcome at a Glance

### After this phase, you can

- run `playspec next`
- have the CLI resolve the target phase and render its prompt through one validated template pipeline
- use template includes
- get actionable failures for missing templates, include cycles, missing required variables, and unresolved placeholders

### After this phase, you still cannot

- complete a phase
- collect evidence
- rollback
- archive tasks
- use MCP
- open a markdown viewer

### This phase is ready to implement / hand off when

- one shared renderer path is defined for `next` and future `phase N`
- include resolution is bounded and cycle-safe
- required-variable checks are explicit
- unresolved placeholder detection is explicit
- errors identify the relevant template or workflow file path
- the implementation plan stays inside the Phase `1.x` render pipeline and avoids Phase `2+` state changes

## 4. Initial Phase Summary

### Intended capability of this phase

Turn Phase `1` task/workflow context into a real rendered prompt safely enough that reviewers can trust `next` output.

### What is still unclear before deep verification

No architecture/spec-level open questions remain.

### After this phase, you can

- render the next prompt through one hardened pipeline

### After this phase, you still cannot

- preview rendered output in a browser
- persist completion state or evidence

### What real workflow this phase unlocks

A reviewer or human CLI user can initialize a workspace, create a task, and ask PlaySpec for the next prompt with confidence that the output is fully resolved or fails with a repairable error.

### What workflow remains intentionally deferred

Anything involving prompt viewing, completion state, evidence, rollback, archive, or agent adapters.

### What should be testable if the phase is grounded correctly

- successful render of a phase template through `next`
- missing template failure
- include success
- circular include failure
- missing required variable failure
- unresolved placeholder failure

## 5. Current Implementation vs Proposed Direction

### Verified current behavior

- [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts) registers `next` and `phase` commands.
- [src/core/playspec-core.ts](/volume2/PJ/playspec/src/core/playspec-core.ts) already orchestrates one shared render path for `renderNextPrompt` and `renderExplicitPhasePrompt`.
- [src/workflow/workflow-loader.ts](/volume2/PJ/playspec/src/workflow/workflow-loader.ts) and [src/workflow/phase-resolver.ts](/volume2/PJ/playspec/src/workflow/phase-resolver.ts) already load workflows and resolve phases.
- [src/template/template-renderer.ts](/volume2/PJ/playspec/src/template/template-renderer.ts) already loads templates, expands `{{include:...}}`, detects circular includes, renders through Handlebars, and rejects unresolved placeholders.
- [src/core/schemas.ts](/volume2/PJ/playspec/src/core/schemas.ts) already provides task and workflow schema validation, but does not yet define a canonical `requiredVariables` field.
- [src/core/errors.ts](/volume2/PJ/playspec/src/core/errors.ts) contains a reusable `PlaySpecError`.
- [src/utils/fs.ts](/volume2/PJ/playspec/src/utils/fs.ts) provides basic text read/write helpers.
- [package.json](/volume2/PJ/playspec/package.json) already includes `handlebars`, `yaml`, `zod`, `commander`, `marked`, and `open`.
- [tests/unit/template-renderer.test.ts](/volume2/PJ/playspec/tests/unit/template-renderer.test.ts) already covers include expansion, circular include failure, and unresolved placeholder failure.
- [tests/integration/init-create-next.test.ts](/volume2/PJ/playspec/tests/integration/init-create-next.test.ts) already covers `init -> create -> renderNextPrompt` and explicit phase rendering.

### Inferred but not fully verified points

- `requiredVariables` should be owned canonically by workflow phase metadata as `phases.<phaseId>.requiredVariables` so the render contract has one source of truth.
- include resolution should normalize paths and keep reads bounded to `.playspec` roots; current code joins paths under `.playspec` but does not yet document or enforce a normalized root-bound check.

### Intended behavior for Phase 1.5

- `next` resolves a target phase using the active task context from earlier Phase `1.x` flow.
- The target phase identifies a template.
- The template renderer loads the template, expands includes, validates required variables, renders via Handlebars, rejects unresolved placeholders, and returns the final prompt.
- CLI prints the final prompt or a clear `PlaySpecError`.

## 6. Use Case Alignment for This Phase

| Use case | Current status | Phase target | Final observable result |
|---|---|---|---|
| Human runs `playspec next` for an active task | partial | harden | stdout contains the fully rendered prompt through the existing shared render path |
| Template contains reusable include content | partial | harden | included content appears in final prompt with normalized root-bounded include loading |
| Template include graph contains a cycle | done | preserve | command fails with cycle error naming the include path stack |
| Workflow/template declares a required variable that is absent | missing | add | command fails before prompt output with missing variable error |
| Template render leaves raw `{{placeholder}}` text | partial | harden | command fails with unresolved placeholder error under one explicit Phase `1.5` rule |
| Human wants browser preview | out-of-phase | deferred | no viewer behavior in this phase |

## 7. Relevant Files Reviewed

### must-read

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)
- [package.json](/volume2/PJ/playspec/package.json)
- [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts)
- [src/core/index.ts](/volume2/PJ/playspec/src/core/index.ts)
- [src/core/errors.ts](/volume2/PJ/playspec/src/core/errors.ts)
- [src/core/schemas.ts](/volume2/PJ/playspec/src/core/schemas.ts)
- [src/template/index.ts](/volume2/PJ/playspec/src/template/index.ts)
- [src/workflow/index.ts](/volume2/PJ/playspec/src/workflow/index.ts)
- [src/utils/fs.ts](/volume2/PJ/playspec/src/utils/fs.ts)
- [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts)
- [tests/helpers/createTempWorkspace.ts](/volume2/PJ/playspec/tests/helpers/createTempWorkspace.ts)

### maybe-read

- [src/storage/index.ts](/volume2/PJ/playspec/src/storage/index.ts)
- [src/preset/index.ts](/volume2/PJ/playspec/src/preset/index.ts)
- [vitest.config.ts](/volume2/PJ/playspec/vitest.config.ts)

### ignore-for-now

- viewer-specific design or implementation
- rollback/archive/evidence systems
- MCP adapter work
- future DAG work
- Phase `2+` docs and runtime paths unrelated to prompt rendering

## 8. Active Entry Points and Possible Bypasses

### Entry-point audit

| Entry point / call site | Current behavior | Status | Why it matters to this phase |
|---|---|---|---|
| CLI bootstrap in [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts) | registers `next` and `phase` and delegates to command handlers | done | this is the active CLI entry point for the render path |
| `playspec next` command | implemented through [src/cli/commands/next.ts](/volume2/PJ/playspec/src/cli/commands/next.ts) | done | this is the required observable phase outcome |
| Core render orchestration in [src/core/playspec-core.ts](/volume2/PJ/playspec/src/core/playspec-core.ts) | shared path used by `renderNextPrompt` and `renderExplicitPhasePrompt` | done | Phase `1.5` must preserve this shared prompt-render pipeline |
| Workflow load/phase resolve in [src/workflow/index.ts](/volume2/PJ/playspec/src/workflow/index.ts) | implemented via exported loader and resolver modules | done | renderer already depends on this contract to select a template |
| Template load/render in [src/template/index.ts](/volume2/PJ/playspec/src/template/index.ts) | implemented via `TemplateRenderer` and `VariableResolver` | partial | this phase hardens include safety and required-variable ownership on the existing path |
| Schema validation in [src/core/schemas.ts](/volume2/PJ/playspec/src/core/schemas.ts) | task/workflow schemas exist, but render metadata is still incomplete | partial | `requiredVariables` validation needs a canonical schema field |

### Possible bypasses

- bypass risk: CLI could read template files directly and bypass Core/template modules
- partial-migration risk: required-variable validation could be added in a different layer than unresolved placeholder checks, creating inconsistent failure semantics
- include-safety risk: current include reads are rooted under `.playspec`, but path normalization and root-bound enforcement are still a current code gap
- old-path risk: none observed in current code; `next` and `phase` already share one Core/template path

## 9. Verified Behavior and Constraints

### Verified behavior

- `PlaySpecError` already supports a message plus optional recovery hint.
- basic file IO helpers already exist and are sufficient for loading template text once the render path is implemented.
- the test workspace helper creates temp directories outside the repo root, which is the right base for renderer integration tests.

### Constraints from the phase plan and code

- This phase must remain in the `Template Renderer Hardening` boundary from the phase plan, not the prompt wording in the request.
- Core must not depend on CLI-only state like implicit global `HEAD`.
- The render pipeline must be coherent end-to-end. Helpers or partial validators do not count as phase completion.
- Later-phase preview/viewer behavior must not leak into this phase.

## 10. What Is Already Implemented vs What Still Needs Verification

### Already implemented

- CLI bootstrap
- `next` command registration
- `phase` command registration
- active-task resolution path
- workflow loading
- phase resolution
- variable resolution
- template loading and Handlebars rendering
- include system
- circular include detection
- unresolved placeholder detection
- missing template and workflow error paths
- one generic domain error type
- basic text file IO
- temp workspace helper
- integration coverage for `init -> create -> renderNextPrompt` and explicit phase render
- dependency declarations for Handlebars and related libraries

### Still missing or unverified

- template metadata schema
- `requiredVariables` validation
- normalized root-bound include enforcement
- end-to-end CLI-level verification for file-path-rich failures

## 11. Proposed Implementation Direction for This Phase

### Smallest safe design

Implement one shared render pipeline with these responsibilities:

1. CLI adapter resolves command arguments and task context.
2. Core orchestrator requests workflow + phase + variables.
3. Workflow phase metadata declares `requiredVariables` canonically at `phases.<phaseId>.requiredVariables`.
4. Template module loads the target template and expands `{{include:path/to/file.md}}` only from normalized paths that remain inside `.playspec` roots.
5. Template module renders through Handlebars.
6. The shared render path validates required variables before render.
7. Template module scans the final output for unresolved placeholders and fails if any raw `{{...}}` token remains in Phase `1.5`.
8. CLI prints the final rendered prompt.

### Localized module responsibilities

- `src/cli/`
  - register `next`
  - map recoverable errors to human-readable CLI output
- `src/core/`
  - preserve the shared orchestrator contract for prompt rendering used by both `next` and `phase`
  - define schemas for workflow phase render metadata needed by `1.5`
- `src/workflow/`
  - expose target phase, template selection, and canonical `requiredVariables` metadata
- `src/template/`
  - own include loading, normalized root-bound path checks, cycle detection, Handlebars render, and unresolved placeholder detection

### Smallest safe fix for this phase

- Do not design a general plugin-like template engine.
- Do not introduce a separate preview renderer.
- Do not persist additional prompt history unless Phase `1` already requires it elsewhere.
- Do not add state transitions beyond reading enough task/workflow context to render.

### Proposed failure semantics

- missing template: fail with file path
- missing include: fail with file path plus parent template
- circular include: fail with include chain
- missing required variable: fail with variable name and source workflow phase
- unresolved placeholder after render: fail with placeholder token and target template; any remaining raw `{{...}}` token is a failure in Phase `1.5`

## 12. Testable Outcomes

| Test scenario | Entry point | Required setup | Expected observable result | Status | Out-of-phase failure acceptable |
|---|---|---|---|---|---|
| render next prompt successfully | `playspec next` | initialized workspace, active task, workflow with valid template and variables | stdout contains fully rendered prompt with no raw placeholders | testable | no |
| include expansion succeeds | template renderer via `next` | template includes another valid template fragment | final prompt contains included content | testable | no |
| circular include fails | template renderer via `next` | two templates include each other | command exits with actionable cycle error | testable | no |
| required variable missing | template renderer via `next` | workflow/template declares required variable absent from resolved inputs | command exits with missing variable error | testable | no |
| unresolved placeholder fails | template renderer via `next` | template references an undeclared value | command exits with unresolved placeholder error | testable | no |
| missing template file fails | `playspec next` | workflow points to absent template file | command exits with missing template file path | testable | no |
| reviewer demo: valid task renders prompt | `playspec next` | temp workspace with default preset and active task | reviewer sees prompt on stdout and can trace its template source | testable | no |
| viewer command absent | any CLI help or command invocation | current phase only | no preview/browser requirement is needed for completion | testable | yes |

## 13. Example Review / Demo Scenarios

1. Initialize a temp workspace with the default preset.
2. Create or prepare an active task that resolves to a known workflow phase.
3. Run `playspec next`.
4. Confirm stdout contains a prompt with all expected substitutions applied.
5. Edit the template to leave an unresolved `{{placeholder}}`.
6. Re-run `playspec next`.
7. Confirm the command fails and identifies the unresolved token and template path.
8. Edit templates to create an include cycle.
9. Re-run `playspec next`.
10. Confirm the command fails with an include chain instead of hanging or printing partial output.

## 14. Risks / Open Questions

### Blocker

- No true blocker remains after code verification.
Smallest safe fix: keep Phase `1.5` scoped to hardening the existing shared render pipeline and do not expand into viewer work or Phase `2+` state changes.

### Medium risk

- `requiredVariables` could be defined in multiple places, causing duplicate or conflicting validation rules.
Smallest safe fix: define `requiredVariables` only on workflow phase metadata at `phases.<phaseId>.requiredVariables` and validate it through `PhaseDefinitionSchema`.

### Medium risk

- include resolution may drift into arbitrary path traversal if file roots are not bounded.
Smallest safe fix: normalize include paths and reject any resolved path outside `.playspec/`, while continuing to allow `.playspec/templates/` and `.playspec/rules/` includes.

### Low risk

- unresolved placeholder behavior is already present in renderer logic, but the spec must keep one explicit rule so tests and future renderers do not drift.
Smallest safe fix: treat any remaining raw `{{...}}` token after render as a failure for Phase `1.5`.

### Open questions

No architecture/spec-level open questions remain.
