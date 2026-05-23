# Draft PR

Fixes #183

## Summary

- Reject `prompt --out` and deprecated `next --out` paths that resolve outside the workspace before writing prompt artifacts or metadata sidecars.
- Keep absolute paths inside the workspace supported while canonicalizing accepted paths so metadata remains workspace-relative.
- Add CLI regression coverage for outside-workspace absolute paths and inside-workspace absolute metadata.

## Changed Files

- `src/cli/cli-utils.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/spec.md`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/plan.md`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/result.md`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/pr.md`

## Tests Run

- `pnpm test -- tests/cli.test.ts -t 'prompt --out writes absolute paths inside the workspace'`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

`github_issue_183_reject_absolute_prompt_output_paths`

## Risk Notes

- Users relying on absolute `--out` paths outside the repository will now receive a validation error.
- Accepted absolute paths are canonicalized through realpath before metadata is written, which keeps artifact metadata workspace-relative across symlinked temp path aliases.

## Reusable Agent Guidance

No reusable guidance update is needed. The existing repository rules already require keeping generated artifacts inside workspace boundaries and avoiding broad storage redesigns.
