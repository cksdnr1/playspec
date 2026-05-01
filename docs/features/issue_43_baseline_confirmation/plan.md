# Issue 43 Baseline Confirmation Implementation Plan

## Goal

Confirm Phase 4.2 baseline readiness without implementing future phases.

## Implementation Steps

1. Verify the required spec sources exist and were linked to the mono-spec task:
   - `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`
   - `docs/features/playspec_evolution/playspec_evolution_total_spec.md`
2. Inspect package scripts and lockfile:
   - `package.json`
   - `pnpm-lock.yaml`
3. Compare runtime and compile-time alias definitions:
   - `package.json#imports`
   - `tsconfig.json#compilerOptions.paths`
4. Preserve `#pack/*.js` if both alias maps contain it and validation passes.
5. Run Phase 4.2 validation:
   - `pnpm build`
   - `pnpm test -- --run tests/integration/runtime-bin.test.ts`
   - `pnpm test -- --run tests/integration/migration.test.ts`
   - `pnpm test -- --run tests/integration/mcp-server.test.ts`
6. Record the result in:
   - `docs/features/issue_43_baseline_confirmation/result.md`
   - `docs/playspec_phase4.2_baseline_confirmation_result.md`
7. Prepare the PR summary in `docs/features/issue_43_baseline_confirmation/pr.md`.

## Acceptance Criteria

- Runtime-bin alias parity passes.
- Compiled CLI and MCP bin startup tests pass.
- Phase 4.1 migration regression tests pass.
- MCP no-HEAD-fallback regression tests pass.
- The result docs explicitly state that `#pack/*.js` is preserved as a reserved future alias.
- No archive/evolution/harness/viewer/DAG behavior is added.

## Validation Commands

Use pnpm because the repository declares `packageManager: pnpm@9.0.0` and includes `pnpm-lock.yaml`.

```bash
pnpm build
pnpm test -- --run tests/integration/runtime-bin.test.ts
pnpm test -- --run tests/integration/migration.test.ts
pnpm test -- --run tests/integration/mcp-server.test.ts
```

## Skipped Validation

The full suite may be run if time permits, but it is not the minimum Phase 4.2 gate. If skipped, record it explicitly in the result and PR notes.

## Scope Guard

Do not modify production source code unless one of the required validation commands fails and the fix is limited to runtime/compile-time alias parity.
