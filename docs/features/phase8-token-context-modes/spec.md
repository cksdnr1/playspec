# Phase 8: Token And Context Modes

## Summary

Prompt rendering supports explicit compact/strict/full context tiers.

## Context Tiers

| Tier | Description |
|------|------|
| compact | Minimal context for fast iteration |
| strict | Standard context with safety checks |
| full | Complete context with detailed history |

## Implementation Plan

1. Add CLI/MCP option for context tier selection
2. Update prompt templates to respect tier settings
3. Add `.meta.yaml` sidecar files for each context tier
4. Implement context size management based on tier

## Files to Modify

- `src/cli/context-tier.js` (new file)
- `src/mcp/context-manager.ts` (new file)
- `docs/features/phase8-token-context-modes/spec.md` (this file)
- `docs/features/phase8-token-context-modes/plan.md` (to be created)
- `docs/features/phase8-token-context-modes/result.md` (to be created)
- `docs/features/phase8-token-context-modes/pr.md` (to be created)
