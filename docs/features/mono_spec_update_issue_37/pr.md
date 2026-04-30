# Draft PR: mono-spec validation score threshold update

Fixes #37

## Summary

- Updated mono-spec Step 2 to directly ask Codex/the code agent to validate the technical spec, replacing the external GPT copy/paste workflow.
- Raised Step 2 and Step 5 gate guidance so `approved` is only valid with readiness score `>= 95/100` and no blockers.
- Added markdown validation/risk score output requirements with `Score: X/100` for Step 2 and Step 5.
- Updated Step 3 and Step 6 to consume the latest markdown validation/risk score output when patching the spec or plan.
- Added rendered-prompt assertions for the updated mono-spec instructions.
- Added a file-level Vitest timeout for the slow CLI process-spawning suite so full-suite validation does not fail on unrelated 5 second timeout headroom.

## Changed Files

- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_patch.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_patch.md`
- `tests/integration/init-create-next.test.ts`
- `tests/cli.test.ts`
- `docs/features/mono_spec_update_issue_37/spec.md`
- `docs/features/mono_spec_update_issue_37/plan.md`
- `docs/features/mono_spec_update_issue_37/result.md`
- `docs/features/mono_spec_update_issue_37/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/init-create-next.test.ts`
- `pnpm vitest run tests/cli.test.ts --reporter verbose`
- `pnpm test`
- `pnpm build`

## PlaySpec Task ID

- `mono_spec_update_issue_37`

## Risk Notes

- Existing initialized `.playspec` workspaces may keep copied old mono-spec workflow assets until refreshed or reinitialized.
- No runtime enforcement was added; this change updates the built-in mono-spec preset prompts and rendered-prompt coverage.
- Reusable agent guidance does not need separate documentation for this issue because the change is specific to shipped mono-spec prompt text.

