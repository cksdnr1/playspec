# Implementation Plan

## Ordered Steps

1. Update `src/template/variable-resolver.ts`.
   - Change `FEATURE_SLUG` engine-variable derivation so `task.variables['FEATURE_SLUG'] === ''` falls back to `slugify(task.title)`.
   - Preserve non-empty task values exactly as stored.
   - Keep declared variable default handling unchanged.

2. Update `tests/unit/variable-resolver.test.ts`.
   - Add a focused test for `FEATURE_SLUG: ""`.
   - Assert the returned `FEATURE_SLUG` is title-derived.
   - Assert at least one workflow default referencing `FEATURE_SLUG`, such as `PHASE_SPEC_FILE` and `PHASE_HANDOFF_FILE`, renders with the derived slug.
   - Keep existing absent-slug, explicit non-empty slug, and empty declared-variable tests passing.

3. Run focused validation first.
   - `pnpm test -- tests/unit/variable-resolver.test.ts`

4. Run repository validation.
   - Inspect `package.json` scripts.
   - Run `pnpm build`.
   - Run `pnpm test`.

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_259_empty_feature_slug_should_fall_back_before_resolving_workflow_defaults/result.md`
- `docs/features/issue_259_empty_feature_slug_should_fall_back_before_resolving_workflow_defaults/pr.md`

## Tests To Add Or Update

- Unit coverage in `tests/unit/variable-resolver.test.ts` for empty `FEATURE_SLUG`.
- Assertions must prove defaults are resolved after the fallback slug is computed.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: `task.variables['FEATURE_SLUG'] ?? slugify(task.title)` accepts empty string as a concrete value.
- Bypass path: manually edited or migrated task YAML can store empty `FEATURE_SLUG`, even though normal task creation stores a slug by default.
- Partial migration risk: changing only final returned variables would not fix defaults already rendered with the empty slug. The change must happen before `engineVariables` enters `resolveDeclaredDefaults`.

## Risks

- A caller that intentionally used an empty `FEATURE_SLUG` to create blank path segments will now get the title-derived slug. This is accepted because empty is already treated as unset for declared variable defaults.
- Whitespace-only values remain explicit overrides. That avoids broadening the issue beyond exact empty-string handling.

## Rollback Notes

- Revert the resolver expression and the new unit test if the behavior must be restored.
- No data migration or generated artifact cleanup is required.

## Completion Criteria

- Empty `FEATURE_SLUG` returns the same slug as absent `FEATURE_SLUG`.
- Non-empty explicit `FEATURE_SLUG` remains unchanged.
- Workflow defaults referencing `FEATURE_SLUG` render with the derived slug for empty stored values.
- Focused and full validation commands pass.
