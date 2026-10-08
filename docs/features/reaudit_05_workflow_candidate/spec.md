# Validate the assembled workflow before selective updates

## Observed failure
A selective workflow.yaml update reports success even when the installed templates do not satisfy the new definition. The updater validates the bundled workflow rather than the assembled installed result.

## Contract
Before replacing runtime assets or baseline, assemble all retained installed files plus selected replacements in a staging directory beneath update metadata. Parse and validate that exact candidate and expand all phase includes. Check active task phases against the candidate, not the builtin. Reject invalid candidates without changing runtime files or baseline. Retain staged evidence and existing backups; preview remains non-mutating. Multi-file apply still uses documented per-file atomicity.

## Verification
A valid one-phase custom mono-spec with only local.md must reject workflow.yaml-only replacement and remain loadable with identical baseline/runtime hashes. Full accepted update passes. Template-only update preserves custom phases and validates retained local definitions. Missing include rejects before replacement.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
