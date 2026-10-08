# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

{{include:rules/evaluation.md}}

Task:
Review the current technical spec for implementation readiness against the requirements and actual repository contracts.

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
- `{{SPEC_FILE}}`
- Linked source problem and context files when present.
- Current repository code.

Write boundary:
- Do not edit the evaluated technical spec, product code or other task artifacts in this phase.
- You may write the required structured validation report at `{{SPEC_VALIDATION_FILE}}` and put the human-readable findings in its summary/evidence or your response. Report writing is required; the reviewed artifact stays read-only.
- Do not implement, create child tasks or silently apply proposed fixes. Proposed fixes do not resolve a blocker until the artifact is patched and reviewed again.

Review checks (apply when relevant):
- Scope fits this workflow; active entry points and integration wiring are identified. Trace changed behavior through validation, state/data update, persistence, propagation, reset/clear and the user-visible outcome. A helper/interface alone is not end-to-end proof.
- Correctness-critical architecture, ownership, lifecycle, API/storage contracts, mutation boundaries, failure handling and dependencies are decided. Legitimate bounded implementation choices are allowed; unresolved safety/correctness decisions are blockers.
- Structured-artifact enum/status/schema/field literals, path conventions, subset filters and stable hash inputs match authoritative files or an explicit migration/mapping. Do not invent parallel vocabularies or mix volatile observations into deterministic fingerprints.
- Tests and acceptance criteria verify changed behavior and failure paths. An unrun command is not a passing test. Existing coverage may suffice when directly relevant; missing verification of critical behavior is a risk/blocker as appropriate.
- Distinguish not-yet-implemented behavior with a clear plan from missing contracts, wiring or evidence. Check old/bypass paths and future-phase leakage; do not demand unrelated redesign, diagrams or generic boilerplate.

Output order:
1. Findings, most severe first. For each material finding: evidence reference, affected contract/behavior, blocker/medium/low classification and smallest patch. Say explicitly when no findings remain.
2. Evidence checked, relevant acceptance/tests and remaining uncertainty. Mark nonapplicable concerns briefly rather than producing empty sections.
3. Rubric dimensions with earned/max points, evidence and deductions; then `Score: X/100` and the calculated total. Score readiness, not effort or confidence.
4. Verdict and unresolved blockers. Approval requires the declared threshold and no blockers; list the minimal remaining artifact patches otherwise. Include a patch-ready ledger only for actual findings.

## Feedback metadata
Put the actual cause classification in the structured report at `{{SPEC_VALIDATION_FILE}}`, not in a prompt snapshot or instructional example. Approval remains 95; feedback signal threshold remains 90 and is computed by the engine.

Required report metadata:
- `cause.category`: exactly one of `artifact_quality_issue`, `authoring_prompt_gap`, `validation_prompt_gap`, `workflow_policy_gap`, or `extractor_or_parser_error`.
- `cause.confidence`: one of `low`, `medium`, or `high`.
- `cause.summary`: a concrete evidence-based explanation; a low artifact score alone does not establish a prompt defect.
- Optional `evolutionTargetPhaseId`: `tech_spec_draft` normally; `tech_spec_validate` only for an evidenced `validation_prompt_gap`.
- Optional `dedupeFieldValues`: stable keys identifying the cause and suggested change when supported by evidence.

The engine reads the completed validation report snapshot. It does not read this prompt to obtain an evaluation score or copy report-supplied approval thresholds.

Approval/gate handling:
- This validation step has an approval gate.
- If the technical spec readiness score is `>= 95/100`, no blockers remain, and the spec is implementation-ready without requiring the code agent to make architecture, storage, API, mutation-boundary, reset/clear, or test-strategy decisions:
  - run `playspec complete --result approved`
  - routes to Step 4. 구현 계획서 생성
- If the technical spec readiness score is below `95/100`, any blocker remains, or implementation would require deciding storage model, API contract, mutation boundary, reset/clear behavior, ownership, lifecycle, or test strategy during coding:
  - run `playspec complete --result needs_revision`
  - routes to Step 3. 기술 명세서 업데이트
- Plain `playspec complete` must not silently choose a route for this gated step.

## Required engine validation report

Write a version-1 YAML or JSON report to `{{SPEC_VALIDATION_FILE}}` before completing this phase. The engine rejects completion without this report, even if you pass `approved`.

Required fields:
- `version: 1`, `taskId: "{{TASK_ID}}"`, `phaseId: "tech_spec_validate"`, and `result` matching the completion result.
- `score`: the numeric sum of earned rubric points; `blockers`: an array of unresolved blockers (empty only when none remain); `summary`: the evidence-based verdict.
- Required rubric names and maxima: `correctness`=30, `contracts`=25, `failure_handling`=20, `testability`=15, `scope`=10.
- `dimensions`: one entry per scoring dimension, each with `name`, numeric `earned` and `max`, nonempty `evidence` references, and `deductions` explaining lost points. Maxima must total 100 and earned points must equal score.
- `artifacts`: exactly the evaluated files listed below, each with its workspace-relative `path` and SHA-256 `sha256` of the current file bytes:
  - `{{SPEC_FILE}}`

For approval, score must be at least 95 and blockers must be empty. Recompute hashes and rewrite the report after any artifact changes; prior reports do not approve a changed file. Keep human-readable findings as well. Report schema and a complete example: `docs/validation-reports.md`.

{{include:rules/global_rules.md}}
