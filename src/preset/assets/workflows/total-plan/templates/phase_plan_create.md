# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Create a risk-reviewed phase implementation plan from the approved total technical specification.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- SOURCE_PROBLEM_FILE=`{{SOURCE_PROBLEM_FILE}}`
- CONTEXT_FILES:
{{CONTEXT_FILES}}
- CONTEXT_REFS_DETAIL:
{{CONTEXT_REFS_DETAIL}}
- TOTAL_SPEC_FILE=`{{TOTAL_SPEC_FILE}}`
- PHASE_PLAN_FILE=`{{PHASE_PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`

Source of truth:
- `{{TOTAL_SPEC_FILE}}`
- Linked source problem and context files when present.
- Current repository code for feasibility checks.

Scope rules:
- Create planning documentation only.
- Do not implement code, create child tasks, or auto-apply proposals.
- Split work into mono-spec-sized implementation phases that can later be run with phase-execution tasks.
- Each phase must have a clear scope, entry points, data/state updates, propagation/callback/event behavior, reset/clear behavior, user-visible outcome, tests, dependencies, and explicit non-goals.
- Preserve downstream compatibility with `{{TOTAL_SPEC_FILE}}` and `{{PHASE_PLAN_FILE}}`.
- When the phase plan references structured artifacts or total-spec vocabularies, reuse literal enum/status/classification/schema/field names from the approved total spec and authoritative artifacts. Do not invent or rename them in the plan.
- If the approved total spec conflicts with a current structured artifact or current code, stop and record the inconsistency as a planning risk instead of silently normalizing it.

Output requirements:
- Update `{{PHASE_PLAN_FILE}}`.
- Include a phase summary table, phase-by-phase implementation plans, dependencies, validation gates, risks, and handoff notes for future phase execution.
- Reference `{{TOTAL_SPEC_FILE}}` as the approved total spec.
- Keep `{{RESULT_FILE}}` untouched unless documenting an unavoidable planning warning.

Approval/gate handling:
- No approval result is required for this step.
- Complete normally after `PHASE_PLAN_FILE` is created or updated.

{{include:rules/global_rules.md}}
