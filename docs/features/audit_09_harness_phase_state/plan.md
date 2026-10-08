# Implementation plan

1. Move phase-mismatch normalization into readHarnessRecord.
2. Reset retry count and transient state while appending the existing reset audit event.
3. Add phase-switch and post-reset retry regression tests, run harness/core suites and build.

## Verification gate

Block A then move to B: both status and attempt recording use B defaults and B can record failures. A same-phase reset restores three attempts and retains audit events/evidence. Existing malformed-record checks remain strict.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
