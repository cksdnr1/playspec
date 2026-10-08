Approval currently hashes live artifacts once, then later writes approval without retaining evaluated bytes or checking changes during completion.

Capture exact evaluated bytes in task snapshots, record path/hash/snapshot in the completion ledger, recheck source and snapshot hashes immediately before journaling. Later phases check the latest approved artifact hashes; editing phases and revalidation remain possible. Legacy approvals use retained validation reports for freshness checks.

Validation: Build passed; 162 focused tests passed across immutable approval snapshots, gate reports, routing, completion, recovery and MCP. Failure injection rejects post-validation edits; downstream execution rejects changed originals or tampered snapshots.

Task: `reaudit_06_approval_snapshots`.
