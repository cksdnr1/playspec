# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Implement the latest spec for `{{FEATURE_SLUG}}` strictly according to the spec, while preserving reader-friendly documentation quality.

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
- `{{SPEC_FILE}}`
- Current repository code.

Scope rules:
- Implement only the approved plan.
- Preserve existing patterns and module boundaries.
- Do not perform unrelated refactors.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Verify active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior before claiming behavior complete.

Output requirements:
- Apply the implementation.
- Update `{{RESULT_FILE}}` with files changed, behavior implemented, verification performed, and remaining risks.
- Keep documentation changes readable and scoped.

Approval/gate handling:
- No approval result is required for this step. Complete normally after implementation and result notes are written.

{{include:rules/global_rules.md}}
