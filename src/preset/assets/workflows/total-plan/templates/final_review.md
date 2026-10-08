# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

{{include:rules/evaluation.md}}

Task:
Perform the final planning review before downstream phase-execution work begins.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- TOTAL_SPEC_FILE=`{{TOTAL_SPEC_FILE}}`
- PHASE_PLAN_FILE=`{{PHASE_PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`

Source of truth:
- `{{TOTAL_SPEC_FILE}}`
- `{{PHASE_PLAN_FILE}}`
- Current repository code for spot checks.

Scope rules:
- Review planning artifacts only.
- Do not implement code.
- Do not create phase execution tasks.
- Do not route into implementation, tests, refactor, PR preparation, migration, viewer, archive, rollback, or MCP work.
- Confirm that downstream phase-execution creation can rely on `{{TOTAL_SPEC_FILE}}` and `{{PHASE_PLAN_FILE}}`.

Output requirements:
- Update `{{RESULT_FILE}}` with a final planning review note.
- Include files reviewed, compatibility conclusion, remaining warnings, and either "ready for phase execution" or a concise blocker list.
- Keep documentation readable and scoped to planning readiness.

Approval/gate handling:
- No approval result is required for this step.
- Complete normally only when the planning artifacts are ready for phase execution and no unresolved blockers remain. If blocked, write the blocker list to `RESULT_FILE`, report the required correction and do not complete. This phase has no result gate; do not invent an approval result.

{{include:rules/global_rules.md}}
