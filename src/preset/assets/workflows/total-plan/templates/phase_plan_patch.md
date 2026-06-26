# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Patch the phase implementation plan using the latest validation findings.

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
- The most recent phase plan validation findings.
- Current repository code for any disputed feasibility claim.

Scope rules:
- Patch `{{PHASE_PLAN_FILE}}` in place.
- Keep changes limited to validation findings.
- Preserve phase numbering and dependency clarity unless the validation findings require a correction.
- Do not alter the approved total spec unless validation exposed a direct contradiction; if that happens, document the issue and stop rather than silently changing both files.
- Do not implement code or create child tasks.
- Re-check any patched enum/status/classification/schema/field names against the approved total spec and authoritative structured artifacts.
- After patching, scan for stale invented vocabulary, field-name drift, fingerprint/hash input drift, deterministic artifact input drift, and test coverage gaps introduced by the patch.

Output requirements:
- Update `{{PHASE_PLAN_FILE}}`.
- Keep the plan reader-friendly and ready for later phase-execution task creation.

Approval/gate handling:
- No approval result is required for this step.
- Complete normally after patching; the workflow returns to phase plan validation.

{{include:rules/global_rules.md}}
