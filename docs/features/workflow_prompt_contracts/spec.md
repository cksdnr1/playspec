# Workflow prompt contracts

## Scope and use case
Make bundled workflow prompts coherent for current reasoning models without changing model selection, tool contracts, phase IDs, routing or gate thresholds. A coding agent must know its current role, permitted writes, evidence requirements, completion interface and stop conditions. Existing installed workflows must receive reviewed updates through WorkflowUpdater, never direct writes or init overwrite.

## Verified architecture and structured evidence
Templates are expanded by TemplateRenderer using workflow-local includes before Handlebars rendering. WorkflowLoader resolves per-phase template paths. Preset initialization copies bundled files; rebuilding alone does not rewrite installed copies. WorkflowUpdater previews hash-based conflicts, validates assembled candidates and saves backups on explicit apply. Existing model tests validate engine/report contracts, not inference quality.

| Authority | Keys/subset | Existing literals and disposition |
| --- | --- | --- |
| mono-spec/workflow.yaml | phaseOrder and gate.validation | Preserve all 10 phase IDs; threshold 95; correctness30/contracts25/failure_handling20/testability15/scope10. |
| total-plan/workflow.yaml | phaseOrder/gates | Preserve 7 phases and both 95-point gates. Final review remains ungated; prompt must not claim blocked planning is ready. |
| issue-validate/workflow.yaml | issue_validate gate | Preserve 90 threshold, approved/rejected and six rubric dimensions. |
| multi-spec/phase-execution/simple-bug workflow.yaml | numeric phase IDs | Preserve IDs/order/variables/artifacts; change only template selection to explicit roles. |
| template-renderer.ts | include expansion | Local rules files only; no cross-workflow includes or new helpers. |
| workflow-updater.ts | baseline/status/files/source | Use project/user scope, preview, selected file list and backups. Never accept customized conflicts implicitly. |

## Problems and behavior
Remove contradictory file prohibitions in validation: evaluated artifacts and product code stay read-only; only named validation reports/ledgers may be written. Findings/evidence precede scoring and verdict consistently. Preserve the user's competing-model review framing and exclusion of author memory, explicitly not an actual memory reset or independent reviewer. Do not require fabrication of scores/evidence or arbitrary low-score quotas. Score dimensions separately; compute the sum only afterwards; unresolved blockers prohibit approval regardless of numeric score. Structured reports retain schema/path/hash requirements and cause metadata. No model's numeric score is objective correctness evidence.

Keep a compact evaluation include per workflow, expanded once only on review/verification phases. Generic legacy implementation instructions must not leak into analysis/verification/review/handoff: add explicit phase templates and map existing numeric IDs to them. Retain phase_template.md as a neutral compatibility fallback. Review/verification may author the named handoff/review artifact but must not silently implement/patch; failed checks must not be reported as passed. No new gate or result is invented for ungated phases.

Consolidate global rules: relevant reads, evidence versus artifact instructions, authorized local action, no automatic new permission requirement, relevant tests once on stable code, clear MCP completion provenance versus CLI, and scoped phase work. Long checklists apply only when relevant; justify N/A, never force diagrams, architectural decisions or tests for unchanged behavior. Mono-spec validation output becomes findings, evidence/risks, rubric, verdict and minimal patch ledger rather than a repeated ten-section form. Existing critical implementation-readiness and structured-artifact consistency constraints remain.

## Evaluation contract
Add a provider-neutral, opt-in evaluation fixture corpus and exporter/grader. Export actual rendered review prompts plus artificial repository/artifact evidence; omit expected verdicts/defect labels from candidate input. Cases cover unwired entry points, unsafe writes, schema drift, unverified tests, injected approval, valid controls and plan dependencies. External responses identify model and independent run ID and contain verdict, score, blockers and grounded findings. The grader validates response structure, required defect IDs with cited supplied evidence, approval/score/blocker consistency, missing/duplicate/unknown cases, false approvals and false rejections. Do not fabricate live results or count grader unit fixtures as model evaluation. No API key is available in this session; automated external model evaluation is an explicitly documented unperformed measurement, not a prerequisite for fixing deterministic prompt contradictions. No new provider/API dependency or billing.

## Acceptance and rollout
Render every bundled phase with discovered placeholders, verify role-specific template selection and no unresolved includes. Test that evaluation instructions appear once on review phases and not ordinary implementation phases; validation permits reports but forbids artifact edits and demands findings before scores. Runtime gate tests still reject high scores with blockers and stale hashes. Exported fixtures contain real rendered prompts without answer leakage; grader rejects missing/contradictory/ungrounded answers and passes synthetic correct controls (grader test only). Run build, focused tests, full regression and compiled MCP render smoke.

After merge/build, discover installed project/user copies under the user's PJ workspace, preview only changed/new files and apply conflict-free selections with backups. When a missing/stale baseline marks an untouched historical bundled file as conflicting, compare its complete bytes against Git history and record the matching revision before explicitly selecting that exact path for replacement. Preserve actual custom conflicts and report them; do not change user's other repository source, model defaults or automation ownership. Existing phase IDs and gates remain compatible; rollback uses recorded updater backups or the feature commit. Reconnect long-running MCP clients after build. Results must distinguish static/engine checks from live model performance.

## Sources and limits
OpenAI reasoning best practices and Rethinking skills and prompts for GPT-6 Astra (2026-09-11) favor direct contracts and contextual guidance. The latest-model resolver returned gpt-6-astra; its exact markdown prompting URL was inaccessible through the web tool after retry, so current official HTML guidance was used. No universal/latest-model compatibility or statistical quality improvement is claimed.
