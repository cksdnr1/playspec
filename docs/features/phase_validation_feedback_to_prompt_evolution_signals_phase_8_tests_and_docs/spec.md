# Phase Validation Feedback To Prompt Evolution Signals Phase 8 Tests And Docs

## Scope

This Phase 8 task is a maintainability and regression-coverage follow-up for the phase validation feedback to prompt evolution signal work through issue #201. It must not add new runtime behavior, auto-apply evolution proposals, or mutate workflow templates during phase completion.

The implementation will add user-facing documentation and fill test gaps around:

- workflow `feedback` config semantics;
- feedback threshold versus approval threshold;
- feedback thread storage versus workflow template source location;
- optional raw audit observation storage;
- repeated validation runs updating one semantic feedback thread;
- compact history bounds and overflow summaries;
- prompt hash history as evidence rather than a dedupe input;
- manual proposal readiness in the first implementation;
- bundled/read-only workflow targets recommending override/copy strategies;
- completion-time capture and proposal evidence attachment.

## Current Behavior

Phase feedback configuration is parsed by `src/core/schemas.ts` and loaded by `src/workflow/workflow-loader.ts`. Completion capture is wired in `src/core/playspec-core.ts`, extracts machine-readable validation feedback through `src/evolution/validation-feedback-extractor.ts`, and updates threads through `src/evolution/feedback-thread-updater.ts`.

Feedback thread records are stored under `.playspec/evolution/feedback/threads/{threadId}.yaml`. Raw audit observations, when saved by the store API, are stored under `.playspec/evolution/feedback/observations/{taskId}/{phaseId}/`. These storage paths are workspace evidence, not the workflow template source. The workflow source and target prompt template location are recorded separately on each thread using `FeedbackWorkflowSourceResolver`.

Existing tests already cover the main happy paths, but Phase 8 should make the guarantees explicit across schema, store, extraction, prompt snapshotting, completion integration, preset loading, and backward compatibility.

## Documentation Requirements

Update README or docs pages so users can answer these questions without reading source:

- Approval threshold decides whether a validation gate may advance; feedback threshold decides whether a validation result becomes an evolution signal. Mono-spec currently keeps approval at 95 and feedback signal threshold at 90.
- Feedback thread files live in `.playspec/evolution/feedback`, while the target prompt template lives in the resolved workflow source (`.playspec/workflows`, user workflow dir, bundled preset, or external workflow root).
- Project-local workflow targets can be edited manually after review. Bundled/user/external targets are treated as read-only by the signal path; users should copy/export/override the workflow into `.playspec/workflows` before editing.
- Feedback threads are durable evidence. Optional raw audit observations are separate and are not required for normal thread updates.
- Prompt snapshot hashes are event evidence for changed prompts and stale-feedback review, not semantic dedupe keys.
- Proposal readiness is manual-only in this implementation; readiness state may indicate review readiness but must not create or apply proposals.

## Test Requirements

Add or tighten tests for:

- schema acceptance/rejection of feedback config, including backward compatibility for workflows without `feedback`;
- store round-tripping of threads and optional raw observations;
- extractor separation of approval and feedback thresholds;
- prompt snapshot hashing and dedupe stability when prompt content changes;
- repeated validation/completion runs updating one thread instead of creating independent evolution items;
- compact history bounds and overflow summarization;
- proposal readiness staying manual-only and not becoming an auto-proposal state;
- workflow source resolution for project, user, bundled, and external/read-only targets;
- completion integration not mutating templates and not auto-applying proposals;
- proposal evidence attachment from a feedback thread;
- preset loading of mono-spec feedback config.

## Non-Goals

- No new runtime behavior beyond preceding phases.
- No automatic evolution proposal creation or application.
- No direct template mutation during completion.
- No viewer work.
