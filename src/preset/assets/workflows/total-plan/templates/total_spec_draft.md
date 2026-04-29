# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Create or update the total technical specification for a large feature before it is split into phase execution tasks.

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
- Start from the linked source problem file when present, the task title, and current repository code.
- If `SOURCE_PROBLEM_FILE` is `(not provided)` and context is `(none)`, start from `TASK_TITLE` and the current repository code, and explicitly note that no source problem was provided.
- Treat existing docs as context, not proof of implemented behavior.

Scope rules:
- First align the intended user-facing use case and final planning outputs.
- Summarize the current implementation at a high level before deep code reading.
- Use minimal relevant file discovery before reading broadly.
- Do not create implementation code or phase execution tasks.
- Do not implement future phases.
- Separate verified code behavior, inferred behavior, and open questions.
- Verify active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior before claiming behavior exists.
- Explicitly identify old paths, bypass paths, alternate active paths, and partial migrations.

Output requirements:
- Update `{{TOTAL_SPEC_FILE}}` with the total technical specification.
- The spec must be reader-friendly and include Scope, Use Case Alignment, Main and Alternative Scenarios, Current Implementation Summary, Relevant Files Reviewed, Active Entry Points and Bypasses, Current Architecture, Verified Behavior and Constraints, Problems, Proposed Direction, File-By-File Plan, Risks and Open Questions, and Reader Aids.
- Mention that `{{PHASE_PLAN_FILE}}` is the downstream phase plan output, but do not create it in this step.
- Use diagrams only when they improve understanding, and label proposed flow separately from verified flow.

Approval/gate handling:
- No approval result is required for this step.
- Complete normally after `TOTAL_SPEC_FILE` is updated.

{{include:rules/global_rules.md}}
