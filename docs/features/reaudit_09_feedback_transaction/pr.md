Feedback is written before completion journal preparation. Retrying one request after a pre-journal failure counts its observation twice, even though completion is recorded once.

Prepare a durable completion journal before any feedback thread mutation. Persist the feedback capture request in that journal and finish capture during transaction recovery. Give each committed observation a stable task/completion ID and deduplicate it under the thread lock, retaining IDs through event compaction. Save the resolved feedback outcome back into the journal before ledger/state writes. Extraction-only preflight preserves fail_completion rejection before mutation. Existing journals without feedback requests remain recoverable.

Validation: Build passed. 129 focused completion, recovery, feedback and MCP tests passed after preserving canonical feedback markdown; includes prepare and post-feedback crash injection plus compacted observation replay.

Task: `reaudit_09_feedback_transaction`.
