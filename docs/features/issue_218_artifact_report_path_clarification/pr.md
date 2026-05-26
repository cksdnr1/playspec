# PR Notes

Fixes #218

## Summary

- Clarify that `issue-scope-create` creation-phase no-edit rules still allow declared workflow report artifacts.
- Document artifact path variables and defaults in the workflow docs.
- Add focused workflow-loader coverage for the artifact variables, docs, and creation-template contradiction.

## Changed Files

- `src/preset/assets/workflows/issue-scope-create/templates/create_scoped_issues.md`
- `docs/workflows/issue-scope-create.md`
- `tests/integration/workflow-loader.test.ts`
- `docs/features/issue_218_artifact_report_path_clarification/spec.md`
- `docs/features/issue_218_artifact_report_path_clarification/plan.md`
- `docs/features/issue_218_artifact_report_path_clarification/result.md`
- `docs/features/issue_218_artifact_report_path_clarification/pr.md`

## Tests Run

- `pnpm exec vitest run tests/integration/workflow-loader.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

- `issue_218_artifact_report_path_clarification`

## Risk Notes

- Low risk. The artifact storage contract is unchanged; this only clarifies prompt wording, docs, and regression coverage.

## Reusable Agent Guidance

No reusable agent guidance is needed. The issue is specific to one built-in workflow prompt and docs page.
