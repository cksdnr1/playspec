# Issue 255 Output Placeholder Demand Plan

## Ordered Implementation Steps

1. Add focused failing unit tests in `tests/unit/variable-resolver.test.ts`.
   - Verify `outputs: ["{{ARTIFACT_FILE}}"]` resolves `ARTIFACT_FILE` from a declaration default.
   - Verify `ARTIFACT_FILE` throws `UnknownVariableDefaultError` when referenced only through `outputs` and its default uses `{{MISSING_KEY}}`.
   - Verify a literal output path with no placeholders does not demand an unrelated declaration with a broken default.
   - Verify multiple placeholders in one output path demand all referenced declarations.

2. Update demand extraction in `src/template/variable-resolver.ts`.
   - Keep the existing demand sources: required declarations, phase variables, `requiredVariables`, and bare output names.
   - Add a helper that parses placeholder names from output templates using the same placeholder body handling as `renderDefault()`.
   - For each output entry, add extracted placeholder names to the demanded set.

3. Run focused validation.
   - `pnpm test -- tests/unit/variable-resolver.test.ts`

4. Run repository validation after the focused tests pass.
   - Inspect `package.json` scripts.
   - Prefer `pnpm build` and relevant `pnpm test` commands because the repo uses `pnpm-lock.yaml`.

5. Record result and PR notes.
   - Update `docs/features/issue_255_output_placeholders/result.md`.
   - Update `docs/features/issue_255_output_placeholders/pr.md` for the draft PR body.

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_255_output_placeholders/result.md`
- `docs/features/issue_255_output_placeholders/pr.md`

## Tests To Add Or Update

- Unit tests only are sufficient because the changed behavior is local to `VariableResolver.resolve()` and the acceptance criteria are resolver-level.
- No integration test is required unless the unit tests reveal a mismatch in template rendering or relevant-file discovery.

## Active Path Trace

1. Caller invokes `VariableResolver.resolve(task, phaseId, workflow, definition)`.
2. Resolver merges workflow and phase declarations.
3. Resolver computes demanded variables for the active phase.
4. Output template placeholders are added to demand.
5. `resolveDeclaredDefaults()` resolves demanded default dependency chains and throws for unknown dependencies.
6. Prompt rendering, relevant-file discovery, and phase handling receive resolved output path variables or a clear resolver error.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: `getDemandedVariableNames()` adds each `definition.outputs` string literally.
- Bypass: `assertRequiredVariables()` does not parse outputs and should remain unchanged.
- Bypass: `TemplateRenderer` can still catch unresolved prompt placeholders, but output-only placeholders may never appear in the prompt body.
- Partial migration risk: updating relevant-file discovery only would not fix prompt rendering or phase completion; the resolver is the correct shared point.

## Risks

- Over-demanding helpers in output templates. Mitigation: parse only existing `{{...}}` placeholder syntax and do not treat literal path text as a variable.
- Breaking legacy bare output-name behavior. Mitigation: preserve the current raw output string addition to the demanded set.
- Placeholder syntax drift. Mitigation: reuse the same dependency-name extraction rule used by `renderDefault()`.

## Rollback Notes

The change is isolated. Rollback is a normal revert of:
- `src/template/variable-resolver.ts`
- added resolver tests
- task documentation artifacts

No data migration, persisted task mutation, or destructive operation is involved.

## Completion Criteria

- `outputs: ["{{ARTIFACT_FILE}}"]` resolves `ARTIFACT_FILE` from its default.
- Unknown default dependencies throw when the owning variable is demanded only by an output placeholder.
- Literal output paths without placeholders do not demand unrelated variables.
- Multiple placeholders in one output string are all demanded.
- Existing resolver behavior for required declarations, phase variables, `requiredVariables`, and bare output names remains intact.
- Focused resolver tests pass.
