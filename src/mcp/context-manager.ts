/**
 * Context Manager for MCP Tools
 * 
 * Handles context tier selection and propagation for MCP tools
 */

import { z } from 'zod';
import { ContextTierClient } from './context-tier-client.js';
import type { TaskRecord, PhaseDefinition } from '#core/types.js';

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
