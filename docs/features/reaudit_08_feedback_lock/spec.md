# Serialize concurrent feedback thread observations

## Observed failure
Two tasks report feedback captured for the same dedupe key, but one read-modify-write overwrites the other thread event. Per-task completion locks do not serialize shared feedback threads.

## Contract
Serialize each feedback dedupe key across prompt snapshot creation, thread read, append/compaction and atomic save using a filesystem lock shared by processes. Compute the deterministic key first and use its hash for a safe lock directory. Different keys retain independent locks. No automatic evolution apply or score reinterpretation.

## Verification
Complete two distinct validation tasks with matching dedupe keys concurrently while delaying thread reads. Both completions must report captured and both task observations must remain in one thread. Existing compaction/trend/proposal tests and build pass.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
