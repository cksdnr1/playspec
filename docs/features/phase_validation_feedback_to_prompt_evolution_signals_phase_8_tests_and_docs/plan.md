# Implementation Plan

1. Add feedback documentation.
   - Update `README.md` with the user-facing distinction between approval threshold and feedback threshold.
   - Add workflow authoring guidance for `feedback` config, including storage paths, workflow source paths, read-only target strategy, compact history, prompt hashes, and manual proposal readiness.
   - Add focused evolution docs for feedback threads and optional audit observations.

2. Tighten schema, preset, and backward compatibility tests.
   - Extend `tests/integration/workflow-loader.test.ts` for mono-spec preset feedback config, missing-feedback backward compatibility, threshold separation, and invalid feedback config failures.

3. Tighten store, updater, extraction, and source-resolution tests.
   - Extend feedback thread store tests for raw audit observation persistence.
   - Extend updater tests for one-thread repeated runs, compact history bounds, prompt hash evidence, dedupe stability, and manual-only readiness.
   - Extend extractor tests for approval threshold versus feedback threshold.
   - Extend workflow source resolver tests for bundled/read-only targets and copy/override recommendation fields.

4. Tighten completion and proposal integration tests.
   - Extend `tests/integration/completion-engine.test.ts` to prove completion capture updates one thread, does not mutate target prompt templates, does not auto-apply/create proposals, and records feedback evidence.
   - Extend proposal/evolution CLI or store tests for feedback-thread evidence attachment where not already explicit.

5. Validate.
   - Run focused tests for changed suites first.
   - Run `pnpm build`, `git diff --check`, and full `pnpm test`.

## Risk Notes

- Keep edits docs/test-only unless an existing assertion exposes a direct bug.
- Do not mutate `.playspec` task evidence into committed product state except normal PlaySpec task artifacts used for this issue.
- The branch is stacked on `agent/issue-201-phase-validation-feedback`; the draft PR should target that branch unless #201 lands first.
