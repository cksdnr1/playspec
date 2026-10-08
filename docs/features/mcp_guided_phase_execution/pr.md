MCP callers currently reconstruct phase guards, report paths and result choices from prose.

Return coherent phase context with server-issued guarded completion arguments, gate report schema and artifact hashes, structured errors and scoped recovery calls. Keep legacy text/CLI behavior and enforce revision freshness under the task lock.

Validation: Build passed. Full suite: 53 files, 788 tests passed. Nine new contract tests plus one actual stdio client lifecycle cover stable completion arguments, explicit workspace/session routing, same-phase revision freshness, committed replay, report schema and hashes, missing/invalid report recovery, prerequisite inspection, blocked/terminal/historical phases, pending commit recovery, and parallel copied requests. Legacy MCP text, CLI, completion, rollback and evolution tests remain passing. No new dependencies or installed workflow edits.

PlaySpec task: `mcp_guided_phase_execution`.
