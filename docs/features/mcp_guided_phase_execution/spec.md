# Guided MCP phase execution

## Problem
A rendered MCP prompt returns only taskId and prose. Completion requires guards that the caller must reconstruct; gate result choices and report details are buried in prose, errors are strings, and prompts instruct MCP callers to run CLI commands.

## Contract
Return one coherent current-phase prompt and execution context under the task lock, recovering pending completion first. Include effective phase ID/title, workflow, allowed results, result requirement, routing targets, rendered required outputs, harness state, and an executable MCP completion call with server-issued stable requestId, expectedPhaseId and optional expectedRevision. The revision binds task/workflow/ledger state, detects returning to the same phase after another completion, and is checked inside the completion lock. Recorded request replay takes priority over stale revision rejection. Repeated reads without state changes return identical completion arguments. Explicit noncurrent phase rendering is inspection-only and never offers a completion call.

Validation context includes report path, actual task/phase identity, threshold, approval result, rubric, evaluated artifact paths, current SHA-256 or explicit missing/unreadable status, required report fields and JSON Schema. Do not generate reviewer scores, approval verdicts or fake evidence. The caller authors the report and selects a declared result; all existing runtime gates remain authoritative. Required outputs and hashes are guidance, not a guarantee completion will pass.

Preserve legacy text JSON responses and add structuredContent. Return structured errors with stable codes, message/hint, retryability and executable read-only recovery calls scoped to the correct workspace/task or session. Missing reports and stale approvals have typed gate errors. Stale phase/revision guidance requires reading and doing the new phase, never blind completion. Blocked harness guidance only inspects state; no automatic reset. Unknown errors fail conservatively without promising successful retries. Schema descriptions explain common context fields and completion argument provenance. MCP prompt delivery adds authoritative MCP completion instructions without modifying CLI template rendering.

## Acceptance criteria
A fresh MCP client can create/bind a task, render, author outputs/report from returned schema and hashes, choose a returned result and submit returned arguments without guessing IDs or paths. Missing report errors contain machine-readable recovery calls; after authoring a legitimate fixture report the same request succeeds. Concurrent distinct requests advance once; exact retries replay; an old revision cannot complete a later visit to the same phase. Explicit workspace/session calls stay scoped. Terminal status offers inspection and no completion. Noncurrent phase rendering offers no completion. Structured and legacy consumers both work. CLI rendering remains unchanged.

## Scope
No new model orchestration, automatic approval/report generation, evolution application, destructive operations, viewer, or unrelated workflow changes.
