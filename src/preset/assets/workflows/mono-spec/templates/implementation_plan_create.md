# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Create a repository-specific, code-anchored implementation plan from the existing spec and actual code.

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
- `{{SPEC_FILE}}`
- Current repository code.

Scope rules:
- Plan only the implementation needed for the approved spec.
- Keep the plan code-anchored, minimal, and maintainable.
- Do not introduce framework-like abstractions unless the current codebase already points there.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- For every planned behavior, trace active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.
- When the plan references structured artifacts or spec-defined vocabularies, reuse literal enum/status/classification/schema/field names from the approved spec and authoritative artifacts. Do not invent or rename them in the plan.
- If the approved spec conflicts with a current structured artifact or current code, stop and record the inconsistency as a planning risk instead of silently normalizing it.

Output requirements:
- Write or update `{{PLAN_FILE}}`.
- Include ordered implementation steps, files to edit, tests to add/update, risks, rollback notes, and completion criteria.
- Identify old paths, bypass paths, and partial migration risks the implementation must close.

Approval/gate handling:
- No approval result is required for this step. Complete normally when the plan is written.

{{include:rules/global_rules.md}}
