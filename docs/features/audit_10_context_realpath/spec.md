# Enforce real context and template boundaries

## Problem

Lexical context and include checks accept workspace-local symlinks pointing outside the allowed root and include external contents in prompts.

## Contract and implementation

Add a shared canonical containment resolver that verifies lexical containment and resolves existing ancestors, including symlinks, against the canonical allowed root. Reject escaping and dangling symlinks. Apply it to context registration, context rendering including completion snapshots, and template/include loads. Preserve missing-file domain errors and allow internal symlinks. Limits: atomic hostile concurrent symlink replacement is outside this local trusted-filesystem change.

## Acceptance and regression coverage

Reject external context and template/include symlinks; allow symlinks to files within the root and a symlinked workspace root. Missing files still produce existing domain errors. Completion rendering cannot bypass context registration checks.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
