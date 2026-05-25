# Phase Validation Feedback To Prompt Evolution Signals Phase Plan

Approved total spec: `docs/features/phase_validation_feedback_evolves_workflow_guidance/phase_validation_feedback_evolves_workflow_guidance_total_spec.md`.

This document is planning-only. It does not implement code, create child tasks, apply proposals, or mutate workflow assets.

## Phase Summary

| Phase | Name | Outcome | Depends on |
| --- | --- | --- | --- |
| 1 | Feedback Config Schema | Workflow phases can opt into score-based prompt evolution feedback without changing existing phases | none |
| 2 | Feedback Thread Schema And Store | Repeated validation feedback updates one canonical thread per prompt evolution signal | 1 |
| 3 | Prompt Snapshot, Dedupe, And Compact History | Threads point to prompt/template versions and accumulate bounded compact history without creating noisy files per run | 2 |
| 4 | Machine-Readable Extraction | Configured validation artifacts produce stable feedback metadata before fallback markdown parsing | 3 |
| 5 | Completion Integration | Shared phase completion captures feedback consistently for CLI and MCP callers with explicit failure policy | 4 |
| 6 | Thread-Based Proposal Evidence Attachment | Mature feedback threads can attach evidence to explicit pending/refining proposals without auto-applying changes | 5 |
| 7 | Mono-Spec Opt-In | `mono-spec` spec and plan validation phases emit 90-threshold prompt evolution signals | 6 |
| 8 | Tests And Docs | Regression coverage and user-facing docs lock the architecture | 7 |

## Validation Gates

- Existing approval gates stay unchanged unless a workflow explicitly changes them.
- Feedback threshold defaults to `90`.
- `score >= feedbackThreshold` records positive feedback.
- `score < feedbackThreshold` records negative feedback.
- Feedback capture must be optional per phase.
- Feedback capture failure policy must be explicit per phase: `fail_completion`, `warn_and_continue`, or `record_failure`.
- Feedback threads must be the canonical ongoing progress points for repeated prompt evolution signals.
- Stored thread events must separate source validation phase, evaluated artifact phase, and evolution target phase.
- Stored thread events must preserve approval result and feedback result as separate decisions.
- Proposal updates must only affect pending/refining proposals.
- Proposal evidence attachment is explicit-only in the first implementation.
- Proposal generation and attachment must use feedback threads, not individual raw observations.
- No proposal apply should happen during phase completion.
- Feedback must remain reviewable thread evidence until proposal review, apply, and post-apply validation have run.
- Workflows without feedback config must behave byte-for-byte the same from a user perspective.

## Phase 1: Feedback Config Schema

Goal:
Add typed workflow metadata that lets any phase describe whether and how validation feedback should be captured.

Entry points:

- `src/core/schemas.ts#PhaseDefinitionSchema`
- `src/core/types.ts`
- `src/workflow/workflow-loader.ts`

Planned data shape:

```yaml
feedback:
  enabled: true
  kind: prompt_evolution_signal
  feedbackThreshold: 90
  thresholdMode: greater_or_equal
  required: true
  onFailure: fail_completion
  sourcePhaseId: tech_spec_validate
  evaluatedArtifactPhaseId: tech_spec_draft
  evolutionTargetPhaseId: tech_spec_draft
  scoreSource:
    artifactRole: validation_report
    preferredBlock: playspecFeedback
    markdownFallback: true
  approval:
    threshold: 95
    resultSource: completion_result
  causeClassification:
    required: true
    allowed:
      - artifact_quality_issue
      - authoring_prompt_gap
      - validation_prompt_gap
      - workflow_policy_gap
      - extractor_or_parser_error
  targetPromptSnapshot:
    required: true
    hashAlgorithm: sha256
  dedupe:
    enabled: true
    fields:
      - workflowId
      - evolutionTargetPhaseId
      - targetType
      - targetGuidanceSection
      - causeCategory
      - suspectedCause
      - suggestedChangeFingerprint
  evolution:
    mode: thread_only
    storageMode: thread_with_compact_history
    targetFiles:
      - .playspec/workflows/mono-spec/templates/tech_spec_draft.md
  workflowSource:
    kind: project_local
    root: .playspec/workflows/mono-spec
    rootPathKind: workspace_relative
  targetPromptTemplate:
    path: .playspec/workflows/mono-spec/templates/tech_spec_draft.md
    pathKind: workspace_relative
    writable: true
  compactHistoryPolicy:
    maxEntries: 20
    keepFirst: true
    keepLatest: 10
    summarizeOverflow: true
  proposalReadinessPolicy:
    mode: manual_only_initial
    minRunCount: 3
    minNegativeCount: 2
    minConfidence: medium
    requireHumanReviewBeforeProposal: true
```

Implementation notes:

- Keep the field optional.
- Validate threshold as `0..100`.
- Validate source/evaluated/target phase IDs as strings at schema load time and resolve them against the workflow definition during workflow validation.
- Validate target files as workspace-relative paths later during capture, not at workflow load time, so builtin workflows remain portable.
- Do not require all phases to have feedback metadata.
- Do not infer `evolutionTargetPhaseId` from `sourcePhaseId`; validation phases often target authoring phases.
- Default storage mode for automation should be `thread_with_compact_history`, not one file per validation run.
- Dedupe keys must be stable meaning-based keys and must not include target prompt/template snapshot hashes.
- Compact history must be bounded by policy.
- Initial proposal readiness must be manual, even when the thread meets suggested maturity counts.
- Feedback thread storage path must always be workspace-local under `.playspec/evolution/feedback`.
- Workflow source metadata must be separate from feedback storage and must identify project-local, user-global, bundled-preset, or external sources.
- Target prompt path kind and writability must be captured for proposal safety.

Tests:

- Workflow with feedback config loads.
- Workflow without feedback config still loads.
- Invalid threshold or invalid feedback kind fails schema validation.
- Invalid failure policy fails schema validation.
- Invalid storage mode fails schema validation.
- Invalid compact history policy fails schema validation.
- Invalid proposal readiness policy fails schema validation.
- Invalid workflow source kind or path kind fails schema validation.
- Config can represent `sourcePhaseId: tech_spec_validate`, `evaluatedArtifactPhaseId: tech_spec_draft`, and `evolutionTargetPhaseId: tech_spec_draft` as separate values.
- Required variable resolution remains unchanged.

Non-goals:

- No score parsing in this phase.
- No evolution writes in this phase.

## Phase 2: Feedback Thread Schema And Store

Goal:
Persist prompt evolution signal threads as the canonical ongoing progress points that can be reviewed independently from proposals.

Entry points:

- `src/evolution/schemas.ts`
- `src/evolution/types.ts`
- `src/utils/paths.ts`
- New `src/evolution/feedback-thread-store.ts`

Thread fields:

- `id`
- `dedupeKey`
- `status`: `open`, `ready_for_proposal`, `attached`, `resolved`, `ignored`
- `workflowId`
- `createdAt`
- `updatedAt`
- `target.workflowId`
- `target.workflowSource.kind`
- `target.workflowSource.root`
- `target.workflowSource.rootPathKind`
- `target.workflowSource.packageName`
- `target.workflowSource.presetId`
- `target.workflowSource.version`
- `target.targetPhaseId`
- `target.targetType`
- `target.targetPromptTemplate.path`
- `target.targetPromptTemplate.pathKind`
- `target.targetPromptTemplate.writable`
- `target.targetGuidanceSection`
- `target.targetPromptSnapshot`
- `target.promptSnapshotHistory[]`
- `revalidation.required`
- `revalidation.reason`
- `classificationTrend.positiveCount`
- `classificationTrend.negativeCount`
- `classificationTrend.latestClassification`
- `classificationTrend.latestSuspectedCause`
- `classificationTrend.state`: `only_positive`, `mostly_positive`, `mixed`, `mostly_negative`, or `only_negative`
- `classificationTrend.trendInterpretation`
- `evidence.firstSeenAt`
- `evidence.lastSeenAt`
- `evidence.runCount`
- `evidence.latestScore`
- `evidence.scoreRange`
- `evidence.compactHistoryPolicy`
- `evidence.compactHistory[]`
- `summary.currentFinding`
- `summary.suggestedGuidanceChange`
- `summary.confidence`
- `proposal.proposalId`
- `proposal.proposalStatus`
- `proposal.readyForProposal`
- `proposal.mutationStrategy.directMutationAllowed`
- `proposal.mutationStrategy.recommendedTarget`
- `proposal.readinessPolicy`

Compact history entry fields:

- `taskId`
- `sourcePhaseId`
- `evaluatedArtifactPhaseId`
- `evolutionTargetPhaseId`
- `targetType`
- `workflowSource`
- `sourceArtifactPath`
- `score.value`
- `score.approvalResult`
- `score.feedbackResult`
- `feedback.summary`
- `feedback.causes[].suspectedCause`
- `timestamp`

Optional raw event fields:

- `id`
- `threadId`
- `taskId`
- `workflowId`
- `sourcePhaseId`
- `evaluatedArtifactPhaseId`
- `evolutionTargetPhaseId`
- `score`
- `feedback`
- `promptEvolution`
- `evolutionTarget.targetPromptSnapshot`
- `promptEvolution.previousGuidanceWeakness[]`
- `promptEvolution.previousGuidanceStrength[]`
- `promptEvolution.suggestedGuidanceChange[]`
- `promptEvolution.confidence`
- `dedupe.key`
- `dedupe.fingerprintFields`
- `status`: `merged_into_thread`, `audit_recorded`, `capture_failed`

Storage:

- `.playspec/evolution/feedback/threads/{threadId}.yaml`
- `.playspec/evolution/feedback/index.yaml`
- `.playspec/evolution/feedback/observations/{taskId}/{phaseId}-{timestamp}.yaml` only when `storageMode: thread_with_audit_observations`

Tests:

- Store writes and reloads a valid thread.
- Store updates an existing thread by thread ID without creating a new file.
- Store writes feedback threads only under workspace-local `.playspec/evolution/feedback`.
- Absolute paths and workspace escapes are rejected.
- Missing source artifact refs fail only when the schema/store requires concrete evidence.
- Compact history records survive multiple validations for the same thread.
- Thread events preserve approval result and feedback result separately.
- Thread events can classify suspected cause as artifact, authoring prompt, validation prompt, workflow policy, or extractor/parser error.
- Thread classification trend state is computed and preserved.
- Thread proposal readiness policy is stored and does not auto-promote by default.
- Thread records workflow source kind, target path kind, target path, and target writability.

Non-goals:

- No proposal matching.
- No prompt surfacing changes.
- No raw observation file per run by default.

## Phase 3: Prompt Snapshot, Dedupe, And Compact History

Goal:
Record which prompt/template/rule version each feedback signal refers to, and update one thread per repeated automation signal before proposal generation.

Entry points:

- New `src/evolution/prompt-snapshot.ts`
- New `src/evolution/feedback-thread-updater.ts`
- New `src/evolution/workflow-source-resolver.ts`
- `src/utils/paths.ts`

Rules:

- Hash every configured `targetPromptTemplate` at capture time.
- Store hash algorithm, hash value, workspace-relative path, and workflow version when available.
- Resolve the active workflow source at capture time and record whether the target template is project-local, user-global, bundled preset, or external.
- Record target path kind and writability separately from feedback storage path.
- Build a stable dedupe key from workflow ID, evolution target phase ID, target type, target guidance section, cause category, suspected cause, and suggested change fingerprint.
- Do not include target prompt/template snapshot hash in the dedupe key. Store prompt hashes in thread evidence and prompt snapshot history instead.
- Resolve the dedupe key to a feedback thread ID.
- If an open thread already has the same dedupe key, update that thread in place: counts, latest score, score range, last seen time, current finding, suggested guidance change, and compact history.
- If no open thread exists, create one thread.
- Dedupe must still resolve to the same semantic thread when the prompt hash changes, because the hash is not part of the dedupe key. The updater must record the new prompt snapshot in thread evidence and mark the thread `revalidationRequired` when prior conclusions may be stale.
- Compact history must be bounded by a configurable max entry count or size. Older entries may be summarized into counters and retained score ranges.
- Preserve first evidence and latest evidence when compact history overflows.
- Maintain `classificationTrend.state` so mixed positive/negative runs are visible.
- Initial implementation must keep `proposal.readyForProposal` manually controlled. Suggested maturity fields may be stored but must not auto-create proposals.

Tests:

- Hashes target prompt templates.
- Rejects missing required target prompt snapshots when config requires them.
- Resolves project-local, user-global, bundled preset, and external workflow source metadata.
- Records bundled preset and read-only targets as non-writable.
- Creates stable dedupe keys.
- Updates one thread for repeated events with the same key and same prompt hash.
- Updates the same semantic thread when target prompt hash changes but records the new hash in snapshot history.
- Marks the thread for revalidation when prompt hash changes and prior conclusions may be stale.
- Enforces compact history bounds.
- Preserves first and latest compact history entries when summarizing overflow.
- Computes `classificationTrend.state` for only-positive, mostly-positive, mixed, mostly-negative, and only-negative histories.
- Does not auto-set `readyForProposal` in the initial implementation.

Non-goals:

- No proposal generation.
- No prompt mutation.

## Phase 4: Machine-Readable Extraction

Goal:
Read the configured validation artifact and extract stable score, cause, and prompt evolution signal fields without relying on broad ad hoc parsing.

Entry points:

- New `src/evolution/validation-feedback-extractor.ts`
- Existing review/snapshot paths from `PlaySpecCore.completePhase`

Rules:

- Require a `playspecFeedback` machine-readable block for phases with `required: true`.
- Prefer structured metadata when present.
- Fall back to configured regex only for optional or compatibility phases.
- Clamp impossible scores by rejecting them, not by coercing.
- Extract cause classification, prior guidance weakness/strength, suggested guidance changes, and confidence from metadata.
- Preserve source excerpt references without copying large markdown into YAML.
- Mark fallback extraction as low confidence and record extractor mode.

Recommended validation template addition:

```yaml
playspecFeedback:
  schemaVersion: 1
  sourcePhaseId: tech_spec_validate
  evaluatedArtifactPhaseId: tech_spec_draft
  evolutionTargetPhaseId: tech_spec_draft
  score: 88
  maxScore: 100
  approvalThreshold: 95
  approvalResult: failed
  feedbackThreshold: 90
  feedbackResult: missed
  classification: negative
  causes:
    - category: acceptance_criteria
      severity: high
      suspectedCause: authoring_prompt_gap
      summary: "Criteria are not testable enough."
  promptEvolution:
    targetType: prompt_template
    workflowSource:
      kind: project_local
      root: .playspec/workflows/mono-spec
      rootPathKind: workspace_relative
    targetGuidanceSection: acceptance_criteria
    previousGuidanceWeakness:
      - "The prompt did not require observable pass/fail criteria."
    suggestedGuidanceChange:
      - "Require each acceptance criterion to name observable evidence."
    confidence: medium
```

Tests:

- Extracts `Score: 92/100`.
- Extracts stable feedback metadata when present.
- Rejects `Score: 190/100`.
- Handles no-score artifact according to config policy.
- Does not parse unrelated numbers as scores when metadata is present.
- Rejects required feedback when the machine-readable block is missing.
- Preserves separate source, evaluated, and target phase IDs.
- Extracts target type into the event so event-to-thread conversion is stable.
- Extracts or resolves workflow source metadata and target writability.
- Records fallback extraction confidence as low.

Non-goals:

- No LLM summarization.
- No automatic rewrite of old validation files.

## Phase 5: Completion Integration

Goal:
Run feedback capture from the shared completion path so CLI and MCP completion use the same behavior and required capture failures cannot disappear silently.

Entry points:

- `src/core/playspec-core.ts#completePhase`
- `src/cli/commands/complete.ts`
- MCP complete-phase tool path if it already delegates to core

Execution order:

1. Resolve phase and validate routing.
2. Write prompt snapshots and git evidence.
3. Write review artifact if enabled.
4. If feedback config is enabled, extract feedback event data and update the matching feedback thread.
5. Apply failure policy:
   - `fail_completion`: stop before task phase completion when capture fails.
   - `warn_and_continue`: complete the phase and print/store a warning.
   - `record_failure`: update or create a `capture_failed` thread event and complete the phase.
6. Complete task phase and ledger with feedback thread references.
7. Render the next prompt as today.

The implementation may choose to place feedback capture immediately after task completion if that better matches current transaction boundaries, but the completion ledger should expose feedback refs once available.

Tests:

- Completion without feedback config remains unchanged.
- Completion with feedback config creates or updates one feedback thread.
- Repeated completion for the same dedupe key updates the same thread path.
- Gated completion result and feedback threshold are independent.
- Feedback extraction failure follows phase policy.
- Completion output can say `Phase result: needs_revision` and `Feedback captured: positive threshold-met signal` for score 91 with approval threshold 95.
- MCP and CLI completion do not diverge.

Non-goals:

- No direct workflow template mutation.
- No proposal apply.

## Phase 6: Thread-Based Proposal Evidence Attachment

Goal:
Attach mature feedback threads to evolution safely without turning every validation run into an immediate mutation proposal or attaching evidence to the wrong proposal.

Entry points:

- `src/evolution/proposal-store.ts`
- New `src/evolution/feedback-updater.ts`
- Existing `appendEvidence` behavior

Attachment strategy:

- First implementation: append only when phase config names an explicit `proposalId` and that proposal is pending/refining.
- Later implementation: allow unambiguous configured target matching only after feedback thread update tests exist.
- Else update the feedback thread only and leave `proposal.readyForProposal` for later review.
- Never create multiple competing proposals automatically in the first implementation.
- Proposal generation uses thread summaries and compact history, not raw events.
- If the thread target is read-only, bundled, or external, proposal generation must recommend project-local override or user-global copy strategy instead of direct mutation.

Tests:

- Appends thread evidence to an explicitly configured proposal.
- Does not append to applied, failed, skipped, or missing proposals.
- Does not append based only on matching target file path.
- Does not append when multiple target-matching proposals exist.
- Thread proposal status reflects `attached`, `not_created`, or `ready_for_proposal`.
- Initial implementation never flips `readyForProposal` automatically.
- Proposal attachment uses a thread ID or explicit proposal ID, not a raw event ID.
- Read-only or bundled targets do not produce direct file mutation proposals.

Non-goals:

- No automatic proposal apply.
- No broad proposal generation from feedback.

## Phase 7: Mono-Spec Opt-In

Goal:
Configure the requested `mono-spec` validation phases to capture 90-threshold prompt evolution signals while preserving existing 95 approval gates.

Files:

- `src/preset/assets/workflows/mono-spec/workflow.yaml`
- `.playspec/workflows/mono-spec/workflow.yaml` only if project preset fixtures require parity
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`

Phase behavior:

- `tech_spec_validate`: positive feedback explains why the technical spec reached 90+; negative feedback explains why it failed to reach 90; source phase is `tech_spec_validate`, evaluated artifact phase is `tech_spec_draft`, and default evolution target phase is `tech_spec_draft`.
- `implementation_plan_validate`: positive feedback explains why the implementation plan reached 90+; negative feedback explains why it failed to reach 90; source phase is `implementation_plan_validate`, evaluated artifact phase is `implementation_plan_create`, and default evolution target phase is `implementation_plan_create`.
- Approval still requires the stricter existing gate, unless a separate approved spec changes that policy.
- Validation templates must ask the agent to distinguish artifact defects, authoring prompt gaps, validation prompt gaps, workflow policy gaps, and extractor/parser failures.
- Validation templates must emit `playspecFeedback` metadata.
- Validation templates must include `promptEvolution.targetType` when the target is not inferable from phase config.

Tests:

- `mono-spec` phase config loads.
- Score 91 with result `needs_revision` can still record positive feedback if below approval threshold but above feedback threshold.
- Score 89 records negative feedback.
- Existing phase routing remains correct.
- `tech_spec_validate` feedback targets the authoring prompt by default, not the validation prompt.
- A validator prompt gap can target the validation prompt instead.
- The `mono-spec` opt-in config includes bounded compact history and manual proposal readiness policy.
- The `mono-spec` opt-in records whether the resolved workflow source is project-local, user-global, bundled, or external.

Non-goals:

- Do not lower `mono-spec` approval from 95 to 90 in this phase.
- Do not change `issue-validate` behavior.

## Phase 8: Tests And Docs

Goal:
Make the behavior maintainable and clear to users.

Docs:

- Add README section explaining approval threshold versus feedback threshold.
- Add evolution docs section for feedback threads and optional audit observations.
- Add workflow authoring docs for `feedback` config.

Test coverage:

- Schema validation.
- Store validation.
- Extractor unit tests.
- Prompt snapshot hashing tests.
- Feedback thread update tests.
- Compact history bounds tests.
- Dedupe-key stability tests proving prompt hash changes do not create new threads by themselves.
- Proposal readiness policy tests proving initial readiness is manual.
- Mixed trend state tests.
- Workflow source resolver tests for project-local, user-global, bundled preset, and external workflows.
- Read-only target proposal strategy tests.
- Completion integration tests.
- Proposal evidence append tests.
- Preset workflow loading tests.
- Backward compatibility for workflows without feedback config.

Acceptance:

- A completed validation phase can create or update a structured feedback thread.
- The thread says why repeated scores met or missed the 90 threshold.
- The thread says which previous prompt/template/rubric/workflow guidance likely contributed to the result.
- The thread recommends reviewable guidance changes without mutating templates.
- Repeated validation runs for the same signal update one thread instead of producing independent evolution items.
- Feedback threads do not grow unbounded; compact history is bounded and overflow is summarized.
- Prompt hash changes are recorded as evidence/snapshot history, not embedded into dedupe keys.
- Proposal readiness remains manual in the first implementation.
- Mixed positive/negative feedback exposes trend state.
- Feedback threads are stored in the active workspace `.playspec/evolution/feedback`, regardless of workflow source.
- Threads record workflow source kind, target path kind, target path, and writability.
- Bundled or read-only targets recommend override/copy strategies instead of direct mutation.
- `mono-spec` validation phases opt in.
- Other workflows can opt in using phase metadata.
- No auto-apply or direct template mutation happens during completion.

## Dependencies

- Existing evolution proposal storage and append-evidence behavior.
- Existing completion ledger and artifact paths.
- Workflow schema extension support.

## Risks

- Capturing every high score can create noise. Use feedback threads as the default progress point before proposal generation.
- Markdown parsing can be brittle. Add stable feedback metadata to validation templates.
- Completion write ordering can create partial state. Keep feedback failure policy explicit.
- Proposal matching can attach evidence to the wrong target. Prefer explicit proposal ID or exact single-target matching.
- Source validation phase can differ from evaluated artifact phase and evolution target phase. Store all three.
- Low scores can reflect validator defects. Require suspected-cause classification.
- Positive feedback can be over-attributed. Store confidence and attribution strength.
- Feedback can become stale after prompt edits. Store prompt/template hashes.
- Feedback storage and workflow target location can be confused. Store feedback in workspace-local `.playspec/evolution/feedback` and store workflow source metadata separately.
- Workflow targets may be bundled or read-only. Proposal generation must respect writability and recommend allowed override/copy paths.
- Target prompt hashes must not be part of dedupe keys; store them as evidence so prompt edits do not split one ongoing issue into duplicate threads.
- Compact history can grow unbounded unless capped; preserve first evidence, recent evidence, and summarized overflow.
- Thread maturity can be over-automated; keep `readyForProposal` manual in the first implementation.
- Positive/negative signals can mix; expose trend state instead of treating the latest result as the whole thread.
- Score-driven automation can overfit prompts to validators. Require review and post-apply validation before treating a signal as a durable improvement.

## Handoff Notes

Start implementation with schema and feedback thread store work before touching `completePhase`. Add prompt snapshot, thread updater, and compact history support before proposal attachment. Then add extraction and completion integration behind an optional phase config. Only after those tests pass should `mono-spec` opt in.
