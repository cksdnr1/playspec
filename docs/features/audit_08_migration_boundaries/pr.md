# Constrain migration paths and automatic mutations

Task: `audit_08_migration_boundaries`
Branch: `fix/audit-08-migration`
Base: `master`

Migration now rejects traversal/external symlinks and raw state writes, restricts auto mode to low-risk deterministic structured promotions, checks stale state, and stops on backup failure. Existing documentation files are backed up and written atomically. Canonical backup/archive paths preserve filenames on macOS. Validation: 28 migration tests passed and build passed. Auto context-ref actions now require review mode by design.

See spec.md and plan.md for the behavioral contract and regression scope.
