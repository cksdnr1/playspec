# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Patch the implementation plan minimally based on the validation result.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- SPEC_FILE=`{{SPEC_FILE}}`
- PLAN_FILE=`{{PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`
- PR_FILE=`{{PR_FILE}}`

Source of truth:
- `{{PLAN_FILE}}`
- Latest markdown implementation plan validation/risk score output from Step 5, including `Score: X/100`.
- Current repository code only where needed to verify a disputed plan point.

Scope rules:
- Patch the existing plan in place.
- Keep changes minimal, code-anchored, and execution-ready.
- Do not broaden scope beyond the approved spec.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Preserve active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior checks in the plan.
- Re-check any patched enum/status/classification/schema/field names against the approved spec and authoritative structured artifacts.
- After patching, scan for stale invented vocabulary, field-name drift, fingerprint/hash input drift, deterministic artifact input drift, and test coverage gaps introduced by the patch.

Output requirements:
- Update `{{PLAN_FILE}}`.
- Record resolved validation findings and remaining risks, and reference the latest Step 5 score.
- Leave clear implementation steps and focused test targets.

Approval/gate handling:
- No approval result is required for this patch step.
- Complete normally after updating `PLAN_FILE`.
- `playspec complete` routes back to Step 5. 구현 계획서 교차 검증.

{{include:rules/global_rules.md}}
