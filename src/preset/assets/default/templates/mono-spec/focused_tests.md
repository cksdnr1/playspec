# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Implement focused test coverage for already-implemented phase behavior and record the result.

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
- `{{RESULT_FILE}}`
- Current repository code and existing test conventions.

Scope rules:
- Add focused coverage for the implemented behavior and routing/edge cases called out in the plan.
- Avoid broad test rewrites.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Tests should exercise active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior where feasible.

Output requirements:
- Add or update focused tests.
- Run the relevant test command.
- Update `{{RESULT_FILE}}` with tests changed, commands run, results, failures, and remaining gaps.

Approval/gate handling:
- No approval result is required for this step. Complete normally after tests and result notes are done.

{{include:rules/global_rules.md}}
