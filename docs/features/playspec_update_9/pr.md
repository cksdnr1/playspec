# Draft PR: PlaySpec Markdown Viewer

Fixes #58

## Summary

- Added `playspec view` for read-only rendering of workspace markdown files and PlaySpec task artifacts.
- Added a viewer module that validates workspace-contained paths, renders local HTML with `marked`, writes generated previews under `.playspec/viewer/cache/`, and clears only that cache.
- Escaped raw HTML and rendered markdown images as text placeholders so previews do not run user-provided scripts or fetch image assets.
- Added CLI coverage for explicit file viewing, task artifact viewing, workspace escape rejection, task-state non-mutation, and cache clearing.

## Changed Files

- `package.json`
- `tsconfig.json`
- `src/cli/index.ts`
- `src/cli/commands/view.ts`
- `src/viewer/markdown-viewer.ts`
- `tests/cli.test.ts`
- `docs/features/playspec_update_9/spec.md`
- `docs/features/playspec_update_9/plan.md`
- `docs/features/playspec_update_9/result.md`
- `docs/features/playspec_update_9/pr.md`

## Tests Run

- `pnpm build`
- `pnpm exec tsx src/cli/index.ts view docs/features/playspec_update_9/spec.md --stdout`
- `pnpm test -- tests/cli.test.ts -t "views|viewer|viewing"`
- `pnpm test`

## PlaySpec Task

- `playspec_update_9`

## Risk Notes

- Browser opening is environment-dependent; automated tests verify generated output and stdout instead of launching a GUI.
- The viewer is intentionally read-only except for generated cache files under `.playspec/viewer/cache/`.
- Task evidence viewing accepts markdown/text task artifacts; explicit path viewing remains markdown-only.

## Reusable Agent Guidance

No reusable agent guidance is needed. This change is a phase-specific CLI feature with tests and does not alter agent workflow instructions.
