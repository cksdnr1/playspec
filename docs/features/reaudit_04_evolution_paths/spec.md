# Constrain evolution writes to canonical allowed roots

## Observed failure
An approved evolution apply follows a symlinked parent beneath .playspec/rules and modifies an external file while reporting success.

## Contract
Keep explicit approval and lexical allow-list, then resolve every read/write target inside the canonical workspace and its specific rules/templates root. Reject external or dangling symlinks before backups or mutation. Internal descendant symlinks remain allowed when within the same allowed root. Revalidate paths on reads and writes. No automatic apply, target expansion, or filesystem deletion.

## Verification
Reproduce the external-parent symlink with an approved executable proposal and assert diff/apply reject without changing external bytes or proposal runtime targets. Check normal apply and internal contained symlink behavior; run existing evolution CLI/MCP regressions and build.

## Scope
Preserve unrelated user files and existing task IDs. No automatic evolution apply. Public compatibility changes are explicitly stated above.
