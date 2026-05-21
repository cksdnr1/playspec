# Interactive Create Required Variables Result

## Files Changed

- `src/cli/commands/create.ts`
- `tests/cli.test.ts`
- `docs/features/interactive-create-required-vars/spec.md`
- `docs/features/interactive-create-required-vars/plan.md`
- `docs/features/interactive-create-required-vars/result.md`

## Behavior Implemented

- Interactive `playspec create` now resolves the selected workflow before task persistence.
- The wizard collects required workflow-level variables without usable defaults before asking for source content.
- Blank required-variable input is rejected and reprompted.
- Cancelled or closed input during required-variable collection fails before `createNormalTask`, so task state, source files, and HEAD are not written.
- Collected variables are passed into the existing `createNormalTask` path, preserving Core required-variable validation.
- Non-interactive create and repeated `--var KEY=VALUE` behavior remain unchanged.

## Verification Performed

- `pnpm exec vitest run tests/cli.test.ts -t 'collects mono-spec|required workflow variables|reprompts|cancelled|repeated workflow variables'`
- `pnpm exec vitest run tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## Remaining Risks

- `FEATURE_SLUG` is still engine-resolvable as a fallback, but the wizard prompts for it because the workflow declares it as required without a default and issue #141 explicitly requires mono-spec `FEATURE_SLUG` collection.
- The new direct interactive tests intentionally drive `runInteractiveCreate` with a controlled stream to avoid pseudo-TTY timing issues; the CLI guard itself remains covered by existing tests.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied; the implementation is already localized to the create command and focused CLI tests.
- Skipped broader test-output cleanup because it would touch shared test harness behavior outside the issue scope.

## PR Preparation

- Draft PR: https://github.com/cksdnr1/playspec/pull/143
- Branch: `agent/issue-141-interactive-vars`
- Commit: `fee84d1`
- Reusable agent guidance: not needed; this is a localized CLI create-flow fix.
