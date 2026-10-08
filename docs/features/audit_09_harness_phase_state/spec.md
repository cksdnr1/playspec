# Keep harness state consistent across phases

## Problem

After a blocked phase A changes to B, harness status reports unblocked B but recording an attempt reuses blocked A. Reset leaves the retry budget consumed.

## Contract and implementation

Normalize loaded harness records to the requested phase in the shared read path, preserving reset audit events but starting a new phase with its own retry budget. Reset clears attemptCount and transient result/reason along with flags. Success retains cumulative failures within the same reset epoch; changing phase starts a fresh epoch.

## Acceptance and regression coverage

Block A then move to B: both status and attempt recording use B defaults and B can record failures. A same-phase reset restores three attempts and retains audit events/evidence. Existing malformed-record checks remain strict.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
