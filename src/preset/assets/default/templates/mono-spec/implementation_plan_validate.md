# 5. 구현 계획서 교차 검증 — {{TASK_TITLE}}

Task:
Validate whether the implementation plan is correct, scoped, code-anchored, non-overengineered, and safe to execute.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- MASTER_SPEC_FILE=`{{MASTER_SPEC_FILE}}`
- MASTER_PHASE_FILE=`{{MASTER_PHASE_FILE}}`
- PHASE_SPEC_FILE=`{{PHASE_SPEC_FILE}}`
- PHASE_HANDOFF_FILE=`{{PHASE_HANDOFF_FILE}}`
- IMPLEMENTATION_PLAN_FILE=`{{IMPLEMENTATION_PLAN_FILE}}`

Source of truth:
- `{{IMPLEMENTATION_PLAN_FILE}}`
- `{{PHASE_SPEC_FILE}}`
- `{{PHASE_HANDOFF_FILE}}`
- Current repository code.

Scope rules:
- Validate the plan against actual code and the approved spec.
- Check whether the plan is over-engineered, underspecified, or missing active-path wiring.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Judge planned behavior from active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.
- Explicitly identify old paths, bypass paths, partial migrations, hidden coupling, ownership/lifetime problems, callback propagation gaps, and reset/clear asymmetry.

Output requirements:
- List blockers, medium risks, low risks, and recommended minimal patches to the plan.
- Separately list unresolved blockers after considering valid proposed fixes.
- State whether the next update step should be completed as `approved` or `needs_revision`.

Approval/gate handling:
- No approval result is required for this validation step.
- The next plan update step will route with `playspec complete --result approved` or `playspec complete --result needs_revision`.

{{include:rules/global_rules.md}}
