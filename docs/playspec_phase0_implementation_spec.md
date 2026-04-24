# PlaySpec Phase 0 Implementation Spec

## 1. How to Read This Spec

This is a Phase 0-only implementation spec derived from:

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)

Use this document in four layers:

1. Treat `docs/playspec_phase_plan.md` as the phase boundary.
2. Treat `docs/playspec_total_spec.md` as the architecture truth.
3. Treat the current repository contents as implementation truth.
4. Treat this document as the smallest safe bootstrap plan for Phase 0 only.

Important current-state fact: this repository is documentation-only at the time of writing. No TypeScript project bootstrap, source tree, CLI placeholder, or test harness exists yet. All Phase 0 implementation findings below are therefore grounded as `missing` or `not-in-codebase` unless explicitly noted otherwise.

## 2. Phase Boundary Alignment

### Locked Phase 0 goal

Phase 0 exists to create the minimum TypeScript project bootstrap needed to implement PlaySpec safely without polluting real workspaces during tests.

### What this phase is trying to enable

- a buildable TypeScript project
- a runnable test harness with isolated filesystem strategy
- a CLI entry placeholder
- a Core skeleton that does not depend on CLI
- a file/module layout that later phases can extend without redoing ownership boundaries

### What must be complete before Phase 1 can safely begin

- `pnpm install` works from a real `package.json`
- `pnpm build` works from a real TypeScript config
- `pnpm test` runs through Vitest
- the repo has a real `src/` bootstrap aligned with the architecture in `AGENTS.md`
- a CLI entry point exists and prints at least help or a stable placeholder
- Core skeleton exists without CLI coupling
- initial shared types, error types, and Zod schema skeletons exist
- test helpers isolate filesystem writes away from the repository root

### What is intentionally deferred

Deferred by the phase plan and repository rules:

- all real task behavior
- `.playspec init --preset default`
- TaskStore and YAML persistence
- `HEAD` management
- create/list/current/use
- workflow loading and phase resolution
- variable resolution and template rendering
- `playspec next`
- MCP
- rollback
- archive
- evidence
- viewer
- SQLite
- DAG execution

### Visible capability or safety property introduced by this phase

Phase 0 introduces one visible capability:

- the project can be installed, built, tested, and invoked as a CLI placeholder

It also introduces one safety property:

- tests can exercise filesystem behavior without creating `.playspec` state in the real repository root

### What would make this phase unsafe even if partially implemented

- tests write `.playspec` into the repo root or another shared workspace path
- CLI bootstrap embeds business logic, forcing Phase 1 Core work to unwind it
- file access is wired directly into future logic without an adapter or replaceable boundary
- the project boots, but build and test commands are not stable enough for Phase 1 development

### Dependencies

- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md) for technology stack and architecture direction
- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md) for Phase 0 scope and acceptance criteria
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md) for repository-local architecture and phase restrictions

### Ambiguities to call out explicitly

- `AGENTS.md` starts Phase 1 with TypeScript setup, while the phase plan assigns project bootstrap to Phase 0. This spec treats the phase plan as authoritative and therefore places bootstrap in Phase 0.
- The master spec still uses `PlaySpec` and `.playspec` naming. This repository uses `PlaySpec`, `playspec`, and `.playspec`. This spec assumes repository-local naming is authoritative for implementation.
- The phase plan allows either `memfs` or temp-dir-backed isolation for unit tests. For Phase 0, temp-dir-backed isolation is the required baseline and `memfs` remains optional unless one concrete test benefits from it.

## 3. Phase Outcome at a Glance

### After this phase, you can

- install dependencies
- run build successfully
- run tests successfully
- execute the CLI entry point and receive help or a stable placeholder result
- add Phase 1 logic on top of a fixed project/module/test layout

### After this phase, you still cannot

- initialize `.playspec`
- create or select tasks
- resolve workflows or phases
- render templates
- run `playspec next`
- use MCP, rollback, archive, evidence, viewer, or DAG features

### This phase is ready to implement / hand off when

- the build, test, and CLI bootstrap targets are explicit
- the `src/` and `tests/` layout is fixed
- the filesystem isolation rule is explicit and testable
- Core/CLI separation is established before real behavior is added
- no Phase 1 behavior is treated as required for Phase 0 completion

## 4. Initial Phase Summary

### Intended capability of this phase

A safe bootstrap foundation: project config, source layout, placeholder CLI wiring, shared skeleton modules, and isolated test infrastructure.

### What is still unclear before deep verification

The repository contains no runtime code, so the remaining unknowns are implementation details rather than code behavior:

- exact `package.json` scripts
- whether one `tsconfig.json` is sufficient in practice or one secondary config is needed after bootstrap work begins
- whether Vitest uses Node environment only or mixed projects later
- exact placeholder CLI help text

### After this phase, you can

- start implementing Phase 1 on a buildable, testable TypeScript base

### After this phase, you still cannot

- execute any real PlaySpec workflow behavior

## 5. High-Level Pre-Read Summary

### What Phase 0 is trying to achieve

Phase 0 is purely bootstrap. It prepares the repository so later behavior can be implemented safely, especially around filesystem-heavy testing.

### What the current implementation likely does at a high level

Nothing operational yet. The current repository contains product docs and phase docs only.

### What still needs confirmation from code

All runtime and tooling behavior still needs confirmation from code because there is no current code path for:

- package install
- TypeScript build
- Vitest execution
- CLI boot
- Core module imports
- schema validation
- filesystem test isolation helpers

### What real workflow this phase unlocks

A contributor can clone the repo, install dependencies, run build/test, and start implementing later phases without inventing the project structure.

### What workflow remains intentionally deferred

Any user-facing `.playspec` workflow, task lifecycle, workflow resolution, or prompt rendering flow.

### What should be testable if the phase is grounded correctly

- CLI placeholder invocation
- basic module import/compile stability
- temp workspace creation
- isolated filesystem writes staying outside the repo root
- at least one negative test proving the test helper does not target the current working repository

## 6. Minimal File Scan

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

## 7. Relevant Files Reviewed

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)
- [README.md](/volume2/PJ/playspec/README.md)
- [docs/playspec_phase1_implementation_spec.md](/volume2/PJ/playspec/docs/playspec_phase1_implementation_spec.md)
- [docs/playspec_phase1_handoff.md](/volume2/PJ/playspec/docs/playspec_phase1_handoff.md)

## 8. Current Implementation vs Proposed Direction

### Verified current behavior

- The repository contains no `package.json`.
- The repository contains no `tsconfig.json`.
- The repository contains no `vitest.config.ts`.
- The repository contains no `src/`.
- The repository contains no `tests/`.
- The repository currently supports documentation review only.

### Inferred but not fully verified points

- CLI package and binary naming should use `playspec`, because repository-local docs and filenames use `playspec`.
- The bootstrap should preserve the architecture split in `AGENTS.md`: `cli`, `core`, `storage`, `workflow`, `template`, `preset`, `utils`.
- The test strategy should start with temp-directory integration helpers and reserve `memfs` for narrow unit tests only if later needed, because the main Phase 0 safety concern is avoiding real `.playspec` writes.

### Intended Phase 0 behavior

Create the minimum project bootstrap required for:

- dependency installation
- TypeScript build
- Vitest execution
- a CLI entry placeholder
- a Core skeleton independent from the CLI adapter
- shared types/errors/schema placeholders
- isolated filesystem test helpers

### Smallest safe implementation direction

Use a narrow project layout:

```text
package.json
tsconfig.json
vitest.config.ts
src/
  cli/
  core/
  storage/
  workflow/
  template/
  preset/
  utils/
tests/
  helpers/
```

Do not add functional task logic yet. Keep Phase 0 limited to compile-safe placeholders and test-safe infrastructure.

## 9. Active Entry Points and Possible Bypasses

### Entry-point audit

| Entry point / call site | Current behavior | Status | Why it matters to this phase |
|---|---|---|---|
| `pnpm install` | no package manifest exists | missing | Phase 0 must establish the dependency base |
| `pnpm build` | no TypeScript project exists | missing | build must pass before Phase 1 implementation starts |
| `pnpm test` | no test runner config or tests exist | missing | filesystem safety must be enforceable in tests |
| CLI executable `playspec` | no entry point exists | missing | acceptance requires CLI help or stable placeholder output |
| Core module import path | no `src/core` exists | missing | later phases need a non-CLI ownership boundary from the start |
| test helper entry point | no helper exists | missing | this phase's main safety property depends on isolated workspace creation |

### Possible bypasses

- writing tests directly against the repo root instead of a temp workspace
- implementing task behavior inside CLI command files during bootstrap
- skipping schema/error/type placeholders and forcing Phase 1 to redesign bootstrap modules
- adding direct filesystem assumptions in Core without a replaceable adapter boundary

## 10. Verified Behavior and Constraints

### Verified current behavior

- The repo is docs-only today.
- Phase 0 is defined in the phase plan as `Project Bootstrap`.
- Phase 0 acceptance requires install, build, test, CLI help, test isolation, Core/CLI separation, and replaceable file-access boundaries.
- No code or config currently satisfies those acceptance criteria.

### Verified constraints from repository docs

- Do not implement future phases early.
- Do not couple Core logic to CLI.
- Do not add MCP before Phase 4.
- Keep functions testable.
- Use `zod`, `yaml`, `handlebars`, `commander`, and `vitest` in the implementation path.

### Locked implementation constraints

- the initial adapter boundary should stay a minimal filesystem utility or adapter seam only, with no TaskStore or persistence semantics in Phase 0
- the CLI placeholder should expose root help or one stable bootstrap placeholder only, without implying real Phase 1 commands

## 11. What Is Already Implemented vs What Still Needs Verification

### Already implemented

- Phase boundary documentation
- product architecture documentation
- a repository-local naming convention in docs: `playspec` and `.playspec`

### Still needs verification after implementation begins

- exact package scripts and binary wiring
- successful TypeScript compile
- successful Vitest execution
- real CLI placeholder behavior
- real filesystem isolation helper behavior
- proof that tests never create `.playspec` under the repository root

## 12. Use Case Alignment for This Phase

| Use case | Status | Final observable result a reviewer should expect |
|---|---|---|
| contributor installs dependencies | blocked | `pnpm install` completes without manual patching |
| contributor runs build | blocked | `pnpm build` exits successfully |
| contributor runs tests safely | blocked | `pnpm test` exits successfully and writes only to temp/mock locations |
| contributor invokes CLI placeholder | blocked | `playspec --help` or equivalent placeholder output is shown |
| contributor starts Phase 1 work from stable structure | blocked | `src/` and `tests/helpers/` layout exists and imports compile |

Do not mark any of these as enabled until the commands run end-to-end.

## 13. Proposed Implementation Direction for This Phase

1. Add `package.json` with only the dependencies and scripts needed for build/test/bootstrap CLI execution.
2. Add one `tsconfig.json` as the default Phase 0 baseline. Add a secondary config only if a real build/test conflict appears.
3. Add `vitest.config.ts` with Node-focused defaults.
4. Add the initial `src/` module tree matching `AGENTS.md`.
5. Add one CLI entry file that prints root help or a stable root-level bootstrap placeholder. Do not add real Phase 1 commands.
6. Add one Core placeholder module to prove Core can compile independently of CLI, plus only a minimal file-system utility or adapter seam for later replacement. Do not add TaskStore or persistence semantics in Phase 0.
7. Add initial shared type, error, and Zod schema placeholder modules.
8. Add `tests/helpers/createTempWorkspace.ts` as the required baseline. Add `tests/helpers/createMockFs.ts` only if one concrete Phase 0 test needs it.
9. Add at least one test proving filesystem isolation behavior and one test proving the CLI placeholder runs.

Smallest safe fix for the Phase 0 ambiguity around filesystem strategy:

- choose temp-directory-backed integration helpers as the required baseline
- treat `memfs` as optional in Phase 0 unless it materially simplifies a concrete unit test

## 14. Testable Outcomes

| Test scenario | Entry point | Required setup | Expected observable result | Status | Intentionally out-of-phase if failing |
|---|---|---|---|---|---|
| install dependencies | `pnpm install` | repo checkout only | dependencies install successfully | not yet testable | no |
| compile project | `pnpm build` | dependencies installed | build exits successfully | not yet testable | no |
| run tests | `pnpm test` | dependencies installed | Vitest runs successfully | not yet testable | no |
| CLI placeholder help | `playspec --help` or script equivalent | built or `tsx`-driven CLI entry exists | help or stable placeholder text is printed | not yet testable | no |
| temp workspace helper creates isolated workspace | test helper call | test runtime and temp path access | workspace path is outside repo root | not yet testable | no |
| filesystem write isolation | helper + file write in test | temp workspace created | any `.playspec`-like test output appears only in temp workspace | not yet testable | no |
| negative safety check for repo root pollution | test helper assertion | repo root path available to test | test fails if output path resolves under repo root | not yet testable | no |
| reviewer bootstrap demo | install/build/test/help flow | fresh clone | reviewer can execute Phase 0 commands without creating real workspace state, and no `.playspec` exists under the repository root after tests | not yet testable | no |

## 15. Example Review / Demo Scenarios

1. In a fresh clone, run `pnpm install`.
2. Run `pnpm build`.
3. Run `pnpm test`.
4. Run the CLI placeholder as root help, such as `playspec --help` or the equivalent root-level script output. No Phase 1 subcommands are required.
5. Confirm test output paths live in temp/mock locations and that no `.playspec` directory was created at the repository root. Treat this as a required safety check for Phase 0 review.

## 16. Risks / Open Questions

### Risks

- `medium risk`: bootstrap work drifts into Phase 1 behavior, making the acceptance target fuzzy. Smallest safe fix: keep Phase 0 completion tied only to install/build/test/help/isolation outcomes and root-level placeholder behavior.
- `medium risk`: tests write to the real repo root. Smallest safe fix: centralize workspace path creation in one temp-dir helper, assert it resolves outside `process.cwd()`, and make the repo-root `.playspec` absence check part of reviewer validation.
- `medium risk`: CLI placeholder owns logic that should live in Core later. Smallest safe fix: keep CLI code limited to argument wiring and placeholder output.
- `medium risk`: two filesystem strategies are added at once with no clear owner. Smallest safe fix: make temp-dir integration helpers the required path and add `memfs` only when one concrete test benefits.
- `medium risk`: the replaceable file-access boundary is overbuilt before real persistence exists. Smallest safe fix: add only a minimal file-system utility or adapter seam in Phase 0 with no TaskStore or persistence semantics.
- `low risk`: naming drift between `PlaySpec` docs and the repo leaks into package/bin names. Smallest safe fix: standardize Phase 0 outputs on `playspec` and `.playspec`.
- `low risk`: CLI placeholder scope expands into future-command stubs. Smallest safe fix: keep the accepted placeholder to root help or a stable root-level bootstrap message only.

### Open questions

No architecture/spec-level open questions remain.
