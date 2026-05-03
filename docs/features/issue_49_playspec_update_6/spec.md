# Issue 49 PlaySpec Update 6 Technical Spec

## Scope

Implement only Phase 6: Evolution Proposal Schema And Store.

In scope:
- Add a new `src/evolution/` module for proposal schemas, TypeScript types, validation reports, and YAML-backed proposal storage.
- Add filesystem-safe proposal ID validation/generation.
- Persist proposal records at `.playspec/evolution/proposals/{proposalId}/proposal.yaml`.
- Persist validation reports at `.playspec/evolution/proposals/{proposalId}/validation.yaml`.
- Support proposal statuses `pending` and `skipped` in the schema/store, with store-level status updates only.
- Add `#evolution/*.js` to runtime and compile-time alias maps.
- Add focused tests for schema validation, persistence/reload, status updates, alias parity, and unchanged prompt/completion/MCP/CLI surfaces.

Out of scope:
- Public `playspec evolution` CLI commands.
- Proposal list/show/skip UX.
- Proposal apply, diff, backups, or mutation of workflows/templates/rules/task state.
- Prompt surfacing of proposals.
- Completion-time evolution snapshots.
- MCP proposal intake.
- Harness retries, viewer, token/context modes, workflow editing, DAG behavior, or future evolution phases.

## Use Case Alignment

The user needs the first safe persistence layer for future evolution proposals. External agents or later CLI phases should be able to hand PlaySpec a structured proposal, have it validated, stored, reloaded, and accompanied by a validation report. This phase does not make the proposal visible in normal commands and does not execute any proposed action.

## High-Level Current Implementation Summary

Verified behavior:
- There is no `src/evolution/` module.
- Phase 5 and 5.1 archive support exists. Archived tasks live under `.playspec/tasks/archived/{taskId}/`, and explicit workspace-relative archived artifact paths can be used as context refs when the file exists.
- Migration provides the nearest pattern for schema-first YAML persistence: `src/migration/schemas.ts`, `src/migration/types.ts`, and `src/migration/migration-store.ts`.
- `src/utils/paths.ts` owns `.playspec` path helpers.
- Runtime alias parity is enforced by `tests/integration/runtime-bin.test.ts`.
- `src/cli/index.ts` registers no `evolution` command group today.
- `src/mcp/server.ts` registers no proposal/evolution intake tool.
- Prompt rendering and completion are implemented in `PlaySpecCore`; neither path loads proposal storage today.

Inferred behavior:
- Proposal storage should be a standalone module rather than a `TaskStore` extension because Phase 6 stores global evolution records under `.playspec/evolution/`, not under active or archived task roots.
- Store APIs can be imported by future core or CLI phases, but this phase does not need to wire them into normal prompt or completion flow.

## Relevant Files Reviewed

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md`
- `docs/features/playspec_update_5_1/spec.md`
- `docs/features/playspec_update_5_1/result.md`
- `src/migration/schemas.ts`
- `src/migration/types.ts`
- `src/migration/migration-store.ts`
- `src/utils/paths.ts`
- `src/utils/fs.ts`
- `src/core/playspec-core.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/index.ts`
- `src/mcp/server.ts`
- `package.json`
- `tsconfig.json`
- `tests/integration/runtime-bin.test.ts`

## Active Entry Points And Bypasses

Active entry points to preserve:
- `playspec prompt` and `playspec next` render prompts from active task state only.
- `playspec complete` writes normal completion artifacts only.
- MCP tools use `resolveMcpTaskId()` and expose current task/prompt/complete/evidence/desync/rollback behavior only.
- Archive CLI commands remain read-only inspection for archived task records.

New internal entry points:
- `EvolutionProposalSchema` and related report schemas.
- `EvolutionProposalStore` methods to save, load, validate/report, and update status.

Bypasses and old paths:
- Migration actions are not an evolution apply engine and must not be reused to mutate proposal targets in Phase 6.
- Direct YAML edits under `.playspec/evolution/proposals/` bypass store validation; tests should prove store load revalidates records.
- Phase 6 must not register a public `playspec evolution` command group or an MCP proposal tool as a hidden bypass into proposal intake.

## Current Architecture

Proposed storage layout:

```text
.playspec/
  evolution/
    proposals/
      {proposalId}/
        proposal.yaml
        validation.yaml
```

Proposed module split:
- `src/evolution/types.ts` defines proposal, action, reference, status, and report TypeScript types.
- `src/evolution/schemas.ts` defines zod schemas and path refinements.
- `src/evolution/proposal-store.ts` owns YAML persistence, reload validation, report writing, and status updates.

Proposed validation flow:

```text
raw proposal object
  -> EvolutionProposalSchema.parse()
  -> proposalId filesystem-safety check
  -> workspace-relative target/reference path checks
  -> save proposal.yaml
  -> save validation.yaml
  -> later load revalidates proposal.yaml
```

## Verified Behavior

- Existing context reference validation rejects absolute, workspace-escaping, and missing context files during prompt rendering.
- Phase 5.1 intentionally permits explicit workspace-relative archived artifact paths when they exist.
- `writeTextFile()` and `writeTextFileAtomic()` create parent directories before writing.
- Runtime-bin tests compare `package.json#imports` and `tsconfig.json#compilerOptions.paths`, then scan emitted runtime aliases.
- Normal CLI help currently lists `archive` and `migrate`, but no `evolution` command group.
- MCP server tool registration currently contains no evolution/proposal tool names.

## Problems

1. There is no schema for evolution proposals.
2. There is no canonical proposal storage path.
3. There is no validation report format for accepted or rejected proposal intake.
4. There is no proposal status model for future CLI skip/apply phases.
5. Adding `src/evolution/` without alias updates would break runtime-bin parity.
6. Proposal records need to reference archived artifacts without copying archived task artifacts into proposal storage.

## Proposed Direction

Create a standalone evolution module with strict schemas and a conservative store API.

Proposal schema should include:
- `id`
- `createdAt`
- `status`: `pending | skipped`
- `source`: source task ID plus optional archived task ID and explicit artifact references
- `targetFiles`: workspace-relative target paths
- `riskLevel`: `low | medium | high`
- `actions`: discriminated union of known proposal action types
- `rationale`
- `review`: structured review status metadata

Action schemas are intentionally narrower than migration actions. Phase 6 only validates and stores actions, so the initial known action union is:
- `propose_file_change`: describes a proposed change to one workspace-relative target file.
- `propose_section_change`: describes a proposed section-level change inside one workspace-relative target file.
- `propose_context_reference`: describes a proposed explicit context/reference addition without mutating task state.

These action records are descriptive only. They are not executable commands, do not create backups, and do not grant permission to mutate target files. Unknown action types must fail schema validation.

Validation report should include:
- `proposalId`
- `createdAt`
- `status`: `valid | invalid`
- `errors`
- `warnings`
- `checkedPaths`
- `summary`

Store behavior:
- `saveProposal(proposal)` validates and writes `proposal.yaml`.
- `loadProposal(proposalId)` reads and validates `proposal.yaml`.
- `saveValidationReport(report)` validates and writes `validation.yaml`.
- `updateProposalStatus(proposalId, status, metadata?)` rewrites only `proposal.yaml` and preserves `validation.yaml`.
- Proposal IDs are stable: the store must not rename an existing proposal on load or status update.
- Collision behavior should reject writing a different proposal into an existing proposal ID directory unless the existing proposal has the same ID and the caller is explicitly updating status.
- Store validation must apply Phase 5.1-style artifact reference checks for archived artifacts: references must be workspace-relative, must not escape the workspace, and must exist at validation time. Target files must be workspace-relative and non-escaping, but they do not need to exist because a proposal may target a future edit.

## File-By-File Plan

- `package.json`
  - Add `#evolution/*.js` to `imports`.

- `tsconfig.json`
  - Add `#evolution/*.js` to `compilerOptions.paths`.

- `src/utils/paths.ts`
  - Add helpers for `.playspec/evolution`, proposals root, proposal root, proposal YAML, and validation YAML paths.

- `src/evolution/types.ts`
  - Add Phase 6 proposal, action, source/reference, review, and validation report types.

- `src/evolution/schemas.ts`
  - Add zod schemas with strict action types, status enum, risk enum, filesystem-safe ID validation, and workspace-relative path validation.

- `src/evolution/proposal-store.ts`
  - Add YAML save/load/report/status update APIs.
  - Use existing fs helpers and schema validation before writes.
  - Do not import CLI code.

- `tests/integration/evolution-proposal-store.test.ts`
  - Cover schema rejection of unknown action types and workspace-escaping paths.
  - Cover archived artifact references by explicit existing workspace-relative paths.
  - Cover missing archived artifact references being rejected by store validation.
  - Cover save/reload and status update preserving proposal/report files.
  - Cover no copying of archived artifact content into proposal storage.
  - Cover invalid proposal IDs, generated ID uniqueness, stable IDs on load/update, and collision rejection.

- `tests/cli.test.ts`
  - Add a narrow regression that `playspec evolution` is not registered in Phase 6, if no equivalent command-surface test already exists.

- `tests/integration/mcp-server.test.ts`
  - Add or extend a regression proving no MCP proposal intake tool is registered.

- Prompt/completion regression tests
  - Add focused fixture-based regressions proving normal prompt rendering ignores stored proposals.
  - Add focused fixture-based regressions proving completion does not write evolution context snapshots when stored proposals exist.

## Risks And Open Questions

Risks:
- If action types are too broad, later phases may treat the schema as permission to mutate arbitrary files. Keep action validation descriptive and non-executing in Phase 6.
- If proposal store load is wired into prompt/completion now, Phase 6 would accidentally implement Phase 6.4 behavior.
- If skipped status update is exposed through CLI now, Phase 6 would accidentally implement Phase 6.1 behavior.
- If proposal references validate only strings and not path shape, workspace-escaping paths could be persisted for later unsafe use.

Open questions:
- Store-level skipped status metadata is useful for tests and forward compatibility, but no user-facing skip command should be added in this phase.

## Reader Aids

Phase 6 definition of "stored with reports": `proposal.yaml` and `validation.yaml` exist under the same proposal ID directory and both validate through zod schemas.

Phase 6 definition of "without mutation": proposal store writes only under `.playspec/evolution/proposals/{proposalId}/` and does not modify workflow assets, templates, rules, task records, source files, archived task artifacts, prompt output, completion artifacts, or MCP tool registration.

Phase 6 definition of "explicit archived artifact reference": a workspace-relative path such as `.playspec/tasks/archived/{taskId}/result.md` recorded in proposal metadata, not copied into the proposal directory.
