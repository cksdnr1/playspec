# Issue 74 CLI Optimize Result

## Implemented

- Rewrote `README.md` around the compact everyday CLI loop: init, create, prompt, complete, status/list/use.
- Documented advanced/recovery/admin commands as directly callable but hidden from root help.
- Marked `playspec migrate` as deprecated compatibility instead of a primary workflow.
- Compacted `playspec --help` by hiding deprecated aliases, advanced/admin commands, and migration while preserving direct invocation.
- Added a migration deprecation warning at the start of `runMigrate`.
- Updated CLI tests for compact root help, direct advanced help, and migration warning compatibility.

## Files Changed

- `README.md`
- `src/cli/index.ts`
- `src/cli/commands/migrate.ts`
- `tests/cli.test.ts`
- `docs/features/issue_74_cli_optimize/spec.md`
- `docs/features/issue_74_cli_optimize/plan.md`
- `docs/features/issue_74_cli_optimize/result.md`

## Verification Performed

- `pnpm exec tsx src/cli/index.ts --help`
- `pnpm exec tsx src/cli/index.ts harness --help`
- `pnpm exec tsx src/cli/index.ts archive --help`
- `pnpm exec tsx src/cli/index.ts workflow --help`
- `pnpm exec tsx src/cli/index.ts migrate`
- `pnpm exec vitest run tests/cli.test.ts`
- `pnpm build`
- `pnpm exec vitest run tests/integration/init-create-next.test.ts`
- `pnpm test`

## Test Changes

- `tests/cli.test.ts` now verifies compact root help, hidden deprecated/advanced/migration commands, direct advanced command help, and migration deprecation warning behavior.
- `tests/integration/init-create-next.test.ts` now expects `close` and `archive` to be hidden from root help while preserving direct `archive --help` and archive command behavior.

## Test Results

- `pnpm exec vitest run tests/cli.test.ts`: passed, 148 tests.
- `pnpm exec vitest run tests/integration/init-create-next.test.ts`: passed, 27 tests.
- `pnpm test`: passed, 22 files / 376 tests.

## Remaining Risks

- Migration implementation remains in place by design; this issue deprecates and hides the CLI path instead of deleting migration files.

## Refactor Review

- `refactor_guard` reviewed the current branch diff and returned `allowed`.
- No additional refactor was applied because the implementation is already localized to the approved docs, CLI registration, warning, and tests.
- `git diff --check` passed with no whitespace errors.
