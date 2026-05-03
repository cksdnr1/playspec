# GitHub Issue #53 - PlaySpec Update 6.4 Technical Spec

## Scope

Implement only `Phase 6.4 - Human Edit Observation Intake` from the PlaySpec evolution phase plan.

In scope:

- Add `playspec evolution record-edit`.
- Persist human edit observations under `.playspec/evolution/human-edits/{editId}.yaml`.
- Reject duplicate observation IDs on creation so records are append-only.
- Support explicit status changes to `ignored` or `superseded`.
- Validate target and before/after refs as workspace-relative, non-escaping paths.
- Do not mutate proposals, workflows, templates, rules, task state, prompts, or completion behavior.

Out of scope:

- Proposal generation, proposal evidence updates, auto-apply, prompt surfacing, MCP, viewer, harness, archive, token modes, workflow editing, or DAG behavior.

## Design

Add a human edit observation model with:

- `id`
- `createdAt`
- `updatedAt`
- `status`
- `targetPath`
- `summary`
- `rationale`
- optional `sourceTaskId`
- optional `proposalId`
- optional `beforeRef`
- optional `afterRef`
- optional `statusReason`

The CLI has two modes:

- Create: `playspec evolution record-edit --target <path> --summary <text> --rationale <text> [--id <id>] [--task <id>] [--proposal <id>] [--before <path>] [--after <path>]`
- Status update: `playspec evolution record-edit --edit <id> --status ignored|superseded [--reason <text>]`

Status updates preserve original identity and source/target fields. Creation fails if the observation file already exists.

## Files

- `src/utils/paths.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/human-edit-store.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/integration/evolution-human-edit-store.test.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`

## Acceptance

- New observations persist to `.playspec/evolution/human-edits/{editId}.yaml`.
- Duplicate IDs are rejected without changing the existing file.
- Escaping paths are rejected.
- Ignored/superseded status changes keep the same file.
- Recording a human edit does not update proposal revision/evidence refs.
- Prompt rendering and completion behavior remain unchanged.
