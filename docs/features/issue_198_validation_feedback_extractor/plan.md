# Issue 198 Validation Feedback Extractor Plan

## Ordered Steps

1. Extend evolution feedback types.
   - Edit `src/evolution/types.ts`.
   - Add extraction method, target type, prompt guidance, threshold/result, extraction input, and extraction result interfaces.
   - Keep the result shaped for direct use by `FeedbackThreadUpdater.update()`.

2. Add zod schemas for machine-readable feedback.
   - Edit `src/evolution/schemas.ts`.
   - Add `ValidationFeedbackBlockSchema` and `ValidationFeedbackExtractionSchema`.
   - Validate score as `0..100`, phase IDs as non-empty strings, target type as `workflow_prompt_template`, cause category against existing enums, and confidence against existing feedback confidence.

3. Implement the extractor.
   - Add `src/evolution/validation-feedback-extractor.ts`.
   - Inputs: workspace root, task, resolved workflow, source phase ID, phase feedback config, artifact path/content, completion result.
   - Locate fenced code blocks labelled `playspecFeedback`.
   - Parse YAML or JSON using existing dependencies.
   - Reject required configured feedback when no valid machine-readable block exists.
   - Reject invalid scores including markdown values like `190/100`.
   - Preserve source/evaluated/target phase IDs from the block when present, otherwise config; reject contradictions for required structured feedback.
   - Compute feedback result from `feedbackThreshold` and `thresholdMode`.
   - Compute approval result from the completion result/config threshold where needed.
   - Resolve workflow source, target path, and writability via `FeedbackWorkflowSourceResolver` when absent.
   - For optional fallback, parse only `Score: X/100`, mark `method: markdown_fallback`, force `confidence: low`, and use `extractor_or_parser_error` as the low-confidence cause.

4. Export the extractor.
   - Edit `src/evolution/index.ts`.

5. Add focused tests.
   - Add `tests/integration/validation-feedback-extractor.test.ts`.
   - Cover stable `playspecFeedback` extraction, score range rejection, required missing block rejection, separate source/evaluated/target phases, target/workflow source resolution, fallback low confidence, and markdown fallback score rejection.

6. Record result notes after implementation.
   - Update `docs/features/issue_198_validation_feedback_extractor/result.md` with changed files and test commands.

## Files To Edit

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/validation-feedback-extractor.ts`
- `src/evolution/index.ts`
- `tests/integration/validation-feedback-extractor.test.ts`
- `docs/features/issue_198_validation_feedback_extractor/result.md`

## Tests

Run focused validation first:

```sh
pnpm test tests/integration/validation-feedback-extractor.test.ts
```

Then run repository validation:

```sh
pnpm build
pnpm test
```

## Risks

- Fenced block parsing must stay narrow. Only labelled `playspecFeedback` blocks are trusted for required extraction.
- Required feedback must not silently downgrade to fallback; missing/invalid blocks should throw explicit errors.
- Optional fallback is intentionally incomplete and low confidence.
- Workflow source and target writability should use the existing resolver, not duplicate path/source classification.

## Rollback Notes

The implementation is additive. Rollback removes the new extractor file, type/schema additions, exports, tests, and docs for this feature.

## Completion Criteria

- Extraction succeeds from structured `playspecFeedback`.
- Invalid scores outside `0..100` are rejected.
- Required configured feedback missing a machine-readable block is rejected.
- Source, evaluated, and target phase IDs remain separate.
- Target type, workflow source metadata, and target writability are extracted or resolved.
- Optional fallback records low confidence.
- Focused tests, build, and full test suite pass.
