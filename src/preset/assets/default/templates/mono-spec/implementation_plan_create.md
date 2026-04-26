# 4. 구현 계획서 생성 — {{TASK_TITLE}}

Task:
Create a repository-specific, code-anchored implementation plan from the existing spec, phase plan, handoff, and actual code.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- MASTER_SPEC_FILE=`{{MASTER_SPEC_FILE}}`
- MASTER_PHASE_FILE=`{{MASTER_PHASE_FILE}}`
- PHASE_SPEC_FILE=`{{PHASE_SPEC_FILE}}`
- PHASE_HANDOFF_FILE=`{{PHASE_HANDOFF_FILE}}`
- IMPLEMENTATION_PLAN_FILE=`{{IMPLEMENTATION_PLAN_FILE}}`

Source of truth:
- `{{PHASE_SPEC_FILE}}`
- `{{PHASE_HANDOFF_FILE}}`
- `{{MASTER_SPEC_FILE}}`
- `{{MASTER_PHASE_FILE}}`
- Current repository code.

Scope rules:
- Plan only the implementation needed for the approved spec.
- Keep the plan code-anchored, minimal, and maintainable.
- Do not introduce framework-like abstractions unless the current codebase already points there.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- For every planned behavior, trace active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.

Output requirements:
- Write or update `{{IMPLEMENTATION_PLAN_FILE}}`.
- Include ordered implementation steps, files to edit, tests to add/update, risks, rollback notes, and completion criteria.
- Identify old paths, bypass paths, and partial migration risks the implementation must close.

Approval/gate handling:
- No approval result is required for this step. Complete normally when the plan is written.

{{include:rules/global_rules.md}}
