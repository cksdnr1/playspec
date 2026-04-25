# Dev Phase 4.1 — Test Result

## Phase Summary

Phase 4.1 adds `playspec migrate` for converting historical project markdown documents into structured PlaySpec state. This document records the focused test follow-up for Phase 4.1 behavior.

## Intended Test Scope vs Actual Test Scope

**Intended:** Add minimum focused test coverage for Phase 4.1 behavior already implemented in code, specifically targeting the gaps between the 16 pre-existing Phase 4.1 tests and the full spec section 12 testable outcomes.

**Actual:** Added 2 focused tests to `tests/integration/migration.test.ts`:
1. `remove_context_ref` action execution — covers the only spec-defined action type with zero execution coverage.
2. `renderNextPrompt` downstream test after migration-added contextRef — fills the explicit gap in spec section 12 ("playspec next --task does not fail for missing ref").

No production code was modified.

## Changed Files

| File | Change |
|---|---|
| `tests/integration/migration.test.ts` | Added `PlaySpecCore` import; added 2 new tests in 2 new describe blocks |

## Changed Functions / Classes

- No production code changed.
- New test: `MigrationRunner — remove_context_ref / removes an existing context ref from task.yaml`
- New test: `MigrationRunner — downstream integration / renderNextPrompt succeeds after migration adds a contextRef pointing to an existing file`

## Pre-Test Entry-Point Audit

| Entry point | Behavior | Existing coverage | Status | Test needed |
|---|---|---|---|---|
| `applyAddContextRef` | Adds contextRef to task.yaml, creates backup | review mode test | done | no |
| `applyUpdateTaskState` | Updates whitelisted task field with schema validation | whitelist tests | done | no |
| `applyArchiveFile` | Archives file to `.playspec/migrations/archived/` | archive guard tests | done | no |
| `applyRemoveContextRef` | Removes existing contextRef from task.yaml | schema-only (not executed) | missing | yes |
| `applyUpdateFile` | Overwrites a document file | schema-only | partial | no (minimal scope) |
| `applyAppendSection` | Appends content to document | schema-only | partial | no (minimal scope) |
| `applyReplaceSection` | Replaces named markdown section | schema-only | partial | no (minimal scope) |
| `PlaySpecCore.renderNextPrompt` after migration | Does not throw MissingContextRefError for existing-file ref | not tested | missing | yes |
| `MigrationPlanSchema` reject `delete_file` | Validation rejects unsupported action | schema test | done | no |
| Dry-run no mutation | Plan/report written, task unchanged | 4 dry-run tests | done | no |
| Auto mode confidence gate | Medium-confidence `update_task_state` skipped | auto mode test | done | no |
| Archive gate | `archive_file` fails without `--with-archive` | archive guard tests | done | no |
| Duplicate contextRef guard | No duplicate added | dedup test | done | no |
| MCP no-HEAD-fallback | MCP tools do not read `.playspec/HEAD` | mcp-server.test.ts | done | no |

## Coverage Before vs After

| Test scenario (from spec section 12) | Before | After |
|---|---|---|
| Default review mode creates plan/report | covered | covered |
| Dry-run mutates nothing | covered | covered |
| Reject `delete_file` action | covered | covered |
| Add context ref — backup exists + task has ref | covered | covered |
| Add context ref — `playspec next --task` does not fail for missing ref | **missing** | **covered** |
| Ambiguous state not auto-applied | covered | covered |
| Archive requires flag | covered | covered |
| MCP path keeps explicit context | covered (mcp-server tests) | covered |
| `remove_context_ref` execution | **missing** | **covered** |

## Build / Test Validation

| Step | Command | Result |
|---|---|---|
| TypeScript compile | `npx tsc --noEmit` | Not re-run (no production code changed) |
| Migration tests only | `npx vitest run tests/integration/migration.test.ts` | 18/18 passed |
| Full suite | `npx vitest run` | 133/133 passed |

- Before: 131/131
- After: 133/133 (2 new Phase 4.1 tests)
- Blocking: no

## Final Verification

- Both new tests target real implemented behavior.
- No future-phase behavior is treated as covered.
- No helper-only testing is overclaimed as active-path coverage.
- No old/bypass paths invalidate coverage.
- `remove_context_ref` execution now has a real end-to-end test through `applyRemoveContextRef`.
- `renderNextPrompt` downstream path after migration is now verified: migration-added contextRefs pointing to existing files are accepted without `MissingContextRefError`.
- Document action types (`update_file`, `append_section`, `replace_section`) have schema validation coverage only; execution is untested but not called out as required in spec section 12 testable outcomes. Deferred as out-of-minimum-scope.

## Remaining Partial Coverage

- `applyUpdateFile`, `applyAppendSection`, `applyReplaceSection` — execution not tested; schema coverage only. These are Phase 4.1 action types but not listed as required in spec section 12 testable outcomes.

## Intentionally Deferred Items

- Execution tests for document action types (update_file, append_section, replace_section): spec section 12 does not list these as required testable outcomes. Minimum scope satisfied without them.
- CLI-level `playspec migrate` E2E test through `tests/cli.test.ts`: existing CLI tests are slow (46s); the migration runner integration tests cover the critical paths more efficiently.

## Recommendation for Next Phase Readiness

Phase 5 (Archive & Knowledge Base) may start. Phase 4.1 test coverage is complete against the spec section 12 testable outcomes. The 2 remaining document-action execution gaps are documented and acceptable for Phase 4.1 scope.
