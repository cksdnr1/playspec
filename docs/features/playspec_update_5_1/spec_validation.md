# Phase 5.1 Technical Spec Validation

## 0. Readiness score

- Score: 96/100
- Why: The spec defines the missing storage API, CLI command surface, mutation boundaries, and required tests. No architecture decision is left to implementation.

## 1. Final verdict

- Verdict: approved
- Blockers: none
- Medium/low risks: keep `archive show` read-only and avoid changing active lookup/list behavior
- Implementation gaps: archived list API and archive CLI list/show commands
- Open questions: none blocking
- Architecture/diagram concerns: proposed diagram is storage/CLI-only and does not imply MCP or restore behavior
- One-line conclusion: Safe to implement Phase 5.1 now.

## 2. Boundary summary

- Goal: Archived tasks can be listed/inspected, and active prompts can reference archived artifacts by explicit paths.
- In/out of scope: in scope is archive list/show plus archived listing API; restore, MCP archive lookup, auto inclusion, and evolution proposals remain out of scope.
- Dependencies/deferred: depends on Phase 5 archive storage and close semantics.
- Boundary drift: none detected.
- Layers/dependency direction: CLI calls storage/core adapters; storage owns archive directory scans.
- Cross-boundary interfaces: `TaskStore.listArchivedTasks()` is the only new storage interface.
- Layer-local concrete classes: `YamlTaskStore` implements the directory scan.
- Architecture migration/build-boundary dependency: no

## 3. Solid parts

- Already coherent and safe:
  - Uses existing `.playspec/tasks/archived/{taskId}/task.yaml` source of truth.
  - Keeps active lookup and HEAD behavior unchanged.
  - Keeps MCP archive lookup out of scope.
  - Documents that context refs already accept explicit archived artifact paths through existing workspace-relative validation.

## 4. Risks and questions

- Item: Archive show output could be mistaken for selection or restore.
- Classification: low
- Why: CLI naming is read-only but output wording must avoid mutation hints.
- Smallest safe fix/action: Print record details only; do not add restore/unarchive hints.

- Item: Existing context validation accepts any workspace-relative file, not only archived artifacts.
- Classification: low
- Why: This is existing behavior and Phase 5.1 only needs archived paths accepted.
- Smallest safe fix/action: Add tests proving archived paths work and missing archived paths fail.

## 5. Architecture and E2E review

- Layer legality: acceptable; no Core-to-CLI coupling required.
- Interface/concrete clarity: acceptable; add `listArchivedTasks()` to `TaskStore` and implement in `YamlTaskStore`.
- State/persistence clarity: archived records remain in `task.yaml`; no index.
- Reset/clear clarity: not applicable because list/show are read-only.
- Mutation boundary clarity: clear; no new mutation beyond existing `add-context`.
- Build workaround risk: none.
- Diagram result: truthful proposed flow.
- Missing verification chains: archive list/show CLI and prompt render with explicit archived context.
- Required spec statements: present.

## 6. Test and acceptance review

- Existing tests relevant to this spec:
  - `tests/integration/task-store.test.ts`
  - `tests/integration/init-create-next.test.ts`
  - `tests/cli.test.ts`
  - `tests/integration/mcp-server.test.ts`

- Missing required tests:
  - storage list archived tasks
  - CLI archive list/show
  - active list commands exclude archived tasks
  - active prompt renders with explicit archived context ref
  - missing archived context ref fails

- Acceptance criteria quality: sufficient.
- User-visible verification: CLI output and prompt command success/failure.
- Regression coverage needed: no MCP archive tool exposure and active lookup isolation.

## 7. Patch-ready ledger

- Risk ID: R1
- Classification: low
- Target section: CLI output
- Problem: archive show may imply mutation if output includes action hints.
- Patch action: keep output factual and read-only.
- Patch intent: preserve Phase 5.1 boundary.
- Keep active?: yes

- Risk ID: R2
- Classification: low
- Target section: tests
- Problem: context behavior is already generic and could regress silently.
- Patch action: add explicit archived context prompt tests.
- Patch intent: lock Phase 5.1 behavior without special-casing core validation.
- Keep active?: yes

## 8. Final readiness

- Safe to implement now: yes
- Minimum remaining spec work: none
- Must not carry unresolved: restore/unarchive, MCP archive lookup, auto archived context inclusion, evolution proposals
