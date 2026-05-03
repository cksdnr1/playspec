import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { PlaySpecError } from '#core/errors.js';
import {
  EvolutionProposalStore,
  generateEvolutionProposalId,
} from '#evolution/proposal-store.js';
import { EvolutionApplyRunner } from '#evolution/apply-runner.js';
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
        'Use `playspec evolution update <proposalId> --file <proposal.yaml>`, or choose a distinct proposal ID for a different improvement area.'
      );
    }
    throw error;
  }
}

export async function runEvolutionUpdate(
  workspaceRoot: string,
  proposalId: string,
  filePath: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
  const raw = parseYaml(await readTextFile(resolvedPath));
  ensureProposalMapping(raw);

  try {
    const result = await store.updateProposal(proposalId, raw);
    console.log(`Proposal updated: ${result.proposal.id}`);
    console.log(`Status: ${result.proposal.status}`);
    console.log(`Revision: ${result.proposal.revision}`);
    console.log(`Revision file: ${path.relative(workspaceRoot, result.revisionPath)}`);
    console.log(`Proposal file: ${path.relative(workspaceRoot, result.proposalPath)}`);
    console.log(`Validation file: ${path.relative(workspaceRoot, result.validationPath)}`);
  } catch (error: unknown) {
    throw withChangeHint(error);
  }
}

export async function runEvolutionAppendEvidence(
  workspaceRoot: string,
  proposalId: string,
  filePath: string,
  note: string
): Promise<void> {
  const store = new EvolutionProposalStore(workspaceRoot);

  try {
    const result = await store.appendEvidence(proposalId, {
      path: filePath,
      note,
    });
    const evidence = result.proposal.evidenceRefs.at(-1);
    console.log(`Evidence appended: ${result.proposal.id}`);
    console.log(`Status: ${result.proposal.status}`);
    console.log(`Revision: ${result.proposal.revision}`);
    if (evidence) {
      console.log(`Evidence file: ${evidence.path}`);
      console.log(`Evidence note: ${evidence.note}`);
    }
    console.log(`Revision file: ${path.relative(workspaceRoot, result.revisionPath)}`);
    console.log(`Proposal file: ${path.relative(workspaceRoot, result.proposalPath)}`);
    console.log(`Validation file: ${path.relative(workspaceRoot, result.validationPath)}`);
  } catch (error: unknown) {
    throw withChangeHint(error);
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
  console.log(`Evidence:     ${proposal.evidenceRefs.length}`);
  for (const evidence of proposal.evidenceRefs) {
    console.log(`  - ${evidence.path} | ${evidence.source} | ${evidence.note}`);
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
  if (proposal.latestApplyReportPath) {
    console.log(`Apply report: ${proposal.latestApplyReportPath}`);
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

export async function runEvolutionDiff(
  workspaceRoot: string,
  proposalId: string
): Promise<void> {
  const result = await new EvolutionApplyRunner(workspaceRoot).diff(proposalId);

  console.log(`Proposal diff: ${result.proposalId}`);
  console.log(`Revision: ${result.proposalRevision}`);
  console.log(`Target files: ${result.targetFiles.length}`);
  for (const targetFile of result.targetFiles) {
    console.log(`  - ${targetFile}`);
    console.log(`    before: ${result.beforeHashes[targetFile]}`);
    console.log(`    after:  ${result.afterHashes[targetFile]}`);
  }
  console.log(`Changed files: ${result.changedFiles.length}`);
  for (const changedFile of result.changedFiles) {
    console.log(`  - ${changedFile}`);
    const fileDiff = result.fileDiffs[changedFile];
    if (fileDiff) {
      console.log(fileDiff);
    }
  }
  console.log('Actions:');
  for (const summary of result.summary) {
    console.log(`  - ${summary}`);
  }
}

export async function runEvolutionApply(
  workspaceRoot: string,
  proposalId: string,
  opts: { yes?: boolean }
): Promise<void> {
  const result = await new EvolutionApplyRunner(workspaceRoot).apply(proposalId, {
    approved: opts.yes === true,
    approvalSource: 'cli --yes',
  });

  console.log(`Proposal applied: ${result.report.proposalId}`);
  console.log(`Status: applied`);
  console.log(`Report file: ${path.relative(workspaceRoot, result.reportPath)}`);
  console.log(`Backup path: ${path.relative(workspaceRoot, result.backupPath)}`);
  console.log(`Changed files: ${result.report.changedFiles.length}`);
  for (const changedFile of result.report.changedFiles) {
    console.log(`  - ${changedFile}`);
  }
}

function normalizeProposalInput(raw: unknown, sourcePath: string): unknown {
  ensureProposalMapping(raw);

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

function ensureProposalMapping(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PlaySpecError(
      'Evolution proposal YAML must be a mapping.',
      'Provide a YAML object with proposal fields.'
    );
  }
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

function withChangeHint(error: unknown): unknown {
  if (error instanceof Error && error.message.includes('Only pending/refining proposals can be changed')) {
    return new PlaySpecError(
      error.message,
      'Use update or append-evidence only on pending/refining proposals.'
    );
  }
  return error;
}
