# Issue 255 Output Placeholder Demand Result

## Behavior Implemented

- `VariableResolver` now parses placeholders inside active phase `outputs` and adds the referenced variable names to the demanded set.
- Existing bare output-name behavior is preserved by continuing to add the raw output string to the demanded set.
- Default placeholder name extraction is shared between output demand parsing and default rendering.

## Files Changed

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_255_output_placeholders/spec.md`
- `docs/features/issue_255_output_placeholders/plan.md`
- `docs/features/issue_255_output_placeholders/result.md`

## Tests Added

- Output placeholder `{{ARTIFACT_FILE}}` resolves `ARTIFACT_FILE` from its default.
- Output-only `ARTIFACT_FILE` throws `UnknownVariableDefaultError` when its default references `{{MISSING_KEY}}`.
- Literal output path `docs/static/artifact.md` does not demand an unrelated declaration.
- Multiple placeholders in one output path demand later placeholders, not only the first one.

## Verification Performed

- `pnpm test -- tests/unit/variable-resolver.test.ts`
  - First run failed on the new output-placeholder demand cases before the resolver patch.
  - Final implementation run passed: 33 tests.
- `pnpm test -- tests/unit/variable-resolver.test.ts`
  - Refactor-phase verification passed again: 33 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 30 test files, 609 tests.

## Refactor Review

- No additional refactor was applied after implementation.
- The only cleanup kept is the scoped helper extraction in `variable-resolver.ts`, which avoids duplicating placeholder dependency-name parsing between default rendering and output demand parsing.

## Remaining Risks

- Low: placeholder parsing remains intentionally limited to the resolver's existing `{{...}}` default-template syntax. This matches the issue scope and avoids broad workflow-template semantics changes.
- Low: bare output names remain demanded for backward compatibility, even though built-in workflows generally use templated output paths.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/256
- Branch: `agent/issue-255-output-path-placeholders`
- Reusable agent guidance: no update needed; this was a local resolver behavior correction with regression tests.
