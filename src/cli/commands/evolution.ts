import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { PlaySpecError } from '#core/errors.js';
import {
  EvolutionProposalStore,
  generateEvolutionProposalId,
} from '#evolution/proposal-store.js';
import type {
  EvolutionProposalValidationReport,
} from '#evolution/types.js';
import { readTextFile } from '#utils/fs.js';

export async function runEvolutionPropose(
  workspaceRoot: string,
  filePath: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
  const raw = parseYaml(await readTextFile(resolvedPath));
  const normalized = normalizeProposalInput(raw, resolvedPath);
  const validation = store.validateProposal(normalized);

  if (!validation.valid || !validation.proposal) {
    throw new PlaySpecError(
      `Evolution proposal is invalid: ${validation.report.errors.join('; ')}`,
      'Fix the proposal YAML and rerun `playspec evolution propose --file <proposal.yaml>`.'
    );
  }

  try {
    const proposalPath = await store.saveProposal(validation.proposal);
    const reportPath = await store.saveValidationReport(validation.report);
    console.log(`Proposal stored: ${validation.proposal.id}`);
    console.log(`Status: ${validation.proposal.status}`);
    console.log(`Revision: ${validation.proposal.revision}`);
    console.log(`Proposal file: ${path.relative(workspaceRoot, proposalPath)}`);
    console.log(`Validation file: ${path.relative(workspaceRoot, reportPath)}`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Evolution proposal already exists:')) {
      throw new PlaySpecError(
        error.message,
        'Use the later proposal update command when it is available, or choose a distinct proposal ID for a different improvement area.'
      );
    }
    throw error;
  }
}

export async function runEvolutionList(workspaceRoot: string): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const proposals = await store.listProposals();

  if (proposals.length === 0) {
    console.log('No evolution proposals found.');
    return;
  }

  console.log('Evolution proposals:');
  for (const proposal of proposals) {
    console.log(`- ${proposal.id} | ${proposal.status} | revision ${proposal.revision} | updated: ${proposal.updatedAt}`);
  }
}

export async function runEvolutionShow(
  workspaceRoot: string,
  proposalId: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const proposal = await store.loadProposal(proposalId);
  const report = await loadReportIfPresent(store, proposalId);

  console.log(`Proposal ID:  ${proposal.id}`);
  console.log(`Status:       ${proposal.status}`);
  console.log(`Revision:     ${proposal.revision}`);
  console.log(`Created:      ${proposal.createdAt}`);
  console.log(`Updated:      ${proposal.updatedAt}`);
  console.log(`Risk:         ${proposal.riskLevel}`);
  console.log(`Review:       ${proposal.review.status}`);
  console.log(`Target files: ${proposal.targetFiles.length}`);
  for (const targetFile of proposal.targetFiles) {
    console.log(`  - ${targetFile}`);
  }
  console.log(`Actions:      ${proposal.actions.length}`);
  for (const action of proposal.actions) {
    console.log(`  - ${action.actionId} | ${action.type} | ${action.summary}`);
  }
  console.log(`Rationale:    ${proposal.rationale}`);

  if (proposal.skippedAt) {
    console.log(`Skipped at:   ${proposal.skippedAt}`);
  }
  if (proposal.skipReason) {
    console.log(`Skip reason:  ${proposal.skipReason}`);
  }

  if (report) {
    console.log('Validation:');
    console.log(`  Status:  ${report.status}`);
    console.log(`  Summary: ${report.summary}`);
  }
}

export async function runEvolutionSkip(
  workspaceRoot: string,
  proposalId: string,
  reason?: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const skippedAt = new Date().toISOString();
  const updated = await store.skipProposal(proposalId, {
    skippedAt,
    ...(reason ? { skipReason: reason } : {}),
  });

  console.log(`Proposal skipped: ${updated.id}`);
  console.log(`Status: ${updated.status}`);
  console.log(`Skipped at: ${updated.skippedAt}`);
  if (updated.skipReason) {
    console.log(`Reason: ${updated.skipReason}`);
  }
}

function normalizeProposalInput(raw: unknown, sourcePath: string): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PlaySpecError(
      'Evolution proposal YAML must be a mapping.',
      'Provide a YAML object with proposal fields.'
    );
  }

  const timestamp = new Date().toISOString();
  const input = raw as Record<string, unknown>;
  return {
    ...input,
    id: input['id'] ?? generateEvolutionProposalId(path.basename(sourcePath, path.extname(sourcePath))),
    revision: 1,
    createdAt: input['createdAt'] ?? timestamp,
    updatedAt: input['updatedAt'] ?? timestamp,
    status: 'pending',
  };
}

async function loadReportIfPresent(
  store: EvolutionProposalStore,
  proposalId: string
): Promise<EvolutionProposalValidationReport | undefined> {
  try {
    return await store.loadValidationReport(proposalId);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}
