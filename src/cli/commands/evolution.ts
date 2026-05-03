import { parse as parseYaml } from 'yaml';
import {
  EvolutionProposalStore,
  generateEvolutionProposalId,
} from '#evolution/proposal-store.js';
import type {
  EvolutionProposal,
  EvolutionProposalAction,
} from '#evolution/types.js';
import { readTextFile } from '#utils/fs.js';

export async function runEvolutionPropose(
  workspaceRoot: string,
  filePath: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const raw = parseYaml(await readTextFile(filePath)) as unknown;
  const proposalInput = withGeneratedProposalId(raw);
  const validation = store.validateProposal(proposalInput);

  if (!validation.valid || !validation.proposal) {
    throw new Error(`Invalid evolution proposal: ${validation.report.errors.join('; ')}`);
  }

  const proposalPath = await store.saveProposal(validation.proposal);
  const reportPath = await store.saveValidationReport(validation.report);

  console.log(`Stored evolution proposal: ${validation.proposal.id}`);
  console.log(`Status: ${validation.proposal.status}`);
  console.log(`Proposal: ${proposalPath}`);
  console.log(`Validation: ${reportPath}`);
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
    console.log(
      `- ${proposal.id} | status: ${proposal.status} | risk: ${proposal.riskLevel} | created: ${proposal.createdAt} | actions: ${proposal.actions.length}`
    );
  }
}

export async function runEvolutionShow(
  workspaceRoot: string,
  proposalId: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const proposal = await store.loadProposal(proposalId);
  const validation = await loadValidationReportIfPresent(store, proposalId);

  console.log(`Proposal ID:  ${proposal.id}`);
  console.log(`Status:       ${proposal.status}`);
  console.log(`Risk:         ${proposal.riskLevel}`);
  console.log(`Created:      ${proposal.createdAt}`);
  console.log(`Review:       ${proposal.review.status}`);
  console.log(`Actions:      ${proposal.actions.length}`);
  console.log(`Rationale:    ${proposal.rationale}`);

  if (proposal.skippedAt) {
    console.log(`Skipped at:   ${proposal.skippedAt}`);
  }
  if (proposal.skipReason) {
    console.log(`Skip reason:  ${proposal.skipReason}`);
  }

  printSource(proposal);
  printTargetFiles(proposal);
  printActions(proposal.actions);

  if (validation) {
    console.log('Validation:');
    console.log(`  Status:  ${validation.status}`);
    console.log(`  Created: ${validation.createdAt}`);
    console.log(`  Summary: ${validation.summary}`);
    if (validation.errors.length > 0) {
      console.log('  Errors:');
      for (const error of validation.errors) {
        console.log(`    - ${error}`);
      }
    }
  } else {
    console.log('Validation: not found');
  }
}

export async function runEvolutionSkip(
  workspaceRoot: string,
  proposalId: string,
  reason?: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const updated = await store.updateProposalStatus(proposalId, 'skipped', {
    skippedAt: new Date().toISOString(),
    ...(reason ? { skipReason: reason } : {}),
  });

  console.log(`Skipped evolution proposal: ${updated.id}`);
  console.log(`Status: ${updated.status}`);
  if (updated.skipReason) {
    console.log(`Reason: ${updated.skipReason}`);
  }
}

function withGeneratedProposalId(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const proposal = raw as Record<string, unknown>;
  if (typeof proposal['id'] === 'string' && proposal['id'].trim() !== '') {
    return proposal;
  }

  return {
    ...proposal,
    id: generateEvolutionProposalId('proposal'),
  };
}

async function loadValidationReportIfPresent(
  store: EvolutionProposalStore,
  proposalId: string
) {
  try {
    return await store.loadValidationReport(proposalId);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function printSource(proposal: EvolutionProposal): void {
  if (!proposal.source.taskId && !proposal.source.archivedTaskId && proposal.source.artifactRefs.length === 0) {
    return;
  }

  console.log('Source:');
  if (proposal.source.taskId) {
    console.log(`  Task ID: ${proposal.source.taskId}`);
  }
  if (proposal.source.archivedTaskId) {
    console.log(`  Archived task ID: ${proposal.source.archivedTaskId}`);
  }
  for (const ref of proposal.source.artifactRefs) {
    console.log(`  - ${ref.path} (${ref.role})`);
  }
}

function printTargetFiles(proposal: EvolutionProposal): void {
  if (proposal.targetFiles.length === 0) return;

  console.log('Target files:');
  for (const filePath of proposal.targetFiles) {
    console.log(`  - ${filePath}`);
  }
}

function printActions(actions: EvolutionProposalAction[]): void {
  console.log('Action details:');
  for (const action of actions) {
    const pathDetail = getActionPath(action);
    console.log(`  - ${action.actionId} [${action.type}] ${action.summary}`);
    if (pathDetail) {
      console.log(`    Path: ${pathDetail}`);
    }
    console.log(`    Rationale: ${action.rationale}`);
  }
}

function getActionPath(action: EvolutionProposalAction): string | undefined {
  if (action.type === 'propose_context_reference') {
    return action.path;
  }
  return action.targetPath;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
