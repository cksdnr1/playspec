# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Review the current branch diff against `{{TARGET_BRANCH}}`, automatically apply only safe and local refactoring opportunities, then verify that the cleanup did not go beyond the intended scope.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- TARGET_BRANCH=`{{TARGET_BRANCH}}`
- SPEC_FILE=`{{SPEC_FILE}}`
- PLAN_FILE=`{{PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`
- PR_FILE=`{{PR_FILE}}`

Source of truth:
- Current branch diff compared against `{{TARGET_BRANCH}}`.
- `{{PLAN_FILE}}`
- `{{RESULT_FILE}}`

Scope rules:
- Compare against `{{TARGET_BRANCH}}`, not stale local assumptions.
- Apply only safe, local, scope-bounded refactors.
- Do not change behavior, public contracts, or workflow scope.
- Do not perform cleanup outside files already implicated by the implementation.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Recheck active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior after cleanup.

Output requirements:
- Apply only safe local refactors when they are clearly justified.
- Run focused verification after refactoring.
- Update `{{RESULT_FILE}}` with what changed, what was intentionally skipped, and why the cleanup stayed in scope.

Approval/gate handling:
- No approval result is required for this step. Complete normally after verification.

{{include:rules/global_rules.md}}
