# Draft PR: Issue 73 Workflow Dedup

Fixes #73

## Summary

- Added project workflow scope at `.playspec/workflows` with priority `project > user > builtin`.
- Deduplicated `playspec workflow list` by effective workflow ID and sorted by source group then ID.
- Kept `workflow show <id>` and runtime loading on the same registry priority path.
- Added `playspec init --workflow-install <project|user|skip>` with project default and interactive prompt support.
- Updated `.gitignore` so project workflows are committable while runtime `.playspec` state stays ignored.

## Changed Files

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
- `docs/features/issue_73_workflow_dedup/spec.md`
- `docs/features/issue_73_workflow_dedup/plan.md`
- `docs/features/issue_73_workflow_dedup/result.md`
- `docs/features/issue_73_workflow_dedup/pr.md`

## Tests Run

- `pnpm build` - pass
- `pnpm test` - pass, 22 files and 374 tests
- Focused tests during development:
  - `pnpm test -- tests/integration/workflow-loader.test.ts tests/integration/init-create-next.test.ts tests/integration/runtime-bin.test.ts`
  - `pnpm test -- tests/cli.test.ts -t "workflow|init workflow install"`
  - `pnpm test -- tests/integration/completion-engine.test.ts`
  - `pnpm test -- tests/integration/init-create-next.test.ts -t "gitignore|PresetManager.initWorkspace"`

## PlaySpec Task

- `issue_73_workflow_dedup`

## Risk Notes

- Project workflows intentionally shadow same-ID user and builtin workflows.
- Automation that expects init to install workflows into the user root should pass `--workflow-install user`.
- Reusable agent guidance does not need an AGENTS.md update; the existing workflow/source rules are enough for this scoped change.
