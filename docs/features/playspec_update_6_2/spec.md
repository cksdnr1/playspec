# PlaySpec Update 6.2 Technical Spec

## Scope

Implement only Phase 6.2, Proposal Update / Merge, from `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`.

In scope:

- `playspec evolution update <proposalId> --file <proposal.yaml>`
- `playspec evolution append-evidence <proposalId> --file <path> --note <text>`
- Store-level update and append behavior for existing pending/refining proposals.
- Revision preservation under `.playspec/evolution/proposals/{proposalId}/revisions/revision-{n}.yaml`.
- Full proposal validation and validation report rewrite after every successful update.
- Tests for valid updates, evidence append, immutable terminal statuses, invalid update atomicity, unchanged prompt/completion behavior, and unchanged MCP tool surface.

Out of scope:

- Proposal apply/diff, backups, apply reports, workflow/template/rule mutation, prompt surfacing, completion-time evolution snapshots, MCP proposal intake, automatic proposal generation, harness behavior, and future phase work.

## Use Case Alignment

A mono-spec run may refine the same improvement proposal as implementation and review evidence accumulates. The user needs a supported path to update a pending/refining proposal and append evidence without creating stale competing proposals.

## High-Level Current Implementation Summary

Phase 6.1 exists. The CLI can validate/store proposal YAML, list proposals, show proposal details, and skip proposals. The store persists canonical proposal YAML and validation YAML under `.playspec/evolution/proposals/{proposalId}/`. Proposal schemas support `pending`, `refining`, and `skipped`.

There is no update command, evidence append schema, revision directory helper, or store API for preserving previous canonical proposal revisions.

## Relevant Files Reviewed

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md` - Phase 6.2 requirements and non-goals.
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md` - broader proposal lifecycle direction.
- `src/cli/index.ts` - `evolution` subcommand registration.
- `src/cli/commands/evolution.ts` - current propose/list/show/skip handlers and input normalization.
- `src/evolution/proposal-store.ts` - persistence, validation report writing, list/load/skip behavior.
- `src/evolution/schemas.ts` - proposal and validation schemas.
- `src/evolution/types.ts` - schema-aligned TypeScript types.
- `src/utils/paths.ts` - path helpers for evolution proposal storage.
- `tests/integration/evolution-proposal-store.test.ts` - store coverage to extend.
- `tests/cli.test.ts` - CLI command coverage to extend.
- `tests/integration/init-create-next.test.ts` and `tests/integration/mcp-server.test.ts` - existing regressions for no prompt surfacing and no MCP proposal tools.

## Active Entry Points And Bypasses

Active entry points:

- `playspec evolution propose --file <proposal.yaml>` validates and stores a new canonical proposal.
- `playspec evolution list` reads stored proposals.
- `playspec evolution show <proposalId>` prints canonical proposal details and validation metadata.
- `playspec evolution skip <proposalId>` marks a proposal skipped.

New entry points:

- `playspec evolution update <proposalId> --file <proposal.yaml>` loads the existing proposal, validates the incoming proposal, preserves the old canonical file, increments revision, updates timestamps, writes canonical YAML, and rewrites validation YAML.
- `playspec evolution append-evidence <proposalId> --file <path> --note <text>` validates a workspace-relative evidence path, appends an evidence reference, preserves the old canonical file, increments revision, updates timestamps, writes canonical YAML, and rewrites validation YAML.

Bypass paths:

- Direct edits to `.playspec/evolution/proposals/*/proposal.yaml` bypass revision history.
- Direct edits to validation YAML can desync validation metadata from canonical proposal YAML.
- Direct filesystem writes can add arbitrary files under proposal directories; list/load should continue to validate canonical proposal records.

## Current Architecture

Verified flow:

```text
CLI evolution command
  -> src/cli/commands/evolution.ts
  -> EvolutionProposalStore
  -> zod schema validation
  -> .playspec/evolution/proposals/{proposalId}/proposal.yaml
  -> .playspec/evolution/proposals/{proposalId}/validation.yaml
```

Proposed Phase 6.2 flow:

```text
update/append command
  -> load current proposal
  -> require status pending/refining
  -> validate incoming proposal or evidence path
  -> build merged proposal in memory
  -> force id, createdAt, revision, and updatedAt from the update operation
  -> reject incoming status changes except pending <-> refining
  -> validate full merged proposal and workspace references
  -> build validation report in memory
  -> write previous canonical proposal to revisions/revision-{oldRevision}.yaml
  -> atomically rewrite proposal.yaml
  -> rewrite validation.yaml
```

Invalid updates must perform no writes at all: no canonical proposal rewrite, no validation rewrite, and no revision file creation.

## Verified Behavior

Verified:

- Proposal IDs are filesystem-safe.
- Proposal target and artifact paths must be workspace-relative and non-escaping.
- Existing artifact references must exist during workspace validation.
- `propose` refuses duplicate proposal IDs.
- `skip` updates canonical status to `skipped`.
- Prompt rendering ignores stored proposals.
- Completion does not create evolution context snapshots.
- MCP registers no proposal/evolution intake tools.

Inferred:

- Phase 6.2 can remain entirely inside `src/evolution` plus CLI adapters.
- Appending evidence is best modeled as adding an artifact reference with a dedicated role and metadata fields, because the existing proposal source already owns artifact references.

Implementation decision:

- Extend proposal status validation to include `applied` and `failed` only as persisted lifecycle statuses that Phase 6.2 must reject for update/evidence append. This does not add apply behavior, failure reports, backups, or status transitions into those states.

## Problems

1. Users cannot revise an active proposal without manually editing canonical YAML.
2. Previous proposal revisions are not preserved.
3. Evidence accumulation requires either manual YAML edits or duplicate proposals.
4. `show` output does not expose evidence references.
5. Existing CLI tests assert that `update` does not exist; those must be updated for Phase 6.2.

## Proposed Direction

Add store APIs:

- `updateProposal(proposalId, incomingProposal)`
- `appendEvidence(proposalId, evidence)`

Add schemas/types:

- Extend status schema to include `applied` and `failed` for rejection-only handling.
- Add `EvolutionEvidenceReference` with workspace-relative `path`, non-empty `note`, `addedAt`, and `source`.
- Add `evidenceRefs` to proposal records with a default empty array.

Add path helpers:

- `getEvolutionProposalRevisionsRoot()`
- `getEvolutionProposalRevisionPath()`

Add CLI behavior:

- Normalize update input similarly to propose, but force the route proposal ID, preserve `createdAt`, increment revision, and allow incoming content to change mutable proposal fields.
- Incoming update YAML may keep the current active status or switch between `pending` and `refining`. Incoming `skipped`, `applied`, or `failed` status is rejected, and existing proposals already in `skipped`, `applied`, or `failed` status are rejected before merge.
- Evidence append validates path existence and writes source command metadata.
- Error hints should tell users that only pending/refining proposals can be changed.

Validation issue resolution:

- Latest Step 2 score: 88/100.
- Resolved blocker: the implementation flow now validates the merged proposal and workspace references before writing any revision, canonical proposal, or validation file.
- Resolved risk: update status handling is explicit. Active proposals may remain in the same active status or switch between `pending` and `refining`; terminal statuses are rejection-only in Phase 6.2.
- Remaining blockers: none known.

## File-By-File Plan

- `src/evolution/types.ts`: add statuses and evidence reference type fields.
- `src/evolution/schemas.ts`: add status values and `evidenceRefs` validation.
- `src/utils/paths.ts`: add revision path helpers.
- `src/evolution/proposal-store.ts`: implement revision preservation, update, evidence append, and validation report rewrite.
- `src/cli/commands/evolution.ts`: add command handlers and show evidence count/details.
- `src/cli/index.ts`: register `update` and `append-evidence`.
- `tests/integration/evolution-proposal-store.test.ts`: cover update, append evidence, terminal rejection, and invalid atomicity.
- `tests/cli.test.ts`: cover command registration and CLI update/evidence behavior.
- Existing prompt/completion/MCP tests remain regression coverage.

## Risks And Open Questions

- Atomicity matters: invalid incoming updates must not write canonical YAML or revision files.
- Status expansion to `applied`/`failed` must not imply apply support; no command may transition proposals into those statuses in this phase.
- Evidence path validation should require workspace-relative, non-escaping, existing files.
- Revision filenames should be deterministic and overwrite-safe by status/loading semantics.

## Reader Aids

Status legend:

- Verified: read directly from current code/tests.
- Inferred: consistent with current architecture and phase docs.
- Proposed: Phase 6.2 implementation direction.
- Out of scope: explicitly deferred to later phases.
