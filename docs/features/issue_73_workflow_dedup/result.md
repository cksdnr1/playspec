# Issue 73 Workflow Dedup Result

## Summary

Implemented workflow source priority and deduplication for project, user, and builtin workflow sources. `workflow list` now returns one effective workflow per ID, grouped by source priority and sorted by ID within each group. `workflow show` and runtime workflow loading use the same priority path.

`playspec init` now supports `--workflow-install <project|user|skip>`, defaults to project install, prompts interactively when no destination is provided, and prints the selected destination. Project workflows install under `.playspec/workflows`.

Updated `.gitignore` so `.playspec/workflows/**` is committable while runtime state directories remain ignored.

## Files Changed

- `.gitignore`
- `src/cli/commands/init.ts`
- `src/cli/index.ts`
- `src/core/types.ts`
- `src/preset/preset-manager.ts`
- `src/utils/paths.ts`
- `src/workflow/workflow-registry.ts`
- `tests/cli.test.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/runtime-bin.test.ts`
- `tests/integration/workflow-loader.test.ts`

## Verification

- `pnpm build` passed.
- `pnpm test` passed: 22 files, 374 tests.
- Post-implementation spec verification found one missing gitignore test; added coverage and reran validation.
- Refactor guard rerun result: allowed.

## Refactor Review

No cleanup refactor was applied after validation. The diff is already scoped to workflow resolution, init destination handling, gitignore policy, focused tests, and PlaySpec docs.

## Risks

- Existing user workflows remain supported, but project workflows now intentionally override same-ID user workflows.
- Existing automation that assumed init installs workflows into the user root by default should pass `--workflow-install user`.

## PR Prep

- PR body drafted in `docs/features/issue_73_workflow_dedup/pr.md`.
- Draft PR created: https://github.com/cksdnr1/playspec/pull/75
- Reusable agent guidance update: not needed. Existing AGENTS.md rules already cover workflow-source boundaries and generated state.
