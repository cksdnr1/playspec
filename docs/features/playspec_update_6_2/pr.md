# PR: PlaySpec Update 6.2

Fixes #51

## Summary

- Add `playspec evolution update <proposalId> --file <proposal.yaml>` for revising pending/refining proposals.
- Add `playspec evolution append-evidence <proposalId> --file <path> --note <text>` for accumulating evidence on one active proposal.
- Preserve previous canonical proposal revisions under `revisions/revision-{n}.yaml`.
- Add top-level `evidenceRefs`, validation report rewrites, and terminal-status rejection for update/append paths.
- Keep apply, prompt surfacing, completion hooks, MCP intake, and automatic generation out of scope.

## Changed Files

- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `src/evolution/proposal-store.ts`
- `src/evolution/schemas.ts`
- `src/evolution/types.ts`
- `src/utils/paths.ts`
- `tests/cli.test.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `docs/features/playspec_update_6_2/spec.md`
- `docs/features/playspec_update_6_2/plan.md`
- `docs/features/playspec_update_6_2/result.md`
- `docs/features/playspec_update_6_2/pr.md`

## Tests Run

- `pnpm install`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm test -- --run tests/integration/evolution-proposal-store.test.ts`
- `pnpm test -- --run tests/cli.test.ts -t "evolution"`
- `pnpm test -- --run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
- `timeout 240s pnpm test` attempted; it hung in an existing broad `tests/cli.test.ts` `complete` command path and was killed after relevant non-CLI suites had passed.

## PlaySpec Task ID

`playspec_update_6_2`

## Risk Notes

- Manual edits to `.playspec/evolution/proposals/*/proposal.yaml` remain a bypass path outside this command API.
- Update writes are ordered revision, validation, canonical. Invalid input performs no writes; a filesystem failure after validation write but before canonical write can leave validation newer than canonical YAML.
- Reusable agent guidance does not need to be documented for this change; the existing phase boundary docs already cover the rule.
