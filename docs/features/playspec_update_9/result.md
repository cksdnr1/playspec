# PlaySpec Update 9 Result

## Implemented

- Added `playspec view` for read-only local markdown/task artifact viewing.
- Added `src/viewer/markdown-viewer.ts` for safe workspace-contained source resolution, task artifact resolution, HTML rendering, cache output, and cache clearing.
- Added `src/cli/commands/view.ts` and CLI registration.
- Added `#viewer/*.js` runtime and TypeScript path aliases.
- Added CLI integration tests for explicit markdown viewing, task artifact viewing, workspace escape rejection, task state non-mutation, and cache clearing.

## User-Visible Behavior

- `playspec view <path>` renders an explicit workspace-relative markdown file to `.playspec/viewer/cache/*.html`.
- `playspec view --task <id> --artifact <type>` renders supported task artifacts.
- `playspec view --stdout` prints generated HTML without writing cache output.
- `playspec view --clear-cache` removes generated viewer cache output only.
- `playspec view --open` opens the generated HTML file in the local browser.
- Raw HTML is escaped during markdown rendering, and markdown images are rendered as non-fetching text placeholders.

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

## Verification

- `pnpm build` passed.
- `pnpm exec tsx src/cli/index.ts view docs/features/playspec_update_9/spec.md --stdout` rendered HTML.
- `pnpm test -- tests/cli.test.ts -t "views|viewer|viewing"` passed: 5 tests.
- `pnpm test` passed: 24 test files, 409 tests.

## Remaining Risks

- Browser opening is environment-dependent; tests cover generated output and stdout instead of launching a GUI.
- The viewer intentionally treats task evidence text files as readable task artifacts while explicit path viewing remains markdown-only.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional cleanup was applied after the TypeScript-safe `open(path.resolve(...))` adjustment.
- Intentionally skipped broader restructuring because the implementation is already scoped to a CLI adapter and one viewer module.
