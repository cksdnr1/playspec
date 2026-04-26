# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Review only the minimal directly related files needed to verify already-identified risks, then strengthen the existing spec and handoff for `{{FEATURE_SLUG}}` with a finalized risk ledger as a minimal in-place patch set.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- MASTER_SPEC_FILE=`{{MASTER_SPEC_FILE}}`
- MASTER_PHASE_FILE=`{{MASTER_PHASE_FILE}}`
- PHASE_SPEC_FILE=`{{PHASE_SPEC_FILE}}`
- PHASE_HANDOFF_FILE=`{{PHASE_HANDOFF_FILE}}`

Source of truth:
- `{{PHASE_SPEC_FILE}}`
- `{{PHASE_HANDOFF_FILE}}`
- Latest technical validation output.
- Current repository code for directly related verification only.

Scope rules:
- Patch existing docs in place; do not rewrite the spec from scratch.
- Keep the risk ledger minimal, code-level, and actionable.
- Do not add future phases or broad architecture.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Verify active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior before marking a path complete.

Output requirements:
- Update `{{PHASE_SPEC_FILE}}`.
- Update `{{PHASE_HANDOFF_FILE}}`.
- Record which validation issues were resolved, downgraded, or remain blockers.
- Keep markdown readable for the implementation planner.

Approval/gate handling:
- After this step, complete with one explicit result:
- `playspec complete --result approved` routes to implementation plan creation.
- `playspec complete --result needs_revision` routes back to technical spec cross-validation.

{{include:rules/global_rules.md}}
