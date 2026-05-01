0. Readiness score
- Score: 97/100
- Why: The revised spec resolves the workflow install target against the current registry architecture and keeps the implementation narrow.

1. Final verdict
- Verdict: Approved for implementation.
- Blockers: None.
- Medium/low risks: Existing user-installed workflow ids must not be overwritten on init; future preset-specific workflow manifests are deferred.
- Implementation gaps: `PresetManager.initWorkspace()` does not yet install bundled workflows; tests do not yet assert installed workflow files.
- Open questions: None blocking for the default preset because it has no workflow subset manifest and is the only preset.
- Architecture/diagram concerns: Diagrams now match the registry-backed user workflow root and do not reintroduce `.playspec/workflows`.
- One-line conclusion: Safe to implement as an idempotent copy of missing bundled workflow directories into `WorkflowRegistry.getUserRoot()`.

2. Boundary summary
- Goal: Install provided workflow assets during `playspec init`.
- In/out of scope: In scope is default preset init and regression tests; out of scope is registry redesign, MCP behavior, new workflows, and destructive overwrite semantics.
- Dependencies/deferred: Future preset manifests are deferred.
- Boundary drift: None detected after the target location revision.
- Layers/dependency direction: CLI delegates to preset manager; preset manager may use workflow registry path information without coupling Core to CLI.
- Cross-boundary interfaces: `WorkflowRegistry.getUserRoot()` is the existing workflow install location interface.
- Layer-local concrete classes: `PresetManager` remains the concrete init orchestrator.
- Architecture migration/build-boundary dependency: yes; build must continue copying `src/preset/assets/workflows` to `dist/preset/assets/workflows`.

3. Solid parts
- Already coherent and safe: The spec identifies the active init path, latest issue #34 architecture, bundled workflow source directory, test gaps, and an idempotent copy strategy.

4. Risks and questions
- Item: Existing installed workflow ids.
- Classification: Medium risk.
- Why: Overwriting could destroy user edits in `~/.playspec/workflows` or `PLAY_SPEC_USER_WORKFLOWS`.
- Smallest safe fix/action: Skip copy for workflow directories that already exist.
- Item: Default preset has no workflow manifest.
- Classification: Low risk.
- Why: The phrase "preset's workflows" cannot be mapped to a subset.
- Smallest safe fix/action: Install all bundled workflows for the only current preset and document the assumption in tests/spec.

5. Architecture and E2E review
- Layer legality: Legal; preset init reads package assets and installs them into the workflow registry's user root.
- Interface/concrete clarity: Clear; `WorkflowRegistry.getUserRoot()` is the concrete target.
- Build workaround risk: Low; existing build already copies workflow assets.
- Diagram result: Truthful after revision.
- Missing verification chains: Add tests for init -> user workflow root files, and compiled CLI init -> user workflow root files.
- Required spec statements: Non-overwrite/idempotent behavior is stated.

6. Patch-ready ledger
- Risk ID: R1
- Classification: Medium
- Target section: `src/preset/preset-manager.ts`
- Problem: Init currently omits workflow installation.
- Patch action: Copy missing bundled workflow directories into `WorkflowRegistry.getUserRoot()`.
- Patch intent: Make provided workflows appear as installed after init.
- Keep active?: yes
- Risk ID: R2
- Classification: Medium
- Target section: tests
- Problem: Existing tests pass through built-in fallback and miss init install behavior.
- Patch action: Assert installed workflow files and idempotent skip behavior.
- Patch intent: Prevent regression.
- Keep active?: yes

7. Final readiness
- Safe to implement now: yes
- Minimum remaining spec work: none
- Must not carry unresolved: Do not copy workflows into `.playspec/workflows`; do not overwrite existing installed workflow directories.
