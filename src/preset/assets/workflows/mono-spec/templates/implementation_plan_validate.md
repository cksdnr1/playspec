# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Validate whether the implementation plan is correct, scoped, code-anchored, non-overengineered, and safe to execute.

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
- Validate the plan against actual code and the approved spec.
- Check whether the plan is over-engineered, underspecified, or missing active-path wiring.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Judge planned behavior from active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.
- Explicitly identify old paths, bypass paths, partial migrations, hidden coupling, ownership/lifetime problems, callback propagation gaps, and reset/clear asymmetry.

Output requirements:
- Update the validation/risk ledger in `{{PLAN_FILE}}`.
- Include markdown validation/risk output with `Score: X/100`.
- List blockers, medium risks, low risks, and recommended minimal patches to the plan.
- Separately list unresolved blockers after considering valid proposed fixes.
- State the exact result to pass to completion:
  - Use `playspec complete --result approved` only when the readiness score is `>= 95/100` and no blockers remain.
  - Use `playspec complete --result needs_revision` when the readiness score is below `95/100` or unresolved blockers remain.

Approval/gate handling:
- This implementation plan validation step has an approval gate.
- If the implementation plan readiness score is `>= 95/100` and no blockers remain:
  - run `playspec complete --result approved`
  - routes to Step 7. 기술 구현
- If the implementation plan readiness score is below `95/100` or unresolved blockers remain:
  - run `playspec complete --result needs_revision`
  - routes to Step 6. 구현 계획서 업데이트
- Plain `playspec complete` must not silently choose a route for this gated step.

{{include:rules/global_rules.md}}
