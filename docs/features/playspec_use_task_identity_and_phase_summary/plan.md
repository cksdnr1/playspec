# playspec_use_task_identity_and_phase_summary Implementation Plan

## Ordered Implementation Steps

1. Add small shared display helpers in `src/cli/cli-utils.ts`.
   - Format compact current task summaries for `playspec use`.
   - Preserve read-only phase resolution.
   - Make invalid phase text use `INVALID (<phase>)` and `Allowed: ...`.

2. Update task identity output.
   - `src/cli/commands/current-task.ts`: print `Task ID:`.
   - `src/cli/commands/current.ts`: print `Task ID:` for deprecated path consistency.
   - `src/cli/commands/list-tasks.ts`: print a first-column header beginning with `Task ID`; keep each data row beginning with the exact accepted task ID.
   - `src/cli/commands/use.ts`: interactive selector rows should start with `Task ID: <id>` while preserving HEAD marker, workflow, phase, and title.

3. Update explicit `playspec use <taskId>`.
   - Exact ID success path: `store.getTask(taskId)`, write `.playspec/HEAD`, then print compact summary.
   - Do not call `updateTask`, `completePhase`, context validation, or source/context file reads.
   - Print:
     - `HEAD set to: <taskId>`
     - blank line
     - `Current task:` block with task ID, title, workflow, phase, and optional context count
     - blank line
     - `Next:` / `playspec prompt`

4. Add title/slug suggestion behavior.
   - If exact ID lookup fails, list active tasks and compare against task ID, title, slugified title, case-insensitive equality, and includes.
   - One match: suggest `playspec use <taskId>`.
   - Multiple matches: list candidate task IDs and titles.
   - Preserve the original task-not-found behavior when no candidates exist.

5. Add focused CLI tests in `tests/cli.test.ts`.
   - Use success summary includes `Task ID`, title, workflow, effective phase, context count, and next action.
   - `use` with title suggests the correct task ID.
   - ambiguous title-like input shows multiple candidates.
   - `list-tasks` header starts with `Task ID`.
   - `current-task` uses `Task ID:`.
   - `use` remains HEAD-only and does not fail on a missing context ref.
   - invalid current phase shows `INVALID (...)` and `Allowed:`.

## Files to Edit

- `src/cli/cli-utils.ts`
- `src/cli/commands/use.ts`
- `src/cli/commands/list-tasks.ts`
- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `tests/cli.test.ts`

## Tests to Run

- Focused: `pnpm test -- tests/cli.test.ts`
- Build: `pnpm build`
- Full suite if feasible: `pnpm test`

## Risks

- Tests currently assert old `ID:` and selector text; update only expectations tied to the requested identity wording.
- Suggestion matching must be helpful without accepting titles as valid IDs. It should not mutate HEAD on a miss.
- Compact summary should load workflow display only for output and must not introduce context file validation.

## Rollback Notes

All changes are confined to CLI formatting/suggestion logic and tests. Revert the touched files if behavior needs to return to previous output.

## Completion Criteria

- Acceptance criteria in issue #25 pass via CLI tests.
- `pnpm build` passes.
- Draft PR includes PlaySpec task ID, changed files, tests run, and risk notes.

## Plan Validation Ledger

Score: 96/100

Blockers: none.

Medium risks:
- Existing tests assert legacy wording (`ID:`, selector row fragments, lowercase `allowed:`). Update only assertions directly tied to requested output changes.

Low risks:
- Matching titles by broad substring could produce noisy suggestions. Keep the algorithm deterministic, deduplicate by task ID, and report multiple candidates rather than choosing one.

Recommended minimal patches:
- Keep all new display logic in `cli-utils.ts` and `use.ts`; avoid changing storage/core APIs.
- Ensure the `use` error path does not write HEAD by writing only after exact `store.getTask(taskId)` success.
- Add a missing-context-ref regression test for `use`.

Unresolved blockers after review: none.

Completion result: `playspec complete --result approved`.
