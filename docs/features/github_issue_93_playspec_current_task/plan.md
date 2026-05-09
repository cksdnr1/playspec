# Implementation Plan: Current Task Phase Display

## Ordered Steps

1. Update `current-task` display terminology.
   - Edit `src/cli/commands/current-task.ts`.
   - Print the resolved phase display under `Phase:` for all workflows.
   - Print `Phase ID:` when `eph.phaseIdDisplay` exists.
   - Keep gate, next-route, context, and docs-root output unchanged.

2. Update deprecated `current` detail parity.
   - Edit `src/cli/commands/current.ts`.
   - Keep the deprecation warning and existing compact fields.
   - Add `Phase ID:` when `eph.phaseIdDisplay` exists.

3. Align explicit task lookup terminology.
   - Edit `src/cli/commands/get-task.ts`.
   - Print `Phase:` and `Phase ID:` for non-JSON output.
   - Leave `--json` unchanged.

4. Update and add CLI regression tests.
   - Edit `tests/cli.test.ts`.
   - Update mono-spec current-task expectations from `Step`/`Step ID` to `Phase`/`Phase ID`.
   - Add or update coverage showing deprecated `current` prints effective phase and phase ID.
   - Keep existing list-tasks effective/invalid phase tests unchanged.

5. Validate.
   - Run `pnpm test -- --runInBand` if supported by Vitest, otherwise run `pnpm test`.
   - Run `pnpm build`.
   - Manually verify the three relevant commands in the PlaySpec task worktree:
     - `pnpm exec tsx src/cli/index.ts list-tasks`
     - `pnpm exec tsx src/cli/index.ts current-task`
     - `pnpm exec tsx src/cli/index.ts current`

## Files To Edit

- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `src/cli/commands/get-task.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_93_playspec_current_task/result.md`
- `docs/features/github_issue_93_playspec_current_task/pr.md`

## Tests To Add Or Update

- Update `prints mono-spec step metadata and gate routes on current-task` to assert phase terminology.
- Update `prints mono-spec next route on current-task for explicit-next steps` if it asserts step terminology.
- Add regression coverage to `current shows deprecation warning on stderr` or a nearby test so deprecated `current` verifies:
  - `Phase:` contains the effective resolved title.
  - `Phase ID:` contains `tech_spec_draft (effective)` for a fresh mono-spec task.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: deprecated `playspec current` remains callable and must keep its warning.
- Bypass: `playspec get-task --json` bypasses human formatting and must not change.
- Partial migration risk: `list-tasks`, `current-task`, and `get-task` already share the resolver; do not fork phase resolution logic in command files.

## Risks

- Human output text changes can affect ad hoc scripts. Stable JSON output remains available through `get-task --json`.
- Some existing tests intentionally assert `Step:`. Updating them is expected because the requested bug is about phase display parity.

## Rollback Notes

- Revert the three command output changes and the matching test expectation updates.
- No persisted task data or workflow files are changed by the implementation.

## Completion Criteria

- `list-tasks`, `current-task`, and `current` all show a resolved `Phase:` value for mono-spec tasks.
- `current-task`, `current`, and `get-task` show the resolved phase ID when available.
- Focused or full tests pass.
- Build passes.
