# Phase Implementation Plan Validation Result

## Findings

1. High: Phase 8.1 has an active-task state propagation blocker. The plan allows `playspec workflow remove-phase` to remove a phase referenced by active tasks when `--replacement` satisfies compatibility, while also requiring that the command "must not mutate task records" (`docs/features/playspec_evolution/playspec_evolution_phase_plan.md:668`-`675`). Current prompt execution validates `task.currentPhase` directly against `workflow.phaseOrder` and throws when the current phase is absent (`src/core/playspec-core.ts:422`-`426`; `src/core/types.ts:42`). A replacement that is not written to task state or represented in resolver metadata cannot keep those active tasks renderable after the workflow edit. Patch Phase 8.1 to either reject removal of any active current phase entirely, or define an implementation-ready state propagation mechanism and tests for the replacement.

2. High: Phase 6 creates a new `src/evolution/` module boundary without declaring the required import alias/config work. The plan names a new `src/evolution/` module for proposal schemas, storage, and reports (`docs/features/playspec_evolution/playspec_evolution_phase_plan.md:230`-`233`), but project rules require path aliases for cross-module imports, and current runtime/compile-time aliases do not include `#evolution/*.js` (`package.json:10`-`19`; `tsconfig.json:10`-`19`; `README.md:409`). Add the alias and runtime-bin parity expectations to Phase 6, or choose an existing module boundary and state that explicitly.

3. Medium: Phase 6.2 requires post-apply schema validation for templates/rules, but the current code has no standalone schema for those target files. The plan says every post-apply artifact must validate through the relevant schema (`docs/features/playspec_evolution/playspec_evolution_phase_plan.md:368`) while Phase 6.2 only permits `.playspec/templates/` and `.playspec/rules/` mutations (`docs/features/playspec_evolution/playspec_evolution_phase_plan.md:364`-`367`). Current schemas cover task/workflow/session-style records, and templates/rules are validated indirectly by render/include behavior rather than by persisted-file schemas (`src/core/schemas.ts:69`-`121`; `src/template/template-renderer.ts:15`-`120`). Define the validation contract for template/rule changes before implementation, such as render validation against affected workflows, include-path validation, unresolved-placeholder checks, or a new schema where appropriate.

4. Medium: Phase 8 is oversized for a mono-spec implementation slice. It combines context-mode semantics, shared prompt metadata writing, sidecar filename compatibility, CLI `prompt`, deprecated `next`, completion snapshots, and MCP render parity (`docs/features/playspec_evolution/playspec_evolution_phase_plan.md:571`-`629`). Current prompt artifacts are written through multiple paths in CLI and Core (`src/cli/commands/prompt.ts:141`-`152`; `src/cli/commands/next.ts:15`-`80`; `src/core/playspec-core.ts:447`-`465`). Split metadata sidecar plumbing from context-mode rendering, or narrow the phase with a more explicit implementation order and acceptance tests per write path.

5. Low: Phase 4.2 correctly handles the stale alias warning in the total spec. The total spec records a `#pack/*.js` parity failure (`docs/features/playspec_evolution/playspec_evolution_total_spec.md:7`, `171`, `255`, `290`), but the current repository has `#pack/*.js` in both `package.json` and `tsconfig.json` (`package.json:19`; `tsconfig.json:19`), and runtime-bin validation passes. Phase 4.2 is implementation-ready as a baseline confirmation/reconciliation phase if it records whether `#pack` is reserved and unused.

6. Low: Future-phase leakage is mostly controlled. Viewer behavior is deferred to Phase 9, DAG execution is explicitly rejected in Phase 10, migration-local archive behavior remains separate from the general archive model, Phase 5.1 now explicitly excludes proposal schemas/storage, and MCP rules preserve `resolveMcpTaskId()` with no `.playspec/HEAD` fallback (`docs/features/playspec_evolution/playspec_evolution_phase_plan.md:35`-`38`, `160`-`220`, `708`-`803`; `src/mcp/context.ts:4`; `src/mcp/server.ts:115`-`147`).

## Readiness Score

82 / 100

The plan is substantially aligned with the approved total spec and current repository direction. It is not ready for approval because Phase 8.1 has a blocker-level state propagation gap, and Phase 6/6.2 need clearer implementation contracts before downstream phase-execution tasks can proceed safely.

## Risk Ledger

| Risk Area | Status | Notes |
|---|---|---|
| Undersized phases | Low | Phase 4.2 is validation-heavy, but acceptable as a gate because it reconciles a total-spec baseline warning before feature work. |
| Oversized phases | Present | Phase 8 is the main oversized slice: context modes plus prompt metadata across CLI, Core, completion, `next`, and MCP. |
| Missing entry points | Present | Archive, evolution, harness, viewer, token/context mode, and workflow editing entry points are absent today. Most are planned, but Phase 6 also needs `#evolution` alias/config entry points if `src/evolution/` is used. |
| Unclear state propagation | Blocker | Phase 8.1 permits active-current-phase removal with replacement while forbidding task mutation; current Core requires `currentPhase` to remain in `phaseOrder`. |
| Missing tests | Partial | Add tests for Phase 8.1 active-task replacement/rejection behavior, Phase 6 alias parity if `src/evolution/` is added, Phase 6.2 template/rule validation semantics, and Phase 8 metadata writer coverage per artifact path. |
| Filename incompatibility | Mostly resolved | Phase 8 preserves existing markdown filenames and adds `.meta.yaml` sidecars. Remaining risk is consistency across separate prompt artifact writers. |
| Future-phase leakage | Low | Boundaries for viewer, DAG, proposal surfacing, MCP, and migration archive are mostly explicit. The remaining leakage risk is workflow mutation safety around Phase 8.1 and future evolution apply reuse. |

## Validation Performed

- `file_scanner` was used for minimal relevant file discovery.
- `spec_verifier` was used for strict plan/spec/code coverage review.
- `pnpm build` passed.
- `pnpm test -- --run tests/integration/runtime-bin.test.ts` passed: 4 tests.

## Gate Result

Use `playspec complete --result needs_revision`.

Reason: readiness is below 95 and unresolved blockers remain. Approval should wait until Phase 8.1's active-task state propagation is corrected and Phase 6/6.2 define their alias and template/rule validation contracts.
