An approved evolution apply follows a symlinked parent beneath .playspec/rules and modifies an external file while reporting success.

Keep explicit approval and lexical allow-list, then resolve every read/write target inside the canonical workspace and its specific rules/templates root. Reject external or dangling symlinks before backups or mutation. Internal descendant symlinks remain allowed when within the same allowed root. Revalidate paths on reads and writes. No automatic apply, target expansion, or filesystem deletion.

Validation: Build and 110 evolution proposal, path-boundary and MCP tests passed. Approved external-parent symlink writes reject before mutation; contained internal links and explicit approval remain supported.

Task: `reaudit_04_evolution_paths`.
