Two tasks report feedback captured for the same dedupe key, but one read-modify-write overwrites the other thread event. Per-task completion locks do not serialize shared feedback threads.

Serialize each feedback dedupe key across prompt snapshot creation, thread read, append/compaction and atomic save using a filesystem lock shared by processes. Compute the deterministic key first and use its hash for a safe lock directory. Different keys retain independent locks. No automatic evolution apply or score reinterpretation.

Validation: Build and 42 feedback/thread/completion tests passed. Concurrent tasks sharing one key both report capture and persist both observations with totalEvents=2.

Task: `reaudit_08_feedback_lock`.
