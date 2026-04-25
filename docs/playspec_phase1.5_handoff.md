# PlaySpec Phase 1.5 Handoff

## Phase Summary

Phase `1.5` is `Template Renderer Hardening`, not markdown preview. Its purpose is to make `playspec next` produce a fully rendered prompt or fail with an actionable error. The current repo already has the minimum Phase `1.1` to `1.4` runtime path, so this handoff is about hardening the existing shared render path without leaking into Phase `2+`.

## Current Goal

Implementation status: complete.

Phase `1.5` now provides one coherent prompt-rendering path for `playspec next` and `playspec phase` that:

- loads the target phase/template
- resolves `{{include:...}}` from normalized paths bounded inside `.playspec`
- validates workflow-phase `requiredVariables`
- renders with Handlebars
- rejects any unresolved raw `{{...}}` placeholders
- reports missing template/include/workflow problems with clear file-path-based errors

Locked decisions for this phase:

- `requiredVariables` is owned by workflow phase metadata at `phases.<phaseId>.requiredVariables`
- include syntax is `{{include:path/to/file.md}}`
- any remaining raw `{{...}}` token after render is a failure

## Locked File Set

### must-read

- [docs/playspec_phase_plan.md](/volume2/PJ/playspec/docs/playspec_phase_plan.md)
- [docs/playspec_total_spec.md](/volume2/PJ/playspec/docs/playspec_total_spec.md)
- [AGENTS.md](/volume2/PJ/playspec/AGENTS.md)
- [package.json](/volume2/PJ/playspec/package.json)
- [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts)
- [src/core/index.ts](/volume2/PJ/playspec/src/core/index.ts)
- [src/core/errors.ts](/volume2/PJ/playspec/src/core/errors.ts)
- [src/core/schemas.ts](/volume2/PJ/playspec/src/core/schemas.ts)
- [src/template/index.ts](/volume2/PJ/playspec/src/template/index.ts)
- [src/workflow/index.ts](/volume2/PJ/playspec/src/workflow/index.ts)
- [src/utils/fs.ts](/volume2/PJ/playspec/src/utils/fs.ts)
- [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts)
- [tests/helpers/createTempWorkspace.ts](/volume2/PJ/playspec/tests/helpers/createTempWorkspace.ts)

### maybe-read

- [src/storage/index.ts](/volume2/PJ/playspec/src/storage/index.ts)
- [src/preset/index.ts](/volume2/PJ/playspec/src/preset/index.ts)
- [vitest.config.ts](/volume2/PJ/playspec/vitest.config.ts)

### ignore-for-now

- viewer-specific work
- rollback/archive/evidence systems
- MCP adapter work
- DAG-related work
- any Phase `2+` state transition logic

## Verified Facts

- [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts) already registers `next` and `phase`.
- [src/core/playspec-core.ts](/volume2/PJ/playspec/src/core/playspec-core.ts) already provides a shared render path for `renderNextPrompt` and `renderExplicitPhasePrompt`.
- [src/workflow/workflow-loader.ts](/volume2/PJ/playspec/src/workflow/workflow-loader.ts) and [src/workflow/phase-resolver.ts](/volume2/PJ/playspec/src/workflow/phase-resolver.ts) already load workflows and resolve phases.
- [src/template/template-renderer.ts](/volume2/PJ/playspec/src/template/template-renderer.ts) expands `{{include:...}}`, enforces normalized `.playspec`-bounded include paths, detects circular includes, renders via Handlebars, and rejects unresolved placeholders from final output.
- [src/core/schemas.ts](/volume2/PJ/playspec/src/core/schemas.ts) validates workflow structure and defines canonical phase-level `requiredVariables`.
- [src/core/errors.ts](/volume2/PJ/playspec/src/core/errors.ts) already provides `PlaySpecError`.
- [src/utils/fs.ts](/volume2/PJ/playspec/src/utils/fs.ts) already provides `readTextFile` and `writeTextFile`.
- [package.json](/volume2/PJ/playspec/package.json) already includes `handlebars`.
- [tests/unit/template-renderer.test.ts](/volume2/PJ/playspec/tests/unit/template-renderer.test.ts) covers include expansion, circular include failure, unresolved placeholder failure, final-output placeholder failure, and include escape rejection.
- [tests/integration/init-create-next.test.ts](/volume2/PJ/playspec/tests/integration/init-create-next.test.ts) covers `init -> create -> renderNextPrompt`, explicit phase rendering, and required-variable failure on the active path.
- The phase plan requires `handlebars rendering`, `include system`, `circular include detection`, `requiredVariables validation`, `unresolved placeholder detection`, `missing template error`, and real `next` rendering for Phase `1.5`.

## Key Control Flow

1. CLI receives `playspec next`.
2. CLI resolves task context through the existing Phase `1.x` task path.
3. Core resolves target workflow phase and its template.
4. Workflow phase metadata provides the canonical `requiredVariables` set.
5. Template module loads the root template.
6. Template module expands `{{include:...}}` from normalized paths that stay inside `.playspec` and rejects cycles.
7. The shared render path validates required variables.
8. Template module renders the template with Handlebars.
9. Template module rejects any remaining raw `{{...}}` token.
10. CLI prints the final prompt or surfaces a `PlaySpecError`.

## Known Constraints

- Stay inside the actual phase-plan boundary: `Template Renderer Hardening`.
- Do not implement markdown preview, browser open, or `view`.
- Do not add Phase `2+` completion/evidence/rollback behavior.
- Do not split render behavior across multiple ad hoc code paths.
- Do not count helper-only work as phase completion; `next` must be observable end-to-end.

## Active Entry Points

| Entry point | Current status | Why it matters |
|---|---|---|
| CLI bootstrap in [src/cli/index.ts](/volume2/PJ/playspec/src/cli/index.ts) | done | active CLI path already wired for rendering |
| `playspec next` | done | required visible outcome already exists and must be hardened rather than replaced |
| core prompt-render orchestrator | done | already owns the shared render path for `next` and `phase` |
| workflow phase/template resolution | done | already selects what to render |
| template include/render/validate pipeline | done | required-variable ownership, root-bound include safety, and final-output placeholder rejection are active |

## Migration Status

- active entry points remain `playspec next` and `playspec phase`
- both entry points use the same `PlaySpecCore` render path
- no old or duplicate renderer path is active
- required-variable validation is enforced in the active Core path
- include safety and unresolved-placeholder policy are enforced in the active template path

## Phase Outcome at a Glance

### After this phase, you can

- render the next prompt through one validated render pipeline
- reuse include fragments in templates
- get explicit failures for template/input problems

### After this phase, you still cannot

- preview prompts in a browser
- complete a phase
- collect evidence
- rollback
- archive

## Enabled Use Cases

- human asks PlaySpec for the next prompt and receives fully rendered text
- template authors split shared prompt text into includes
- broken includes or missing variables are caught before the user sees partial output

## Still-Blocked or Deferred Use Cases

- browser-based preview
- task summary viewer
- prompt history viewer
- completion/evidence/review flow
- rollback/archive flow
- MCP-driven task rendering

## Concrete Testable Outcomes

- `playspec next` prints a fully rendered prompt for a valid active task
- include expansion works
- circular include fails with an actionable error
- missing required variable fails with an actionable error
- unresolved placeholder fails with an actionable error
- missing template file fails with an actionable error

## Reviewer Demo Checklist

1. Use a temp workspace.
2. Ensure a valid active task and workflow resolve to a template.
3. Run `playspec next`.
4. Confirm stdout contains fully rendered content with no raw `{{...}}`.
5. Break a required variable and confirm the command fails clearly.
6. Introduce an include cycle and confirm the command fails clearly.
7. Point a phase to a missing template and confirm the file path is reported.

## Open Questions

No architecture/spec-level open questions remain.

## Next Phase Dependency

The next phase should not start until the existing shared render pipeline keeps one canonical workflow-phase `requiredVariables` contract, one normalized root-bound include rule, and one unresolved-placeholder policy from CLI entry point through stdout output. If later work splits those rules across bypass paths, completion-state work will build on an unstable base.

## Verifier Result Summary

- shared active renderer: done
- canonical `requiredVariables`: done
- required-variable validation on active path: done
- normalized root-bounded include rule: done
- unresolved placeholder rejection on final output: done
- relevant unit/integration coverage: done
- direct CLI `playspec next` stdout coverage: done
- direct CLI missing-template error coverage: done
- direct CLI `playspec phase` coverage: done

## Build Validation Summary

- `corepack pnpm build`: success
- `corepack pnpm test`: success
- environment note: non-blocking Node engine warning because the validator ran on `node v20.20.2` while `package.json` declares `>=22.0.0`

## Test Status

Focused Phase `1.5` follow-up test coverage is complete for the active `playspec next` CLI path.

Added direct CLI assertions in [tests/cli.test.ts](/volume2/PJ/playspec/tests/cli.test.ts) for:

- successful `playspec next` stdout rendering from an active task
- successful `playspec phase <phaseId>` stdout rendering from an active task
- failing `playspec next` output when the phase template file is missing, including the resolved template path and recovery hint

## Active Paths Covered vs Not Covered

Covered:

- direct CLI `playspec next` success path
- direct CLI `playspec phase <phaseId>` success path
- direct CLI `playspec next` missing-template failure path
- shared Core `renderNextPrompt` path
- shared Core `renderExplicitPhasePrompt` path
- template include, cycle, unresolved placeholder, and include escape checks

Not directly covered:

- CLI-level missing workflow and missing include-file failures

## Unresolved Blockers

None.

## Remaining Old / Bypass Paths Affecting Confidence

No old or duplicate renderer path is active.

One implementation nuance remains reviewer-visible: [src/template/template-renderer.ts](/volume2/PJ/playspec/src/template/template-renderer.ts) now preflights unresolved template variables before render as well as rejecting raw `{{...}}` in final output. That is stricter than the original final-output-only wording, but it does not introduce a separate runtime path.

## Next-Phase Readiness

Ready for Phase `2`.
