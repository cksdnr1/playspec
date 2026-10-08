# Implementation plan

1. Implement canonical containment helper with existing-ancestor handling.
2. Wire context access and template expansion to the helper.
3. Add symlink and missing-file regressions; run template/core suites and build.

## Verification gate

Reject external context and template/include symlinks; allow symlinks to files within the root and a symlinked workspace root. Missing files still produce existing domain errors. Completion rendering cannot bypass context registration checks.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
