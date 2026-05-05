# Technical Spec Validation

0. Readiness score
- Score: 96/100
- Why: The implementation spec is concrete enough to code against current repository boundaries without leaving storage, CLI, mutation, prompt, status, or test strategy decisions unresolved.

1. Final verdict
- Verdict: approved
- Blockers: none for implementation readiness
- Medium/low risks: archived task links explicitly deferred; status suggested-next must stay direct-only
- Implementation gaps: runtime links are not implemented yet, as expected for this issue
- Open questions: none blocking
- Architecture/diagram concerns: proposed flow is labeled as proposed and matches current Core/CLI/store split
- One-line conclusion: safe to proceed to implementation planning at the 95-point gate.

2. Boundary summary
- Goal: implement optional direct task links and their CLI/status/prompt surfaces.
- In/out of scope: v1 metadata links only; no graph engine, viewer, MCP, migration, or inverse persistence.
- Dependencies/deferred: uses existing task store and prompt pipeline; archived link display deferred.
- Boundary drift: none detected.
- Layers/dependency direction: CLI resolves HEAD/current-task shorthand; Core receives explicit task IDs.
- Cross-boundary interfaces: `TaskRecord.links`, resolver, and Core link helpers.
- Layer-local concrete classes: `YamlTaskStore` remains persistence implementation.
- Architecture migration/build-boundary dependency: no.

3. Solid parts
- Already coherent and safe: schema/storage model, validation rules, create/link/unlink CLI contracts, direct-only status behavior, prompt linked-context behavior, and test coverage expectations.

4. Risks and questions
- Item: suggested-next could become scheduler-like.
- Classification: low
- Why: spec constrains it to direct child tasks and ambiguous-candidate display.
- Smallest safe fix/action: enforce direct-only logic in tests.

- Item: archived linked tasks.
- Classification: low
- Why: not needed for v1 workflow and would broaden scanning scope.
- Smallest safe fix/action: keep active/completed-only resolution documented and tested.

5. Architecture and E2E review
- Layer legality: acceptable.
- Interface/concrete clarity: acceptable.
- State/persistence clarity: acceptable.
- Reset/clear clarity: unlink behavior covers clear/removal.
- Mutation boundary clarity: acceptable.
- Build workaround risk: none.
- Diagram result: accurate as proposed architecture.
- Missing verification chains: none in spec; implementation must add tests.
- Required spec statements: present.

6. Test and acceptance review
- Existing tests relevant to this spec: CLI integration and task store integration suites.
- Missing required tests: all task-link paths, to be added during implementation.
- Acceptance criteria quality: concrete and user-visible.
- User-visible verification: create/link/unlink/status/prompt flows defined.
- Regression coverage needed: tasks without links still parse/render.

7. Patch-ready ledger
- Risk ID: R1
- Classification: low
- Target section: Status Behavior
- Problem: suggested-next ambiguity can be misread.
- Patch action: test multiple unblocked children output.
- Patch intent: prevent guessing.
- Keep active?: yes

- Risk ID: R2
- Classification: low
- Target section: Scope
- Problem: archived link behavior not included.
- Patch action: keep deferred unless explicitly requested.
- Patch intent: prevent scope drift.
- Keep active?: yes

8. Final readiness
- Safe to implement now: yes
- Minimum remaining spec work: none
- Must not carry unresolved: graph recursion, inverse persistence, MCP coupling, or create-time `--related`
