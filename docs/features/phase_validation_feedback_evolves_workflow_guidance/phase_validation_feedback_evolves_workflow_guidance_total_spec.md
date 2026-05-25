# Phase Validation Feedback To Prompt Evolution Signals Total Spec

## Scope

Design a planning-only architecture for turning phase validation results into prompt evolution signals. The first concrete use case is `mono-spec` technical spec validation and implementation plan validation: when a validation score reaches the configured feedback threshold, PlaySpec records why the artifact passed that threshold; when the score is below the threshold, PlaySpec records why it failed to reach it.

This spec intentionally does not implement code. It defines the target behavior, data model, integration points, risks, and phase plan needed for a later implementation.

The requested generalization is phase-level prompt evolution feedback, not a `mono-spec` special case. Any workflow phase should be able to opt into feedback capture with a threshold, score source, classification rules, evaluated artifact phase, and evolution target phase.

## Use Case Alignment

The user wants PlaySpec to learn from validation outcomes over time. A validation that scores well should not only pass; it should explain which workflow guidance, spec structure, or plan structure may have made it strong enough. A validation that scores poorly should not only route to a patch phase; it should preserve the causes as evolution evidence so workflow prompts and rules can improve.

Each captured feedback record must answer five questions:

1. Which workflow phase produced the feedback?
2. Which artifact and artifact-producing phase were evaluated?
3. Why did the artifact meet or miss the feedback threshold?
4. Which previous prompt, template, rubric, or workflow guidance likely contributed to that outcome?
5. What guidance change should be considered later by the evolution proposal system?

The important distinction is between approval routing and learning capture:

- Approval routing remains workflow-specific. `mono-spec` currently approves validation phases at `>= 95/100`.
- Feedback capture uses a configurable feedback threshold. The requested default is `90`.
- A score `>= feedbackThreshold` records positive feedback: why the artifact met or exceeded the threshold.
- A score `< feedbackThreshold` records negative feedback: why the artifact failed to reach the threshold.
- Scores equal to the threshold are treated as threshold-met feedback unless a phase config explicitly asks for strict `>` behavior.
- Positive feedback is only a candidate signal, not proof that the current prompt is correct.
- Negative feedback must classify whether the likely cause is the artifact, authoring prompt, validation prompt, workflow policy, or extraction path.

## Main Scenario

1. A `mono-spec` validation phase produces markdown with `Score: X/100`, a verdict, risks, and a patch-ready ledger.
2. The user or agent completes the validation phase with `playspec complete --result approved` or `playspec complete --result needs_revision`.
3. During completion, PlaySpec checks the active workflow phase definition for validation feedback configuration.
4. PlaySpec extracts the score and summary from the configured validation artifact.
5. If the score is `>= 90`, PlaySpec creates a positive prompt evolution signal explaining why the spec or plan met the feedback threshold and how confidently that outcome can be attributed to current guidance.
6. If the score is `< 90`, PlaySpec creates a negative prompt evolution signal explaining why the spec or plan missed the threshold and which prompt, rubric, or workflow guidance may need review.
7. The feedback remains reviewable evidence. It does not auto-apply prompt/template changes.
8. Existing evolution proposal review/apply safety still controls whether workflow templates or rules are changed.

## Alternative Scenarios

- A non-validation phase opts in to feedback capture. It can emit a qualitative signal or use a different score extractor, but the same storage and evolution path applies.
- A phase has no score. The feedback collector records a skipped feedback event with the reason `score_not_found` only when the phase config requires observability.
- A phase has multiple output artifacts. The phase config names the artifact role or path that contains the score.
- A validation score is malformed. Completion should not corrupt task state. The feedback event records an extraction failure, and the phase completion can either continue with a warning or fail before state mutation depending on phase policy.
- A matching pending evolution proposal already exists. PlaySpec appends feedback evidence only when matching is explicit or unambiguous enough for the configured phase.
- No matching feedback thread exists. PlaySpec creates one canonical thread for that prompt evolution signal. Draft proposal generation is deferred until the thread is mature enough for review.

## Current Implementation Summary

Verified from current code:

- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md` and `implementation_plan_validate.md` already require a readiness score and detailed risk output.
- `mono-spec` validation routing currently approves only at `>= 95/100`; this should remain an approval gate, not be replaced by the requested feedback threshold.
- `src/preset/assets/workflows/issue-validate/templates/issue_validate.md` uses a 90 point approval threshold, but that workflow is issue-specific and not a general phase feedback mechanism.
- `src/core/playspec-core.ts` owns `completePhase`, writes snapshots/evidence/review files, updates task state through `TaskStore`, and can already write evolution context snapshots when requested.
- `src/core/schemas.ts` defines `PhaseDefinitionSchema`, `WorkflowDefinitionSchema`, and completion metadata. There is no phase-level feedback config today.
- `src/evolution/schemas.ts` and `src/evolution/proposal-store.ts` support proposal records, evidence refs, updates, revisions, and validation reports. They do not yet have a first-class feedback thread or validation feedback event type.
- `src/utils/paths.ts` centralizes `.playspec/evolution` paths, including proposals, human edits, context snapshots, reports, and backups.

Inferred behavior:

- The safest implementation boundary is a small feedback capture service invoked after routing validation succeeds and before or immediately after completion ledger persistence. The exact ordering must preserve atomicity and recovery behavior.
- Existing evolution proposals are change plans, while validation feedback starts as a run event and is operationally managed through a durable feedback thread. A feedback thread is cleaner than forcing every validation outcome to become a proposal immediately.

## Relevant Files Reviewed

- `src/core/playspec-core.ts`
- `src/core/schemas.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-store.ts`
- `src/utils/paths.ts`
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`
- `src/preset/assets/workflows/issue-validate/templates/issue_validate.md`
- `src/preset/assets/workflows/total-plan/workflow.yaml`

## Active Entry Points And Bypasses

Active entry points:

- CLI completion through `src/cli/commands/complete.ts`.
- Core phase completion through `PlaySpecCore.completePhase`.
- MCP completion through the existing MCP complete-phase path when it delegates to core completion.

Bypasses and old paths:

- Direct file edits to workflow templates bypass evolution feedback capture.
- Direct proposal CLI commands can create or update proposals without validation phase context.
- Validation markdown is currently a prompt output convention, not a schema-checked artifact.
- `withEvolutionContext` currently writes read-only context snapshots; it is not a feedback ingestion path.

The design must attach feedback capture to the shared core completion path so CLI and MCP completion behave consistently.

## Current Architecture

Current evolution support has three related but separate concepts:

- Proposal records: reviewable change plans under `.playspec/evolution/proposals/{proposalId}/proposal.yaml`.
- Human edit observations: manual observations stored independently from proposals.
- Evolution context snapshots: prompt-time or completion-time read-only summaries of active evolution context.

The proposed architecture adds two feedback concepts, with one canonical operational object:

- Feedback thread: the canonical ongoing progress point for one repeated prompt evolution signal. It is updated in place when the same dedupe key appears again.
- Validation feedback event: compact per-run evidence that may be stored inside the thread history or, only when configured, as an optional raw audit observation file.

Feedback storage and workflow target location are deliberately separate:

- Feedback threads are workspace-local evidence and are stored under the active workspace `.playspec/evolution/feedback/threads/`.
- Target prompts/templates/rubrics may live in project-local workflows, user-global workflows, bundled presets, or external workflow sources.
- A thread must record where the target workflow asset came from and whether it is writable. Proposal generation must not assume the target file can be mutated directly.

Proposed flow:

```text
phase prompt output
  -> validation markdown artifact
  -> playspec complete
  -> core routing validation
  -> feedback config lookup
  -> structured feedback metadata extraction
  -> compute feedback thread dedupe key
  -> update matching open feedback thread or create one
  -> optionally write compact/raw audit event
  -> proposal generation later reads feedback threads, not raw events
  -> task completion ledger
```

The exact write ordering should be finalized in implementation, but the completion ledger must reference feedback output when capture succeeds.

## Verified Behavior And Constraints

- Workflow phase definitions are validated by Zod in `WorkflowDefinitionSchema`.
- Unknown phase definition fields are not currently rejected because `z.object` defaults to stripping unknown fields; if feedback config is added, tests must prove it is preserved through workflow loading and rendering.
- Evolution proposal actions are intentionally allow-listed and apply only after explicit review.
- Proposal evidence refs must point to existing workspace-relative paths.
- `completePhase` already collects git evidence and snapshots, which can serve as source artifact references for feedback.
- Task state must continue to validate through `TaskRecordSchema`.
- Existing validation prompts do not yet emit machine-readable feedback blocks; relying only on free-form markdown parsing is unsafe for automation.

## Problems

1. Validation learning is trapped in markdown. A high or low score can guide the current task, but PlaySpec does not preserve the reason as reusable evolution input.
2. The requested 90-point feedback behavior does not map cleanly to current `mono-spec` approval gates, which use 95. Mixing them would weaken approval semantics.
3. Evolution proposals are heavier than raw feedback. Creating a proposal for every validation result could create noisy competing changes.
4. Score extraction is convention-based. Current validation templates produce markdown, not structured JSON/YAML.
5. Phase-level generalization needs workflow metadata, not hard-coded `mono-spec` phase names.
6. A feedback-producing validation phase is not always the phase that should evolve. `tech_spec_validate` may produce feedback whose target is `tech_spec_draft`.
7. A low score may be caused by a bad validator prompt rather than a bad artifact.
8. Repeated automation runs can create duplicate feedback noise and duplicate proposals.
9. Prompt guidance changes over time; feedback must record which prompt/template version or hash it refers to.
10. Score-driven automation can overfit prompts to validator preferences instead of improving implementation usefulness.

## Proposed Direction

Add a general phase feedback capture layer with these pieces:

- `PhaseFeedbackConfig` on workflow phases.
- `FeedbackThreadSchema` under evolution as the first-class persisted object.
- `ValidationFeedbackEventSchema` under evolution as compact per-run evidence, not the default queue item.
- `FeedbackThreadStore` that writes canonical threads under `.playspec/evolution/feedback/threads/{threadId}.yaml`.
- Optional raw audit event storage under `.playspec/evolution/feedback/observations/{taskId}/{phaseId}-{timestamp}.yaml`.
- `ValidationFeedbackExtractor` that reads configured artifacts and extracts score, threshold, reason, verdict, risks, and patch ledger snippets.
- `FeedbackThreadUpdater` that finds or creates the thread for the dedupe key and updates counts, trend, latest evidence, and proposal readiness.
- `EvolutionFeedbackUpdater` that can attach a mature thread as evidence to an explicit pending/refining proposal.
- Template updates for `mono-spec` validation phases so the validation markdown includes stable machine-readable feedback fields without losing readability.

The feedback system must avoid creating noisy independent evolution items for every validation run. Raw validation feedback is an event, but prompt evolution should be tracked through durable feedback threads. A feedback thread is the canonical ongoing progress point for a repeated prompt evolution signal. Feedback capture computes a dedupe key from workflow, evolution target phase, target type, guidance section, cause category, suspected cause, and suggested change fingerprint. If a matching open thread exists, PlaySpec updates that thread with the latest score, evidence summary, counts, trend, and source references. If no matching thread exists, PlaySpec creates one.

The dedupe key must be meaning-based and stable across prompt edits. It must not include the target prompt/template snapshot hash. Prompt hashes belong in thread evidence and snapshot history so stale feedback can be detected without splitting one continuing issue into unrelated threads.

Feedback threads must not only record validation scores and pass/fail classifications. They must also preserve the causal explanation for the score and translate that explanation into prompt-evolution signals. The first implementation should store these prompt-evolution signals as reviewable thread evidence only. It must not directly mutate workflow templates.

The initial implementation should not auto-apply proposals. It should not mutate workflow templates directly. It should update one canonical feedback thread per repeated signal and, when explicitly configured, attach that thread as evidence to a pending/refining evolution proposal.

## Required Feedback Thread Shape

The thread schema must keep the feedback source, evaluated artifact, and evolution target separate while accumulating repeated runs:

```yaml
id: feedback-thread-mono-spec-tech-spec-acceptance-criteria
dedupeKey: mono-spec:tech_spec_draft:prompt_template:acceptance_criteria:authoring_prompt_gap:observable-pass-fail-evidence
status: open
target:
  workflowId: mono-spec
  workflowSource:
    kind: project_local
    root: .playspec/workflows/mono-spec
    rootPathKind: workspace_relative
    packageName: null
    presetId: mono-spec
    version: null
  targetPhaseId: tech_spec_draft
  targetType: prompt_template
  targetPromptTemplate:
    path: .playspec/workflows/mono-spec/templates/tech_spec_draft.md
    pathKind: workspace_relative
    writable: true
  targetGuidanceSection: acceptance_criteria
  targetPromptSnapshot:
    path: .playspec/workflows/mono-spec/templates/tech_spec_draft.md
    pathKind: workspace_relative
    hash: sha256:...
    capturedAt: "2026-05-25T10:00:00Z"
    workflowVersion: 1
  promptSnapshotHistory:
    - hash: sha256:...
      observedAt: "2026-05-25T10:00:00Z"
revalidation:
  required: false
  reason: null
classificationTrend:
  positiveCount: 1
  negativeCount: 4
  latestClassification: negative
  latestSuspectedCause: authoring_prompt_gap
  state: mostly_negative
  trendInterpretation:
    stability: mixed
    summary: "Guidance sometimes works for simple specs but fails when acceptance criteria need observable verification."
evidence:
  firstSeenAt: "2026-05-25T10:00:00Z"
  lastSeenAt: "2026-05-25T14:00:00Z"
  runCount: 5
  latestScore: 87
  scoreRange:
    min: 82
    max: 91
  compactHistoryPolicy:
    maxEntries: 20
    keepFirst: true
    keepLatest: 10
    summarizeOverflow: true
  compactHistory:
    - taskId: task-a
      sourcePhaseId: tech_spec_validate
      evaluatedArtifactPhaseId: tech_spec_draft
      score: 84
      timestamp: "2026-05-25T10:00:00Z"
      summary: "Acceptance criteria were not observable."
    - taskId: task-b
      sourcePhaseId: tech_spec_validate
      evaluatedArtifactPhaseId: tech_spec_draft
      score: 87
      timestamp: "2026-05-25T14:00:00Z"
      summary: "No verification method was required."
summary:
  currentFinding: "Acceptance criteria guidance often fails to force observable pass/fail evidence."
  suggestedGuidanceChange: "Require each acceptance criterion to name observable evidence and verification method."
  confidence: medium
proposal:
  proposalId: null
  proposalStatus: not_created
  readyForProposal: false
  mutationStrategy:
    directMutationAllowed: true
    recommendedTarget: project_local_workflow
  readinessPolicy:
    mode: manual_only_initial
    minRunCount: 3
    minNegativeCount: 2
    minConfidence: medium
    requireHumanReviewBeforeProposal: true
```

Raw validation events may be represented as compact history entries by default. Full raw observation files are optional audit artifacts controlled by config:

```yaml
feedback:
  storageMode: thread_with_compact_history
```

Supported storage modes:

- `thread_only`: update the thread summary and counters without per-run history.
- `thread_with_compact_history`: update the thread and append bounded compact history. This is the recommended automation default.
- `thread_with_audit_observations`: update the thread and write raw observation files for audit-heavy workflows.

Proposal generation must use feedback threads, not individual raw observations. Raw observations may be stored as optional audit evidence, but they must not create competing proposals or clutter the evolution queue by default.

Workflow source policy:

- `workflowSource.kind` must be one of `project_local`, `user_global`, `bundled_preset`, or `external`.
- `targetPromptTemplate.pathKind` must be one of `workspace_relative`, `user_home_relative`, `package_relative`, or `absolute`.
- `targetPromptTemplate.writable` must be recorded at capture time when possible.
- If `workflowSource.kind` is `bundled_preset` or the target is read-only, proposal generation must recommend an allowed override/copy strategy instead of direct mutation.
- For bundled presets, a proposal should normally target a project-local workflow override or a user-global workflow copy, not package internals.

Initial proposal readiness policy:

- `readyForProposal` must not become `true` automatically in the first implementation.
- A human or explicit command should promote a thread to proposal-ready after reviewing the thread summary and compact history.
- Later automation may recommend readiness using `minRunCount`, `minNegativeCount`, `minConfidence`, and target snapshot checks, but it still must not apply changes without review.

Trend state policy:

- `classificationTrend.state` must be one of `only_positive`, `mostly_positive`, `mixed`, `mostly_negative`, or `only_negative`.
- Mixed positive/negative signals must not be collapsed into a simple good/bad verdict.
- When results are mixed, the thread should preserve a short `trendInterpretation` so reviewers can distinguish unstable validator behavior, context-dependent prompt weakness, and actual prompt improvement.

## Required Event Shape

The per-run event shape must support thread updates and optional audit storage:

```yaml
source:
  workflowId: mono-spec
  sourcePhaseId: tech_spec_validate
  artifactRole: validation_report
  artifactPath: .playspec/tasks/active/task-id/reviews/phasetech_spec_validate_review.yaml
evaluated:
  evaluatedArtifactPhaseId: tech_spec_draft
  artifactKind: technical_spec
  artifactPath: docs/features/example/spec.md
score:
  value: 87
  max: 100
  approvalThreshold: 95
  approvalResult: failed
  feedbackThreshold: 90
  feedbackResult: missed
  classification: negative
feedback:
  summary: "The validation missed the feedback threshold because acceptance criteria were not observable."
  causes:
    - category: acceptance_criteria
      severity: high
      suspectedCause: authoring_prompt_gap
      evidence: "Validation noted that success criteria were not observable."
    - category: risk_management
      severity: medium
      suspectedCause: artifact_quality_issue
      evidence: "Risks were listed but not tied to phase gates."
evolutionTarget:
  workflowId: mono-spec
  workflowSource:
    kind: project_local
    root: .playspec/workflows/mono-spec
    rootPathKind: workspace_relative
  targetPhaseId: tech_spec_draft
  targetType: prompt_template
  targetPromptTemplate:
    path: .playspec/workflows/mono-spec/templates/tech_spec_draft.md
    pathKind: workspace_relative
    writable: true
  targetGuidanceSection: acceptance_criteria
  targetPromptSnapshot:
    path: .playspec/workflows/mono-spec/templates/tech_spec_draft.md
    pathKind: workspace_relative
    hash: sha256:...
    capturedAt: "2026-05-25T10:00:00Z"
    workflowVersion: 1
promptEvolution:
  previousGuidanceWeakness:
    - "The previous prompt did not force testable acceptance criteria."
  previousGuidanceStrength:
    - "The prompt already required risk discovery."
  suggestedGuidanceChange:
    - "Require every acceptance criterion to include observable pass/fail evidence."
  confidence: medium
  attribution:
    promptContribution: inferred
    evidenceStrength: moderate
dedupe:
  key: mono-spec:tech_spec_draft:prompt_template:acceptance_criteria:authoring_prompt_gap:observable-pass-fail-evidence
  fingerprintFields:
    - workflowId
    - evolutionTargetPhaseId
    - targetType
    - targetGuidanceSection
    - causeCategory
    - suspectedCause
    - suggestedChangeFingerprint
threadId: feedback-thread-mono-spec-tech-spec-acceptance-criteria
status: merged_into_thread
```

Cause classification must support at least:

- `artifact_quality_issue`
- `authoring_prompt_gap`
- `validation_prompt_gap`
- `workflow_policy_gap`
- `extractor_or_parser_error`

This prevents automation from assuming every low score means the artifact authoring prompt is wrong.

## Machine-Readable Feedback Block

Validation prompts should require a stable block that extraction reads before any markdown fallback:

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
    targetGuidanceSection: acceptance_criteria
    previousGuidanceWeakness:
      - "The prompt did not require observable pass/fail criteria."
    suggestedGuidanceChange:
      - "Require each acceptance criterion to name observable evidence."
    confidence: medium
```

Fallback markdown extraction is allowed only as a lower-confidence compatibility path, and the feedback event/thread update must record that the extractor used fallback parsing.

## Phase Feedback Config Example

The first implementation should make workflow opt-in explicit in `workflow.yaml`. A `mono-spec` validation phase should look like this shape:

```yaml
tech_spec_validate:
  title: "Technical Spec Validation"
  template: tech_spec_validate.md
  feedback:
    enabled: true
    kind: prompt_evolution_signal
    feedbackThreshold: 90
    thresholdMode: greater_or_equal
    storageMode: thread_with_compact_history
    scoreSource:
      artifactRole: validation_report
      preferredBlock: playspecFeedback
      markdownFallback: true
    sourcePhaseId: tech_spec_validate
    evaluatedArtifactPhaseId: tech_spec_draft
    evolutionTarget:
      targetType: prompt_template
      targetPhaseId: tech_spec_draft
      workflowSource:
        kind: project_local
        root: .playspec/workflows/mono-spec
        rootPathKind: workspace_relative
      targetPromptTemplate:
        path: .playspec/workflows/mono-spec/templates/tech_spec_draft.md
        pathKind: workspace_relative
        writable: true
      targetGuidanceSectionSource: playspecFeedback.promptEvolution.targetGuidanceSection
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
    capturePolicy:
      required: true
      onExtractionFailure: fail_completion
      onStoreFailure: fail_completion
    proposalUpdate:
      mode: explicit_only
```

This config locks the operational behavior: validation completion updates a feedback thread, bounded compact history prevents unbounded growth, and proposal promotion stays manual until a later implementation adds reviewed readiness automation.

## File-By-File Plan

- `src/core/schemas.ts`: add optional feedback config to `PhaseDefinitionSchema`.
- `src/core/types.ts`: add phase feedback config and completion result fields.
- `src/core/playspec-core.ts`: call feedback capture from the shared completion path.
- `src/evolution/schemas.ts`: add feedback thread and validation feedback event schemas.
- `src/evolution/types.ts`: add typed feedback thread, feedback event, and extraction result types.
- `src/evolution/feedback-thread-store.ts`: persist canonical feedback threads and the thread index.
- `src/evolution/feedback-thread-updater.ts`: find/create/update feedback threads from extracted events.
- `src/evolution/validation-feedback-extractor.ts`: parse configured validation markdown safely.
- `src/evolution/validation-feedback-audit-store.ts`: optionally persist raw audit observations when configured.
- `src/evolution/feedback-updater.ts`: attach explicit mature feedback threads to active proposals.
- `src/evolution/prompt-snapshot.ts`: hash target prompt/template/rule files referenced by feedback.
- `src/evolution/workflow-source-resolver.ts`: resolve workflow source kind, path kind, target writability, and safe mutation strategy.
- `src/utils/paths.ts`: add feedback storage path helpers.
- `src/preset/assets/workflows/mono-spec/workflow.yaml`: opt in `tech_spec_validate` and `implementation_plan_validate`.
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`: add stable feedback metadata fields.
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`: add stable feedback metadata fields.
- `src/preset/assets/workflows/total-plan/*`: optionally opt in later after mono-spec proves the mechanism.
- `src/mcp/server.ts`: expose feedback records only if current MCP completion response needs parity.
- Tests: cover schema validation, score extraction, completion integration, proposal append behavior, and disabled/no-score cases.

## Risks And Open Questions

- Write ordering: feedback capture should not leave a completed task without referenced feedback when capture is required.
- Noise control: positive feedback may be frequent. The default store must update feedback threads, not create independent evolution items per run.
- Proposal matching: matching by target files can be ambiguous. Initial matching should require explicit `proposalId` or phase config target.
- Threshold semantics: user requested 90. Existing approval threshold remains 95 for mono-spec. The docs and templates must make this distinction obvious.
- Artifact location: current validation templates do not mandate a separate persisted validation file. Implementation must either add one or parse review/snapshot artifacts.
- Backward compatibility: old workflows without feedback config must behave exactly as before.
- Wrong phase attachment: source validation phase, evaluated artifact phase, and evolution target phase must be stored separately.
- Validator defects: low scores may reflect validation prompt defects. Feedback events and threads must classify suspected cause before recommending authoring prompt changes.
- Positive over-attribution: threshold-met feedback is an evidence signal with confidence, not proof that the prompt is correct.
- Duplicate automation noise: repeated runs must update the same feedback thread by dedupe key before proposal generation.
- Silent capture failure: phase config must define whether feedback capture failure fails completion or warns and continues.
- Prompt version drift: feedback must record the target prompt/template hash so stale feedback can be ignored or revalidated.
- Workflow location drift: feedback storage is workspace-local evidence, while target prompts may live in project-local, user-global, bundled, or external workflow sources. Store workflow source metadata separately from feedback storage paths.
- Read-only targets: bundled presets and external workflows may not be writable. Proposal generation must recommend override/copy strategies instead of direct mutation.
- Dedupe drift: target prompt/template hashes must not be part of dedupe keys; otherwise minor prompt edits split the same continuing issue into new threads.
- Thread growth: compact history must be bounded, preserving first evidence, recent evidence, and summarized overflow.
- Premature proposal promotion: initial implementation must keep `readyForProposal` manually controlled.
- Mixed trend ambiguity: positive and negative signals in one thread must expose a trend state and interpretation instead of overwriting each other.
- Score gaming: automated evolution must not optimize prompts only to satisfy validators; event -> feedback thread -> proposal draft -> review -> apply -> post-apply validation remains the required path.

## Reader Aids

Terminology:

- Approval threshold: decides route, such as approved or needs revision.
- Feedback threshold: decides whether to record positive or negative evolution feedback.
- Feedback event: compact evidence from one phase validation run.
- Feedback thread: canonical ongoing progress point for one repeated prompt evolution signal.
- Evolution proposal: reviewable change plan that may later mutate allowed PlaySpec assets.

Downstream output:

- The phase implementation plan is `docs/features/phase_validation_feedback_evolves_workflow_guidance/phase_validation_feedback_evolves_workflow_guidance_phase_plan.md`.
