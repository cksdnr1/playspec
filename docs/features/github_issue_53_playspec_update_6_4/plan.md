# GitHub Issue #53 - PlaySpec Update 6.4 Implementation Plan

## Goal

Implement Phase 6.4 only: human edit observation intake.

## Steps

1. Add human edit path helpers under `.playspec/evolution/human-edits`.
2. Add observation types and zod schemas.
3. Add `EvolutionHumanEditStore` with create, load, list, and status update APIs.
4. Register `playspec evolution record-edit`.
5. Add CLI runner for create and status update modes.
6. Add store/schema tests, CLI tests, and prompt/completion no-surfacing regressions.

## Validation

- `pnpm build`
- `pnpm test -- --run tests/integration/evolution-human-edit-store.test.ts tests/cli.test.ts tests/integration/init-create-next.test.ts`
- `pnpm test`

## Boundaries

Do not generate proposals, append evidence, apply proposals, mutate PlaySpec assets, or surface human edit records in prompts/completion.
