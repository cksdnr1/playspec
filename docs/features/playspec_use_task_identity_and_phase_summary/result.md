# playspec_use_task_identity_and_phase_summary Result

## Behavior Implemented

- `playspec use <taskId>` now prints a compact current-task summary after writing `.playspec/HEAD`.
- Task identity labels now use `Task ID` in `current`, `current-task`, `list-tasks` header, and interactive `use` selector rows.
- `playspec list-tasks` prints `Task ID` as the first column header while each task row still begins with the exact copyable task ID accepted by `playspec use`.
- `playspec use <value>` suggests matching task IDs when `<value>` looks like a title, slug, ID fragment, or case-insensitive close match.
- Multiple title-like matches are reported as candidate task IDs and titles.
- Invalid phase display now uses `INVALID (<phase>)` with `Allowed: ...`.
- Explicit `use` remains HEAD-only: it reads the task, writes `.playspec/HEAD`, and formats display output without validating linked context files or mutating `task.yaml`.

## Files Changed

- `src/cli/cli-utils.ts`
- `src/cli/commands/use.ts`
- `src/cli/commands/list-tasks.ts`
- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `tests/cli.test.ts`
- `docs/features/playspec_use_task_identity_and_phase_summary/spec.md`
- `docs/features/playspec_use_task_identity_and_phase_summary/plan.md`
- `docs/features/playspec_use_task_identity_and_phase_summary/result.md`

## Verification Performed

- `pnpm install`
- `pnpm test -- tests/cli.test.ts` — passed, 122 tests
- `pnpm build` — passed
- `pnpm test` — passed, 287 tests

## Tests Changed

- Added CLI coverage for explicit `use` summary output and HEAD-only behavior with a missing context ref.
- Added CLI coverage for title-like `use` suggestions and ambiguous candidate lists.
- Updated CLI coverage for `Task ID` identity labels and `Allowed:` invalid phase display.

## Failures and Gaps

- No validation failures remain.
- No skipped validation commands.

## Remaining Risks

- CLI output wording changed in a few human-facing commands. Existing tests were updated for the intended issue #25 wording.
- Suggestion matching is intentionally simple and deterministic; ambiguous inputs are not auto-selected.

## Refactor Review

- Compared the implementation diff against `origin/master`.
- No additional refactor was applied; the changed code is already limited to the planned CLI display/use/test files.
- Intentionally skipped broad formatter abstractions beyond the small summary helpers because the issue only needs current task identity and `use` output improvements.

## PR Preparation Notes

- Reusable agent guidance: not needed. The issue is a one-off CLI UX fix and did not reveal a durable project-agent rule.
- PR link: pending draft PR creation.
- Final limitations: none beyond the intentional wording changes and deterministic, non-autoselecting suggestions.
