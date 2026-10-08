# Bind approvals to immutable evaluated artifact snapshots

## Observed failure
Approval currently hashes live artifacts once, then later writes approval without retaining evaluated bytes or checking changes during completion.

## Contract
Capture exact evaluated bytes in task snapshots, record path/hash/snapshot in the completion ledger, recheck source and snapshot hashes immediately before journaling. Later phases check the latest approved artifact hashes; editing phases and revalidation remain possible. Legacy approvals use retained validation reports for freshness checks.

## Verification
Inject artifact edits during evidence collection and reject completion. Verify immutable snapshots retain original bytes. Reject later execution with changed approved inputs and reject tampered snapshots.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
