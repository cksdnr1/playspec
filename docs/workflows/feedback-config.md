# Workflow Feedback Config

Workflow authors can opt a validation phase into prompt feedback signals with a `feedback` block. The block describes how to extract validation feedback, where to store the thread, and which prompt template the feedback concerns.

## Thresholds

Keep approval and feedback thresholds separate:

- `approval.threshold` is the workflow gate threshold. It documents the score needed before a validation phase should complete with `approved`.
- `feedbackThreshold` is the signal threshold. Scores below it become negative feedback; scores at or above it become positive feedback.

The bundled `mono-spec` validation prompts use approval `95` and feedback `90`. This means `91/100` can still require plan/spec revision while recording positive feedback for prompt evolution.

## Source and Target

Thread files live under `.playspec/evolution/feedback/threads/`. That is storage, not the workflow source location.

The workflow target source is recorded separately:

- `workflowSource` identifies project-local, user-global, bundled-preset, or external workflow roots.
- `targetPromptTemplate` identifies the target template relative to that workflow.
- `targetWritable` and `targetPath` tell reviewers whether the target can be edited directly.

Project-local workflow targets are writable after review. Bundled preset and external targets should be copied, exported, or overridden into `.playspec/workflows/` before editing.

## History and Proposals

Use `evolution.storageMode: thread_with_compact_history` to keep one durable thread per semantic feedback signal. The compact history policy bounds retained events and summarizes overflow. Prompt snapshot hashes remain per-event evidence and should not be included in dedupe fields.

Use `proposalReadinessPolicy.mode: manual_only_initial` for the first implementation. Readiness can indicate that a thread deserves review, but it must not automatically create or apply proposals.
