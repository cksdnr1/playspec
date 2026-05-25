# Evolution Feedback Threads

Phase validation feedback signals are stored as reviewable evidence. They do not apply proposals, create proposals automatically, or mutate workflow templates during `playspec complete`.

## Threads and Observations

- Canonical thread storage: `.playspec/evolution/feedback/threads/{threadId}.yaml`
- Optional raw audit observations: `.playspec/evolution/feedback/observations/{taskId}/{phaseId}/`
- Workflow target source: recorded separately in each thread as `workflowSource`, `targetPromptTemplate`, `targetWritable`, and `targetPath`

Threads group repeated validation feedback by a semantic dedupe key. Prompt snapshot hashes are kept on each event as evidence of the prompt version that was evaluated, but they are not dedupe keys. This allows repeated validation runs to update one feedback thread even when the target prompt template changes between runs.

Compact history keeps thread files bounded. The first event and latest events are retained according to the workflow policy, and omitted events are summarized in `historyOverflowSummary`.

## Manual Readiness

The initial feedback implementation is manual-only. A thread trend can become `ready_for_review`, but PlaySpec does not create an evolution proposal, apply an evolution proposal, or edit a prompt template from completion feedback. A human or agent must review the thread, decide whether to draft a proposal, and explicitly use the evolution proposal commands.

## Read-Only Targets

Feedback threads may point at bundled preset or external workflow templates. Those targets are recorded as non-writable signal targets. To change them, copy/export/override the workflow into `.playspec/workflows/`, review the prompt change, and then edit the project-local workflow. This preserves the evidence trail while avoiding direct mutation of packaged presets.
