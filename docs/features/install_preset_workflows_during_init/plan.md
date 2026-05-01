# Install Preset Workflows During Init Plan

## Ordered Implementation Steps

1. Add init-time workflow installation in `src/preset/preset-manager.ts`.
   - Import `readdir` and `access` from `node:fs/promises`.
   - Import `WorkflowRegistry` from `#workflow/workflow-registry.js`.
   - Resolve bundled workflow assets from `path.join(__dirname, 'assets', 'workflows')`.
   - Resolve target root through `new WorkflowRegistry(workspaceRoot).getUserRoot()`.
   - Create the target root.
   - For each bundled workflow directory containing `workflow.yaml`, copy it to the target root only if the target workflow directory does not already exist.

2. Preserve existing init behavior.
   - Keep `.playspec/tasks/active` creation.
   - Keep preset `sessions` and `config.yaml` copy behavior.
   - Keep empty `.playspec/HEAD` creation.
   - Do not add `.playspec/workflows` or `.playspec/templates` as runtime asset roots.

3. Add regression coverage in `tests/integration/init-create-next.test.ts`.
   - Existing tests set `PLAY_SPEC_USER_WORKFLOWS` to an isolated temp directory; assert installed workflow files under that directory.
   - Check at least `mono-spec/workflow.yaml`, `mono-spec/templates/tech_spec_draft.md`, and a second workflow such as `multi-spec/workflow.yaml`.
   - Add idempotence coverage: preexisting installed workflow content remains unchanged after a second init.

4. Add compiled CLI smoke coverage in `tests/integration/runtime-bin.test.ts`.
   - Set `PLAY_SPEC_USER_WORKFLOWS` to a temp path for the child process environment.
   - After `node dist/cli/index.js init --preset default`, assert `mono-spec/workflow.yaml` exists in that temp workflow root.

5. Validate.
   - Run `pnpm build`.
   - Run focused tests for init/runtime behavior.
   - Run full `pnpm test`.

## Files To Edit

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/runtime-bin.test.ts`

## Tests To Add Or Update

- Init structure test: assert workflow files are installed into `PLAY_SPEC_USER_WORKFLOWS`.
- Init idempotence test: assert existing installed workflow directory is not overwritten.
- Runtime bin init test: assert compiled CLI also installs workflow files when `PLAY_SPEC_USER_WORKFLOWS` is provided.

## Old Paths And Bypasses

- Old path to avoid: `.playspec/workflows`.
- Bypass to cover: built-in fallback can make prompts render even when install is missing, so tests must inspect filesystem installation directly.
- Partial migration risk: using `WorkflowInstaller.install()` directly would throw on existing workflow ids; init needs skip-if-exists behavior instead.

## End-To-End Chain

`playspec init --preset default` -> `runInit()` -> `PresetManager.initWorkspace()` -> bundled workflows are copied to `WorkflowRegistry.getUserRoot()` when missing -> user sees provided workflow directories in the install location and `playspec workflow list` can report them as user workflows.

## Risks

- Existing user workflow directories must not be overwritten by init.
- Build output must include bundled workflows; current `pnpm build` already copies `src/preset/assets` into `dist/preset/assets`.
- Installing all bundled workflows is the current default-preset behavior because no preset manifest exists.

## Rollback Notes

Revert the focused commit to restore previous init behavior. No migration or destructive cleanup is required because the implementation only adds copy-on-missing behavior.

## Completion Criteria

- `playspec init --preset default` installs bundled workflow directories into the workflow registry user root.
- Rerunning init does not overwrite an existing installed workflow directory.
- Existing task creation and prompt rendering behavior remains unchanged.
- `pnpm build` and `pnpm test` pass.

## Plan Validation

- Score: 96/100
- Verdict: Approved.
- Blockers: none.
- Medium risks: idempotence test must cover a preexisting changed workflow directory; implementation should prefer `WorkflowRegistry.getBuiltinRoot()` over duplicating the built-in path formula.
- Low risks: future preset workflow manifests remain deferred.
- Recommended minimal patches: use `WorkflowRegistry.getBuiltinRoot()` and `getUserRoot()` in `PresetManager`; add a regression test that writes a custom installed `mono-spec/workflow.yaml`, reruns init, and verifies it is unchanged.
- Unresolved blockers after fixes: none.
- Completion result: `approved`.
