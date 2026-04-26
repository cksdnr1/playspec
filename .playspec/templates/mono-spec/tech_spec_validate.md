# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Validate the technical spec using strict code-level and end-to-end criteria.

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
- SPEC_FILE=`{{SPEC_FILE}}`
- PLAN_FILE=`{{PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`
- PR_FILE=`{{PR_FILE}}`

Source of truth:
- Current repository code.
- `{{SPEC_FILE}}`
- Linked source problem file when present: `{{SOURCE_PROBLEM_FILE}}`

Scope rules:
- Validate the spec, not the implementation plan.
- Keep findings code-anchored and practical.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Judge end-to-end from active entry point -> state/data update -> propagation/callback/event -> reset/clear -> final user-visible behavior.
- Identify old paths, bypass paths, alternate active paths, partial migrations, hidden coupling, ownership/lifetime risks, callback propagation gaps, reset/clear asymmetry, and state conflicts.
- Check whether the design is over-engineered or hard to maintain.
- If a proposed fix is valid, downgrade that issue from blocker and rejudge.
- Separately list only unresolved blockers that remain after considering proposed fixes.
- Recommend handling for Inferred items and Open Questions.

Output requirements:
- Update the validation/risk ledger in `{{SPEC_FILE}}`.
Use exactly these top-level sections:
- 해결 가능한 이슈
- 아직 남는 blocker
- medium risk
- low risk
- Inferred and Open Question Solution
- 최종 판정

Approval/gate handling:
- No approval result is required for this validation step.
- The next patch step will route with `playspec complete --result approved` or `playspec complete --result needs_revision`.

{{include:rules/global_rules.md}}
