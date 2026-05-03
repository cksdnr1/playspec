import { access } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import {
  EvolutionProposalSchema,
  EvolutionProposalValidationReportSchema,
  EvolutionProposalStatusSchema,
  EvolutionProposalIdSchema,
} from './schemas.js';
import type {
  EvolutionProposal,
  EvolutionProposalStatus,
  EvolutionProposalValidationReport,
  EvolutionProposalValidationResult,
} from './types.js';
import { slugify } from '#utils/slug.js';
import { readTextFile, writeTextFile, writeTextFileAtomic } from '#utils/fs.js';
import {
  getEvolutionProposalPath,
  getEvolutionProposalRoot,
  getEvolutionProposalValidationPath,
} from '#utils/paths.js';

export function generateEvolutionProposalId(prefix = 'proposal'): string {
  const safePrefix = slugify(prefix).replace(/_/g, '-').replace(/[^a-z0-9-]/g, '') || 'proposal';
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'z')
    .toLowerCase();
  const entropy = Math.random().toString(36).slice(2, 8);
  return EvolutionProposalIdSchema.parse(`${safePrefix}_${timestamp}_${entropy}`);
}

export class EvolutionProposalStore {
  constructor(private readonly workspaceRoot: string) {}

  async saveProposal(proposal: EvolutionProposal): Promise<string> {
    const validated = await this.validateProposalForWorkspace(proposal);
    const proposalRoot = getEvolutionProposalRoot(this.workspaceRoot, validated.id);
    const proposalPath = getEvolutionProposalPath(this.workspaceRoot, validated.id);

    if (await pathExists(proposalRoot)) {
      throw new Error(`Evolution proposal already exists: ${validated.id}`);
    }

    await writeTextFileAtomic(proposalPath, stringifyYaml(validated));
    return proposalPath;
  }

  async loadProposal(proposalId: string): Promise<EvolutionProposal> {
    EvolutionProposalIdSchema.parse(proposalId);
    const content = await readTextFile(getEvolutionProposalPath(this.workspaceRoot, proposalId));
    const parsed = EvolutionProposalSchema.parse(parseYaml(content) as unknown) as EvolutionProposal;
    return this.validateProposalForWorkspace(parsed);
  }

  async saveValidationReport(report: EvolutionProposalValidationReport): Promise<string> {
    const validated = EvolutionProposalValidationReportSchema.parse(report) as EvolutionProposalValidationReport;
    const reportPath = getEvolutionProposalValidationPath(this.workspaceRoot, validated.proposalId);
    await writeTextFile(reportPath, stringifyYaml(validated));
    return reportPath;
  }

  async loadValidationReport(proposalId: string): Promise<EvolutionProposalValidationReport> {
    EvolutionProposalIdSchema.parse(proposalId);
    const content = await readTextFile(getEvolutionProposalValidationPath(this.workspaceRoot, proposalId));
    return EvolutionProposalValidationReportSchema.parse(parseYaml(content) as unknown) as EvolutionProposalValidationReport;
  }

  validateProposal(raw: unknown): EvolutionProposalValidationResult {
    const result = EvolutionProposalSchema.safeParse(raw);
    const proposalId = extractProposalId(raw);

    if (result.success) {
      return {
        valid: true,
        proposal: result.data as EvolutionProposal,
        report: this.buildReport(result.data.id, 'valid', [], collectCheckedPaths(result.data), 'Proposal is valid.'),
      };
    }

    const errors = result.error.issues.map(formatZodIssue);
    return {
      valid: false,
      report: this.buildReport(proposalId, 'invalid', errors, [], 'Proposal is invalid.'),
    };
  }

  async validateProposalForWorkspace(raw: unknown): Promise<EvolutionProposal> {
    const proposal = EvolutionProposalSchema.parse(raw) as EvolutionProposal;
    const workspaceRoot = path.resolve(this.workspaceRoot);

    for (const ref of proposal.source.artifactRefs) {
      const resolved = path.resolve(this.workspaceRoot, ref.path);
      if (!isInsideWorkspace(workspaceRoot, resolved)) {
        throw new Error(`Evolution proposal artifact reference escapes workspace: ${ref.path}`);
      }
      try {
        await access(resolved);
      } catch {
        throw new Error(`Evolution proposal artifact reference not found: ${ref.path}`);
      }
    }

    return proposal;
  }

  async updateProposalStatus(
    proposalId: string,
    status: EvolutionProposalStatus,
    metadata: { skippedAt?: string; skipReason?: string } = {}
  ): Promise<EvolutionProposal> {
    EvolutionProposalIdSchema.parse(proposalId);
    EvolutionProposalStatusSchema.parse(status);
    const existing = await this.loadProposal(proposalId);
    const updated: EvolutionProposal = {
      ...existing,
      status,
      ...(status === 'skipped' ? metadata : {}),
    };
    const validated = await this.validateProposalForWorkspace(updated);
    await writeTextFileAtomic(
      getEvolutionProposalPath(this.workspaceRoot, proposalId),
      stringifyYaml(validated)
    );
    return validated;
  }

  private buildReport(
    proposalId: string,
    status: 'valid' | 'invalid',
    errors: string[],
    checkedPaths: string[],
    summary: string
  ): EvolutionProposalValidationReport {
    return {
      proposalId,
      createdAt: new Date().toISOString(),
      status,
      errors,
      warnings: [],
      checkedPaths,
      summary,
    };
  }
}

function collectCheckedPaths(proposal: EvolutionProposal): string[] {
  return [
    ...proposal.targetFiles,
    ...proposal.source.artifactRefs.map((ref) => ref.path),
  ];
}

function extractProposalId(raw: unknown): string {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const id = (raw as Record<string, unknown>)['id'];
    if (typeof id === 'string') {
      const parsed = EvolutionProposalIdSchema.safeParse(id);
      if (parsed.success) return parsed.data;
    }
  }
  return 'invalid_proposal';
}

function formatZodIssue(issue: z.ZodIssue): string {
  const location = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  return `${location}${issue.message}`;
}

function isInsideWorkspace(workspaceRoot: string, resolvedPath: string): boolean {
  return resolvedPath === workspaceRoot || resolvedPath.startsWith(`${workspaceRoot}${path.sep}`);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
