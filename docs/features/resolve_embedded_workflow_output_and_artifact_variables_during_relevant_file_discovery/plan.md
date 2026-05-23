# Implementation plan

## Ordered steps

1. Update test fixtures in `tests/unit/relevant-files.test.ts`.
   - Keep one literal phase output path so existing literal output coverage remains.
   - Keep whole-placeholder artifact paths such as `{{SPEC_FILE}}` so single-placeholder behavior remains covered.
   - Add a workflow artifact path that is not duplicated by any literal output and only becomes discoverable after embedded `{{FEATURE_SLUG}}` substitution.
   - Add a phase output path that embeds `{{FEATURE_SLUG}}`.

2. Add focused assertions in `tests/unit/relevant-files.test.ts`.
   - Assert the embedded artifact path appears as a workflow candidate.
   - Assert the embedded output path appears as a workflow candidate.
   - Assert deduplication priority still prefers a higher-priority source when a resolved workflow path overlaps an existing context or variable candidate.

3. Update `src/core/relevant-files.ts`.
   - Replace whole-string-only placeholder handling in `resolveWorkflowPathValue()`.
   - Use simple variable substitution for placeholders matching `{{ VARIABLE_NAME }}`.
   - Preserve `variableName` metadata only when the full value is a single placeholder.
   - Leave unknown placeholders unresolved so existing normalization produces the standard ignored-candidate warning.

4. Run targeted and full validation.
   - `pnpm test -- tests/unit/relevant-files.test.ts`
   - `pnpm test`
   - `pnpm build`

## Files to edit

- `src/core/relevant-files.ts`
- `tests/unit/relevant-files.test.ts`
- `docs/features/resolve_embedded_workflow_output_and_artifact_variables_during_relevant_file_discovery/result.md`
- `docs/features/resolve_embedded_workflow_output_and_artifact_variables_during_relevant_file_discovery/pr.md`

## Tests to add or update

- Embedded workflow artifact path:
  - Input: artifact path `docs/features/{{FEATURE_SLUG}}/artifact-only.md`
  - Expected: candidate `docs/features/feature_x/artifact-only.md`

- Embedded phase output path:
  - Input: output path `docs/features/{{FEATURE_SLUG}}/output-only.md`
  - Expected: candidate `docs/features/feature_x/output-only.md`

- Existing behavior preservation:
  - Literal output path remains discovered.
  - Whole-placeholder artifact path remains discovered.
  - Deduplication priority remains governed by `SOURCE_PRIORITY`.

## Risks

- Unknown placeholders could still show as raw brace paths before normalization. This is acceptable only if normalization emits an existing clear ignored-candidate warning.
- Variable values can contain invalid path text. Existing path validation remains the enforcement boundary.
- Avoid full Handlebars support to prevent unexpected helper, partial, or expression evaluation in metadata paths.

## Rollback notes

The implementation is isolated to one helper and unit tests. Rollback is a normal git revert of the source/test changes and generated PlaySpec docs.

## Old paths, bypasses, and partial migration risks

- Old path: whole-placeholder-only resolution in `resolveWorkflowPathValue()`.
- Bypass: rendered prompt discovery already uses template rendering and is not part of this fix.
- Bypass: variable candidates already use `VariableResolver`; this fix must not change variable resolution.
- Partial migration risk: updating only artifacts or only outputs would leave one acceptance criterion unmet.

## Completion criteria

- `discoverRelevantFiles()` resolves embedded placeholders in both phase outputs and workflow artifact paths.
- Single-placeholder workflow paths still resolve and retain variable metadata.
- Unresolved placeholders produce the existing warning style through normalization.
- Relevant-file deduplication still prefers higher-priority sources.
- Targeted relevant-file tests, full test suite, and build pass.
