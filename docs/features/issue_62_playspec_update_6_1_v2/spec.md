# Issue #62 PlaySpec Update 6.1 v2 Technical Spec

## Scope

Implement only Phase 6.1, "Evolution Proposal CLI Intake", from `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`.

In scope:

- Add a public `playspec evolution` CLI group with `propose --file`, `list`, `show`, and `skip`.
- Validate external proposal YAML with the evolution proposal schema before storing it.
- Store accepted proposals and validation reports under `.playspec/evolution/proposals/{proposalId}/`.
- Expose proposal statuses `pending`, `refining`, and `skipped` through list/show output.
- Mark proposals skipped with timestamp and optional reason without deleting proposal or validation files.

Out of scope:

- Proposal apply, update, merge, evidence append, generation, diff, reopen, clear, archive, or MCP intake.
- Prompt rendering integration or completion-time evolution context snapshots.
- Workflow/template/rule mutation from proposals.
- Proposal apply lifecycle states such as `applied`, `failed`, `archived`, or `superseded`.
- Evidence append behavior. Optional evidence-related fields may be preserved only if already present and schema-valid; no command may add evidence in this phase.

## Use Case Alignment

Users and external agents can draft evolution proposal YAML outside PlaySpec, then ask PlaySpec to validate and persist the proposal through an explicit CLI command. Users can inspect pending/refining/skipped proposals and intentionally skip one before any later apply path exists.

The issue referenced `playspec_evolution_total_spec.md.md`; the repository contains the intended file at `docs/features/playspec_evolution/playspec_evolution_total_spec.md`.

## Current Implementation Summary

Verified:

- `src/evolution/schemas.ts` defines proposal ID, status, action, proposal, and validation report schemas.
- `src/evolution/proposal-store.ts` can save/load proposals, save/load validation reports, validate raw proposals, validate artifact refs against the workspace, generate proposal IDs, and update status.
- `src/utils/paths.ts` already owns `.playspec/evolution/proposals/{proposalId}/proposal.yaml` and `validation.yaml` paths.
- Tests currently assert that no public evolution CLI group is registered.
- Prompt rendering and completion tests already assert stored proposals are ignored.
- MCP tests currently assert no proposal/evolution intake tools are registered.

Inferred:

- Phase 6.1 should build on the Phase 6 store rather than introduce a second storage layer.
- Duplicate active IDs should be rejected by the existing store collision check, but CLI output should add recovery guidance.

## Relevant Files Reviewed

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md`
- `src/cli/index.ts`
- `src/evolution/proposal-store.ts`
- `src/evolution/schemas.ts`
- `src/evolution/types.ts`
- `src/utils/paths.ts`
- `tests/cli.test.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`

## Active Entry Points And Bypasses

Current active entry points:

- CLI command registration in `src/cli/index.ts`.
- Evolution store methods in `src/evolution/proposal-store.ts`.

Bypasses to preserve:

- `prompt`/`next` must not load proposal summaries.
- `complete` must not write evolution context snapshots.
- MCP server must not register proposal/evolution intake tools in this phase.

## Current Architecture

```mermaid
flowchart LR
  CLI[src/cli/index.ts] --> Commands[src/cli/commands/*]
  Commands --> Store[src/evolution/proposal-store.ts]
  Store --> Schemas[src/evolution/schemas.ts]
  Store --> Paths[src/utils/paths.ts]
  Paths --> Files[.playspec/evolution/proposals/{id}]
```

## Verified Behavior

- `EvolutionProposalStore.saveProposal()` rejects existing proposal directories.
- `EvolutionProposalStore.updateProposalStatus()` rewrites `proposal.yaml` but preserves `validation.yaml`.
- `EvolutionProposalStore.validateProposal()` produces a validation report for valid or invalid raw records.
- `validateProposalForWorkspace()` rejects missing or workspace-escaping artifact refs.

## Problems

- No CLI command exposes the existing store.
- Status types currently omit `refining`, which Phase 6.1 requires list/show to expose.
- Proposal records currently omit `revision` and `updatedAt`, while Phase 6.1 requires intake to persist revision `1` and initialize/update timestamps.
- CLI tests must change from "no evolution command" to the narrow 6.1 command surface.
- Store-level `updateProposalStatus()` is broader than the public Phase 6.1 command needs. The new CLI must expose only the skip transition and must not provide reopen/reset behavior.

## Proposed Direction

Add a small CLI command module, `src/cli/commands/evolution.ts`, that:

- Parses YAML proposal files with `yaml`.
- Normalizes a raw mapping before validation:
  - if `id` is absent, generate a filesystem-safe ID from the proposal file name;
  - if `id` is present, validate it as filesystem-safe;
  - set `revision: 1` for new intake;
  - set `createdAt` and `updatedAt` to the same current timestamp when absent;
  - set `status: pending` when absent.
- Validates the normalized proposal with `EvolutionProposalStore.validateProposal()` before workspace validation and persistence.
- Saves the proposal and validation report only after both schema and workspace validation pass.
- Lists proposals by loading stored `proposal.yaml` files from `.playspec/evolution/proposals`.
- Shows one proposal and its validation report in reviewer-readable CLI output.
- Skips one proposal by setting `status: skipped`, `updatedAt`, `skippedAt`, and optional `skipReason`.
- Treats `pending` and `refining` as active duplicate statuses for user messaging; because Phase 6.1 has no update/merge command, any existing proposal directory remains a collision and should fail with guidance to use the later update command.

Keep all behavior local to CLI plus evolution schema/store helpers. Do not change prompt rendering, completion, workflows, MCP tools, migration, or apply-like behavior.

## File-by-File Plan

- `src/evolution/types.ts`: add `refining`, `revision`, and `updatedAt` fields. Preserve broader evidence/source-result field design for later phases unless an optional field is needed for schema-compatible reads.
- `src/evolution/schemas.ts`: accept `refining`, require positive integer `revision`, and require `updatedAt`.
- `src/evolution/proposal-store.ts`: add proposal listing, keep duplicate rejection, update `updatedAt` on status change, and preserve validation files. Do not add public reopen/reset semantics.
- `src/cli/commands/evolution.ts`: add CLI handlers for propose/list/show/skip.
- `src/cli/index.ts`: register the `evolution` command group and subcommands.
- `tests/cli.test.ts`: add CLI coverage for propose/list/show/skip/duplicate behavior and update the old no-command assertions.
- `tests/integration/evolution-proposal-store.test.ts`: update fixtures for schema fields and add list/refining status coverage as needed.

## Risks And Open Questions

- Older Phase 6 proposal fixtures without `revision`/`updatedAt` will need test updates. This is expected because Phase 6.1 explicitly requires those fields at intake.
- `refining` can be represented and listed in Phase 6.1, but no command should transition into it until Phase 6.2.
- Invalid proposal intake should not leave partial proposal files. The CLI should write `validation.yaml` only for accepted proposals because there is no safe proposal ID directory for invalid input.

## Reader Aids

Expected accepted proposal layout:

```text
.playspec/evolution/proposals/{proposalId}/
  proposal.yaml
  validation.yaml
```

Expected command surface:

```text
playspec evolution propose --file proposal.yaml
playspec evolution list
playspec evolution show proposal_123
playspec evolution skip proposal_123 --reason "Not needed"
```
