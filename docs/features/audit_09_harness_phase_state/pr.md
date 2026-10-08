# Keep harness state consistent across phases

Task: `audit_09_harness_phase_state`
Branch: `fix/audit-09-harness`
Base: `master`

Harness reads and mutations now share phase normalization; explicit reset replenishes its retry budget and clears transient state while retaining reset evidence. Validation: 8 harness regression/existing tests passed; build passed.

See spec.md and plan.md for the behavioral contract and regression scope.
