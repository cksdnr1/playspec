# Draft PR

Fixes #115

## Summary

- Add workflow ID validation for registry and loader entry points before filesystem lookup.
- Harden `resolveFromDirectory()` path handling, source labeling, and ID mismatch checks while preserving custom workflow directory validation.
- Add integration coverage for traversal, null-byte, absolute path, valid dotted IDs, source precedence, and direct-directory loading.

## Changed Files

- `src/workflow/workflow-registry.ts`
- `src/workflow/workflow-loader.ts`
- `tests/integration/workflow-loader.test.ts`
- `docs/features/issue_115_workflowid_path_traversal_guard/spec.md`
- `docs/features/issue_115_workflowid_path_traversal_guard/plan.md`
- `docs/features/issue_115_workflowid_path_traversal_guard/result.md`
- `docs/features/issue_115_workflowid_path_traversal_guard/pr.md`

## Tests Run

- `pnpm install`
- `pnpm test tests/integration/workflow-loader.test.ts`
- `pnpm test tests/cli.test.ts`
- `pnpm test`
- `pnpm build`
- `git diff --check`

Skipped/failed attempts:
- Initial focused test failed before execution because dependencies were not installed in the new worktree.
- `pnpm test tests/cli.test.ts -- --runInBand` failed before execution because Vitest does not support `--runInBand`.

## PlaySpec Task

- `issue_115_workflowid_path_traversal_guard`

## Risk Notes

- Validation failures use plain `Error`, consistent with existing workflow loader path/template validation.
- `resolveFromDirectory()` still accepts custom workflow directories outside known source roots for CLI/install compatibility; it validates the directory basename and declared workflow ID and labels those as `user`.

## Reusable Agent Guidance

No reusable agent guidance update is needed. The repository already documents path-safety expectations in `AGENTS.md`, and this change is a localized workflow resolver hardening.
