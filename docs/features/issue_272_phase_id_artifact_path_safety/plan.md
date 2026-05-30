# Issue 272 Implementation Plan

## Ordered Implementation Steps

1. Add a workflow phase ID safety validator in `src/workflow/workflow-loader.ts`.
   - Keep the helper close to workflow validation.
   - Accept only ASCII letters, digits, `_`, `.`, and `-`.
   - Reject `.` and `..`.
   - Error text must include the workflow ID, unsafe phase ID, allowed characters, and artifact filename safety rationale.

2. Call the validator from `WorkflowLoader.validateWorkflowDefinition()`.
   - Validate every `definition.phaseOrder` entry.
   - Validate every `Object.keys(definition.phases)` entry, including unused keys.
   - Run validation before template access so unsafe IDs fail even if their template exists.
   - Leave `phaseOrder` missing-reference, feedback-reference, and template-path validation behavior intact.

3. Add workflow-loader regression coverage in `tests/integration/workflow-loader.test.ts`.
   - Create an explicit workflow directory with an unsafe `bad/phase` phase ID and template.
   - Assert `resolveFromDirectory()` rejects with clear text about unsafe phase IDs and allowed characters.
   - Add coverage for a `..` phase ID or unsafe phase map key so path traversal style IDs are explicitly covered.

4. Strengthen completion artifact consistency coverage in `tests/integration/completion-engine.test.ts`.
   - Extend the existing completion ledger test or add a nearby test.
   - Assert `completePhase()` returns the same artifact refs recorded in task history and completion ledger.
   - Assert snapshot, evidence, review, rollback safe point, and markdown file refs remain unchanged for safe phase ID `1`.
   - Confirm completion markdown contains the same task-root-relative artifact refs.

5. Run focused validation.
   - `pnpm exec vitest run tests/integration/workflow-loader.test.ts`
   - `pnpm exec vitest run tests/integration/completion-engine.test.ts`
   - `pnpm build`
   - Broader `pnpm test` only if focused tests expose shared-risk changes or time permits after focused validation.

## Files To Edit

- `src/workflow/workflow-loader.ts`
- `tests/integration/workflow-loader.test.ts`
- `tests/integration/completion-engine.test.ts`
- Feature docs under `docs/features/issue_272_phase_id_artifact_path_safety/`

## Old Paths, Bypasses, And Partial Migration Risks

- Old artifact writers in `PlaySpecCore` will continue interpolating phase IDs. This is acceptable only because all production workflow loading paths will reject unsafe IDs.
- Direct unit tests that construct `WorkflowDefinition` objects can still bypass `WorkflowLoader`; no production task lifecycle entry point should.
- Existing task records with unsafe `currentPhase` cannot proceed if their workflow is reloaded and rejected. This is the intended fail-fast behavior.
- Harness writes only `harness.yaml`; it is covered by loader validation for phase existence and safe IDs, with no filename interpolation to change.
- Evolution feedback/context filename helpers interpolate phase IDs, but completion reaches them only after workflow loading, so loader validation closes that path too.

## Risks

- Compatibility: custom workflows with path-like phase IDs will stop loading.
- Error wording: tests should assert stable, helpful substrings without overfitting to a full message.
- YAML parsing of `..` as a key may need quoting in tests.

## Rollback Notes

The change is additive validation plus tests. Rollback is limited to removing the helper/calls and deleting the new test expectations. It does not migrate or mutate stored task artifacts.

## Completion Criteria

- Unsafe workflow phase IDs with `/` and `..` are rejected during workflow loading.
- Safe phase IDs preserve existing artifact filenames and completion ledger refs.
- Focused workflow-loader and completion-engine integration tests pass.
- Build passes.
