# Issue 73 Workflow Dedup Implementation Plan

## Steps

1. Add project workflow source plumbing.
   - Extend `WorkflowSource`.
   - Add project workflows path helper.
   - Update registry source order and roots.

2. Implement effective workflow list and show behavior.
   - Deduplicate workflow IDs by priority.
   - Sort groups as project, user, builtin.
   - Sort IDs alphabetically inside each source group.
   - Keep CLI output to source type only.

3. Update init workflow installation.
   - Add install destination `project | user | skip`.
   - Prompt interactively with project as default.
   - Add `--workflow-install <project|user|skip>` for non-interactive automation.
   - Default non-interactive init to project install.
   - Preserve existing files by not overwriting target workflows.

4. Update gitignore policy.
   - Keep `.playspec/workflows/**` committable.
   - Ignore `.playspec/tasks/`, `.playspec/cache/`, `.playspec/tmp/`, `.playspec/logs/`.

5. Add tests.
   - Registry duplicate ID priority and stable ordering.
   - Loader/show resolution uses project over user over builtin.
   - Init project default, user install, and skip install.
   - CLI workflow list/show source output.

6. Validate.
   - Run focused workflow/init tests.
   - Run `pnpm build`.
   - Run `pnpm test`.

## Files To Edit

- `src/core/types.ts`
- `src/utils/paths.ts`
- `src/workflow/workflow-registry.ts`
- `src/workflow/workflow-loader.ts`
- `src/preset/preset-manager.ts`
- `src/cli/commands/init.ts`
- `src/cli/index.ts`
- `.gitignore`
- `tests/integration/workflow-loader.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/runtime-bin.test.ts`
- `tests/cli.test.ts`

## Old Paths And Bypasses

- Old user-only default install path: `~/.playspec/workflows` or `PLAY_SPEC_USER_WORKFLOWS`.
- New project default install path: `<workspace>/.playspec/workflows`.
- Explicit `workflow validate <path>` stays outside registry priority.
- `workflow install/remove` stay user-scoped.

## Rollback Notes

All changes are local code, tests, docs, and ignore patterns. Reverting the branch restores the old user-over-builtin behavior. No migration or deletion of existing workflow assets is required.

## Acceptance Criteria

- `workflow list` prints each workflow ID once.
- `workflow show <id>` and runtime loader resolve the same effective source.
- Project workflows override user and builtin; user overrides builtin.
- Source display is `project`, `user`, or `builtin`.
- `init` can install default workflows to project, user, or skip.
- Runtime generated `.playspec` paths are ignored while project workflows remain committable.
