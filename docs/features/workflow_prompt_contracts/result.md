# Workflow prompt contract implementation

Bundled prompts now state the active role, permitted writes, evidence requirements and completion contract without changing phase IDs, gate thresholds, routing, model configuration or runtime tool APIs. Validation keeps evaluated artifacts/product code read-only while explicitly permitting required report writing. Findings and evidence precede rubric totals/verdicts; unresolved blockers prevent approval. Competing-model framing remains explicitly hypothetical and same-agent reviews must disclose their limitation.

Legacy multi-spec, phase-execution and simple-bug phases have role-specific templates. Review/verification phases record evidence without silently implementing fixes. Common rules limit reading/testing/refactoring to relevant work and distinguish MCP-issued completion arguments from CLI routing examples. No extra permission requirement or ungated approval result is invented.

The developer-only corpus/exporter/grader covers eight artificial review inputs and two valid controls. Candidate exports omit expected answers. Grader tests include false approval/rejection, inconsistent gates, bad arithmetic, missing/duplicate/unknown cases and ungrounded evidence. See `evals/workflow-prompts/README.md` for running independent provider comparisons and limitations.

## Verification

- `npm run build`: passed.
- `npx tsc -p tsconfig.eval.json`: passed.
- Focused contract, eval, lifecycle and gate tests: 87 passed.
- `npm test`: 56 test files, 816 tests passed.
- `npm run eval:workflow-prompts -- export /tmp/playspec-review-inputs-final`: eight real rendered inputs exported without expected annotations; no model inference.
- Compiled MCP stdio smoke: 48 tools, mono-spec validation prompt rendered with report boundary and evidence-first review rules.
- `git diff --check`: passed.

## Review and rollout

Source review checked all seven workflows/33 phase renders, five existing validation gates and numeric legacy IDs. Critical spec readiness, report metadata, schema/rubric/hash requirements and stop conditions remain intact. This is same-agent code/spec review, not independent model evaluation. No unresolved implementation blocker was found; limitations are listed below.

PJ inventory found 92 installed workflow copies across 13 project roots (including independent worktree copies), plus one user-scope installation in that count. Symlink aliases were deduplicated. Preview found 429 conflict-free new/changed assets and 137 baseline conflicts. Every conflicting content matched an exact historical bundled asset (32 distinct contents); no actual customization was found. Matching revisions and explicit selected paths are recorded in the local rollout evidence. After merge, apply through WorkflowUpdater with backups and validate installed prompts; do not run init or directly edit task internals.

## Limits

No external model inference or statistical before/after comparison was performed because no API key was available. Synthetic answers test the grader only. These changes resolve evidenced prompt contradictions; they do not prove a model-quality gain, actual memory erasure, independent same-agent review, or universal compatibility. Ungated legacy/final-review blocker handling remains an instruction rather than a new engine gate. Existing long-running clients should reconnect after main is rebuilt.
