# Implementation plan

## Code changes

1. Add a small helper in `PlaySpecCore` that maps `visitCount` to an artifact suffix:
   - no suffix for `undefined` and `1`
   - `_visitN` for `N > 1`
2. Pass the computed completion suffix from `completePhase()` into:
   - `writeSnapshots()`
   - `writeEvidence()`
3. Keep manual snapshot/evidence behavior unchanged.
4. Continue using the returned writer paths as the only values stored in:
   - `phaseHistory`
   - rollback safe point
   - completion ledger event
   - returned `CompletionResult`

## Tests

1. Extend `tests/integration/routing.test.ts`.
2. Complete routed `validation` twice.
3. Assert first and second validation history entries have distinct `snapshotFiles` and `evidenceFiles`.
4. Assert every referenced file exists.
5. Read first visit artifacts before the second completion and verify those file contents are unchanged after the second completion.
6. Assert `rollback.lastSafePoint` points at the second visit's snapshot files.
7. Run focused routing/completion tests, then full build and test.

## Compatibility

Existing single completion paths remain unchanged because first visits and non-routed phases do not receive a suffix.
