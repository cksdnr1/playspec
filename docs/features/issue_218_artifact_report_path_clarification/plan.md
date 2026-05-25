# Issue 218 Artifact Report Path Clarification Plan

## Ordered Implementation Steps

1. Update the creation template.
   - File: `src/preset/assets/workflows/issue-scope-create/templates/create_scoped_issues.md`
   - Keep the existing no-implementation/no-branch/no-PR safety rule.
   - Add an explicit exception for declared workflow report artifacts: `{{DISCOVERY_FILE}}`, `{{CANDIDATE_ISSUES_FILE}}`, and `{{CREATED_ISSUES_FILE}}`.
   - Keep the final report requirement unchanged.

2. Strengthen workflow-loader integration coverage.
   - File: `tests/integration/workflow-loader.test.ts`
   - In the existing `issue-scope-create` loader test, assert all artifact path variables remain declared with defaults:
     - `OUTPUT_DIR`
     - `DISCOVERY_FILE`
     - `CANDIDATE_ISSUES_FILE`
     - `CREATED_ISSUES_FILE`
   - In the template safeguard test, assert the creation template includes both the no-edit rule and an explicit declared-report-artifact exception before requiring `{{CREATED_ISSUES_FILE}}`.
   - Add docs assertions that `docs/workflows/issue-scope-create.md` names the artifact variables and default report path.

3. Review and adjust docs only if needed.
   - File: `docs/workflows/issue-scope-create.md`
   - The current docs already document default report paths and overrides. If tests reveal missing clarity, add narrow wording without changing the artifact contract.

4. Run validation.
   - Targeted test: `pnpm exec vitest run tests/integration/workflow-loader.test.ts`
   - Build/type check: `pnpm build`
   - Full test suite: `pnpm test`

5. Record implementation result and prepare PR metadata.
   - Update `docs/features/issue_218_artifact_report_path_clarification/result.md`.
   - Later, update `pr.md` during PR prep with summary, changed files, tests, risks, and PlaySpec task ID.

## Files To Edit

- `src/preset/assets/workflows/issue-scope-create/templates/create_scoped_issues.md`
- `tests/integration/workflow-loader.test.ts`
- `docs/workflows/issue-scope-create.md` only if clarification is needed beyond existing report artifact documentation
- `docs/features/issue_218_artifact_report_path_clarification/result.md`
- `docs/features/issue_218_artifact_report_path_clarification/pr.md`

## Tests To Add Or Update

- `tests/integration/workflow-loader.test.ts`
  - Creation template contradiction coverage.
  - Loaded artifact variable declaration/default coverage.
  - Workflow docs artifact-variable coverage.

## Risks

- The artifact exception must not weaken the target repository edit restriction. It should be limited to declared workflow report artifacts.
- Avoid brittle prose assertions by checking stable variable names and required template clauses.

## Rollback Notes

This change is limited to Markdown workflow assets, docs, and integration tests. Reverting the changed files restores previous behavior.

## Completion Criteria

- The creation template explicitly permits declared report artifact writes while keeping code/branch/commit/PR restrictions.
- Docs and loaded workflow assertions cover all artifact path variables.
- Targeted workflow-loader test, build, and full test suite pass.
