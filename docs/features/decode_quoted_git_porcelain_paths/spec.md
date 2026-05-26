# Decode Quoted Git Porcelain Paths Technical Spec

## Scope

Implement a focused fix for Git porcelain v1 path parsing in `src/core/git-state.ts`. The parser must decode Git's quoted C-style path form before storing `GitStatusEntry.path` and `GitStatusEntry.originalPath`, while preserving ordinary unquoted path behavior and the existing changed-files evidence filenames.

Out of scope: redesigning evidence artifacts, switching all Git status collection to a new format, changing workflow templates, or adding unrelated Git status parsing features.

## Use Case Alignment

When a workspace file contains characters Git quotes in porcelain output, such as a tab in `docs/name\twithtab.md`, PlaySpec's simplified changed-files evidence should contain the actual workspace-relative path, not `"docs/name\\twithtab.md"`. Reviewers and automation can then use `.playspec/tasks/.../evidence/phase*_changed_files.txt` paths directly.

## Current Implementation Summary

Verified code behavior:

- `GitState.getWorkspaceState()` runs `git status --porcelain --untracked-files=all`.
- `parsePorcelain()` splits status output into lines, slices `line.slice(3)` as raw path text, and stores it directly.
- Rename lines are detected with `rawPath.includes(' -> ')`, then split into `originalPath` and destination `path`.
- `statusEntryPathList()` serializes `originalPath -> path` or `path` into changed-files evidence.
- `PlaySpecCore` writes both raw Git status evidence and simplified changed-files evidence during completion and manual evidence collection.
- `state-desync-detector.ts` also consumes `GitStatusEntry.path` and `originalPath`, so parser-level decoding benefits that code path too.

Inferred behavior:

- Git porcelain v1 only quotes paths when needed. Ordinary unquoted paths currently work because the raw slice is already the workspace-relative path.
- Rename parsing is vulnerable to quoted source or destination paths because the split happens before any decoding and only handles the unquoted `old -> new` form.

## Relevant Files Reviewed

- `src/core/git-state.ts`: status collection, `parsePorcelain()`, `statusEntryPathList()`, and `parseNameStatus()`.
- `src/core/playspec-core.ts`: evidence writing uses `statusEntryPathList(workspaceState.entries)`.
- `src/core/state-desync-detector.ts`: downstream consumers classify changed/deleted/renamed/untracked entries from parsed paths.
- `tests/integration/completion-engine.test.ts`: existing changed-files evidence coverage, including unquoted rename evidence.
- `tests/`: no existing direct unit coverage for `parsePorcelain()` was found.

## Active Entry Points And Bypasses

Active entry points:

- Completion evidence: `PlaySpecCore.completePhase()` -> `GitState.getWorkspaceState()` -> `parsePorcelain()` -> `statusEntryPathList()`.
- Manual evidence: `PlaySpecCore.collectEvidence()` follows the same parser and serializer path.
- Desync checks: `state-desync-detector.ts` consumes `GitStatusEntry[]`.

Bypasses:

- `phase*_git_status.txt` intentionally stores raw `git status --short --branch --untracked-files=all` output and should remain unchanged.
- `parseNameStatus()` parses `git diff --name-status`, which is tab-delimited and is not the issue's evidence path.

## Proposed Direction

Add a small parser helper in `src/core/git-state.ts` that understands the subset of Git porcelain v1 path syntax PlaySpec receives:

- If a path token is unquoted, return it unchanged.
- If it starts with `"`, parse until the closing unescaped quote and decode Git C-style escapes into JavaScript string characters.
- Support standard escapes used by Git quoting: `\\`, `\"`, `\n`, `\t`, `\r`, `\b`, `\f`, `\v`, `\a`, and octal byte escapes where practical.
- If quoted syntax is malformed or unsupported, fail safely by returning the original raw token rather than throwing during evidence collection.

For rename entries, parse the raw path field as two porcelain path tokens separated by ` -> `. This keeps ordinary `old -> new` behavior intact and decodes quoted source and destination paths when Git emits them.

## File-By-File Plan

- `src/core/git-state.ts`
  - Add a quoted porcelain path decoder helper.
  - Route `parsePorcelain()` normal and rename paths through the helper.
  - Preserve the existing `GitStatusEntry` shape.

- New or existing focused test file under `tests/`
  - Cover ordinary unquoted porcelain paths.
  - Cover quoted untracked path `?? "docs/name\\twithtab.md"`.
  - Cover rename parsing with destination and original path fields.
  - Cover malformed quoted syntax safe fallback if the helper exposes that behavior.

- `tests/integration/completion-engine.test.ts`
  - Only touch if evidence serialization itself changes. Parser-level decoding should make this unnecessary, but the existing evidence test should be run.

## Risks And Open Questions

- Risk: Git's C-style quoting includes octal byte escapes. A partial decoder that only handles tabs would create future misleading paths. Mitigation: include a small, tested decoder for common escapes and octal byte escapes, with safe fallback on malformed syntax.
- Risk: Rename parsing with quoted paths cannot rely only on `split(' -> ')` when quoted path contents could include spaces or escapes. Mitigation: parse path tokens first, then consume the separator.
- Open question: whether to switch to `git status -z`. This would be more robust but has broader parser and evidence implications. For this issue, a localized decoder is smaller and compatible with current code.

## Reader Aids

Current flow:

```text
git status --porcelain
  -> parsePorcelain(raw path slice)
  -> GitStatusEntry.path
  -> statusEntryPathList()
  -> evidence/phase*_changed_files.txt
```

Proposed flow:

```text
git status --porcelain
  -> parsePorcelain(decode porcelain path token)
  -> GitStatusEntry.path / originalPath
  -> statusEntryPathList()
  -> evidence/phase*_changed_files.txt
```
