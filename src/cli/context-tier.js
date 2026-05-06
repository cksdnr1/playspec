/**
 * Context Tier Manager for CLI
 * 
 * Handles selection and propagation of context tiers (compact/strict/full)
 * for prompt rendering in CLI and MCP tools.
 */

const { resolve } = require('node:path');
const { writeFileSync, readFileSync, existsSync } = require('node:fs');

const DEFAULT_TIER = 'strict';

/**
 * Context tier configurations
 */
const TIER_CONFIGS = {
  compact: {
    maxTokens: 2000,
    maxHistoryTurns: 5,
    includeSystemPrompt: false,
    includePreviousConversations: false,
    includeReasoning: false,
    truncateMiddle: true,
    truncateSize: 500,
  },
  strict: {
    maxTokens: 8000,
    maxHistoryTurns: 20,
    includeSystemPrompt: true,
    includePreviousConversations: true,
    includeReasoning: false,
    truncateMiddle: false,
    truncateSize: 2000,
  },
  full: {
    maxTokens: 32000,
    maxHistoryTurns: 50,
    includeSystemPrompt: true,
    includePreviousConversations: true,
    includeReasoning: true,
    truncateMiddle: false,
    truncateSize: 5000,
  },
};

/**
 * Resolve context tier for a given path
 * Reads tier from .meta.yaml sidecar if available
 */
function resolveContextTier(filePath, options = {}) {
  const { tier = DEFAULT_TIER, path: file, cwd = process.cwd() } = options;
  
  // Check for .meta.yaml sidecar
  if (options.autoDetect) {
    const metaPath = resolve(cwd, file + '.meta.yaml');
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
        if (meta.contextTier && TIER_CONFIGS[meta.contextTier]) {
          return meta.contextTier;
        }
      } catch (err) {
        // Ignore parse errors
      }
    }
  }
  
  return tier;
}

/**
 * Get tier configuration object
 */
function getTierConfig(tierName) {
  const tier = tierName || DEFAULT_TIER;
  if (!TIER_CONFIGS[tier]) {
    throw new Error(`Unknown context tier: ${tier}. Available: ${Object.keys(TIER_CONFIGS).join(', ')}`);
  }
  return TIER_CONFIGS[tier];
}

/**
 * Validate tier name
 */
function isValidTier(tierName) {
  return Object.keys(TIER_CONFIGS).includes(tierName);
}

/**
 * Create .meta.yaml sidecar for a file
 */
function createMetaSidecar(filePath, tier, options = {}) {
  const { includeMetadata = true, version = '1.0' } = options;
  
  const metaPath = filePath + '.meta.yaml';
  const meta = {
    version,
    contextTier: tier,
    maxTokens: TIER_CONFIGS[tier].maxTokens,
    createdAt: new Date().toISOString(),
    ...options,
  };
  
  if (includeMetadata) {
    meta.description = `Context tier metadata for ${filePath}`;
    meta.tierDescription = getTierDescription(tier);
  }
  
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  return metaPath;
}

/**
 * Get human-readable tier description
 */
function getTierDescription(tier) {
  const descriptions = {
    compact: 'Minimal context for fast iteration',
    strict: 'Standard context with safety checks',
    full: 'Complete context with detailed history',
  };
  return descriptions[tier] || 'Unknown tier';
}

/**
 * Main export
 */
module.exports = {
  resolveContextTier,
  getTierConfig,
  isValidTier,
  createMetaSidecar,
  getTierDescription,
  TIER_CONFIGS,
  DEFAULT_TIER,
};
