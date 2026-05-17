# PR: Validate first-phase required variables during task creation

Fixes #123

## Summary

- Adds a shared Core required-variable assertion used by prompt rendering and normal task creation.
- Preflights the selected workflow's initial phase during normal `playspec create` before task persistence, source writes, or HEAD mutation.
- Allows workflow defaults to reference task variables supplied with `--var`, which is needed for workflows whose derived defaults depend on required user input.
- Adds CLI and unit coverage for failed create atomicity, supplied variables, workflow defaults, phase defaults, and task-variable-backed defaults.

## Changed Files

- `src/core/required-variables.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/create.ts`
- `src/template/variable-resolver.ts`
- `tests/cli.test.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue-123-required-vars/spec.md`
- `docs/features/issue-123-required-vars/plan.md`
- `docs/features/issue-123-required-vars/result.md`
- `docs/features/issue-123-required-vars/pr.md`
- `docs/issues/123-validate-first-phase-required-variables.md`

## Tests Run

- `pnpm test -- tests/unit/variable-resolver.test.ts`
- `pnpm test -- tests/cli.test.ts -t "required variable|repeated workflow variables"`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `validate_first_phase_required_variables_during_task_creation`

## Risk Notes

- Create-time validation is intentionally limited to the initial phase for normal task creation.
- Phase-execution task creation is intentionally unchanged.
- No reusable agent guidance needs to be documented; this is a localized CLI/Core validation fix.
