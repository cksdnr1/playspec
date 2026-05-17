# Validate routed next-phase variables before completing a phase

## Scope

Implement issue #127 only: `PlaySpecCore.completePhase()` must reject before mutating task state or writing completion artifacts when the computed next phase cannot satisfy its required variables. This applies to routed phases and linear next-phase resolution because both paths compute a `nextPhase` before the completion write.

Out of scope: workflow routing redesign, interactive variable prompts, task variable storage changes, and create-time validation changes tracked elsewhere.

## Use Case Alignment

An automation run completes a gated phase with `playspec complete --result approved`. If that result routes to a phase with a required custom variable that is absent from task variables/defaults, completion must fail immediately. The task should remain on the original phase with no phase history entry, no completion event, no evidence files, no snapshots, and no updated safe point.

## Current Implementation Summary

Verified in `src/core/playspec-core.ts` before the fix:

- `renderNextPrompt()` resolves the current phase and calls `renderResolvedPhase()`.
- `renderResolvedPhase()` resolves variables and calls `assertRequiredVariables()`.
- `completePhase()` resolves routing, renders the current phase snapshot, then writes snapshots, evidence, completion events, rollback safe-point metadata, and task state.
- The computed `nextPhase` was checked for routing validity but not for required-variable renderability.

Verified in `src/cli/commands/complete.ts`:

- The CLI calls `core.completePhase()` first.
- If completion returns a next phase, the CLI reloads the task and calls `core.renderNextPrompt()`.
- Any render error at that point is downgraded to a warning because state has already advanced.

## Relevant Files Reviewed

- `src/core/playspec-core.ts`
- `src/core/required-variables.ts`
- `src/core/errors.ts`
- `src/cli/commands/complete.ts`
- `tests/integration/routing.test.ts`
- `tests/cli.test.ts`

## Active Entry Points And Bypasses

Active entry points:

- Core: `PlaySpecCore.completePhase(taskId, { result })`.
- CLI: `playspec complete --result <route>`.
- MCP: delegates to `PlaySpecCore.completePhase()`, so core behavior covers it.

Out-of-scope bypasses:

- `renderExplicitPhasePrompt()` renders arbitrary phases but does not mutate completion state.
- `setCurrentPhase()` is manual phase recovery.
- Create-time first phase validation is separate existing behavior.

## Proposed Direction

Add a core preflight immediately after `resolveRoutedCompletion()` and before current-phase snapshot rendering or any artifact writes:

- If `nextPhase` is `null`, skip preflight.
- Resolve the target phase definition from `workflow.definition.phases[nextPhase]`.
- Use `VariableResolver.resolve(task, nextPhase, workflow.definition, nextDefinition)` plus `assertRequiredVariables()`.
- Reuse the same helper from `renderResolvedPhase()` so completion and prompt rendering agree.
- Preserve the existing `MissingRequiredVariablesError` message shape, including workflow id, routed next phase id, and missing variable names.

## File-By-File Plan

- `src/core/playspec-core.ts`: add a private helper for variable resolution plus required-variable assertion; call it from prompt rendering and from a new next-phase preflight in completion.
- `tests/integration/routing.test.ts`: add a gated workflow regression where `approved` targets a phase requiring missing `CUSTOM_REQUIRED`; assert rejection and unchanged task/artifact state.
- `tests/cli.test.ts`: add `playspec complete --result approved` coverage for the same missing routed target variable; assert non-zero exit instead of successful completion plus warning.

## Risks

- Validating by fully rendering the next prompt would add unrelated context/template reads. The implementation should validate only required variables.
- Artifact assertions must account for task-store directories that may exist before completion; tests should check that no files or completion ledger are written.

## Expected Error

```text
Missing required variables for workflow "routed-spec" phase "implementation": CUSTOM_REQUIRED
```
