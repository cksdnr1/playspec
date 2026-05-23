# Implementation Plan

## Ordered Steps

1. Add focused failing CLI tests in `tests/cli.test.ts`.
   - For `prompt --out <absolute outside path>`:
     - Create an active task.
     - Pick an absolute path outside the temp workspace.
     - Run with clipboard disabled.
     - Assert non-zero exit.
     - Assert error text tells the user to choose a path inside the workspace or a workspace-relative path.
     - Assert neither the prompt file nor `<prompt>.meta.yaml` exists.
   - For `next --out <absolute outside path>`:
     - Mirror the prompt test.
     - Account for the existing deprecation warning on stderr.
     - Assert no prompt or sidecar file exists.
   - For an allowed absolute path inside the workspace:
     - Use `path.join(workspace.dir, 'tmp', 'prompt-absolute.md')`.
     - Run `prompt --out`.
     - Assert prompt and sidecar are written.
     - Parse metadata and assert `promptArtifactPath` is workspace-relative and does not equal `..` or start with `../`.

2. Update `src/cli/cli-utils.ts`.
   - Resolve `workspaceRoot` with `realpath()`.
   - Resolve absolute input as a normalized absolute path and relative input against the real workspace root.
   - Apply the lexical workspace boundary check to all output paths.
   - Create the parent directory only after the lexical check passes.
   - Apply the real parent directory symlink check to all output paths.
   - Use recovery text that clearly says to choose an output path inside the workspace or a workspace-relative path.

3. Run focused validation.
   - `pnpm test -- tests/cli.test.ts`
   - If that passes, run `pnpm build`.
   - Run full `pnpm test` if focused tests or build surface wider risk.

4. Complete PlaySpec implementation phases.
   - Complete implementation only after code and focused validation pass.
   - Write result and PR prep artifacts required by later mono-spec phases.

## Files To Edit

- `src/cli/cli-utils.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/result.md`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/pr.md`

## Tests To Add Or Update

- Add two outside-workspace absolute `--out` rejection tests covering:
  - `playspec prompt --out`
  - `playspec next --out`
- Add or update one allowed absolute in-workspace output test covering metadata:
  - prompt file exists
  - metadata sidecar exists
  - `promptArtifactPath` is workspace-relative
  - `promptArtifactPath` does not start with `..`
- Keep existing relative `tmp/prompt.md` and symlink escape tests passing.

## Active Paths And Bypasses

Active paths closed by the shared helper:
- `prompt --out`
- `next --out`

Paths not changed:
- `prompt --write`
- `next --write`
- clipboard fallback prompt snapshots
- completion prompt snapshots

These paths already choose task-local prompt directories and do not accept arbitrary absolute `--out` values.

## Risks

- Compatibility risk: callers using absolute outside-workspace paths will now fail.
- Symlink risk: parent realpath validation must still run after `mkdir()` and before prompt or sidecar writes.
- Error-message risk: stderr may include command-specific warnings, so tests should assert required guidance rather than exact full stderr.

## Rollback Notes

The rollback is limited to reverting `resolveOutputFilePath()` and the associated CLI tests. No migration or persistent data format changes are planned.

## Completion Criteria

- `prompt --out` rejects absolute outside-workspace paths before file and sidecar writes.
- `next --out` rejects absolute outside-workspace paths before file and sidecar writes.
- Absolute inside-workspace paths remain supported and produce workspace-relative metadata.
- Relative `--out` behavior remains unchanged.
- Focused CLI tests and build pass.
