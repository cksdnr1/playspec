# Draft PR: Issue 49 PlaySpec Update 6

Fixes #49

## Summary

- Adds Phase 6 evolution proposal schemas, types, validation reports, and YAML-backed storage under `src/evolution/`.
- Persists proposals and validation reports under `.playspec/evolution/proposals/{proposalId}/`.
- Adds filesystem-safe proposal IDs, directory-level collision rejection, workspace-relative path validation, and existing archived artifact reference validation.
- Keeps Phase 6 non-user-facing: no public `playspec evolution` command group, no MCP proposal intake, no prompt surfacing, no completion evolution snapshots, and no apply/mutation path.
- Adds alias parity for `#evolution/*.js` across runtime, TypeScript, and Vitest config.

## Changed Files

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/utils/paths.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-store.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_49_playspec_update_6/spec.md`
- `docs/features/issue_49_playspec_update_6/plan.md`
- `docs/features/issue_49_playspec_update_6/result.md`
- `docs/features/issue_49_playspec_update_6/pr.md`

## Tests Run

- `pnpm build`
- `pnpm test -- --run tests/integration/evolution-proposal-store.test.ts`
- `pnpm test -- --run tests/cli.test.ts -t "evolution"`
- `pnpm test -- --run tests/integration/mcp-server.test.ts`
- `pnpm test -- --run tests/integration/init-create-next.test.ts -t "proposals"`
- `pnpm test -- --run tests/integration/runtime-bin.test.ts`
- `pnpm test`

## PlaySpec Task

- `issue_49_playspec_update_6`

## Risk Notes

- Proposal actions are descriptive only in Phase 6 and are not executable.
- Full CLI tests are slow in this environment, but the full suite completed successfully.
- No reusable agent guidance changes are needed; existing project rules already cover Phase 6 boundaries and future-phase exclusions.
