# PR: PlaySpec Update 6.3

Fixes #52

## Summary

Implements Evolution Phase 6.3 apply support for reviewed executable proposals.

- Adds `playspec evolution diff <proposalId>` to preview executable proposal changes without mutation.
- Adds `playspec evolution apply <proposalId> --yes` with explicit approval.
- Adds executable proposal actions: `replace_file`, `append_section`, and `replace_section`.
- Restricts mutation targets to `.playspec/templates/` and `.playspec/rules/`.
- Writes backups, reports, hashes, validation results, failure metadata, and proposal status updates.
- Keeps migration apply separate and leaves prompt surfacing/human edit observation/generation deferred.

## Changed Files

- `src/evolution/apply-runner.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-store.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `src/utils/paths.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_52_playspec_update_6_3/spec.md`
- `docs/features/issue_52_playspec_update_6_3/plan.md`
- `docs/features/issue_52_playspec_update_6_3/result.md`

## Tests Run

- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run tests/integration/evolution-proposal-store.test.ts tests/cli.test.ts -t "(EvolutionProposal|executable proposals|partial-apply|explicit approval|diffs executable|rejects old planning|Phase 6.3|allow-listed|workflow targets)"`
- `pnpm build`
- `git diff --check`

Partial/limited:

- `pnpm test` was attempted and passed completed suites through evolution, migration, task store, variable resolver, MCP, relevant-files, workflow-loader, clipboard, completion, selector, template renderer, active-task resolver, phase resolver, temp workspace, slug, routing, runtime-bin, and init/create/next before hanging in the broader CLI suite. The run was stopped and focused CLI/evolution coverage was used for this change.

## PlaySpec Task

- `issue_52_playspec_update_6_3`

## Risk Notes

- Template validation uses representative PlaySpec variables and include resolution; it is not exhaustive for every future workflow variable set.
- Phase 6.3 records backup/report recovery metadata but does not implement automatic rollback.
- Reusable agent guidance does not need to be documented for this change; the existing phase plan and AGENTS rules already cover the relevant safety boundary.
