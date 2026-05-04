# Issue 74 CLI Optimize Implementation Plan

## Goal

Make the first PlaySpec CLI experience simpler without breaking existing command compatibility:
- README leads with the compact mono-spec CLI journey.
- `playspec --help` shows only everyday workflow commands.
- Deprecated aliases, migration, and advanced/admin commands remain callable but are hidden from root help.
- Migration remains implemented but emits a deprecation warning when invoked.

This is a pre-implementation plan. Current-code observations such as root help still showing hidden commands, README still documenting migration as current, and `runMigrate` not yet warning are expected implementation gaps, not plan blockers, because the steps below name exact files, command objects, warnings, and tests to change.

## Ordered Steps

1. Rewrite README around the primary journey.
   - Edit `README.md`.
   - Move the compact path to the top: init, create, prompt, complete, status/list/use.
   - Describe root help as intentionally compact.
   - Move advanced commands into a short advanced section.
   - Remove migration from Current Status and normal user journey.
   - Mention migration only as a deprecated hidden compatibility command.

2. Compact Commander root help.
   - Edit `src/cli/index.ts`.
   - Add `.hideHelp()` to hidden deprecated aliases: `list`, `current`, `next`.
   - Add `.hideHelp()` to hidden advanced/admin commands: `workflow`, `rewind`, `evidence`, `snapshot`, `desync-check`, `rollback`, `harness`, `close`, `archive`, `evolution`.
   - Add `.hideHelp()` to hidden deprecated `migrate`.
   - Keep all command actions and options unchanged.
   - Keep visible command descriptions short and focused.

3. Add migration deprecation warning.
   - Edit `src/cli/commands/migrate.ts`.
   - At the start of `runMigrate`, write the exact warning to stderr:
     `Warning: \`playspec migrate\` is deprecated. Migration is hidden from the primary CLI workflow.`
   - Do not alter migration validation, backup, report, archive gating, or action execution.

4. Update CLI tests.
   - Edit `tests/cli.test.ts`.
   - Change root help test to assert visible everyday commands are present.
   - Assert hidden commands are absent from root help.
   - Keep explicit subcommand help coverage for `harness` and `evolution`.
   - Add explicit subcommand help coverage for `archive` and `workflow`.
   - Add or update coverage that `migrate` is absent from root help but direct invocation emits the deprecation warning.
   - Preserve existing alias behavior tests for `list`, `current`, and `next`.

5. Validate.
   - Use pnpm because `pnpm-lock.yaml` exists.
   - Run `pnpm build`.
   - Run `pnpm test`.
   - Run targeted CLI help checks if failures need diagnosis:
     - `pnpm exec tsx src/cli/index.ts --help`
     - `pnpm exec tsx src/cli/index.ts harness --help`
     - `pnpm exec tsx src/cli/index.ts archive --help`
     - `pnpm exec tsx src/cli/index.ts workflow --help`
     - `pnpm exec tsx src/cli/index.ts migrate --help`

## Files To Edit

- `README.md`
- `src/cli/index.ts`
- `src/cli/commands/migrate.ts`
- `tests/cli.test.ts`

## Tests To Add Or Update

- Root help compactness:
  - Present: `init`, `create`, `list-tasks`, `current-task`, `get-task`, `add-context`, `use`, `prompt`, `specs`, `phase`, `complete`, `status`.
  - Absent: `workflow`, `list`, `current`, `next`, `rewind`, `evidence`, `snapshot`, `desync-check`, `rollback`, `harness`, `close`, `archive`, `evolution`, `migrate`.
- Explicit advanced help remains callable:
  - `playspec harness --help`
  - `playspec evolution --help`
  - `playspec archive --help`
  - `playspec workflow --help`
- Migration compatibility:
  - `playspec migrate` remains callable and emits the deprecation warning before normal behavior.

## Old Paths And Bypasses

- Deprecated aliases are old paths: `list`, `current`, `next`. They must be hidden but callable.
- Migration is a deprecated old path. It must be hidden but callable for compatibility.
- Advanced/admin commands bypass the primary journey. They must be hidden from root help but callable directly.

## Risks

- Commander `.hideHelp()` must be placed on the command object being registered. Accidentally hiding subcommands instead of root commands would not compact root help.
- Existing tests expect `harness` and `evolution` in root help; those expectations must change while keeping explicit command help tests.
- Migration deletion is out of scope. Removing `src/migration/*` would break integration coverage and exceed the approved spec.

## Step 5 Validation Ledger

Latest Step 5 readiness score: 86/100.

Resolved by this patch:
- Explicit advanced help coverage now includes `archive --help` and `workflow --help`, matching the spec's callable compatibility contract.
- The risk that only `harness` and `evolution` would be tested after hiding all advanced command groups is closed.

Remaining risks:
- README wording remains authorial work during implementation, but the required content and migration deprecation stance are specified.
- `.hideHelp()` must be applied to root command objects, not nested subcommands.

## Step 5 Revalidation Ledger

Latest Step 5 revalidation score: 38/100.

Findings classified as expected implementation gaps, not plan blockers:
- Root help still exposes deprecated aliases, advanced/admin commands, and `migrate`; Step 2 gives the exact `.hideHelp()` work required in `src/cli/index.ts`.
- `playspec migrate` does not yet emit the deprecation warning; Step 3 gives the exact warning and target file.
- README still presents migration as current functionality; Step 1 gives the required README changes.
- CLI tests still assert old root help behavior; Step 4 and the Tests section give exact updated expectations.

Plan action from this revalidation:
- Added this note to prevent treating pre-implementation code gaps as plan incompleteness.
- No implementation scope, file set, command contract, or test strategy changed.

## Rollback Notes

All implementation changes are localized to docs, CLI registration, one warning line, and tests. Reverting the CLI compaction means removing `.hideHelp()` calls and restoring README/test expectations.

## Completion Criteria

- `README.md` teaches the compact CLI journey before advanced feature inventory.
- `playspec --help` displays only the approved visible root command set.
- Hidden commands remain callable by direct invocation.
- `playspec migrate` emits the approved deprecation warning.
- `pnpm build` passes.
- `pnpm test` passes.
