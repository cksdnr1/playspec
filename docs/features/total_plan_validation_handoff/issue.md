# Issue: Persist Total-Plan Validation Handoff Files

## Summary

The `total-plan` workflow has two validation gates:

- Step 2: `total_spec_validate`
- Step 5: `phase_plan_validate`

Both templates currently tell the agent to produce findings, a readiness score, and a risk ledger in the response. That is useful for the current conversation, but it is not durable enough for the intended workflow.

When Step 2 or Step 5 completes with `needs_revision`, the user wants to clear LLM context and run Step 3 or Step 6 patching from a fresh context. The patching step then needs a small, stable markdown file that contains the validation findings and patch instructions, instead of relying on previous chat history.

## User Problem

Current flow:

1. Step 2 validates `TOTAL_SPEC_FILE`.
2. Step 2 reports findings in chat.
3. User completes with `playspec complete --result needs_revision`.
4. Step 3 patch prompt runs.
5. If the user cleared LLM context, Step 3 cannot reliably know the Step 2 findings unless they were manually copied somewhere.

The same problem exists for:

1. Step 5 validates `PHASE_PLAN_FILE`.
2. Step 5 reports findings in chat.
3. User completes with `playspec complete --result needs_revision`.
4. Step 6 patch prompt runs.
5. If context was cleared, Step 6 lacks the Step 5 risk ledger and required changes.

The desired behavior is that validation produces a durable markdown handoff artifact, similar to a risk file, so patch phases can start from that file with low token cost.

## Current Behavior

Verified from current workflow assets:

- `src/preset/assets/default/workflows/total-plan.yaml`
  - Step 2 is `total_spec_validate`.
  - Step 2 routes `approved` to `phase_plan_create`.
  - Step 2 routes `needs_revision` to `total_spec_patch`.
  - Step 5 is `phase_plan_validate`.
  - Step 5 routes `approved` to `final_review`.
  - Step 5 routes `needs_revision` to `phase_plan_patch`.
- `src/preset/assets/default/templates/total-plan/total_spec_validate.md`
  - Requires findings, readiness score, risk ledger, and completion result guidance.
  - Does not require writing a validation handoff file.
- `src/preset/assets/default/templates/total-plan/phase_plan_validate.md`
  - Requires findings, readiness score, risk ledger, and completion result guidance.
  - Does not require writing a validation handoff file.

Current limitation:

- The validation risk ledger is prompt output only.
- Step 3 and Step 6 do not have a guaranteed file to read after context clearing.
- Reusing validation findings requires manual copy/paste or preserving chat history.

## Additional Packaging Issue

The built asset tree currently appears to store `total-plan` differently from the other default preset assets.

Observed paths:

```text
dist/preset/assets/assets/default/workflows/total-plan.yaml
dist/preset/assets/assets/default/templates/total-plan/*.md
```

Other default preset workflows and templates are present under:

```text
dist/preset/assets/default/workflows/*.yaml
dist/preset/assets/default/templates/<workflow>/*.md
```

Impact:

- Runtime or packaged installs may miss `total-plan` if the preset loader reads `dist/preset/assets/default`.
- `total-plan` may only work from source or test paths while packaged CLI usage fails.
- The validation handoff change should not be implemented only in the duplicated `assets/assets/default` tree.

Required follow-up:

- Fix the build or asset-copy path so `total-plan.yaml` and `templates/total-plan/*.md` are emitted to `dist/preset/assets/default/...`, consistent with the other default workflows.
- Remove or prevent the unintended `dist/preset/assets/assets/default/...` duplication if it is not needed.
- Add packaging validation that checks all default preset workflows and templates, including `total-plan`, exist in the same expected built asset root.

## Proposed Feature

Add explicit validation handoff files for `total-plan` validation gates.

Suggested variables:

```text
TOTAL_SPEC_VALIDATION_FILE=docs/features/<featureSlug>/<featureSlug>_total_spec_validation.md
PHASE_PLAN_VALIDATION_FILE=docs/features/<featureSlug>/<featureSlug>_phase_plan_validation.md
```

Suggested ownership:

- Step 2 writes or updates `TOTAL_SPEC_VALIDATION_FILE`.
- Step 3 reads `TOTAL_SPEC_VALIDATION_FILE` before patching `TOTAL_SPEC_FILE`.
- Step 5 writes or updates `PHASE_PLAN_VALIDATION_FILE`.
- Step 6 reads `PHASE_PLAN_VALIDATION_FILE` before patching `PHASE_PLAN_FILE`.

These files should be project documentation artifacts under `docs/features/<featureSlug>/`, not hidden cache files, because they are intended to be human-readable handoff context.

## Validation File Contract

Each validation handoff file should be concise and patch-oriented.

Required sections:

```md
# <Total Spec | Phase Plan> Validation Handoff

- Task: <task title or task id>
- Validated file: <TOTAL_SPEC_FILE or PHASE_PLAN_FILE>
- Validation phase: <total_spec_validate or phase_plan_validate>
- Readiness score: <0-100>
- Result recommendation: <approved or needs_revision>
- Generated at: <ISO timestamp if available, otherwise omit>

## Blocking Findings

- ...

## Patch Requirements

- ...

## Risk Ledger

| Risk | Severity | Evidence | Required Fix |
| --- | --- | --- | --- |

## Verification Notes

- Verified:
- Inferred:
- Still unknown:
```

The file should contain enough information for the patch phase to proceed without prior chat context, but should avoid dumping large source excerpts or full file copies.

## Template Changes

Update `total_spec_validate.md`:

- Add `TOTAL_SPEC_VALIDATION_FILE` to displayed variables.
- Require writing or updating `TOTAL_SPEC_VALIDATION_FILE`.
- Tell the validator to keep the file concise and patch-oriented.
- Keep the existing readiness score and gate result instructions.

Update `total_spec_patch.md`:

- Add `TOTAL_SPEC_VALIDATION_FILE` to displayed variables.
- Treat `TOTAL_SPEC_VALIDATION_FILE` as the first source of truth for patch requirements.
- Patch `TOTAL_SPEC_FILE` in place using that handoff.
- Do not require prior chat context.

Update `phase_plan_validate.md`:

- Add `PHASE_PLAN_VALIDATION_FILE` to displayed variables.
- Require writing or updating `PHASE_PLAN_VALIDATION_FILE`.
- Tell the validator to keep the file concise and patch-oriented.
- Keep the existing readiness score and gate result instructions.

Update `phase_plan_patch.md`:

- Add `PHASE_PLAN_VALIDATION_FILE` to displayed variables.
- Treat `PHASE_PLAN_VALIDATION_FILE` as the first source of truth for patch requirements.
- Patch `PHASE_PLAN_FILE` in place using that handoff.
- Do not require prior chat context.

## Workflow Metadata Changes

Update `src/preset/assets/default/workflows/total-plan.yaml`:

- Add `TOTAL_SPEC_VALIDATION_FILE` as a required variable for:
  - `total_spec_validate`
  - `total_spec_patch`
- Add `PHASE_PLAN_VALIDATION_FILE` as a required variable for:
  - `phase_plan_validate`
  - `phase_plan_patch`
- Add validation file outputs:
  - `total_spec_validate.outputs` should include `{{TOTAL_SPEC_VALIDATION_FILE}}`.
  - `phase_plan_validate.outputs` should include `{{PHASE_PLAN_VALIDATION_FILE}}`.

## Variable Resolver Changes

Update `src/template/variable-resolver.ts` to resolve:

```text
TOTAL_SPEC_VALIDATION_FILE=docs/features/<featureSlug>/<featureSlug>_total_spec_validation.md
PHASE_PLAN_VALIDATION_FILE=docs/features/<featureSlug>/<featureSlug>_phase_plan_validation.md
```

Preserve explicit task variable overrides if supplied.

## Out Of Scope

- Engine-level parsing of readiness scores.
- Engine-level automatic approval or rejection.
- Auto-applying validation findings.
- Creating child phase-execution tasks.
- Viewer UI.
- Migration, archive, rollback, or MCP behavior changes.
- Replacing the broader completion ledger proposal in `docs/features/phase_completion_ledger/issue.md`.
- Leaving `total-plan` only under `dist/preset/assets/assets/default`.

This issue is narrower than the completion ledger feature. It only concerns durable, human-readable validation handoff files for `total-plan` Step 2 -> Step 3 and Step 5 -> Step 6.

## Acceptance Criteria

- `TOTAL_SPEC_VALIDATION_FILE` and `PHASE_PLAN_VALIDATION_FILE` resolve by default under `docs/features/<featureSlug>/`.
- Step 2 prompt displays and requires writing `TOTAL_SPEC_VALIDATION_FILE`.
- Step 3 prompt displays and instructs patching from `TOTAL_SPEC_VALIDATION_FILE`.
- Step 5 prompt displays and requires writing `PHASE_PLAN_VALIDATION_FILE`.
- Step 6 prompt displays and instructs patching from `PHASE_PLAN_VALIDATION_FILE`.
- `total-plan.yaml` declares the validation handoff files as outputs for the validation phases.
- Render tests cover all four affected templates with no unresolved placeholders.
- Validation prompt tests assert that handoff files are required while existing `approved` and `needs_revision` routing guidance remains intact.
- Existing total-plan routing tests continue to pass.
- Built package assets place `total-plan.yaml` and `templates/total-plan/*.md` under `dist/preset/assets/default/...`, consistent with the other default workflows.
- Packaging validation fails if `total-plan` is emitted only under `dist/preset/assets/assets/default/...`.
