# Issue 43 Baseline Confirmation Technical Spec

## Scope

Implement only PlaySpec Update 4.2 / Phase 4.2 Baseline Confirmation from `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`.

This phase confirms whether the total spec's `#pack/*.js` alias parity warning is still true against the execution-time repository, and records the baseline evidence before future phases begin.

Out of scope:

- Archive, evolution, harness, token mode, workflow editing, viewer, or DAG behavior.
- MCP migration tools or new MCP context resolution behavior.
- Migration action type expansion.
- Source-code changes unless validation fails.

## Use Case Alignment

The user needs a durable baseline gate before later PlaySpec evolution phases. The outcome is not a new feature surface; it is a verified record that runtime aliases, compiled bins, migration behavior, and MCP no-HEAD behavior remain clean after Phase 4.1.

## Current Implementation Summary

PlaySpec is a TypeScript CLI/MCP workflow engine. Runtime package import aliases are defined in `package.json#imports`; compile-time aliases are defined in `tsconfig.json#compilerOptions.paths`.

The total spec records a stale validation failure: it says `package.json` had `#pack/*.js` while `tsconfig.json` did not. The current repository contains `#pack/*.js` in both files. There is no `src/pack/` implementation today, so `#pack` is an unused reserved future module boundary, not active behavior.

## Relevant Files Reviewed

- `.playspec/tasks/active/issue_43_baseline_confirmation/sources/source_problem.md`
- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md`
- `docs/features/playspec_evolution/result.md`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `tests/integration/runtime-bin.test.ts`
- `tests/integration/migration.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/playspec_phase4.1_test_result.md`
- `docs/playspec_phase4.1_implementation_result.md`

## Active Entry Points And Bypasses

Active entry points:

- `pnpm build` validates TypeScript compilation and emitted runtime alias rewriting.
- `pnpm test -- --run tests/integration/runtime-bin.test.ts` validates package import alias parity and compiled CLI/MCP bin startup.
- `pnpm test -- --run tests/integration/migration.test.ts` validates Phase 4.1 migration regression coverage.
- `pnpm test -- --run tests/integration/mcp-server.test.ts` validates MCP session/task context behavior, including no HEAD fallback.

Bypasses and risks:

- Direct alias edits in only `package.json` or only `tsconfig.json` can break runtime-bin parity.
- Direct `.playspec` task YAML edits bypass normal schema-validated command paths.
- Future phases could mistake an empty `#pack` alias for accidental drift unless this phase records it as reserved.

## Current Architecture

Verified baseline flow:

```text
package.json#imports
  -> Node runtime package import resolution

tsconfig.json#paths
  -> TypeScript compile-time alias resolution

tests/integration/runtime-bin.test.ts
  -> compares alias keys
  -> scans emitted runtime alias families in src/ and dist/
  -> starts compiled CLI and MCP bins
```

MCP context flow remains:

```text
MCP tool args
  -> resolveMcpTaskId(taskId | sessionId)
  -> PlaySpecCore
```

No MCP path should read `.playspec/HEAD`.

## Verified Behavior

Verified from code before validation:

- `package.json#imports` includes `#pack/*.js`.
- `tsconfig.json#compilerOptions.paths` includes `#pack/*.js`.
- `tests/integration/runtime-bin.test.ts` compares the full key set from runtime imports and TypeScript paths.
- The same runtime-bin suite also starts the compiled CLI and MCP bins.
- Migration plans are validated through `MigrationPlanSchema`.
- `delete_file` is not a migration action type.
- `archive_file` migration actions require `--with-archive`.
- `resolveMcpTaskId()` is the MCP context resolver and rejects missing `taskId`/`sessionId` instead of falling back to HEAD.

Inferred behavior:

- If focused validation passes, the total spec's `#pack` warning is stale for the current repository state.
- Because no files import `#pack/*.js` and no `src/pack/` files exist, preserving the alias is only a reserved future boundary.

Open questions:

- None for Phase 4.2. Later phases must still decide when or whether to populate `src/pack/`.

## Problems

1. The total spec contains a stale alias parity warning.
2. The repository did not yet have a Phase 4.2 execution artifact recording that the warning was reconciled.
3. Later phases could reinterpret the empty `#pack` module boundary as accidental unless the reserved status is explicit.

## Proposed Direction

Preserve `#pack/*.js` in both runtime and compile-time alias configuration if validation passes. Record it as a reserved future alias in the Phase 4.2 result. Do not add a `src/pack/` implementation, because Phase 4.2 is confirmation-only and no active runtime behavior requires it.

If validation fails, apply only the narrow alias-parity fix needed to make runtime and compile-time aliases consistent.

## File-By-File Plan

- `docs/features/issue_43_baseline_confirmation/spec.md`: Record this technical spec.
- `docs/features/issue_43_baseline_confirmation/plan.md`: Record the narrow implementation/validation plan.
- `docs/features/issue_43_baseline_confirmation/result.md`: Record validation commands and outcomes.
- `docs/features/issue_43_baseline_confirmation/pr.md`: Draft the PR body.
- `docs/playspec_phase4.2_baseline_confirmation_result.md`: Durable phase-execution result doc for Phase 4.2 baseline reconciliation.

No production source file changes are planned unless validation fails.

## Risks And Open Questions

- Risk: Full test suite runtime may be longer than focused Phase 4.2 validation. Mitigation: run the targeted required suites and report any skipped broader validation explicitly.
- Risk: Empty `#pack` alias could be mistaken for dead config. Mitigation: document it as a reserved future alias.

## Reader Aids

`playspec_evolution_total_spec.md` is historical context and contains a known stale statement for this phase. `playspec_evolution_phase_plan.md` is the execution source of truth for Phase 4.2.
