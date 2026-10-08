# Implementation and validation result

Completion now acquires the task-ID lock before reading state or checking expected phase. CLI passes the resolved expected phase and exposes --expected-phase/--request-id; MCP exposes requestId. Persisted request IDs deduplicate concurrent and completed-task retries; conflicting reuse rejects. Context/link/phase mutations use the same lock. Validation: 148 completion/routing/MCP/concurrency tests passed; build passed.

Review: changes are scoped to this task, failures reject or recover before advancing state, and regression cases exercise the observed audit behavior.
