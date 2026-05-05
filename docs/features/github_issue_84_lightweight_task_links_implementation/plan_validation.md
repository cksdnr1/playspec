# Implementation Plan Validation

0. Readiness score
- Score: 96/100
- Why: The plan is code-anchored, sequenced, and covers schema, resolver, mutation, CLI, status, prompt, tests, and validation without requiring unresolved architecture decisions during coding.

1. Final verdict
- Verdict: approved
- Blockers: none
- Medium risks: none
- Low risks: suggested-next ambiguity needs focused tests; archived task links remain deferred
- Implementation gaps: all runtime behavior remains to be implemented in the implementation phase
- Unresolved blockers after proposed fixes: none
- One-line conclusion: safe to implement now with the approved mono-spec plan.

2. Boundary and scope review
- Goal: implement v1 direct task links.
- In/out of scope: matches spec; no graph engine, viewer, MCP, migration, archive, or create-time related link.
- Phase size: acceptable for one mono-spec implementation because files are tightly coupled around one CLI feature.
- Mono-spec readiness: ready.
- Dependencies/deferred: uses existing store/update/prompt/status infrastructure.
- Boundary drift: none.
- Future-phase leakage: none.

3. Code anchoring review
- Active entry points: `create`, `link`, `unlink`, `status`, `prompt`.
- Existing files/modules touched: types, schemas, YAML store, Core, CLI command files, tests.
- Old paths: exact-only `ActiveTaskResolver` and `status --task` identified.
- Bypass paths: no-link task parsing/rendering preserved.
- Partial migrations: resolver behavior is explicitly centralized for link refs and status explicit refs.
- Missing code anchors: none.
- Repository assumptions that need verification: test helper patterns and exact command outputs during implementation.

4. E2E execution review
- Entry point clarity: explicit.
- Validation path: resolver plus Core link validation.
- State/data update: source task outgoing links only.
- Persistence/artifact path: `task.yaml` through `YamlTaskStore.updateTask()` and `createTask()`.
- Propagation/callback/event: prompt and status read persisted links.
- Reset/clear behavior: unlink removes by target and optional type.
- User-visible outcome: CLI output, status sections, prompt context.
- Test coverage: concrete integration list included.

5. Architecture and safety review
- Layer/dependency legality: Core remains CLI-free; CLI owns HEAD shorthand.
- Interface vs concrete boundary: acceptable.
- Ownership/lifetime clarity: task link metadata owned by source task.
- Mutation boundary: Core helper methods.
- Backup/report/approval gates: not required for non-destructive task YAML metadata writes.
- MCP/CLI context behavior: MCP untouched by scope.
- Build/include workaround risk: none.

6. Risks and questions
- Item: status suggested-next ordering.
- Classification: low
- Why: easy to over-interpret as dependency scheduler.
- Smallest safe fix/action: test ambiguous multiple candidates and only direct-child blocking.

- Item: exact command output assertions.
- Classification: low
- Why: CLI style may require small wording alignment during tests.
- Smallest safe fix/action: assert stable IDs/sections and warning substrings.

7. Patch-ready ledger
- Risk ID: R1
- Classification: low
- Target section: Add focused tests
- Problem: suggested-next ambiguity could regress.
- Patch action: add explicit ambiguous-candidate test.
- Patch intent: prevent scheduler behavior.
- Keep active?: yes

8. Final readiness
- Safe to implement now: yes
- Minimum remaining plan work: none
- Must not carry unresolved: graph traversal, inverse persistence, archived scans, MCP coupling
- Completion command: `playspec complete --result approved`
