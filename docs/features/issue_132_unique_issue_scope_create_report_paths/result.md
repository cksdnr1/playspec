# Issue 132 Implementation Result

## Summary

Updated the built-in `issue-scope-create` workflow so default report artifacts are written below `docs/issues/scope-create/{{TASK_ID}}` instead of a scope-only directory. This keeps repeated runs from overwriting one another while preserving the existing `OUTPUT_DIR` and individual artifact file override behavior.

## Changed Files

- `src/preset/assets/workflows/issue-scope-create/workflow.yaml`
- `docs/workflows/issue-scope-create.md`
- `tests/integration/workflow-loader.test.ts`
- `tests/unit/variable-resolver.test.ts`

## Validation

- `pnpm test -- tests/integration/workflow-loader.test.ts tests/unit/variable-resolver.test.ts`
- `pnpm build`

## Notes

Existing automation that needs `docs/issues/scope-create/*.md` can continue to pass explicit `OUTPUT_DIR`, `DISCOVERY_FILE`, `CANDIDATE_ISSUES_FILE`, or `CREATED_ISSUES_FILE` values.
