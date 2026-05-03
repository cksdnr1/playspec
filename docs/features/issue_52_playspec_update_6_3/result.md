# Issue 52 PlaySpec Update 6.3 Result

Implemented Phase 6.3 evolution diff/apply for reviewed executable proposals.

## Implemented

- Added executable evolution actions: `replace_file`, `append_section`, and `replace_section`.
- Added `playspec evolution diff <proposalId>`.
- Added `playspec evolution apply <proposalId> --yes`.
- Restricted apply targets to `.playspec/templates/` and `.playspec/rules/`.
- Rejected planning-only proposal actions during diff/apply.
- Created pre-apply backups under `.playspec/evolution/backups/{proposalId}-{timestamp}/`.
- Wrote apply reports under `.playspec/evolution/reports/{proposalId}-{timestamp}.yaml`.
- Recorded before/after SHA-256 hashes, changed files, action results, validation results, failure metadata, partial-apply state, and recovery guidance.
- Updated proposal status to `applied` on success and `failed` after a written failure report.
- Added template validation through `TemplateRenderer` and narrow readable non-empty rule validation.

## Validation

- Added integration coverage for executable schemas, apply report persistence, and apply status persistence.
- Added CLI coverage for help, diff no-mutation behavior, approval rejection, successful apply, rejected actions/targets/statuses including `skipped`, `applied`, and `failed`, partial failure reports, and migration path separation.
- Ran `pnpm exec tsc --noEmit` - passed.
- Ran `pnpm exec vitest run tests/integration/evolution-proposal-store.test.ts tests/cli.test.ts -t "(EvolutionProposal|executable proposals|partial-apply|explicit approval|diffs executable|rejects old planning|Phase 6.3|allow-listed|workflow targets)"` - passed, 26 tests.
- Ran `pnpm build` - passed.
- Ran `git diff --check` - passed.
- Ran `pnpm test` - partial pass until the known full CLI-suite hang; completed suites included evolution proposal store, migration, task store, variable resolver, MCP server, relevant files, workflow loader, clipboard, completion engine, interactive selector, template renderer, active task resolver, phase resolver, temp workspace, slug, routing, runtime-bin, and init/create/next before the run was stopped.

## Remaining Risks

- Template validation uses representative PlaySpec variables and include resolution; it is not exhaustive for every future workflow variable set.
- Phase 6.3 intentionally provides backup/report recovery metadata, not an automatic rollback command.

## Refactor Review

- Compared the implementation scope against `origin/master`.
- No safe local refactor was applied; the current changes are already scoped to evolution apply, CLI wiring, path helpers, focused tests, and feature docs.
- Intentionally skipped broader cleanup in CLI test structure and template validation because it would exceed Phase 6.3.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/67
- Reusable agent guidance: no new guidance needed; existing AGENTS rules and evolution phase docs cover the safety boundary.
