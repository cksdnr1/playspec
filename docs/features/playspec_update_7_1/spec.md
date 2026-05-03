# PlaySpec Update 7.1 Technical Spec

## Scope

Implement only Phase 7.1, "Automatic Proposal Generation", from `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`.

Phase 7.1 adds an explicit command path that can generate a draft evolution proposal from a workspace evidence file, or refine an existing active proposal. Generation must validate through the existing proposal schema and storage/update paths, respect the Phase 7 harness blocked state, and never apply proposals or mutate PlaySpec assets.

Out of scope:

- proposal apply, diff, backup, or report behavior changes;
- prompt, complete, migration, workflow, or MCP-triggered generation;
- MCP generation tools;
- token/context modes, viewer, DAG, or workflow editing phases;
- automatic proposal generation without an explicit CLI command.

## Use Case Alignment

A user has explicit evidence from a completed task, review, harness run, or human observation and wants PlaySpec to draft a reviewable evolution proposal. The generated record should enter the same lifecycle as manually created proposals, so humans can inspect, update, skip, diff, and explicitly apply it later.

## High-Level Current Implementation Summary

Verified current behavior:

- `src/evolution/schemas.ts` validates proposal IDs, status, source refs, evidence refs, target files, actions, review state, validation reports, apply reports, and prompt context snapshots.
- `src/evolution/proposal-store.ts` stores proposals under `.playspec/evolution/proposals/{proposalId}/proposal.yaml`, writes `validation.yaml`, preserves previous revisions on update under `revisions/revision-{n}.yaml`, and rejects updates to terminal proposals.
- `src/cli/commands/evolution.ts` exposes manual `propose`, `update`, `append-evidence`, `list`, `show`, `skip`, `diff`, `apply`, and `record-edit`.
- `src/core/playspec-core.ts` owns harness status/attempt/reset behavior; blocked or circuit-breaker records are persisted in active task `harness.yaml`.
- `src/mcp/server.ts` has no evolution intake/generation tools and uses explicit MCP task/session context.

Inferred behavior:

- Phase 7.1 should reuse the proposal store's save/update paths instead of introducing another persistence format.
- Duplicate detection can be based on active `pending`/`refining` proposals that target the same improvement area, represented by overlapping target files with the generated proposal.
- "Generated output" can be deterministic local proposal YAML from explicit CLI metadata and evidence, because no LLM provider or autonomous runner exists in scope.

Open questions:

- The phase plan does not define an LLM/provider interface for generation. This implementation should keep generation local and deterministic, producing a draft proposal from explicit evidence and CLI fields.

## Relevant Files Reviewed

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-store.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `src/core/playspec-core.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/utils/paths.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/integration/harness-store.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`

## Active Entry Points And Bypasses

Active entry points:

- `playspec evolution propose --file <proposal.yaml>` validates and stores a new manual proposal.
- `playspec evolution update <proposalId> --file <proposal.yaml>` updates only active proposals and writes revision history.
- `playspec evolution append-evidence <proposalId> --file <path> --note <text>` appends evidence to active proposals.
- `playspec harness status/attempt/reset` manages blocked harness state per active task.

New entry point:

- `playspec evolution generate --task <taskId> --from-evidence <path> [--proposal <proposalId>] --target <path> --summary <text> --rationale <text>`

Bypasses to avoid:

- Do not write proposal YAML directly from the CLI without `EvolutionProposalSchema` validation.
- Do not mutate workflow, template, rule, task, migration, source, test, or package files as part of generation.
- Do not use MCP or `.playspec/HEAD` for generation context. The new command requires `--task`.

## Current Architecture

Verified flow:

```text
CLI evolution command
  -> runEvolutionPropose / runEvolutionUpdate / runEvolutionAppendEvidence
  -> EvolutionProposalStore
  -> EvolutionProposalSchema validation
  -> .playspec/evolution/proposals/{proposalId}/...
```

Proposed Phase 7.1 flow:

```text
playspec evolution generate --task --from-evidence --target ...
  -> check active task harness status
  -> build deterministic generated proposal
  -> validate with EvolutionProposalSchema
  -> new proposal: reject duplicate active target overlap, then save + validation report
  -> existing proposal: update only pending/refining through store.updateProposal()
```

## Verified Behavior

- The proposal store rejects `applied` and `failed` intake through `saveProposal`.
- `updateProposal()` and `appendEvidence()` preserve the previous revision before writing the new proposal.
- Missing evidence and artifact refs are rejected during workspace validation.
- Harness status can be read without creating `harness.yaml`; failures block at the retry budget.
- MCP tests currently assert no proposal/evolution intake tool registration.

## Problems

- There is no `playspec evolution generate` command.
- Proposal records have evidence refs with `source: append-evidence` only, so generated evidence refs need schema/type support for generation source.
- There is no helper that checks harness blocked/circuit-breaker state before evolution generation.
- There is no active duplicate detection before creating a generated proposal.

## Proposed Direction

Add a narrow generation module in `src/evolution/` that:

- accepts explicit CLI input for task ID, evidence path, target file, summary, rationale, risk level, optional proposal ID, and optional generated proposal ID;
- checks `PlaySpecCore.getHarnessStatus(taskId)` and blocks when `blocked` or `circuitBreaker` is true;
- builds a proposal with `source.taskId`, evidence refs, generation source metadata, target files, review `unreviewed`, and a non-executable `propose_file_change` action;
- validates generated records before storage;
- updates existing proposals only through `EvolutionProposalStore.updateProposal()`;
- creates new proposals only when no active proposal has overlapping target files.

## File-By-File Plan

- `src/evolution/types.ts`: add generated evidence/source metadata types as needed.
- `src/evolution/schemas.ts`: allow generated evidence refs and validate optional generation metadata.
- `src/evolution/proposal-generator.ts`: implement deterministic proposal generation orchestration and duplicate detection.
- `src/cli/commands/evolution.ts`: add `runEvolutionGenerate()`.
- `src/cli/index.ts`: register `evolution generate` with required explicit options.
- `tests/integration/evolution-proposal-store.test.ts`: cover generated schema/storage/update behavior.
- `tests/integration/harness-store.test.ts` or a generation-specific test: cover harness blocked generation rejection.
- `tests/cli.test.ts`: cover CLI command registration and basic generate flows.
- `tests/integration/mcp-server.test.ts`: keep no MCP generation tool registration coverage.

## Risks And Open Questions

- Duplicate matching by target file is conservative but may reject unrelated changes to the same file. The error should guide users to `--proposal` for refinement.
- Deterministic generation does not replace human-authored proposal quality; it provides a schema-valid draft for review.
- Existing tests may rely on evidence source being only `append-evidence`; update only where Phase 7.1 requires generated evidence.

## Reader Aids

The implementation should be easy to audit by searching for `evolution generate`. No normal prompt, completion, migration, workflow, MCP, or apply path should call the generator.
