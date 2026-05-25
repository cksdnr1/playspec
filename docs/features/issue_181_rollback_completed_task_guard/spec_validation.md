0. Readiness score
- Score: 98/100
- Why: The spec identifies the exact shared core boundary, existing guard, rollback mutation paths, and CLI regression coverage needed without leaving architecture or safety policy decisions open.

1. Final verdict
- Verdict: approved
- Blockers: none
- Medium/low risks: Low risk that tests must carefully prove state-only rejection does not mutate task files or quarantine artifacts.
- Implementation gaps: Add the core guard and CLI tests.
- Open questions: none blocking.
- Architecture/diagram concerns: none; the proposed flow matches current layering.
- One-line conclusion: Safe to implement now with a focused core guard and CLI regression tests.

2. Boundary summary
- Goal: Reject non-active tasks before rollback preview or rollback execution.
- In/out of scope: In scope is rollback preview/state-only/git-only through core; out of scope is rollback policy redesign or safe-point format changes.
- Dependencies/deferred: none.
- Boundary drift: none detected.
- Layers/dependency direction: legal; CLI and MCP call core, core delegates to rollback manager.
- Cross-boundary interfaces: existing `PlaySpecCore` rollback methods and `TaskNotActiveError`.
- Layer-local concrete classes: `RollbackManager` remains focused on mechanics.
- Architecture migration/build-boundary dependency: no

3. Solid parts
- Already coherent and safe: The spec uses the existing core helper, keeps CLI/MCP behavior shared, and preserves rollback manager safety gates for active tasks.

4. Risks and questions
- Item: State-only non-mutation assertion
- Classification: Low
- Why: The test must compare pre/post `task.yaml` and artifact locations to prove the guard runs before rollback manager mutation.
- Smallest safe fix/action: Capture task file contents and relevant artifact/quarantine paths before invoking `rollback --state-only`.

5. Architecture and E2E review
- Layer legality: valid; no CLI-to-core inversion.
- Interface/concrete clarity: clear; no new public interface needed.
- State/persistence clarity: clear; completed tasks must not be persisted differently by rollback.
- Reset/clear clarity: not applicable beyond proving no state-only quarantine/write occurs.
- Mutation boundary clarity: clear; mutation remains inside rollback manager and is bypassed for non-active tasks by core guard.
- Build workaround risk: none.
- Diagram result: truthful and useful.
- Missing verification chains: CLI tests need to exercise HEAD and explicit task resolution.
- Required spec statements: present.

6. Test and acceptance review
- Existing tests relevant to this spec: active rollback preview, state-only rollback, dirty tracked safety, post-safe-point commit safety, untracked conflict safety, clean git rollback.
- Missing required tests: completed HEAD preview rejection, completed HEAD state-only rejection with non-mutation assertions, completed HEAD confirmed git-only rejection, explicit completed `--task` rejection.
- Acceptance criteria quality: strong and directly testable.
- User-visible verification: stderr should include `Task "<taskId>" is not active (status: completed).`
- Regression coverage needed: keep existing active rollback tests unchanged.

7. Patch-ready ledger
- Risk ID: R1
- Classification: Low
- Target section: tests
- Problem: State-only rejection could pass while still mutating artifacts if test only checks exit code.
- Patch action: Assert `task.yaml` contents are unchanged, the active future snapshot still exists, and the rollback quarantine path was not created.
- Patch intent: Prove rejection happens before rollback manager state mutation.
- Keep active?: yes

8. Final readiness
- Safe to implement now: yes
- Minimum remaining spec work: none.
- Must not carry unresolved: do not move the guard into CLI only; core must own the lifecycle boundary.
