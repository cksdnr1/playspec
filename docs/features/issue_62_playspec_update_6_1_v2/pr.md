# PR: Issue #62 PlaySpec Update 6.1 v2

Fixes #62

## Summary

- Adds the Phase 6.1 `playspec evolution` CLI surface for proposal intake, listing, inspection, and skipping.
- Extends proposal records with `refining` status support, `revision`, and `updatedAt`.
- Stores validated proposal YAML and validation reports under `.playspec/evolution/proposals/{proposalId}/`.
- Keeps prompt rendering, completion, MCP tools, apply/update/merge/evidence behavior, and proposal generation out of scope.

## Changed Files

- `src/cli/index.ts`
- `src/cli/commands/evolution.ts`
- `src/evolution/proposal-store.ts`
- `src/evolution/schemas.ts`
- `src/evolution/types.ts`
- `tests/cli.test.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_62_playspec_update_6_1_v2/spec.md`
- `docs/features/issue_62_playspec_update_6_1_v2/plan.md`
- `docs/features/issue_62_playspec_update_6_1_v2/result.md`
- `docs/features/issue_62_playspec_update_6_1_v2/pr.md`

## Tests Run

```text
pnpm test -- tests/integration/evolution-proposal-store.test.ts tests/cli.test.ts tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts
pnpm test
pnpm build
```

## PlaySpec Task

- `issue_62_playspec_update_6_1_v2`

## Risk Notes

- This PR intentionally does not add proposal apply/update/merge/evidence append/generation behavior.
- This PR intentionally does not surface proposals in prompts, completion snapshots, or MCP tools.
- Intake always stores new proposals as `pending`; `refining` is supported for stored records and read-only CLI output until a later update/merge phase exists.

## Reusable Agent Guidance

No reusable agent guidance needs to be documented from this change. The existing project rules already cover the main guardrails: keep future phases out of scope, do not auto-apply evolution proposals, and keep MCP separate from CLI behavior.
