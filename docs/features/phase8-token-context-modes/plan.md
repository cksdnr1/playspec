# Implementation Plan: Phase 8 - Token And Context Modes

## Phase 8 Summary

Prompt rendering supports explicit compact/strict/full context tiers.

## Depends On

- Phase 7: Complete (assumed from the issue description)

## Plan

1. **Add CLI/MCP context tier option**
   - Create `src/cli/context-tier.js` for CLI integration
   - Create `src/mcp/context-manager.ts` for MCP tool integration
   - Create `src/mcp/context-tier-client.ts` for MCP tool implementations

2. **Update prompt templates**
   - Modify prompt rendering to accept tier parameter
   - Add tier-based context generation logic
   - Implement context size management based on tier

3. **Add .meta.yaml sidecars**
   - Create `.meta.compact.yaml` for compact tier
   - Create `.meta.strict.yaml` for strict tier
   - Create `.meta.full.yaml` for full tier

4. **Implement context size management**
   - Compact: 2000 tokens max, 5 history turns, no system prompt
   - Strict: 8000 tokens max, 20 history turns, system prompt only
   - Full: 32000 tokens max, 50 history turns, full context

## Changed Files

- `src/cli/context-tier.js` (new file)
- `src/mcp/context-manager.ts` (new file)
- `src/mcp/context-tier-client.ts` (new file)
- `docs/features/phase8-token-context-modes/.meta.compact.yaml` (new file)
- `docs/features/phase8-token-context-modes/.meta.strict.yaml` (new file)
- `docs/features/phase8-token-context-modes/.meta.full.yaml` (new file)
- `docs/features/phase8-token-context-modes/plan.md` (this file)
- `docs/features/phase8-token-context-modes/spec.md` (existing spec)

## Tests to Run

- `pnpm test` - run all tests
- `pnpm build` - build the project
- Verify new files compile correctly

## Risk Notes

- **Low risk**: Adding new files and configurations
- No breaking changes to existing functionality
- Tier selection is opt-in and backward compatible
- Existing prompts will use default tier (strict)

## Next Steps

After implementation:
1. Run `pnpm build` to verify compilation
2. Run `pnpm test` to verify tests pass
3. Create draft PR
4. Update PlaySpec CLI with new commands
