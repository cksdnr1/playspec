import { access, readdir } from 'node:fs/promises';
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
  getEvolutionProposalRevisionPath,
  getEvolutionProposalRoot,
  getEvolutionProposalsRoot,
  getEvolutionProposalValidationPath,
} from '#utils/paths.js';

export interface EvolutionProposalWriteResult {
  proposal: EvolutionProposal;
  proposalPath: string;
  validationPath: string;
  revisionPath: string;
}

export interface AppendEvolutionEvidenceInput {
  path: string;
  note: string;
}

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
    if (validated.status === 'applied' || validated.status === 'failed') {
      throw new Error(`Evolution proposal status cannot be stored by propose: ${validated.status}`);
    }
    const proposalRoot = getEvolutionProposalRoot(this.workspaceRoot, validated.id);
    const proposalPath = getEvolutionProposalPath(this.workspaceRoot, validated.id);

    if (await pathExists(proposalRoot)) {
      throw new Error(`Evolution proposal already exists: ${validated.id}`);
    }

    await writeTextFileAtomic(proposalPath, stringifyYaml(validated));
    return proposalPath;
  }

  async updateProposal(proposalId: string, incomingProposal: unknown): Promise<EvolutionProposalWriteResult> {
    EvolutionProposalIdSchema.parse(proposalId);
    const existing = await this.loadProposal(proposalId);
    assertProposalCanChange(existing);

    const incomingStatus = extractProposalStatus(incomingProposal);
    if (incomingStatus && !isActiveStatus(incomingStatus)) {
      throw new Error(`Only pending/refining proposals can be changed; incoming status was ${incomingStatus}.`);
    }

    const timestamp = new Date().toISOString();
    const merged = normalizeIncomingProposalForUpdate(incomingProposal, existing, proposalId, timestamp);
    const validation = this.validateProposal(merged);
    if (!validation.valid || !validation.proposal) {
      throw new Error(`Evolution proposal is invalid: ${validation.report.errors.join('; ')}`);
    }
    const validated = await this.validateProposalForWorkspace(validation.proposal);
    const report = this.buildReport(
      validated.id,
      'valid',
      [],
      collectCheckedPaths(validated),
      'Proposal is valid.'
    );

    const revisionPath = getEvolutionProposalRevisionPath(this.workspaceRoot, proposalId, existing.revision);
    const validationPath = getEvolutionProposalValidationPath(this.workspaceRoot, proposalId);
    const proposalPath = getEvolutionProposalPath(this.workspaceRoot, proposalId);
    await writeTextFileAtomic(revisionPath, stringifyYaml(existing));
    await writeTextFileAtomic(validationPath, stringifyYaml(report));
    await writeTextFileAtomic(proposalPath, stringifyYaml(validated));

    return { proposal: validated, proposalPath, validationPath, revisionPath };
  }

  async appendEvidence(
    proposalId: string,
    evidence: AppendEvolutionEvidenceInput
  ): Promise<EvolutionProposalWriteResult> {
    EvolutionProposalIdSchema.parse(proposalId);
    const existing = await this.loadProposal(proposalId);
    assertProposalCanChange(existing);

    const timestamp = new Date().toISOString();
    const updated: EvolutionProposal = {
      ...existing,
      revision: existing.revision + 1,
      updatedAt: timestamp,
      evidenceRefs: [
        ...existing.evidenceRefs,
        {
          path: evidence.path,
          note: evidence.note,
          addedAt: timestamp,
          source: 'append-evidence',
        },
      ],
    };
    const validation = this.validateProposal(updated);
    if (!validation.valid || !validation.proposal) {
      throw new Error(`Evolution proposal is invalid: ${validation.report.errors.join('; ')}`);
    }
    const validated = await this.validateProposalForWorkspace(validation.proposal);
    const report = this.buildReport(
      validated.id,
      'valid',
      [],
      collectCheckedPaths(validated),
      'Proposal is valid.'
    );

    const revisionPath = getEvolutionProposalRevisionPath(this.workspaceRoot, proposalId, existing.revision);
    const validationPath = getEvolutionProposalValidationPath(this.workspaceRoot, proposalId);
    const proposalPath = getEvolutionProposalPath(this.workspaceRoot, proposalId);
    await writeTextFileAtomic(revisionPath, stringifyYaml(existing));
    await writeTextFileAtomic(validationPath, stringifyYaml(report));
    await writeTextFileAtomic(proposalPath, stringifyYaml(validated));

    return { proposal: validated, proposalPath, validationPath, revisionPath };
  }

  async loadProposal(proposalId: string): Promise<EvolutionProposal> {
    EvolutionProposalIdSchema.parse(proposalId);
    const content = await readTextFile(getEvolutionProposalPath(this.workspaceRoot, proposalId));
    const parsed = EvolutionProposalSchema.parse(parseYaml(content) as unknown) as EvolutionProposal;
    return this.validateProposalForWorkspace(parsed);
  }

  async listProposals(): Promise<EvolutionProposal[]> {
    let entries: string[];
    try {
      entries = await readdir(getEvolutionProposalsRoot(this.workspaceRoot));
    } catch (error: unknown) {
      if (isMissingPathError(error)) {
        return [];
      }
      throw error;
    }

    const proposals: EvolutionProposal[] = [];
    for (const entry of entries.sort()) {
      const parsedId = EvolutionProposalIdSchema.safeParse(entry);
      if (!parsedId.success) {
        continue;
      }
      try {
        proposals.push(await this.loadProposal(parsedId.data));
      } catch (error: unknown) {
        if (isMissingPathError(error)) {
          continue;
        }
        throw error;
      }
    }

    return proposals.sort((a, b) => a.id.localeCompare(b.id));
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

    for (const ref of proposal.evidenceRefs) {
      const resolved = path.resolve(this.workspaceRoot, ref.path);
      if (!isInsideWorkspace(workspaceRoot, resolved)) {
        throw new Error(`Evolution proposal evidence reference escapes workspace: ${ref.path}`);
      }
      try {
        await access(resolved);
      } catch {
        throw new Error(`Evolution proposal evidence reference not found: ${ref.path}`);
      }
    }

    return proposal;
  }

  async skipProposal(
    proposalId: string,
    metadata: { skippedAt?: string; skipReason?: string } = {}
  ): Promise<EvolutionProposal> {
    EvolutionProposalIdSchema.parse(proposalId);
    const existing = await this.loadProposal(proposalId);
    const updated: EvolutionProposal = {
      ...existing,
      status: 'skipped',
      updatedAt: new Date().toISOString(),
      ...metadata,
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
    ...proposal.evidenceRefs.map((ref) => ref.path),
  ];
}

function normalizeIncomingProposalForUpdate(
  raw: unknown,
  existing: EvolutionProposal,
  proposalId: string,
  timestamp: string
): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const input = raw as Record<string, unknown>;
  return {
    ...input,
    id: proposalId,
    revision: existing.revision + 1,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
    status: hasOwn(input, 'status') ? input['status'] : existing.status,
    evidenceRefs: hasOwn(input, 'evidenceRefs') ? input['evidenceRefs'] : existing.evidenceRefs,
  };
}

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function extractProposalStatus(raw: unknown): EvolutionProposalStatus | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const status = (raw as Record<string, unknown>)['status'];
  if (typeof status !== 'string') {
    return undefined;
  }

  const parsed = EvolutionProposalStatusSchema.safeParse(status);
  return parsed.success ? parsed.data : undefined;
}

function assertProposalCanChange(proposal: EvolutionProposal): void {
  if (!isActiveStatus(proposal.status)) {
    throw new Error(`Only pending/refining proposals can be changed; current status is ${proposal.status}.`);
  }
}

function isActiveStatus(status: EvolutionProposalStatus): boolean {
  return status === 'pending' || status === 'refining';
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

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
