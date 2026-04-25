# PlaySpec Phase 1.5 Test Result

## Phase Summary

Phase `1.5` remains `Template Renderer Hardening`.

This follow-up added only focused test coverage for the already-implemented active render behavior, with emphasis on the real `playspec next` CLI path.

## Intended Scope vs Actual Test Scope

Intended scope:

- verify real Phase `1.5` rendering behavior already implemented in code
- prefer direct active-path coverage over helper-only assertions
- avoid production-code changes

Actual scope:

- extended [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts) with direct `playspec next` success and failure coverage
- reused existing [tests/integration/init-create-next.test.ts](/volume2/PJ/playspec/tests/integration/init-create-next.test.ts) and [tests/unit/template-renderer.test.ts](/volume2/PJ/playspec/tests/unit/template-renderer.test.ts) coverage for the shared Core/template path
- kept production-code edits at zero

## Changed Files

- `tests/cli.test.ts`
- `docs/playspec_phase1.5_test_result.md`
- `docs/playspec_phase1.5_handoff.md`
- `docs/playspec_phase1.5_implementation_result.md`

## Changed Functions / Classes

- `tests/cli.test.ts`
  - `runCli`
  - `createActiveTask`

## Minimal File Scan

### must-read

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_phase1.5_implementation_spec.md](/volume2/PJ/playspec/docs/playspec_phase1.5_implementation_spec.md)
- [docs/playspec_phase1.5_handoff.md](/volume2/PJ/playspec/docs/playspec_phase1.5_handoff.md)
- [docs/playspec_phase1.5_implementation_result.md](/volume2/PJ/playspec/docs/playspec_phase1.5_implementation_result.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts)
- [src/cli/commands/next.ts](/volume2/PJ/playspec/src/cli/commands/next.ts)
- [src/core/playspec-core.ts](/volume2/PJ/playspec/src/core/playspec-core.ts)
- [src/template/template-renderer.ts](/volume2/PJ/playspec/src/template/template-renderer.ts)
- [src/core/errors.ts](/volume2/PJ/playspec/src/core/errors.ts)
- [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts)
- [tests/integration/init-create-next.test.ts](/volume2/PJ/playspec/tests/integration/init-create-next.test.ts)
- [tests/unit/template-renderer.test.ts](/volume2/PJ/playspec/tests/unit/template-renderer.test.ts)

### maybe-read

- [src/cli/commands/phase.ts](/volume2/PJ/playspec/src/cli/commands/phase.ts)
- [src/core/schemas.ts](/volume2/PJ/playspec/src/core/schemas.ts)
- [tests/helpers/createTempWorkspace.ts](/volume2/PJ/playspec/tests/helpers/createTempWorkspace.ts)
- [package.json](/volume2/PJ/playspec/package.json)
- [vitest.config.ts](/volume2/PJ/playspec/vitest.config.ts)

### ignore-for-now

- viewer, archive, rollback, evidence, MCP, and other Phase `2+` paths
- unrelated storage/workflow internals not needed beyond the active render call chain

## Pre-Test Entry-Point Audit

| Entry point / call site | Behavior to verify | Current code path | Existing automated coverage before | Old path still active | Status before | Test still needed |
|---|---|---|---|---|---|---|
| `playspec next` CLI | render prompt to stdout for active task | [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts) -> [src/cli/commands/next.ts](/volume2/PJ/playspec/src/cli/commands/next.ts) `runNext` -> [src/core/playspec-core.ts](/volume2/PJ/playspec/src/core/playspec-core.ts) `renderNextPrompt` | no direct CLI coverage | no | missing | yes |
| `playspec next` CLI failure | surface actionable template-path error | same as above -> [src/template/template-renderer.ts](/volume2/PJ/playspec/src/template/template-renderer.ts) `render` | no direct CLI coverage | no | missing | yes |
| `playspec phase <phaseId>` CLI | explicit phase render uses shared path | [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts) -> [src/cli/commands/phase.ts](/volume2/PJ/playspec/src/cli/commands/phase.ts) `runPhase` -> [src/core/playspec-core.ts](/volume2/PJ/playspec/src/core/playspec-core.ts) `renderExplicitPhasePrompt` | core integration only | no | partial | yes |
| Core next render path | required variables checked before output | [src/core/playspec-core.ts](/volume2/PJ/playspec/src/core/playspec-core.ts) `assertRequiredVariables` | yes | no | done | no |
| Template renderer | include expansion, cycle rejection, unresolved placeholder rejection | [src/template/template-renderer.ts](/volume2/PJ/playspec/src/template/template-renderer.ts) `expandIncludes`, `render` | yes | no | done | no |

## Coverage Before Implementation

- `playspec next` direct CLI stdout coverage: missing
- `playspec next` direct CLI missing-template error coverage: missing
- shared Core `renderNextPrompt`: done
- shared Core `renderExplicitPhasePrompt`: done
- include expansion: done
- circular include detection: done
- required-variable failure: done
- unresolved placeholder failure: done
- include escape rejection: done
- direct CLI `playspec phase <phaseId>` coverage: missing

## Mapping to Phase 1.5 Behavior

| Phase `1.5` behavior | Coverage after change | Evidence |
|---|---|---|
| `next` renders a real prompt | done | [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts) `it('renders the next prompt for the active task via the CLI')` |
| include system works | done | [tests/unit/template-renderer.test.ts](/volume2/PJ/playspec/tests/unit/template-renderer.test.ts) `it('expands {{include:...}} directives')` |
| circular include fails | done | [tests/unit/template-renderer.test.ts](/volume2/PJ/playspec/tests/unit/template-renderer.test.ts) `it('throws CircularIncludeError on circular includes')` |
| `requiredVariables` validation fails clearly | done | [tests/integration/init-create-next.test.ts](/volume2/PJ/playspec/tests/integration/init-create-next.test.ts) `it('fails when a workflow phase requires a missing variable')` |
| unresolved placeholders fail | done | [tests/unit/template-renderer.test.ts](/volume2/PJ/playspec/tests/unit/template-renderer.test.ts) `it('throws UnresolvedPlaceholderError for unknown variables')` and `it('throws UnresolvedPlaceholderError when rendered output still contains raw placeholders')` |
| missing template error identifies file path | done | [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts) `it('reports the missing template path via the CLI when rendering fails')` |
| explicit `phase` reuses shared renderer | done | [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts) `it('renders an explicit phase prompt via the CLI')` and [tests/integration/init-create-next.test.ts](/volume2/PJ/playspec/tests/integration/init-create-next.test.ts) `it('renders an explicit phase prompt')` |

## Coverage After Implementation

- `playspec next` direct CLI stdout coverage: done
- `playspec next` direct CLI missing-template error coverage: done
- shared Core `renderNextPrompt`: done
- shared Core `renderExplicitPhasePrompt`: done
- include expansion: done
- circular include detection: done
- required-variable failure: done
- unresolved placeholder failure: done
- include escape rejection: done
- direct CLI `playspec phase <phaseId>` coverage: done

## Post-Test Verifier Result

- shared active renderer: done
- canonical `requiredVariables`: done
- required-variable validation on active path: done
- normalized root-bounded include rule: done
- unresolved placeholder rejection on final output: done
- direct CLI `playspec next` stdout coverage: done
- direct CLI missing-template error coverage: done
- direct CLI `playspec phase` coverage: done

## Refactor-Guard Result

- allowed

## Build / Test Validation Result

- Command: `corepack pnpm build`
- Target/module: repository TypeScript build
- Why chosen: project-standard compile validation for the current worktree
- Result: success
- Blocking: no
- Short error summary: non-blocking engine warning because the validator ran on `node v20.20.2` while `package.json` declares `>=22.0.0`

- Command: `corepack pnpm test`
- Target/module: repository Vitest suite
- Why chosen: project-standard test validation for the current worktree, including the focused Phase `1.5` test change
- Result: success
- Blocking: no
- Short error summary: non-blocking engine warning because the validator ran on `node v20.20.2` while `package.json` declares `>=22.0.0`

- Command: `npm test -- tests/cli.test.ts`
- Target/module: focused CLI test target
- Why chosen: local fallback used during authoring after `pnpm` was unavailable on the interactive shell path
- Result: success
- Blocking: no

- Command: `npm test -- tests/cli.test.ts tests/integration/init-create-next.test.ts tests/unit/template-renderer.test.ts`
- Target/module: focused Phase `1.5` coverage slice
- Why chosen: local slice validation while iterating on the test change
- Result: success
- Blocking: no

- Command: `npm run build`
- Target/module: repository TypeScript build
- Why chosen: local build-safe confirmation while iterating on the change
- Result: success
- Blocking: no

## Remaining Partial Coverage or Blockers

- No blocker remains.
- CLI-level missing workflow and missing include-file failures are still covered indirectly rather than by dedicated CLI assertions.

## Intentionally Deferred Items

- browser preview / viewer
- completion, evidence, rollback, archive
- MCP
- any Phase `2+` behavior

## Recommendation for Next-Phase Readiness

Phase `1.5` is safely test-backed for the active `playspec next` path and remains ready for Phase `2`.

If future work touches CLI command wiring again, add a direct `playspec phase <phaseId>` CLI test before broadening render behavior.
