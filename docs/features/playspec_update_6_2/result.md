# PlaySpec Update 6.2 Result

## Behavior Implemented

- Added `playspec evolution update <proposalId> --file <proposal.yaml>`.
- Added `playspec evolution append-evidence <proposalId> --file <path> --note <text>`.
- Added top-level `evidenceRefs` with workspace-relative path, note, timestamp, and `append-evidence` source.
- Added proposal revision preservation under `.playspec/evolution/proposals/{proposalId}/revisions/revision-{n}.yaml`.
- Rewrites validation metadata on successful update/evidence append.
- Rejects updates/appends for `skipped`, `applied`, and `failed` proposals.
- Keeps `applied` and `failed` as rejection-only lifecycle statuses in this phase; no apply behavior was added.
- Preserves prompt rendering, completion, MCP, migration, and workflow behavior.

## Files Changed

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/utils/paths.ts`
- `src/evolution/proposal-store.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/cli.test.ts`
- `docs/features/playspec_update_6_2/spec.md`
- `docs/features/playspec_update_6_2/plan.md`
- `docs/features/playspec_update_6_2/result.md`

## Verification Performed

- `pnpm install`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm test -- --run tests/integration/evolution-proposal-store.test.ts`
- `pnpm test -- --run tests/cli.test.ts -t "evolution"`
- `pnpm test -- --run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
- Post-implementation `spec_verifier`: no blockers.
- `refactor_guard`: allowed.

Attempted:

- `timeout 240s pnpm test` was attempted. It passed the non-CLI suites shown in output, then hung in an existing broad `tests/cli.test.ts` `complete` command path and was killed. Focused Phase 6.2 CLI tests passed separately.

## Remaining Risks

- Manual edits to `.playspec/evolution/proposals/*/proposal.yaml` remain a bypass path outside the command API.
- Update writes are ordered as revision, validation, canonical. A filesystem failure after validation write but before canonical write can leave validation metadata newer than canonical YAML; invalid input still performs no writes.

## Refactor Review

- `git diff --check` passed.
- Scope review found no unrelated refactor or future-phase leakage.
- No code refactor was applied after implementation because the existing changes are local to Phase 6.2 behavior and tests.

## PR Preparation

- PR body drafted in `docs/features/playspec_update_6_2/pr.md`.
- Reusable agent guidance does not need a separate docs update; the existing phase plan already states the reusable constraints for Phase 6.2.
- Branch ancestry rechecked before PR prep: `git rev-list --left-right --count HEAD...origin/master` returned `0 0`, and `git merge-base --is-ancestor origin/master HEAD` returned exit code `0`.
