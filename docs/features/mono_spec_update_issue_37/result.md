# mono-spec update issue 37 Result

## Files Changed

- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_patch.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_patch.md`
- `tests/integration/init-create-next.test.ts`

## Behavior Implemented

- Step 2 now directly instructs Codex/the code agent to validate the technical spec instead of preparing copy/paste text for an external GPT.
- Step 2 requires markdown validation/risk output with `Score: X/100`.
- Step 2 approval is limited to readiness score `>= 95/100` with no blockers; lower scores or unresolved blockers route to `needs_revision`.
- Step 3 references the latest Step 2 markdown validation/risk score output when patching the spec.
- Step 5 requires markdown validation/risk output with `Score: X/100`.
- Step 5 approval is limited to readiness score `>= 95/100` with no blockers; lower scores or unresolved blockers route to `needs_revision`.
- Step 6 references the latest Step 5 markdown validation/risk score output when patching the plan.
- Rendered-prompt integration assertions cover the Step 2, Step 3, Step 5, and Step 6 behavior.

## Verification Performed

- Focused implementation validation reported by spec implementer:
  - `pnpm vitest run tests/integration/init-create-next.test.ts`
  - `pnpm build`
- Owner validation:
  - `pnpm vitest run tests/integration/init-create-next.test.ts` passed, 14 tests.
  - `pnpm test` initially stalled and then failed two `tests/cli.test.ts` cases on Vitest's 5000 ms default timeout.
  - `pnpm vitest run tests/cli.test.ts --reporter verbose` confirmed the CLI transition behavior passes after giving the CLI process-spawning suite a file-level timeout; 120 tests passed.
  - `pnpm test` passed after the timeout adjustment; 18 test files and 285 tests passed.
  - `pnpm build` passed.

## Remaining Risks

- Existing initialized `.playspec` workspaces can retain copied old workflow assets until their workflow assets are refreshed. No runtime migration was added because the issue scope is the mono-spec preset.
- `tests/cli.test.ts` is a slow CLI process-spawning suite; it now has a file-level 20 second per-test timeout to avoid unrelated timeout failures under full-suite load.

## Step 9 Refactor Review

- `git diff --check` passed.
- No additional refactor was applied. The current diff is already limited to mono-spec prompt templates, prompt-rendering tests, CLI test timeout reliability, and PlaySpec task documentation.
- Intentionally skipped runtime refactors because the requested behavior is preset prompt policy, not CLI/core behavior.

## Step 10 PR Preparation

- PR body drafted in `docs/features/mono_spec_update_issue_37/pr.md`.
- Reusable agent guidance: not documented separately because this is a mono-spec preset wording change, not a reusable operating procedure.
- Branch push and draft PR creation are handled after commit.
- Returning this isolated worktree to `master` is intentionally skipped because the operator required work to remain on branch `agent/issue-37-mono-spec-update` in this isolated worktree.
