# Issue #201 Implementation Result

## Behavior Implemented

- Added feedback opt-in config to `mono-spec` validation phases:
  - `tech_spec_validate` defaults prompt evolution feedback to `tech_spec_draft`.
  - `implementation_plan_validate` defaults prompt evolution feedback to `implementation_plan_create`.
- Preserved existing approval gates and routing:
  - approval threshold remains `95`.
  - `approved` and `needs_revision` still route through the existing `nextByResult` maps.
  - feedback threshold is independently configured as `90`.
- Added required `playspecFeedback` metadata guidance to both validation templates.
- Added validation-prompt-gap targeting support:
  - default feedback targets the authoring prompt configured on the phase.
  - `cause.category: validation_prompt_gap` may target the active validation phase instead.
- Kept proposal readiness manual-review-only with bounded compact history metadata.

## Files Changed

- `src/core/playspec-core.ts`
- `src/evolution/feedback-thread-updater.ts`
- `src/evolution/types.ts`
- `src/evolution/validation-feedback-extractor.ts`
- `src/preset/assets/workflows/mono-spec/workflow.yaml`
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`
- `tests/integration/workflow-loader.test.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_201_phase_validation_feedback/spec.md`
- `docs/features/issue_201_phase_validation_feedback/plan.md`
- `docs/features/issue_201_phase_validation_feedback/result.md`

## Verification

Commands run:
- `pnpm test tests/integration/workflow-loader.test.ts tests/integration/completion-engine.test.ts`
  - Passed: 2 files, 64 tests.
  - Rerun during safe-refactor review: passed again, 2 files, 64 tests.
- `pnpm build`
  - Passed.
  - Final rerun during PR preparation: passed.
- `git diff --check`
  - Passed.
  - Final rerun during PR preparation: passed.
- `pnpm test`
  - Passed: 29 files, 564 tests.
  - Final rerun during PR preparation: passed again, 29 files, 564 tests.

## Safe Refactor Review

- Reviewed the #201 working-tree diff after implementation.
- No cleanup was applied: the new target override path is intentionally small, and the YAML/template/test additions are direct acceptance-criteria coverage.
- Used `origin/agent/issue-200-thread-evidence` as the effective comparison base for scope review because this issue depends on #200 and the branch is stacked on that dependency.

## Remaining Risks

- The feedback capture system still depends on the configured score artifact containing the validation output. This issue wires mono-spec metadata and capture behavior but does not redesign how validation responses are persisted.
- Mono-spec bundled preset targets are treated as non-writable, so proposal creation remains manual-review-driven rather than auto-mutating prompt files.
