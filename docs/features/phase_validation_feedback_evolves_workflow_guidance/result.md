# Phase Validation Feedback To Prompt Evolution Signals Result

Planning completed with no implementation changes.

## Final Review

- Total spec: `docs/features/phase_validation_feedback_evolves_workflow_guidance/phase_validation_feedback_evolves_workflow_guidance_total_spec.md`
- Phase plan: `docs/features/phase_validation_feedback_evolves_workflow_guidance/phase_validation_feedback_evolves_workflow_guidance_phase_plan.md`
- Scope: markdown planning only
- Implementation status: not implemented

## Review Summary

The plan separates approval routing from prompt evolution signal capture. This preserves the current `mono-spec` 95-point approval gate while adding the requested 90-point feedback threshold.

The design generalizes through optional phase metadata, not hard-coded `mono-spec` phase names. `mono-spec` becomes the first opt-in workflow, and later workflows can adopt the same feedback config.

The strengthened design requires each feedback thread to preserve source validation phase, evaluated artifact phase, evolution target phase, causal classification, prompt/template snapshot hash, confidence, dedupe key, compact history, and suggested guidance changes. This directly addresses the automation risk that PlaySpec could otherwise learn noisy, stale, or wrongly attached feedback.

The proposed architecture uses feedback threads as the canonical progress point, then appends thread evidence to pending/refining proposals only when the proposal is explicit and safe. It avoids automatic proposal application or direct workflow template mutation during phase completion.

## Revalidation

Readiness: ready for later implementation planning.

The updated spec now explicitly covers the previously ambiguous areas:

- Source validation phase, evaluated artifact phase, and evolution target phase are separate fields.
- Feedback causes distinguish artifact issues, authoring prompt gaps, validation prompt gaps, workflow policy gaps, and extractor/parser failures.
- Positive feedback is stored as a confidence-scored candidate signal, not proof that the prompt is correct.
- Prompt/template snapshot hashes prevent stale feedback from being applied to changed guidance.
- FeedbackThread is the first-class durable progress point, so repeated runs update one thread instead of creating independent evolution items.
- Compact thread history is the default automation storage mode; raw observation files are optional audit artifacts.
- Feedback capture failure policy is explicit per phase.
- Proposal evidence attachment starts with explicit proposal IDs only.
- Machine-readable `playspecFeedback` metadata is required for important automated validation phases.
- Workflow opt-in now has a concrete `PhaseFeedbackConfig` YAML shape.
- Compact history is bounded with first/latest retention and overflow summary.
- Dedupe keys exclude target prompt hashes; prompt hashes are stored in thread evidence.
- Initial proposal readiness is manual, with maturity policy fields stored only as review guidance.
- Mixed positive/negative feedback exposes trend state instead of overwriting the thread with the latest classification.
- Feedback events include `targetType` so event-to-thread conversion is stable.
- Feedback storage is workspace-local under `.playspec/evolution/feedback`, independent of where the workflow prompt lives.
- Threads record workflow source kind, target path kind, target path, and target writability.
- Bundled, external, or read-only workflow targets require override/copy proposal strategies instead of direct mutation.

## Ready For Later Implementation

The next implementation task should start with:

1. Workflow phase feedback config schema.
2. Feedback thread schema and store.
3. Prompt snapshot hashing, dedupe keying, and compact history.
4. Workflow source and target writability resolution.
5. Score and signal extraction from stable `playspecFeedback` metadata.
6. Shared completion integration with required failure policy.
7. Explicit thread evidence attachment.
8. `mono-spec` opt-in.

## Consistency Check

- Canonical storage object: feedback thread.
- Default storage mode: `thread_with_compact_history`.
- Optional raw files: only under `thread_with_audit_observations`.
- Dedupe basis: semantic signal fields, not prompt hash.
- Prompt hash role: evidence/snapshot history and stale-feedback detection.
- Proposal basis: feedback thread, not raw event.
- Feedback path: active workspace `.playspec/evolution/feedback`.
- Target path: workflow source metadata, with writability and mutation strategy.
