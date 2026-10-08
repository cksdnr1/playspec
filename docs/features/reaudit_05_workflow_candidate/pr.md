A selective workflow.yaml update reports success even when the installed templates do not satisfy the new definition. The updater validates the bundled workflow rather than the assembled installed result.

Before replacing runtime assets or baseline, assemble all retained installed files plus selected replacements in a staging directory beneath update metadata. Parse and validate that exact candidate and expand all phase includes. Check active task phases against the candidate, not the builtin. Reject invalid candidates without changing runtime files or baseline. Retain staged evidence and existing backups; preview remains non-mutating. Multi-file apply still uses documented per-file atomicity.

Validation: Build and 56 candidate, installed-update and workflow regressions passed. YAML-only missing-template updates and retained missing includes reject before runtime writes; retained custom active phases stay compatible.

Task: `reaudit_05_workflow_candidate`.
