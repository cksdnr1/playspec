# PR: Issue 136 Create Phase Handoff

Fixes #136

## Summary

- Store the requested initial phase for new handoff tasks when the selected workflow declares that phase.
- Carry planning-derived `FEATURE_SLUG` into phase-execution handoff tasks while preserving explicit `--var` overrides.
- Render phase spec and handoff paths in the phase-execution prompt so the resolved planning-derived file variables are visible.
- Extend the total-plan to phase-execution integration test to assert phase 2 prompt rendering, stored task state, context refs, and planning-slug file paths.

## Changed Files

- `src/cli/commands/create.ts`
- `src/core/types.ts`
- `src/storage/yaml-task-store.ts`
- `src/preset/assets/workflows/phase-execution/templates/phase_template.md`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_136_create_phase_handoff/spec.md`
- `docs/features/issue_136_create_phase_handoff/plan.md`
- `docs/features/issue_136_create_phase_handoff/result.md`
- `docs/features/issue_136_create_phase_handoff/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/init-create-next.test.ts tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_136_create_phase_handoff`

## Risk Notes

- Existing tasks are not migrated; the fix applies to newly created handoff tasks.
- Legacy non-phase workflows that use `--phase` keep their prior behavior unless they declare the requested phase id or `FEATURE_SLUG`.
