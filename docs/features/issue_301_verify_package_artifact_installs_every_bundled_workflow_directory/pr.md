# Draft PR: Issue #301

Fixes #301

## Summary

- Derive expected bundled workflow IDs in the package artifact test from `src/preset/assets/workflows` directories containing `workflow.yaml`.
- Assert each expected workflow YAML exists in the packed-and-installed package under `dist/preset/assets/workflows`.
- Assert each expected workflow YAML is installed into the consumer workspace by installed `playspec init --preset default`.
- Preserve stale asset cleanup, compiled runtime file checks, `mono-spec` template check, and MCP runtime smoke assertions.

## Changed Files

- `tests/integration/package-artifact.test.ts`
- `docs/features/issue_301_verify_package_artifact_installs_every_bundled_workflow_directory/spec.md`
- `docs/features/issue_301_verify_package_artifact_installs_every_bundled_workflow_directory/plan.md`
- `docs/features/issue_301_verify_package_artifact_installs_every_bundled_workflow_directory/result.md`
- `docs/features/issue_301_verify_package_artifact_installs_every_bundled_workflow_directory/pr.md`

## Tests Run

- `pnpm test:package-artifact`
- `pnpm test:package-artifact` (rerun during focused-test phase)

Skipped:

- Focused workflow-loader integration test, because workflow loading expectations and product code were not changed.

## PlaySpec Task

- `issue_301_verify_package_artifact_installs_every_bundled_workflow_directory`

## Risk Notes

- Low: the expected workflow list is intentionally tied to the source checkout and filters only directories containing `workflow.yaml`, matching the packaging parity behavior requested by the issue.

## Reusable Agent Guidance

- No new reusable agent guidance is needed. The existing package artifact test pattern and issue-specific spec cover the workflow directory assertion behavior.
