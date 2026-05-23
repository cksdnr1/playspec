# PR notes

Fixes #158

## Summary

- Resolve simple embedded workflow metadata placeholders in relevant file discovery.
- Preserve whole-placeholder workflow path behavior and variable metadata.
- Skip unresolved workflow metadata placeholders through the existing candidate warning flow.
- Add focused relevant-file tests for embedded artifact and phase output paths.

## Changed files

- `src/core/relevant-files.ts`
- `tests/unit/relevant-files.test.ts`
- `docs/features/resolve_embedded_workflow_output_and_artifact_variables_during_relevant_file_discovery/spec.md`
- `docs/features/resolve_embedded_workflow_output_and_artifact_variables_during_relevant_file_discovery/plan.md`
- `docs/features/resolve_embedded_workflow_output_and_artifact_variables_during_relevant_file_discovery/result.md`
- `docs/features/resolve_embedded_workflow_output_and_artifact_variables_during_relevant_file_discovery/pr.md`

## Tests run

- `pnpm test -- tests/unit/relevant-files.test.ts`
- `pnpm test`
- `pnpm build`

## PlaySpec task id

`resolve_embedded_workflow_output_and_artifact_variables_during_relevant_file_discovery`

## Risk notes

- Placeholder resolution is intentionally limited to simple uppercase `{{VARIABLE_NAME}}` workflow metadata placeholders.
- Handlebars helpers, partials, and expressions are not evaluated for metadata paths.
- Existing path validation remains responsible for rejecting unsafe or invalid resolved paths.

## Reusable agent guidance

No reusable agent guidance needs to be added. This was a focused defect fix in one helper plus targeted tests.
