# Detect and safely update installed workflow drift

## Problem

Installed workflow copies silently shadow newer built-in validation policies; diagnostics compare only artifacts/outputs/version and init never upgrades existing copies.

## Contract and implementation

Compare all semantic workflow fields plus every template/include content hash. Add explicit workflow update preview/apply with per-file baseline hashes from new preset installs. Unchanged upstream files update safely; customized or legacy divergent files conflict until each path is explicitly accepted. Never delete files. Validate the builtin and active phase compatibility before writes, serialize updates, back up replaced files and write atomic per-file changes and a persistent report. Existing installs have no assumed baseline.

## Acceptance and regression coverage

Detect prompt-only and gate-only drift. Preview never mutates. Safe baseline updates succeed with backups and remain idempotent. Customized files abort unchanged unless named explicitly. Invalid workflow and incompatible active phases reject before writes.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
