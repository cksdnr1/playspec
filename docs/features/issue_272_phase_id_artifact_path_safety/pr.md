# PR: Validate Workflow Phase IDs Before Artifact Path Use

Fixes #272

## Summary

- Reject workflow phase IDs that are unsafe for artifact filenames during workflow loading.
- Validate both `phaseOrder` entries and all `phases` map keys, including unused unsafe keys.
- Preserve existing completion artifact paths for safe phase IDs.
- Add regression coverage for unsafe `/` and `..` phase IDs plus completion artifact ref consistency.

## Changed Files

- `src/workflow/workflow-loader.ts`
- `tests/integration/workflow-loader.test.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_272_phase_id_artifact_path_safety/spec.md`
- `docs/features/issue_272_phase_id_artifact_path_safety/plan.md`
- `docs/features/issue_272_phase_id_artifact_path_safety/result.md`
- `docs/features/issue_272_phase_id_artifact_path_safety/pr.md`

## Tests Run

- `pnpm exec vitest run tests/integration/workflow-loader.test.ts`
- `pnpm exec vitest run tests/integration/completion-engine.test.ts`
- `pnpm build`
- `pnpm test`
- `pnpm exec vitest run tests/integration/workflow-loader.test.ts tests/integration/completion-engine.test.ts`

## PlaySpec

- Task ID: `issue_272_phase_id_artifact_path_safety`
- Workflow: `mono-spec`

## Risk Notes

- Custom workflows with path-like or otherwise filename-unsafe phase IDs now fail workflow loading.
- Artifact writers intentionally keep their existing safe-ID filename behavior.
- No reusable agent guidance was added; this is a narrow validation bug fix rather than a new workflow policy for future agents.
