# Draft PR: CLI Optimize

Fixes #74

## Summary

- Rewrites the README around the compact PlaySpec user journey: initialize, create/select a task, render prompts, complete phases, and inspect/switch task state.
- Compacts root CLI help by hiding deprecated aliases, migration, and advanced/admin command groups while preserving direct command invocation.
- Deprecates `playspec migrate` at invocation time without deleting migration implementation files.
- Updates CLI and integration tests for the new help visibility contract.

## Changed Files

- `README.md`
- `src/cli/index.ts`
- `src/cli/commands/migrate.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_74_cli_optimize/spec.md`
- `docs/features/issue_74_cli_optimize/plan.md`
- `docs/features/issue_74_cli_optimize/result.md`
- `docs/features/issue_74_cli_optimize/pr.md`

## Tests Run

- `pnpm exec tsx src/cli/index.ts --help`
- `pnpm exec tsx src/cli/index.ts harness --help`
- `pnpm exec tsx src/cli/index.ts archive --help`
- `pnpm exec tsx src/cli/index.ts workflow --help`
- `pnpm exec tsx src/cli/index.ts migrate`
- `pnpm exec vitest run tests/cli.test.ts`
- `pnpm build`
- `pnpm exec vitest run tests/integration/init-create-next.test.ts`
- `pnpm test`
- `pnpm exec vitest run tests/cli.test.ts tests/integration/init-create-next.test.ts`

## PlaySpec Task

- `issue_74_cli_optimize`

## Risk Notes

- Migration files remain in place because existing migration code and integration coverage still depend on them. This PR hides and deprecates the CLI entry point instead of deleting migration implementation.
- Advanced commands remain callable directly but are hidden from root help to keep the primary user journey compact.

## Reusable Agent Guidance

No new reusable AGENTS guidance is needed. The existing repository rule about not deleting migration files unless safe covered the main risk.
