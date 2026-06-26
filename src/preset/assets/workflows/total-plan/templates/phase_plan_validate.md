# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Validate the phase implementation plan against the approved total technical specification and current repository code.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- TOTAL_SPEC_FILE=`{{TOTAL_SPEC_FILE}}`
- PHASE_PLAN_FILE=`{{PHASE_PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`

Source of truth:
- `{{TOTAL_SPEC_FILE}}`
- `{{PHASE_PLAN_FILE}}`
- Current repository code.

Scope rules:
- Verify that each phase is mono-spec-sized and implementation-ready.
- Verify dependencies, sequencing, reset/clear behavior, user-visible outcomes, and tests.
- Verify that structured-artifact literals used by the plan match the approved total spec and authoritative artifacts: enum/status/classification/schema/field names, value mappings, generated catalog fields, fingerprint/hash inputs, baseline anchors, and artifact paths.
- Check that no phase relies on future work unless it declares the dependency.
- Do not implement code or create child tasks.

Output requirements:
- Report findings first, ordered by severity.
- Include a readiness score from 0 to 100.
- Include a risk ledger for undersized/oversized phases, missing entry points, unclear state propagation, missing tests, structured-artifact vocabulary/schema/catalog/hash mismatches, filename incompatibility, and future-phase leakage.
- Classify structured-artifact vocabulary/schema/catalog/hash mismatches as at least Medium. Classify them as Blockers when they would make a later implementation phase choose a contract, storage/API shape, migration behavior, or safety boundary.
- State the exact result to pass to completion:
  - Use `playspec complete --result approved` only when the readiness score is `>= 95` and no blockers remain.
  - Use `playspec complete --result needs_revision` when the readiness score is below `95` or unresolved blockers remain.

Approval/gate handling:
- This is a gated phase.
- `approved` routes to final planning review.
- `needs_revision` routes to phase plan patching.

{{include:rules/global_rules.md}}
