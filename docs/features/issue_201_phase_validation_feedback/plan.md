# Issue #201 Implementation Plan

## Ordered Steps

1. Update built-in mono-spec workflow feedback config.
   - Edit `src/preset/assets/workflows/mono-spec/workflow.yaml`.
   - Add `feedback` config under `tech_spec_validate`.
   - Add `feedback` config under `implementation_plan_validate`.
   - Preserve the existing `gate.results` and `gate.nextByResult` maps.
   - Use `feedbackThreshold: 90` and `approval.threshold: 95`.
   - Use bundled preset workflow source metadata and non-writable bundled target templates by default.
   - Configure bounded compact history and manual-only proposal readiness.

2. Update technical spec validation prompt.
   - Edit `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`.
   - Add a required `playspecFeedback` YAML fenced block to the exact output requirements.
   - Require phase metadata:
     - `sourcePhaseId: tech_spec_validate`
     - `evaluatedArtifactPhaseId: tech_spec_draft`
     - default `evolutionTargetPhaseId: tech_spec_draft`
   - Document that authoring prompt gaps target `tech_spec_draft` by default.
   - Document that validator prompt gaps may target `tech_spec_validate` and the validation template path instead.

3. Update implementation plan validation prompt.
   - Edit `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`.
   - Add the same structured block requirement with plan-specific values:
     - `sourcePhaseId: implementation_plan_validate`
     - `evaluatedArtifactPhaseId: implementation_plan_create`
     - default `evolutionTargetPhaseId: implementation_plan_create`
   - Document validator prompt gap override to `implementation_plan_validate`.

4. Add workflow loader assertions.
   - Edit `tests/integration/workflow-loader.test.ts`.
   - Extend the mono-spec workflow test to assert both validation phases have feedback config.
   - Assert 90 feedback threshold, 95 approval threshold, phase IDs, target files, bundled workflow source metadata, target writability, compact history bounds, manual proposal readiness, and unchanged routing.

5. Add completion capture regression coverage.
   - Edit `tests/integration/completion-engine.test.ts`.
   - Add a helper or targeted workflow fixture that mirrors mono-spec validation feedback config closely enough to test core behavior without relying on manual review files.
   - Test score 91 with completion result `needs_revision` records positive feedback and routes to the revision phase.
   - Test score 89 records negative feedback.
   - Test default authoring-prompt target metadata is persisted in the thread.
   - Test a validation prompt gap can target the validation prompt/template instead.

6. Run focused validation.
   - Run `pnpm test tests/integration/workflow-loader.test.ts tests/integration/completion-engine.test.ts`.
   - Run `pnpm build`.
   - Run `git diff --check`.
   - Run full `pnpm test` if focused tests and build pass.

## Files To Edit

- `src/preset/assets/workflows/mono-spec/workflow.yaml`
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`
- `tests/integration/workflow-loader.test.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_201_phase_validation_feedback/result.md`
- `docs/features/issue_201_phase_validation_feedback/pr.md`

Generated `.playspec` task state should not be committed. Project workflow copies under `.playspec/workflows` should only be updated if a test or repository fixture requires parity; current `.gitignore` makes task state ignored.

## Risks

- `scoreSource.artifactRole` must point at the rendered prompt snapshot in automated tests because actual validation markdown is not a persisted artifact unless the workflow writes one. Use `prompt_snapshot` in config if the structured block lives in the validation template/prompt snapshot.
- Built-in preset targets are not directly writable. Configure `targetPromptTemplate.writable: false` and rely on proposal evidence/manual review rather than automatic mutation.
- The validation-prompt-gap override must still conform to configured phase IDs. Because `ValidationFeedbackExtractor` asserts the observed `evolutionTargetPhaseId` matches the phase config, testing validator prompt gaps may require a fixture whose config target is the validation phase, or a second validation phase config. Do not change extractor semantics in this issue.

## Rollback Notes

Rollback is straightforward: revert the mono-spec workflow YAML, the two validation template edits, and focused tests. Feedback threads written during manual testing are under `.playspec/evolution/feedback/threads` and are not product source.

## Completion Criteria

- Built-in `mono-spec` workflow loads with feedback config on both validation phases.
- Approval routing stays unchanged.
- Score 91 can produce positive feedback while completion result remains `needs_revision`.
- Score 89 produces negative feedback.
- Default target metadata points at authoring prompt templates.
- Validator prompt gap coverage proves validation prompt targeting is possible through config/template metadata.
- Focused and full repository validation pass.
