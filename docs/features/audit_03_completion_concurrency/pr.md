# Serialize and deduplicate phase completion

Task: `audit_03_completion_concurrency`
Branch: `fix/audit-03-concurrency`
Base: `master`

Completion now acquires the task-ID lock before reading state or checking expected phase. CLI passes the resolved expected phase and exposes --expected-phase/--request-id; MCP exposes requestId. Persisted request IDs deduplicate concurrent and completed-task retries; conflicting reuse rejects. Context/link/phase mutations use the same lock. Validation: 148 completion/routing/MCP/concurrency tests passed; build passed.

See spec.md and plan.md for the behavioral contract and regression scope.
