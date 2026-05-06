# PR Preparation: Phase 8 - Token And Context Modes

## PR Title

`feat: Phase 8 - Token And Context Modes - Prompt rendering supports explicit compact/strict/full context tiers`

## PR Body Template

```markdown
## Summary

Phase 8 implementation: Prompt rendering now supports explicit compact/strict/full context tiers.

This update adds:
- CLI/MCP context tier selection
- Context tier configurations for compact/strict/full modes
- `.meta.yaml` sidecar files for tier specification
- Auto-detection and validation tools

## Changed Files

New files:
- `src/cli/context-tier.js` - CLI context tier manager
- `src/mcp/context-manager.ts` - MCP context manager
- `src/mcp/context-tier-client.ts` - MCP tier client
- `docs/features/phase8-token-context-modes/.meta.compact.yaml`
- `docs/features/phase8-token-context-modes/.meta.strict.yaml`
- `docs/features/phase8-token-context-modes/.meta.full.yaml`
- `docs/features/phase8-token-context-modes/spec.md`
- `docs/features/phase8-token-context-modes/plan.md`
- `docs/features/phase8-token-context-modes/result.md`
- `docs/features/phase8-token-context-modes/pr.md`

## Tests

Tests run:
- `pnpm build` - Compilation verification
- `pnpm test` - Full test suite
- No new test files required (feature adds no breaking changes)

## PlaySpec Task ID

`phase8-token-context-modes`

## Risk Notes

- Low risk: New feature, no breaking changes
- Backward compatible (default tier = strict)
- Opt-in tier selection
- No production impact
```

## Usage Instructions

1. **Select Context Tier**:
   ```bash
   playspec context-tier select <tier>
   ```
   Available tiers: `compact`, `strict`, `full`

2. **Auto-Detect Tier**:
   ```bash
   playspec context-tier detect --files <file1> <file2>
   ```

3. **Check Tier Consistency**:
   ```bash
   playspec context-tier check --files <files>
   ```

## Branch Name

`agent/issue-56-phase-8`

## Issue

Fixes #56 - PlaySpec Update 8: Token And Context Modes

## Workflow

Follows PlaySpec mono-spec workflow pattern:
- Phase 8: Token And Context Modes
- Dependent on Phase 7 (complete)
- No blocking issues
