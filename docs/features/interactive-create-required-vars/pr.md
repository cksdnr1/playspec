# PR: Interactive Create Required Variables

Fixes #141

## Summary

- Interactive `playspec create` now resolves the selected workflow before task persistence.
- The wizard prompts for required workflow-level variables without usable defaults, including mono-spec `FEATURE_SLUG` and the multiple required variables in `issue-scope-create`.
- Blank required-variable answers are rejected before task creation.
- Cancelled variable collection fails before writing task state, source files, or `.playspec/HEAD`.
- Non-interactive repeated `--var KEY=VALUE` create behavior is unchanged.

## Changed Files

- `src/cli/commands/create.ts`
- `tests/cli.test.ts`
- `docs/features/interactive-create-required-vars/spec.md`
- `docs/features/interactive-create-required-vars/plan.md`
- `docs/features/interactive-create-required-vars/result.md`
- `docs/features/interactive-create-required-vars/pr.md`

## Tests Run

- `pnpm exec vitest run tests/cli.test.ts -t 'collects mono-spec|required workflow variables|reprompts|cancelled|repeated workflow variables'`
- `pnpm exec vitest run tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `interactive_create_should_collect_required_workflow_variables_before_creating_variable_required_tasks`

## Draft PR

- https://github.com/cksdnr1/playspec/pull/143

## Risk Notes

- The interactive wizard prompts for mono-spec `FEATURE_SLUG` even though the resolver has an engine fallback, because the workflow declares it as required without a default and issue #141 explicitly requires collecting it.
- No reusable agent guidance needs to be documented; this is a localized CLI behavior fix.
