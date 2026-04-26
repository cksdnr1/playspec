# 10. PR 준비 — {{TASK_TITLE}}

Task:
Draft a reviewer-friendly PR message, update phase completion docs, decide whether reusable agent guidance should be documented, push the branch, create a PR, then return to master.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- TARGET_BRANCH=`{{TARGET_BRANCH}}`
- IMPLEMENTATION_PLAN_FILE=`{{IMPLEMENTATION_PLAN_FILE}}`
- IMPLEMENTATION_RESULT_FILE=`{{IMPLEMENTATION_RESULT_FILE}}`
- TEST_RESULT_FILE=`{{TEST_RESULT_FILE}}`
- PR_BODY_FILE=`{{PR_BODY_FILE}}`

Source of truth:
- Current branch diff compared against `{{TARGET_BRANCH}}`.
- `{{IMPLEMENTATION_PLAN_FILE}}`
- `{{IMPLEMENTATION_RESULT_FILE}}`
- `{{TEST_RESULT_FILE}}`

Scope rules:
- Compare against `{{TARGET_BRANCH}}`, not stale local assumptions.
- Keep PR text reviewer-friendly and code-anchored.
- Do not hide unresolved risks or skipped tests.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Confirm the PR summary reflects active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.

Output requirements:
- Write `{{PR_BODY_FILE}}`.
- Update phase completion docs if needed.
- State whether reusable agent guidance should be documented.
- Push the branch, create the PR, then return to master.
- Include commands run, PR link, and any limitations.

Approval/gate handling:
- No approval result is required for this final step. Complete normally when PR preparation is done.

{{include:rules/global_rules.md}}
