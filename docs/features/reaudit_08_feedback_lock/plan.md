# Implementation plan

1. Derive shared lock from feedback dedupe key.
2. Hold lock across complete thread update.
3. Add concurrent cross-task regression with controlled read delay.
4. Run thread, feedback, completion regressions and build.

## Acceptance gate
Complete two distinct validation tasks with matching dedupe keys concurrently while delaying thread reads. Both completions must report captured and both task observations must remain in one thread. Existing compaction/trend/proposal tests and build pass.

Revisit the design if failure injection exposes an inconsistent contract.
