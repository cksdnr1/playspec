# 8. 테스트 — cross_project_cli_import_alias_bug

Task:
Implement focused test coverage for already-implemented phase behavior and record the result.

Variables:
- FEATURE_SLUG=`cross_project_cli_import_alias_bug`
- TASK_TITLE=`cross_project_cli_import_alias_bug`
- STEP_NUMBER=`8`
- STEP_ID=`focused_tests`
- STEP_TITLE=`테스트`
- SPEC_FILE=`docs/features/cross_project_cli_import_alias_bug/spec.md`
- PLAN_FILE=`docs/features/cross_project_cli_import_alias_bug/plan.md`
- RESULT_FILE=`docs/features/cross_project_cli_import_alias_bug/result.md`
- PR_FILE=`docs/features/cross_project_cli_import_alias_bug/pr.md`

Source of truth:
- `docs/features/cross_project_cli_import_alias_bug/plan.md`
- `docs/features/cross_project_cli_import_alias_bug/result.md`
- Current repository code and existing test conventions.

Scope rules:
- Add focused coverage for the implemented behavior and routing/edge cases called out in the plan.
- Avoid broad test rewrites.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Tests should exercise active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior where feasible.

Output requirements:
- Add or update focused tests.
- Run the relevant test command.
- Update `docs/features/cross_project_cli_import_alias_bug/result.md` with tests changed, commands run, results, failures, and remaining gaps.

Approval/gate handling:
- No approval result is required for this step. Complete normally after tests and result notes are done.

## Global Rules

- Follow the phase spec exactly.
- Do not implement future phases.
- Keep changes minimal and spec-aligned.

