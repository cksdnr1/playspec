# Draft PR: Issue #109

Fixes #109

## Summary

- Allow `playspec create --phase <n> --var KEY=VALUE` to persist variables on the created task.
- Reuse the existing `parseTaskVariables()` validation and `YamlTaskStore.createTask()` variable persistence path.
- Add CLI regression coverage that verifies phase-execution task YAML contains supplied variables.

## Changed Files

- `src/cli/commands/create.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_109_var_phase_create/spec.md`
- `docs/features/github_issue_109_var_phase_create/plan.md`
- `docs/features/github_issue_109_var_phase_create/result.md`
- `docs/features/github_issue_109_var_phase_create/pr.md`

## Tests Run

- `pnpm install`
- `pnpm exec vitest run tests/cli.test.ts`
- `pnpm test`
- `pnpm build`
- `pnpm exec vitest run tests/cli.test.ts`

## PlaySpec Task

- `github_issue_109_var_phase_create`

## Risk Notes

- Phase-execution creation now accepts `--var` instead of rejecting it.
- Required variable validation still happens at prompt rendering time, preserving the existing validation boundary.

## Reusable Agent Guidance

No reusable agent guidance needs to be added. This was a narrow CLI variable handoff bug with existing parser and storage contracts.
