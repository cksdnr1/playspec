# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Draft a reviewer-friendly PR message, update phase completion docs, decide whether reusable agent guidance should be documented, push the branch, create a PR, then return to master.

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
- `{{SPEC_FILE}}`
- `{{PLAN_FILE}}`
- `{{RESULT_FILE}}`

Scope rules:
- Compare against `{{TARGET_BRANCH}}`, not stale local assumptions.
- Keep PR text reviewer-friendly and code-anchored.
- Do not hide unresolved risks or skipped tests.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Do not write a summary-only PR body.
- Make the motivation, problem, fix, validation, and residual risk clear enough that a reviewer can understand the PR at a glance.
- Confirm the implementation summary reflects active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.
- If the diff does not support one of those chain links, call that out in risks/limitations instead of implying it is complete.

Output requirements:
- Write `{{PR_FILE}}` as the PR body source.
- Use this PR body structure:
  - Summary: 2-4 bullets with the concrete user-visible or reviewer-visible outcome.
  - Why this PR: what triggered the work, the failing behavior or workflow gap, and why it matters now.
  - Problem: the specific broken, missing, confusing, or risky behavior before this change.
  - How it was fixed: code-anchored bullets naming the main files/functions and the behavioral path changed.
  - Validation: exact commands run and their pass/fail result; include skipped or unavailable checks.
  - Risks / follow-ups: unresolved risks, intentional non-goals, rollout notes, or `None`.
- Update `{{RESULT_FILE}}` with final implementation notes, commands run, PR link, and any limitations.
- State whether reusable agent guidance should be documented.
- Push the branch, create the PR, then return to master.

Approval/gate handling:
- No approval result is required for this final step. Complete normally when PR preparation is done.

{{include:rules/global_rules.md}}
