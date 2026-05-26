# Issue #221: Reserved Engine Phase Metadata

## Scope

Prevent task-supplied variables from overriding resolver-derived engine metadata in `VariableResolver.resolve()`. The focused change is in `src/template/variable-resolver.ts`, with tests in `tests/unit/variable-resolver.test.ts`.

Out of scope: workflow variable redesign, broad task validation, MCP, rollback, harness, routing, workflow installation, and viewer behavior.

## Use Case Alignment

Operators and automation must be able to trust rendered metadata such as `TASK_ID`, `TASK_TITLE`, `WORKFLOW_TYPE`, `PHASE_NUMBER`, `STEP_NUMBER`, `STEP_ID`, and `STEP_TITLE`. A task may still provide normal workflow variables, but those task variables must not spoof the active task or phase identity.

## High-Level Current Implementation Summary

Verified in `src/template/variable-resolver.ts`:

- `VariableResolver.resolve()` builds `engineVariables` from the task record and active phase definition.
- It resolves declared workflow and phase defaults via `resolveDeclaredDefaults()`.
- It filters empty task variables, then returns `{ ...engineVariables, ...resolvedDefaults, ...nonEmptyTaskVariables }`.
- `resolveDeclaredDefaults()` currently seeds its `resolved` map with `{ ...engineVariables, ...taskVariables }`, so task variables can affect default interpolation before final merge.

This means a task variable named `PHASE_NUMBER` or `STEP_ID` can affect both rendered output and workflow defaults that reference those names.

## Relevant Files Reviewed

- `src/template/variable-resolver.ts`: active resolver implementation and default dependency logic.
- `tests/unit/variable-resolver.test.ts`: existing resolver coverage for standard metadata, mono-spec defaults, explicit non-reserved overrides, empty task variables, unknown references, and circular defaults.
- `src/core/playspec-core.ts`: uses `VariableResolver.resolve()` for render paths; no separate validation appears necessary for this issue.

## Active Entry Points And Bypasses

Active entry points:

- Direct resolver calls in unit tests and core/template paths.
- `PlaySpecCore.renderNextPrompt()` resolves variables through `VariableResolver`.
- CLI create/render paths also call the resolver.

Bypass risk:

- Any caller passing a `TaskRecord` with colliding `task.variables` currently receives spoofed reserved metadata unless the resolver filters those keys.

## Current Architecture

The resolver is the right boundary for this contract because all render paths depend on its returned variable map. Core validation is optional and would be broader than needed if the resolver can consistently ignore reserved collisions.

## Verified Behavior

Verified from code:

- Non-empty task variables currently override derived values in the final return object.
- Task variables are used while resolving defaults, which lets spoofed reserved keys affect default-dependent paths.
- Empty task variables are intentionally ignored so declared defaults can fill in values.
- Explicit non-reserved task variables override declared defaults, such as custom report paths.
- Unknown and circular default handling is already covered and should remain unchanged.

## Problems

- Reserved engine metadata has no protected namespace.
- Defaults referencing engine variables can be computed from untrusted task data.
- Final resolved variables can disagree with the actual task record and active phase.

## Proposed Direction

Define an explicit reserved engine variable set in `src/template/variable-resolver.ts` for resolver-derived metadata:

- `TASK_ID`
- `TASK_TITLE`
- `WORKFLOW_TYPE`
- `PHASE_NUMBER`
- `STEP_NUMBER`
- `STEP_ID`
- `STEP_TITLE`

Filter task variables with those names out before default resolution and final merge. Preserve existing behavior for non-reserved variables, including explicit overrides of declared workflow variables and ignored empty strings.

## File-By-File Plan

`src/template/variable-resolver.ts`:

- Add a local reserved engine variable set.
- Build `nonReservedTaskVariables` from `task.variables` by excluding reserved names.
- Use `nonReservedTaskVariables` when resolving declared defaults.
- Continue using a non-empty filtered version of the non-reserved task variables for final overrides.

`tests/unit/variable-resolver.test.ts`:

- Add a test proving task variables with reserved names do not replace derived task and phase metadata.
- Add a test proving defaults referencing `{{PHASE_NUMBER}}` and `{{STEP_ID}}` use derived active phase values even when task variables contain spoofed reserved values.
- Keep existing tests for default chains, explicit non-reserved overrides, unknown references, and circular defaults passing.

## Risks And Open Questions

- Existing tasks with colliding reserved variables will have those values ignored by the resolver. This is the safer acceptance-criteria-compatible behavior and avoids failing old tasks.
- `FEATURE_SLUG` is resolver-provided but intentionally not included in the issue's reserved metadata list, because existing behavior allows task-provided feature slug customization.
- No integration test is expected unless a render-path-specific regression appears, since `renderNextPrompt()` already uses the resolver.

## Reader Aids

Verified current precedence:

```text
engine variables -> defaults seeded with task variables -> non-empty task variables override final output
```

Proposed precedence:

```text
reserved engine variables always derived
non-reserved task variables may seed defaults and override declared defaults
empty task variables still allow defaults
```
