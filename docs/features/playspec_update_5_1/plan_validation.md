# Phase 5.1 Implementation Plan Validation

## 0. Readiness score

- Score: 97/100
- Why: The plan is code-anchored, narrow, and specifies storage, CLI, prompt-context, and regression tests without leaving architecture decisions open.

## 1. Final verdict

- Verdict: approved
- Blockers: none
- Medium risks: none
- Low risks: archive output ordering should be deterministic if tests assert ordering
- Implementation gaps: storage API, CLI adapter, command registration, tests
- Unresolved blockers after proposed fixes: none
- One-line conclusion: Safe to route into implementation.

## 2. Boundary and scope review

- Goal: list/inspect archived tasks and prove explicit archived context refs render in active prompts.
- In/out of scope: correct; excludes restore, MCP archive lookup, automatic archive context, and future evolution work.
- Phase size: appropriate for one mono-spec implementation.
- Mono-spec readiness: ready.
- Dependencies/deferred: correctly depends on Phase 5 archive close/storage.
- Boundary drift: none.
- Future-phase leakage: none.

## 3. Code anchoring review

- Active entry points: `playspec archive list`, `playspec archive show --task`, existing `add-context`, existing `prompt`.
- Existing files/modules touched: storage interface/implementation, CLI registration/adapter, focused tests.
- Old paths: active list and active lookup paths are preserved.
- Bypass paths: MCP remains unchanged; active resolver remains unchanged.
- Partial migrations: migration-local archive remains untouched.
- Missing code anchors: none.
- Repository assumptions that need verification: test helpers can create archived fixture tasks cleanly.

## 4. E2E execution review

- Entry point clarity: clear.
- Validation path: `show` uses explicit task ID and `getArchivedTask`; missing task uses existing not-found error.
- State/data update: no new mutation for list/show.
- Persistence/artifact path: `.playspec/tasks/archived/{taskId}/task.yaml`.
- Propagation/callback/event: not applicable for read-only commands.
- Reset/clear behavior: not applicable for read-only commands.
- User-visible outcome: archived summaries/details on CLI; prompt success for explicit archived context path.
- Test coverage: sufficient planned coverage.

## 5. Architecture and safety review

- Layer/dependency legality: acceptable.
- Interface vs concrete boundary: clear.
- Ownership/lifetime clarity: archived task records remain storage-owned.
- Mutation boundary: no new mutation in archive list/show.
- Backup/report/approval gates: not needed for read-only commands.
- MCP/CLI context behavior: plan preserves no MCP archive lookup.
- Build/include workaround risk: none.

## 6. Risks and questions

- Item: Archive list ordering.
- Classification: low
- Why: Directory order can vary and produce fragile tests.
- Smallest safe fix/action: Sort summaries by ID before returning or assert by containment.

## 7. Patch-ready ledger

- Risk ID: R1
- Classification: low
- Target section: storage list implementation
- Problem: Non-deterministic archive directory order could make CLI output tests fragile.
- Patch action: Sort archived summaries by ID.
- Patch intent: deterministic user output and tests.
- Keep active?: yes

## 8. Final readiness

- Safe to implement now: yes
- Minimum remaining plan work: none
- Must not carry unresolved: restore/unarchive, MCP archive lookup, automatic archived context inclusion
- Completion command: `playspec complete --result approved`
