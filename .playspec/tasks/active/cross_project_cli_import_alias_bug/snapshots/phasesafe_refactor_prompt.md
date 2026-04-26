# 9. 리팩토링 — cross_project_cli_import_alias_bug

Task:
Review the current branch diff against `origin/master`, automatically apply only safe and local refactoring opportunities, then verify that the cleanup did not go beyond the intended scope.

Variables:
- FEATURE_SLUG=`cross_project_cli_import_alias_bug`
- TASK_TITLE=`cross_project_cli_import_alias_bug`
- STEP_NUMBER=`9`
- STEP_ID=`safe_refactor`
- STEP_TITLE=`리팩토링`
- TARGET_BRANCH=`origin/master`
- SPEC_FILE=`docs/features/cross_project_cli_import_alias_bug/spec.md`
- PLAN_FILE=`docs/features/cross_project_cli_import_alias_bug/plan.md`
- RESULT_FILE=`docs/features/cross_project_cli_import_alias_bug/result.md`
- PR_FILE=`docs/features/cross_project_cli_import_alias_bug/pr.md`

Source of truth:
- Current branch diff compared against `origin/master`.
- `docs/features/cross_project_cli_import_alias_bug/plan.md`
- `docs/features/cross_project_cli_import_alias_bug/result.md`

Scope rules:
- Compare against `origin/master`, not stale local assumptions.
- Apply only safe, local, scope-bounded refactors.
- Do not change behavior, public contracts, or workflow scope.
- Do not perform cleanup outside files already implicated by the implementation.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Recheck active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior after cleanup.

Output requirements:
- Apply only safe local refactors when they are clearly justified.
- Run focused verification after refactoring.
- Update `docs/features/cross_project_cli_import_alias_bug/result.md` with what changed, what was intentionally skipped, and why the cleanup stayed in scope.

Approval/gate handling:
- No approval result is required for this step. Complete normally after verification.

## Global Rules

- Follow the phase spec exactly.
- Do not implement future phases.
- Keep changes minimal and spec-aligned.

