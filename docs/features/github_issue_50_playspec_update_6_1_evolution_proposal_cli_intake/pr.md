# Draft PR

Fixes #50

## Summary

- Add `playspec evolution propose --file` to validate and store external evolution proposal YAML files with validation reports.
- Add `playspec evolution list`, `show`, and `skip` for read-only inspection and skip status updates.
- Add store-backed proposal listing and CLI tests for intake, generated IDs, invalid-file no-partial-storage, list/show, and skip preservation.

## Changed Files

- `src/cli/index.ts`
- `src/cli/commands/evolution.ts`
- `src/evolution/proposal-store.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_50_playspec_update_6_1_evolution_proposal_cli_intake/spec.md`
- `docs/features/github_issue_50_playspec_update_6_1_evolution_proposal_cli_intake/plan.md`
- `docs/features/github_issue_50_playspec_update_6_1_evolution_proposal_cli_intake/result.md`
- `docs/features/github_issue_50_playspec_update_6_1_evolution_proposal_cli_intake/pr.md`

## Tests Run

- `pnpm install`
- `pnpm test -- tests/cli.test.ts -t 'evolution proposals|proposal IDs|invalid proposal|help output'`
- `pnpm build`
- `timeout 260s pnpm test`

## PlaySpec Task

`github_issue_50_playspec_update_6_1_evolution_proposal_cli_intake`

## Risk Notes

- Phase 6.1 intentionally does not apply proposals, create backups, add apply reports, surface proposals in prompts, add completion snapshots, or register MCP proposal tools.
- `show` can report a missing validation file for older/manual records, but proposals created through `propose --file` always write `validation.yaml`.
- No reusable agent guidance needs to be documented from this change; the existing phase-boundary rules remain sufficient.
