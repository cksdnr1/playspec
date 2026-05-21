# Interactive Create Required Variables Plan

## Ordered Steps

1. Update `src/cli/commands/create.ts` so `runInteractiveCreate` resolves the selected workflow before source handling.
2. Add a CLI-local helper to identify required workflow-level variables that need wizard input:
   - Include declarations from `workflow.definition.variables` where `required: true`.
   - Skip variables with a usable declaration default.
   - Skip variables already collected in the same wizard pass.
   - Do not inspect or relax Core required-variable validation.
3. Prompt for each missing required variable using the declaration description when available.
4. Reject blank answers by reprompting before task creation.
5. Treat closed input or cancellation during variable collection as an error before calling `createNormalTask`.
6. Pass collected variables into `createNormalTask(workspaceRoot, workflow, titleInput, sourceResult, undefined, variables)`.
7. Keep non-interactive `runCreate` and repeated `--var KEY=VALUE` behavior unchanged.
8. Add CLI tests covering interactive mono-spec `FEATURE_SLUG`, multiple `issue-scope-create` variables, blank reprompting, cancellation/no persistence, unchanged non-interactive `--var`, and prompt rendering success.

## Files To Edit

- `src/cli/commands/create.ts`
  - Add the interactive required-variable collection helper.
  - Adjust `askQuestion` so closed input can be detected by variable collection.
  - Wire collected variables into interactive task creation.
- `tests/cli.test.ts`
  - Add pseudo-TTY tests near the existing create UX tests.

## Tests To Add Or Update

- Interactive default `mono-spec` creation prompts for and stores `FEATURE_SLUG`; `prompt --no-copy` renders successfully with that value.
- Interactive `issue-scope-create` prompts for all required workflow variables without defaults and stores them in `task.yaml`.
- Blank input for a required interactive variable is rejected and reprompted.
- Cancellation or EOF during variable collection leaves no task directory, no source file, and unchanged or empty `.playspec/HEAD`.
- Existing non-interactive repeated `--var` behavior remains unchanged.

## Risks

- `FEATURE_SLUG` is also an engine fallback, but issue #141 explicitly requires prompting for mono-spec `FEATURE_SLUG`; the helper should follow workflow declaration requirements instead of treating that fallback as a reason to skip.
- Pseudo-TTY timing can be brittle. Tests should validate persisted state and rendered output, not exact prompt timing.
- Source content must not be written before variable collection succeeds. Keep the persistence boundary inside `createNormalTask`.

## Rollback Notes

The change is isolated to CLI create behavior and tests. Reverting `src/cli/commands/create.ts` and the related test additions restores prior behavior.

## Completion Criteria

- Interactive create collects required workflow variables before persistence.
- Blank values are rejected in the wizard.
- Failed/cancelled collection does not create task/source state or update HEAD.
- Non-interactive `--var` behavior is unchanged.
- Prompt rendering succeeds after interactive creation with collected variables.
- `pnpm build` and relevant `pnpm test` commands pass.
