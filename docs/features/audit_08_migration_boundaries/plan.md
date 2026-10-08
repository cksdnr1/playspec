# Implementation plan

1. Add safe IDs and relative-path schema validation.
2. Preflight target contracts, canonical paths and context/state values.
3. Restrict automatic execution, enforce backups and atomic file writes.
4. Add boundary/policy/failure regressions and update changed auto-mode expectations; build.

## Verification gate

Reject traversal, absolute and external symlink targets and unsafe plan IDs. Reject raw task-state mutation. High-risk auto actions cannot execute; deterministic low-risk promotions can. Inject a backup error and verify target unchanged. Existing review/dry-run/archive tests must remain meaningful under the tightened policy.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
