# Implementation plan

1. Stage the selected/retained file combination.
2. Validate candidate schema, routing, templates and includes.
3. Check active phases against candidate and preserve optimistic recheck before writes.
4. Add selective mismatch and retained-phase tests; build and workflow regressions.

## Acceptance gate
A valid one-phase custom mono-spec with only local.md must reject workflow.yaml-only replacement and remain loadable with identical baseline/runtime hashes. Full accepted update passes. Template-only update preserves custom phases and validates retained local definitions. Missing include rejects before replacement.

Revisit the design if failure injection exposes an inconsistent contract.
