# mono-spec update issue 37 Implementation Plan

## Ordered Implementation Steps

1. Update Step 2 prompt template.
   - File: `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
   - Replace external GPT copy/paste framing with direct Codex/code-agent validation instructions.
   - Require a markdown validation/risk score section in `SPEC_FILE`.
   - Require `Score: X/100`.
   - State `playspec complete --result approved` is allowed only when score is `>= 95` and no unresolved blockers remain; otherwise use `needs_revision`.

2. Update Step 3 prompt template.
   - File: `src/preset/assets/workflows/mono-spec/templates/tech_spec_patch.md`
   - Add the Step 2 markdown validation/risk score output as source of truth.
   - Require patch notes that resolve, downgrade, or preserve score-impacting findings.

3. Update Step 5 prompt template.
   - File: `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`
   - Require a markdown validation/risk score section in `PLAN_FILE`.
   - Require `Score: X/100`.
   - State `playspec complete --result approved` is allowed only when score is `>= 95` and no unresolved blockers remain; otherwise use `needs_revision`.

4. Update Step 6 prompt template.
   - File: `src/preset/assets/workflows/mono-spec/templates/implementation_plan_patch.md`
   - Add the Step 5 markdown validation/risk score output as source of truth.
   - Require plan patches to address score-impacting validation findings.

5. Add rendered-prompt tests.
   - File: `tests/integration/init-create-next.test.ts`
   - Assert mono-spec Step 2 and Step 5 rendered prompts include `readiness score is \`>= 95/100\`` and `Score: X/100`.
   - Assert Step 2 no longer renders external GPT/Web GPT/paste-to-GPT wording.
   - Assert Step 3 and Step 6 render references to the latest markdown validation/risk score output.

## Active Path Trace

- Entry point: default preset init copies mono-spec assets; `PlaySpecCore.renderExplicitPhasePrompt()` renders a mono-spec phase.
- State/data update: markdown templates define rendered phase instructions.
- Propagation: tests initialize a temp workspace, create a mono-spec task, and render phase prompts.
- Reset/clear: no state migration or runtime reset path is affected.
- User-visible behavior: rendered Step 2/5/3/6 prompts contain stricter validation and direct-agent wording.

## Tests To Add/Update

- Update existing mono-spec rendered prompt integration test to cover:
  - Step 2 strict `>= 95` approval threshold.
  - Step 5 strict `>= 95` approval threshold.
  - Step 2 and Step 5 markdown score output.
  - Step 3 and Step 6 patch steps consuming markdown validation/risk score output.
  - Step 2 removal of external GPT copy/paste phrasing.

## Risks

- Existing workspaces already initialized with copied workflow assets may retain old templates. This is a known preset distribution limitation and not part of this prompt-only change.
- Over-specifying output filenames could require workflow artifact/schema changes. The plan avoids that by keeping outputs in existing `SPEC_FILE` and `PLAN_FILE`.

## Rollback Notes

Rollback is limited to the four mono-spec template files and one integration test file. No runtime schema, storage, CLI, or migration files should change.

## Completion Criteria

- Step 2 and Step 5 rendered mono-spec prompts require score `>= 95` and no unresolved blockers for approval.
- Step 2 and Step 5 rendered prompts require markdown validation/risk score output with a 0-100 score.
- Step 3 and Step 6 rendered prompts reference the latest markdown validation/risk score output.
- Step 2 rendered prompt addresses Codex/the code agent directly and avoids external GPT copy/paste instructions.
- `pnpm build` and `pnpm test` pass.

## Step 5 Validation/Risk Ledger

- Score: 97/100
- Verdict: approved
- Blockers: none
- Medium risks: none
- Low risks: existing initialized workspaces may retain copied old workflow assets until reinitialized or workflow assets are refreshed.
- Recommended minimal patches: proceed with the four mono-spec template edits and rendered prompt test assertions described above.
- Unresolved blockers after valid proposed fixes: none
- Next gate result: `approved`
