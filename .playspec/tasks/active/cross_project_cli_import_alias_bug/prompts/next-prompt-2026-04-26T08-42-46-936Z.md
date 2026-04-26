# 2. 기술 교차 검증 — cross_project_cli_import_alias_bug

Task:
Validate the technical spec using strict code-level and end-to-end criteria.

Variables:
- FEATURE_SLUG=`cross_project_cli_import_alias_bug`
- TASK_TITLE=`cross_project_cli_import_alias_bug`
- STEP_NUMBER=`2`
- STEP_ID=`tech_spec_validate`
- STEP_TITLE=`기술 교차 검증`
- SOURCE_PROBLEM_FILE=`cross_project_cli_import_alias_bug.md`
- CONTEXT_FILES:
- `cross_project_cli_import_alias_bug.md`
- CONTEXT_REFS_DETAIL:
- `cross_project_cli_import_alias_bug.md` (role: planning-context, source: manual)
- SPEC_FILE=`docs/features/cross_project_cli_import_alias_bug/spec.md`
- PLAN_FILE=`docs/features/cross_project_cli_import_alias_bug/plan.md`
- RESULT_FILE=`docs/features/cross_project_cli_import_alias_bug/result.md`
- PR_FILE=`docs/features/cross_project_cli_import_alias_bug/pr.md`

Source of truth:
- Current repository code.
- `docs/features/cross_project_cli_import_alias_bug/spec.md`
- Linked source problem file when present: `cross_project_cli_import_alias_bug.md`

Scope rules:
- Validate the spec, not the implementation plan.
- Keep findings code-anchored and practical.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Judge end-to-end from active entry point -> state/data update -> propagation/callback/event -> reset/clear -> final user-visible behavior.
- Identify old paths, bypass paths, alternate active paths, partial migrations, hidden coupling, ownership/lifetime risks, callback propagation gaps, reset/clear asymmetry, and state conflicts.
- Check whether the design is over-engineered or hard to maintain.
- If a proposed fix is valid, downgrade that issue from blocker and rejudge.
- Separately list only unresolved blockers that remain after considering proposed fixes.
- Recommend handling for Inferred items and Open Questions.

Output requirements:
- Update the validation/risk ledger in `docs/features/cross_project_cli_import_alias_bug/spec.md`.
Use exactly these top-level sections:
- 해결 가능한 이슈
- 아직 남는 blocker
- medium risk
- low risk
- Inferred and Open Question Solution
- 최종 판정

Approval/gate handling:
- No approval result is required for this validation step.
- The next patch step will route with `playspec complete --result approved` or `playspec complete --result needs_revision`.

## Global Rules

- Follow the phase spec exactly.
- Do not implement future phases.
- Keep changes minimal and spec-aligned.

