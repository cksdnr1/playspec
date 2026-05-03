# Issue 49 PlaySpec Update 6 Implementation Plan

## Goal

Implement Phase 6 only: validated evolution proposal schemas and a reloadable YAML store with validation reports. The implementation must not expose a public proposal CLI, MCP proposal intake, prompt surfacing, completion snapshots, or proposal apply behavior.

## Ordered Steps

1. Add evolution path and alias boundaries.
   - Edit `package.json` to add `#evolution/*.js`.
   - Edit `tsconfig.json` to add `#evolution/*.js`.
   - Edit `src/utils/paths.ts` with helpers for:
     - `.playspec/evolution`
     - `.playspec/evolution/proposals`
     - proposal root
     - `proposal.yaml`
     - `validation.yaml`

2. Add evolution domain types.
   - Create `src/evolution/types.ts`.
   - Define:
     - `EvolutionProposalStatus = 'pending' | 'skipped'`
     - `EvolutionRiskLevel = 'low' | 'medium' | 'high'`
     - proposal source/task/artifact reference types
    - known proposal action union:
      - `propose_file_change`
      - `propose_section_change`
      - `propose_context_reference`
     - review metadata
     - validation report types

3. Add strict schemas.
   - Create `src/evolution/schemas.ts`.
   - Validate filesystem-safe proposal IDs.
   - Validate workspace-relative paths by rejecting absolute paths, `..` traversal, and normalized paths that escape the workspace root shape.
   - Validate archived artifact references with Phase 5.1-style checks in store-level validation: workspace-relative, non-escaping, and existing at validation time.
   - Validate target files as workspace-relative and non-escaping, but do not require existence because proposals may describe future edits.
   - Use a discriminated union for known action types so unknown action types are rejected.
   - Include `pending` and `skipped` only in the Phase 6 status enum.
   - Keep schema strict enough that future `accepted`, `applied`, or `failed` statuses require an intentional later phase change.

4. Add proposal store.
   - Create `src/evolution/proposal-store.ts`.
   - Implement:
     - `generateEvolutionProposalId(prefix?)`
     - `saveProposal(proposal)`
     - `loadProposal(proposalId)`
     - `saveValidationReport(report)`
     - `loadValidationReport(proposalId)`
     - `validateProposal(raw)`
     - `validateProposalForWorkspace(raw)`
     - `updateProposalStatus(proposalId, status, metadata?)`
   - Parse through zod before every write and after every load.
   - Use workspace-level validation for save paths so archived artifact references must exist before persistence.
   - Write only under `.playspec/evolution/proposals/{proposalId}/`.
   - Preserve proposal IDs on reload and status update.
   - Preserve `validation.yaml` when status is updated.
   - Reject saving a different proposal into an existing proposal ID directory.

5. Add store tests.
   - Create `tests/integration/evolution-proposal-store.test.ts`.
   - Cover valid pending proposal save/reload.
   - Cover validation report persistence/reload.
   - Cover status update to `skipped` preserving proposal/report files.
   - Cover unknown action type rejection.
   - Cover workspace-escaping target and artifact path rejection.
   - Cover explicit archived artifact references by workspace-relative path.
   - Cover missing archived artifact references are rejected during store validation.
   - Cover archived artifact content is not copied into the proposal directory.
   - Cover invalid proposal ID rejection.
   - Cover generated proposal ID uniqueness.
   - Cover proposal ID stability on load and status update.
   - Cover collision rejection when saving a different proposal with an existing ID.

6. Add surface-area regression tests.
   - Extend `tests/cli.test.ts` with a regression proving `playspec evolution` is not a registered public command in Phase 6.
   - Extend `tests/integration/mcp-server.test.ts` or the nearest existing MCP test with a regression proving no MCP proposal/evolution tool is registered.
   - Add a focused prompt rendering regression that creates a stored proposal fixture and proves `PlaySpecCore.renderNextPrompt()` output does not include proposal IDs, proposal summaries, or evolution context.
   - Add a focused completion regression that creates a stored proposal fixture, completes a normal phase, and proves `.playspec/evolution/context/` is not created.

7. Run validation.
   - `pnpm build`
   - `pnpm test -- --run tests/integration/evolution-proposal-store.test.ts`
   - `pnpm test -- --run tests/cli.test.ts -t "evolution"`
   - `pnpm test -- --run tests/integration/mcp-server.test.ts`
   - `pnpm test -- --run tests/integration/runtime-bin.test.ts`
   - Run broader `pnpm test` if feasible; if it hangs due to known subprocess issues, report exactly what happened and keep focused passing evidence.

## Files To Edit

- `package.json`
- `tsconfig.json`
- `src/utils/paths.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-store.ts`
- `tests/integration/evolution-proposal-store.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_49_playspec_update_6/result.md`
- `docs/features/issue_49_playspec_update_6/pr.md`

## Old Paths, Bypasses, And Partial Migration Risks

- Do not wire the store into `PlaySpecCore.renderNextPrompt()` or `PlaySpecCore.completePhase()`.
- Do not register `playspec evolution` in `src/cli/index.ts`.
- Do not register MCP proposal tools in `src/mcp/server.ts`.
- Do not reuse migration runner actions as proposal apply behavior.
- Do not write proposal artifacts under active or archived task roots.
- Do not copy archived artifacts into proposal directories; store references only.
- Direct manual YAML edits remain possible, so store load must always validate persisted records.

## Reset And Clear Behavior

No user-facing reset, clear, or skip command is added in this phase.

Store-level status update supports `skipped` for forward compatibility and tests, but it mutates only `proposal.yaml` inside the proposal directory and preserves `validation.yaml`.

## Completion Criteria

- Evolution schemas validate the Phase 6 proposal and report records.
- Store APIs persist and reload proposals/reports under the required paths.
- Store-level skipped status updates preserve proposal and report files.
- Unknown action types and unsafe paths are rejected.
- Explicit existing archived artifact references are accepted as references and not copied.
- Missing archived artifact references are rejected by store validation.
- Proposal IDs are filesystem-safe, generated uniquely, stable across load/update, and collision-protected.
- `#evolution/*.js` alias parity passes.
- No public evolution CLI command group exists.
- No MCP proposal intake tool exists.
- Prompt rendering and completion do not load proposal storage or write evolution context snapshots.

## Rollback Notes

The implementation is additive except for alias map updates and tests. If rollback is needed, remove `src/evolution/`, remove the `#evolution/*.js` alias entries, remove the focused tests, and remove generated `.playspec/evolution` fixtures in temporary test workspaces. No production or external state is touched.

## Risks

- Action schema names are future-facing. Keep them explicit and non-executing so later phases must intentionally extend or apply them.
- The CLI regression should assert absence of the command without making help output brittle.
- MCP tool introspection may require using the existing test helper style rather than depending on private SDK internals.
- Full-suite Vitest may have existing subprocess hangs; focused validation must be reported exactly if broad validation is not usable.

## Plan Validation Findings Resolved

Latest Step 5 result: `needs_revision`.

Resolved findings:
- Archived artifact validation: store-level validation now requires existing workspace-relative non-escaping archived artifact references, matching Phase 5.1 behavior.
- Prompt/completion regressions: tests are now mandatory and fixture-based, not conditional.
- Proposal ID guarantees: tests now cover invalid IDs, generated uniqueness, stability, and collision rejection.
- Action API clarity: the Phase 6 action union is explicit and descriptive only.

Remaining risks:
- Full-suite test reliability may still depend on subprocess behavior already noted in prior phase results. Focused validation remains required and broad validation should be reported exactly.
