/**
 * Context Manager for MCP Tools
 * 
 * Handles context tier selection and propagation for MCP tools
 */

import { z } from 'zod';
import { ContextTierClient } from './context-tier-client.js';
import type { TaskRecord, PhaseDefinition } from '#core/types.js';

// Type definition for TIER_CONFIGS
export interface ContextTierConfig {
  maxTokens: number;
  maxHistoryTurns: number;
  includeSystemPrompt: boolean;
  includePreviousConversations: boolean;
  includeReasoning: boolean;
  truncateMiddle: boolean;
  truncateSize: number;
}

export const TIER_CONFIGS = {
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
} as const;

export const DEFAULT_TIER = 'strict';

/**
 * Get tier description
 */
export function getTierDescription(tier: string): string {
  const descriptions: Record<string, string> = {
    compact: 'Minimal context for fast iteration',
    strict: 'Standard context with safety checks',
    full: 'Complete context with detailed history',
  };
  return descriptions[tier] || 'Unknown tier';
}

/**
 * Create .meta.yaml sidecar for a file
 */
export function createMetaSidecar(filePath: string, tier: string, options: { includeMetadata?: boolean; version?: string } = {}): string {
  const { includeMetadata = true, version = '1.0' } = options;
  const metaPath = filePath + '.meta.yaml';
  const meta = {
    version,
    contextTier: tier,
    maxTokens: TIER_CONFIGS[tier].maxTokens,
    createdAt: new Date().toISOString(),
    ...(includeMetadata && { description: `Context tier metadata for ${filePath}`, tierDescription: getTierDescription(tier) }),
  };
  
  // This is a stub - actual creation is done by CLI
  return metaPath;
}

/**
 * Schema for context tier selection request
 */
export const ContextTierSelectSchema = z.object({
  tier: z.enum(['compact', 'strict', 'full']).optional(),
  reason: z.string().optional(),
  autoDetect: z.boolean().optional(),
});

/**
 * Schema for context tier update request
 */
export const ContextTierUpdateSchema = z.object({
  tier: z.enum(['compact', 'strict', 'full']),
  files: z.array(z.string()).optional(),
  autoUpdate: z.boolean().optional(),
});

/**
 * ContextManager class for MCP tool integration
 */
export class ContextManager {
  private readonly client: ContextTierClient;

  constructor(client: ContextTierClient) {
    this.client = client;
  }

  /**
   * Select context tier for current task
   */
  async selectContextTier(
    tier: 'compact' | 'strict' | 'full',
    reason?: string
  ): Promise<void> {
    await this.client.updateTaskContextTier(tier, reason);
  }

  /**
   * Auto-detect context tier from file metadata
   */
  async autoDetectContextTier(
    files: string[]
  ): Promise<string | null> {
    const dominantTier = await this.client.findDominantTier(files);
    return dominantTier;
  }

  /**
   * Validate tier consistency across files
   */
  async validateTierConsistency(files: string[]): Promise<{
    valid: boolean;
    inconsistencies: Array<{
      file: string;
      currentTier: string;
      expectedTier: string;
    }>;
  } | null> {
    const results = await this.client.checkTierConsistency(files);
    return results;
  }

  /**
   * Get current context tier for a file
   */
  async getTierForFile(filePath: string): Promise<string | null> {
    return this.client.getFileTier(filePath);
  }

  /**
   * Update context tier for multiple files
   */
  async updateFilesContextTier(
    files: string[],
    tier: 'compact' | 'strict' | 'full'
  ): Promise<void> {
    await this.client.updateFilesTiers(files, tier);
  }

  /**
   * Generate context based on tier
   */
  async generateContext(
    task: TaskRecord,
    phase: PhaseDefinition,
    tier: 'compact' | 'strict' | 'full'
  ): Promise<string> {
    const config = this.client.getTierConfig(tier);
    
    // Generate context based on tier configuration
    let context = this.client.generateBaseContext(task, phase);
    
    // Apply tier-specific modifications
    context = this.applyTierContext(context, config);
    
    return context;
  }

  /**
   * Apply tier-specific context modifications
   */
  private applyTierContext(
    context: string,
    config: typeof import('#cli/context-tier').TIER_CONFIGS['strict']
  ): string {
    if (config.includeSystemPrompt) {
      context = this.client.prependSystemPrompt(context);
    }
    
    if (config.includePreviousConversations) {
      context = this.client.appendPreviousConversations(context);
    }
    
    if (config.includeReasoning) {
      context = this.client.appendReasoning(context);
    }
    
    if (config.truncateMiddle) {
      context = this.client.truncateMiddle(context, config.truncateSize);
    }
    
    return context;
  }
}

/**
 * Zod schema for context tier select response
 */
export const ContextTierSelectResponseSchema = z.object({
  tier: z.string(),
  reason: z.string().optional(),
  maxTokens: z.number(),
  historyTurns: z.number(),
  includeSystemPrompt: z.boolean(),
  includePreviousConversations: z.boolean(),
  includeReasoning: z.boolean(),
});

/**
 * Zod schema for context tier update response
 */
export const ContextTierUpdateResponseSchema = z.object({
  filesUpdated: z.array(z.object({
    file: z.string(),
    previousTier: z.string().nullable(),
    newTier: z.string(),
  })),
});
