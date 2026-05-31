# Implementation Plan

## Ordered Steps

1. Update finalized artifact variable resolution in `src/core/playspec-core.ts`.
   - Extract artifact path placeholder names from `workflow.definition.artifacts`.
   - Use `resolveAndAssertRequiredVariables()` in `resolveFinalizedArtifacts()` with those placeholders as additional demanded variables.
   - Preserve the existing rendered artifact object shape.

2. Add terminal completion preflight in `src/core/playspec-core.ts`.
   - After `resolveRoutedCompletion()` and `assertNextPhaseRequiredVariables()`, call `resolveFinalizedArtifacts(task, workflow, phaseId, definition)` when `nextPhase === null`.
   - This validates required artifact variables before snapshots, completion records, and task state changes are written.

3. Add MCP integration coverage in `tests/integration/mcp-server.test.ts`.
   - Negative test: terminal completion with workflow artifact `docs/{{PROJECT_KEY}}/result.md`, `PROJECT_KEY.required: true`, and no task value should return MCP error text containing the existing missing-required-variable message and `PROJECT_KEY`.
   - Verify the task is not moved to completed state after the failed terminal completion.
   - Positive test: declaration defaults still resolve into `finalizedArtifacts` for valid terminal completion. The existing terminal finalized artifact test already covers default-derived `OUTPUT_DIR`, `SPEC_FILE`, and `RESULT_FILE`; keep or strengthen that assertion.

4. Run targeted validation.
   - `pnpm vitest run tests/integration/mcp-server.test.ts`
   - `pnpm vitest run tests/unit/variable-resolver.test.ts`
   - `pnpm build`

## Files to Edit

- `src/core/playspec-core.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/result.md`
- `docs/features/issue_291_validate_required_variables_before_rendering_finalized_artifact_paths/pr.md`

## Active Flow Trace

MCP `playspec_complete_phase` -> `PlaySpecCore.completePhase()` -> resolve current workflow/phase -> route completion -> validate next phase variables -> preflight terminal finalized artifacts -> write completion artifacts -> persist task phase/status -> return `finalizedArtifacts`.

## Old Paths and Bypasses to Close

- Old bypass: `resolveFinalizedArtifacts()` directly called `variableResolver.resolve()` and rendered paths without `assertRequiredVariables()`.
- Partial mutation risk: validation after `taskStore.completePhase()` could return an error after state was already completed. The preflight closes that for terminal completion.

## Tests

Required:

- Missing required artifact path variable rejects terminal MCP completion.
- Default-backed artifact path variables still resolve in terminal `finalizedArtifacts`.

Regression:

- Existing successful terminal completion response shape remains unchanged.
- Variable resolver unit tests remain unchanged and passing.

## Risks

- Some existing workflows may have relied on completing with unresolved required artifact placeholders. This is now treated as a workflow configuration error, matching prompt rendering.
- `resolveFinalizedArtifacts()` may still be invoked for non-terminal completions by existing code. Using required-variable assertion there could expose invalid workflow configuration earlier than before. The terminal preflight is the user-visible safety fix; valid workflows should be unaffected.

## Rollback Notes

Rollback is a small code/test revert in `src/core/playspec-core.ts` and `tests/integration/mcp-server.test.ts`. No migration or persistent schema change is involved.

## Completion Criteria

- Terminal completion fails with the existing missing-required-variable public error when a required artifact path variable is absent or empty.
- Failed terminal completion does not mark the task completed.
- Valid finalized artifacts with declaration defaults still return resolved paths.
- Targeted integration test, variable resolver unit tests, and build pass.
