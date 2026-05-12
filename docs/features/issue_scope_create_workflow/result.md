# Issue Scope Create Workflow Result

## Summary

Added a standalone built-in workflow named `issue-scope-create` for scoped GitHub issue creation.

## Changes

- Added workflow registry assets under `src/preset/assets/workflows/issue-scope-create/`.
- Added discovery and issue creation templates with duplicate-search, scope, and no-implementation safeguards.
- Added documentation at `docs/workflows/issue-scope-create.md`.
- Updated the README built-in workflow list.
- Added integration coverage for workflow loading, template safeguards, and CLI workflow listing.

## Verification

- `pnpm test -- tests/integration/workflow-loader.test.ts tests/cli.test.ts`
- `pnpm build`
