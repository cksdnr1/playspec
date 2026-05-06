/**
 * Context Tier Client for MCP
 * 
 * Provides MCP tool implementations for context tier management
 */

import { readFile, writeFile, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ContextTierConfig, TIER_CONFIGS, DEFAULT_TIER, getTierDescription, createMetaSidecar } from '#cli/context-tier.js';

export interface ContextTierClient {
  updateTaskContextTier(tier: string, reason?: string): Promise<void>;
  findDominantTier(files: string[]): Promise<string | null>;
  getFileTier(filePath: string): Promise<string | null>;
  checkTierConsistency(files: string[]): Promise<{
    valid: boolean;
    inconsistencies: Array<{
      file: string;
      currentTier: string;
      expectedTier: string;
    }>;
  } | null>;
  updateFilesTiers(files: string[], tier: string): Promise<void>;
  getTierConfig(tier: string): ContextTierConfig;
  generateBaseContext(task: any, phase: any): string;
  prependSystemPrompt(context: string): string;
  appendPreviousConversations(context: string): string;
  appendReasoning(context: string): string;
  truncateMiddle(context: string, size: number): string;
}

/**
 * Implementation of ContextTierClient for MCP tools
 */
export class ContextTierClientImpl implements ContextTierClient {
  constructor(private readonly workspaceRoot: string) {}

  async updateTaskContextTier(
    tier: string,
    reason?: string
  ): Promise<void> {
    const filePath = `${this.workspaceRoot}/.playspec/tasks/current/context-tier.json`;
    
    const data = {
      tier,
      reason,
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      // Fallback: create directory if needed
      const dir = join(this.workspaceRoot, '.playspec/tasks/current');
      try {
        await this.ensureDir(dir);
        await writeFile(filePath, JSON.stringify(data, null, 2));
      } catch (writeErr) {
        throw new Error(`Failed to update context tier: ${writeErr.message}`);
      }
    }
  }

  async findDominantTier(files: string[]): Promise<string | null> {
    const tierCounts = new Map<string, number>();
    
    for (const file of files) {
      const tier = await this.getFileTier(file);
      if (tier) {
        tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
      }
    }
    
    if (tierCounts.size === 0) {
      return null;
    }
    
    // Return the tier with most occurrences
    return [...tierCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  async getFileTier(filePath: string): Promise<string | null> {
    try {
      const metaPath = join(this.workspaceRoot, filePath) + '.meta.yaml';
      const content = await readFile(metaPath, 'utf8');
      const meta = JSON.parse(content);
      
      if (meta.contextTier && TIER_CONFIGS[meta.contextTier]) {
        return meta.contextTier;
      }
    } catch {
      // File or parse error
    }
    
    return null;
  }

  async checkTierConsistency(files: string[]): Promise<{
    valid: boolean;
    inconsistencies: Array<{
      file: string;
      currentTier: string;
      expectedTier: string;
    }>;
  } | null> {
    const fileTiers = new Map<string, string>();
    
    for (const file of files) {
      const tier = await this.getFileTier(file);
      fileTiers.set(file, tier || 'default');
    }
    
    // Check if all files have the same tier
    const tiers = new Set(fileTiers.values());
    
    if (tiers.size > 1) {
      const inconsistencies = Array.from(fileTiers.entries()).map(([file, tier]) => ({
        file,
        currentTier: tier,
        expectedTier: 'any (mixed)',
      }));
      
      return {
        valid: false,
        inconsistencies,
      };
    }
    
    return null; // All consistent or all default
  }

  async updateFilesTiers(files: string[], tier: string): Promise<void> {
    const updated = [];
    
    for (const file of files) {
      const filePath = join(this.workspaceRoot, file) + '.meta.yaml';
      
      try {
        await writeFile(
        filePath,
        JSON.stringify(
          {
            contextTier: tier,
            maxTokens: TIER_CONFIGS[tier].maxTokens,
            tierDescription: getTierDescription(tier),
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
        updated.push({ file, tier });
      } catch {
        // File creation failed, continue with others
      }
    }
    
    if (updated.length > 0) {
      console.log(`Updated ${updated.length} file(s) to tier: ${tier}`);
    }
  }

  getTierConfig(tier: string): ContextTierConfig {
    return TIER_CONFIGS[tier];
  }

  generateBaseContext(task: any, phase: any): string {
    return `Base context for task: ${task.title}
Phase: ${phase.title || phase.id || 'not started'}

Task ID: ${task.id}
Current Phase: ${phase.currentPhase || 'not started'}
`;
  }

  prependSystemPrompt(context: string): string {
    return `You are an AI assistant helping with the following task:
${context}

Remember to respect the current context tier settings.\n`;
  }

  appendPreviousConversations(context: string): string {
    return `${context}
Previous conversations:
${this.getPreviousConversationsPlaceholder()}
`;
  }

  appendReasoning(context: string): string {
    return `${context}

Include reasoning steps in your responses.
`;
  }

  truncateMiddle(context: string, size: number): string {
    const words = context.split(' ');
    if (words.length <= size) {
      return context;
    }
    
    // Take first and last portions, truncate middle
    const prefixSize = Math.floor(size / 2);
    const suffixSize = size - prefixSize;
    
    const prefix = words.slice(0, prefixSize).join(' ') + '...';
    const suffix = words.slice(-suffixSize).join(' ');
    
    return `${prefix}\n[...TRUNCATED...]\n${suffix}`;
  }

  getTierDescription(tier: string): string {
    const descriptions = {
      compact: 'Minimal context for fast iteration',
      strict: 'Standard context with safety checks',
      full: 'Complete context with detailed history',
    };
    return descriptions[tier] || 'Unknown tier';
  }

  async ensureDir(dir: string): Promise<void> {
    try {
      await writeFile(dir + '.empty', '');
      await this.removeFile(dir + '.empty');
    } catch {
      // Directory creation not possible in sandbox
    }
  }

  async removeFile(filePath: string): Promise<void> {
    try {
      await writeFile(filePath, '');
    } catch {
      // Ignore errors
    }
  }

  getPreviousConversationsPlaceholder(): string {
    return `[Previous conversation history would be inserted here]`;
  }
}
