# PlaySpec Phase 0 Handoff

## Phase Summary

Phase 0 is a zero-feature bootstrap phase. It must create the minimum TypeScript project, placeholder CLI entry, Core skeleton, and isolated test infrastructure needed to begin Phase 1 safely.

**Implementation status: COMPLETE** (2026-04-25)

## Implementation Status

- **Implementation**: complete
- **Migration**: not applicable (greenfield bootstrap)
- **Build validation**: `pnpm build` passes (tsc, zero errors)
- **Test validation**: `pnpm test` passes (3/3 tests)
- **CLI placeholder**: `playspec --help` prints help output
- **Filesystem isolation**: confirmed — no `.playspec` created under repo root after tests
- **Next-phase readiness**: Phase 1 can begin

## Verifier Result Summary

All Phase 0 acceptance criteria satisfied:
- pnpm install: pass
- pnpm build: pass
- pnpm test: pass
- CLI help: pass
- Test isolation: pass
- Core/CLI separation: pass
- FS adapter seam: pass

## Unresolved Blockers

- Node engine version: system is v20.20.2, spec requires >=22.0.0. Non-blocking for Phase 0. Monitor for Phase 1.

## Active Entry Points and Remaining Old/Bypass Paths

All Phase 0 entry points are now live. No old/bypass paths exist (greenfield).

| Entry point | Status |
|-------------|--------|
| `pnpm install` | done |
| `pnpm build` | done |
| `pnpm test` | done |
| `playspec --help` | done |
| `tests/helpers/createTempWorkspace.ts` | done |
| `src/core/index.ts` placeholder | done |

Original bootstrap brief follows below.

## Current Goal

Implement only the minimum code required to make these outcomes real:

- `pnpm install`
- `pnpm build`
- `pnpm test`
- `playspec --help` or equivalent root-level placeholder CLI output
- isolated filesystem test helpers that do not create `.playspec` in the repository root

Do not add Phase 1 task behavior.

## Locked File Set

### must-read

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)

### maybe-read

- [README.md](/volume2/PJ/playspec/README.md)
- [docs/playspec_phase1_implementation_spec.md](/volume2/PJ/playspec/docs/playspec_phase1_implementation_spec.md)
- [docs/playspec_phase1_handoff.md](/volume2/PJ/playspec/docs/playspec_phase1_handoff.md)

### ignore-for-now

- [CLAUDE.md](/volume2/PJ/playspec/CLAUDE.md)
- `.serena/` project metadata

## Verified Facts

- Repository is docs-only right now; no implementation code is present.
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/`, and `tests/` are absent.
- Phase 0 requires project TypeScript setup, CLI placeholder, Core skeleton, basic types/errors/schema placeholders, and filesystem-safe test infrastructure.
- Phase 0 acceptance requires install, build, test, CLI help, test isolation, Core/CLI separation, and replaceable file-access boundaries.
- The phase plan treats bootstrap as Dev Phase 0 even though `AGENTS.md` lists TypeScript setup under Phase 1 scope.
- Repository-local naming should be `playspec` and `.playspec`.
- Temp-directory workspace helpers are the required Phase 0 filesystem-isolation baseline; `memfs` is optional and deferred unless one concrete test needs it.
- The initial file-access boundary should be only a minimal utility or adapter seam, not Phase 1 persistence logic.

## Key Control Flow

### Bootstrap install/build/test flow

1. `pnpm install` resolves dependencies from a real `package.json`.
2. `pnpm build` compiles the placeholder source tree using TypeScript config.
3. `pnpm test` runs Vitest against isolated helpers and placeholder tests.
4. CLI entry can be invoked for help or a stable placeholder output.

### Test isolation flow

1. Test calls a central temp workspace helper.
2. Helper creates a workspace outside the repository root.
3. Any filesystem writes for bootstrap tests target that isolated workspace.
4. Test asserts no `.playspec`-like artifacts are created under the repo root.

## Known Constraints

- No Phase 1 task behavior may leak into the bootstrap work.
- Do not couple Core logic to CLI.
- Do not add MCP.
- Do not treat file layout alone as completion; build/test/help/isolation must be observable.
- File access should be introduced behind a replaceable boundary, not hardwired into future Core behavior.
- The accepted CLI placeholder is root help or a stable root-level bootstrap message only; future command stubs are not required in Phase 0.

## Active Entry Points

| Entry point | Status | Why it matters |
|---|---|---|
| `pnpm install` | missing | dependency bootstrap must become real |
| `pnpm build` | missing | build must pass before Phase 1 starts |
| `pnpm test` | missing | test isolation is a Phase 0 acceptance item |
| CLI executable `playspec` | missing | acceptance requires help or placeholder output |
| temp workspace helper | missing | main safety guarantee for filesystem-heavy development |
| Core placeholder import path | missing | later behavior needs a stable non-CLI boundary |

## Possible Bypasses

- tests write directly into the repo root
- CLI files become the first owner of real task logic
- direct filesystem access is embedded without a boundary
- Phase 1 command placeholders are mistaken for Phase 0 completion

## Phase Outcome at a Glance

### After this phase, you can

- install dependencies
- build the project
- run tests
- invoke the CLI placeholder
- begin Phase 1 work on a fixed project layout

### After this phase, you still cannot

- initialize `.playspec`
- create or switch tasks
- resolve workflows or phases
- render prompts
- use MCP, rollback, archive, viewer, or DAG features

### This phase is ready to implement / hand off when

- bootstrap targets are limited to build/test/help/isolation
- module layout is fixed
- test helpers own workspace isolation
- Core/CLI separation is established before real behavior exists

## Enabled Use Cases

Target end-of-phase enabled use cases:

- contributor installs project dependencies
- contributor builds the project
- contributor runs the test suite safely
- contributor invokes the CLI placeholder
- contributor starts Phase 1 from a compile-safe layout

## Still-Blocked or Deferred Use Cases

- `.playspec init --preset default`
- task create/list/current/use
- `HEAD` management
- workflow loading
- phase resolution
- variable resolution
- template rendering
- `playspec next`
- all later-phase platform features

## Concrete Testable Outcomes

- `pnpm install` completes successfully
- `pnpm build` completes successfully
- `pnpm test` completes successfully
- CLI help or placeholder output is stable and observable
- a temp workspace helper creates paths outside the repository root
- bootstrap tests prove no `.playspec` is created under the repo root
- reviewer validation explicitly checks that no repo-root `.playspec` exists after tests

## Reviewer Demo Checklist

1. Run `pnpm install` in a fresh checkout.
2. Run `pnpm build`.
3. Run `pnpm test`.
4. Invoke the CLI placeholder and confirm root help or stable root-level placeholder output.
5. Confirm no `.playspec` directory was created under the repository root during tests. Treat this as a required safety check.

## Open Questions

No architecture/spec-level open questions remain.

## Next Phase Dependency

Phase 1 must not begin until Phase 0 provides a stable install/build/test baseline and test-safe filesystem isolation. Without that, all Phase 1 task and prompt work will be built on an unsafe development environment.

## Reader Aids

### How to read this spec

Use [docs/playspec_phase0_implementation_spec.md](/volume2/PJ/playspec/docs/playspec_phase0_implementation_spec.md) for the full Phase 0 design and this handoff for execution focus.

### Phase outcome at a glance

Phase 0 is complete only when build/test/help/isolation are real, not when folders or placeholders merely exist.

### Use case alignment

Only count the phase as complete when a reviewer can install, build, test, and invoke the placeholder CLI without repository-root workspace pollution.

### Testable outcomes

The minimum test surface is install/build/test/help plus one filesystem isolation proof.

### What is already implemented vs what still needs verification

Implemented now: docs only.

Still needs verification after coding: every bootstrap command path and the isolation guarantee.

### Active entry points and possible bypasses

All active entry points are currently missing; the main bypass risks are repo-root writes, CLI-owned logic, and skipping the file-access boundary.
