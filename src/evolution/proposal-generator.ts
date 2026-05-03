import path from 'node:path';
import { PlaySpecError } from '#core/errors.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import {
  EvolutionProposalStore,
  generateEvolutionProposalId,
  type EvolutionProposalWriteResult,
} from '#evolution/proposal-store.js';
import type {
  EvolutionEvidenceReference,
  EvolutionProposal,
  EvolutionRiskLevel,
} from '#evolution/types.js';

export interface GenerateEvolutionProposalInput {
  taskId: string;
  evidencePath: string;
  targetPath: string;
  summary: string;
  rationale: string;
  riskLevel?: EvolutionRiskLevel;
  proposalId?: string;
  generatedId?: string;
}

export interface GenerateEvolutionProposalResult {
  proposal: EvolutionProposal;
  proposalPath: string;
  validationPath: string;
  revisionPath?: string;
}

export async function generateEvolutionProposal(
  workspaceRoot: string,
  input: GenerateEvolutionProposalInput
): Promise<GenerateEvolutionProposalResult> {
  const core = new PlaySpecCore(workspaceRoot, new YamlTaskStore(workspaceRoot));
  const harness = await core.getHarnessStatus(input.taskId);
  if (harness.blocked || harness.circuitBreaker) {
    throw new PlaySpecError(
      `Evolution generation is blocked for task "${input.taskId}" phase "${harness.phaseId}".`,
      'Inspect `playspec harness status --task <TASK_ID>` and run `playspec harness reset --task <TASK_ID>` after human review.'
    );
  }

  const store = new EvolutionProposalStore(workspaceRoot);
  const now = new Date().toISOString();

  if (input.proposalId) {
    const existing = await store.loadProposal(input.proposalId);
    const incoming = buildGeneratedProposal(input, now, {
      id: existing.id,
      revision: existing.revision,
      createdAt: existing.createdAt,
      status: existing.status,
      evidenceRefs: [
        ...existing.evidenceRefs,
        buildGeneratedEvidenceRef(input, now),
      ],
    });
    return toGenerateResult(await store.updateProposal(input.proposalId, incoming));
  }

  const proposal = buildGeneratedProposal(input, now, {
    id: input.generatedId ?? generateEvolutionProposalId(path.basename(input.targetPath, path.extname(input.targetPath))),
    revision: 1,
    createdAt: now,
    status: 'pending',
    evidenceRefs: [buildGeneratedEvidenceRef(input, now)],
  });
  const validation = store.validateProposal(proposal);
  if (!validation.valid || !validation.proposal) {
    throw new PlaySpecError(
      `Generated evolution proposal is invalid: ${validation.report.errors.join('; ')}`,
      'Adjust --task, --from-evidence, --target, --summary, --rationale, --id, or --risk and rerun `playspec evolution generate`.'
    );
  }

  await rejectActiveTargetOverlap(store, validation.proposal);
  const proposalPath = await store.saveProposal(validation.proposal);
  const validationPath = await store.saveValidationReport(validation.report);
  return { proposal: validation.proposal, proposalPath, validationPath };
}

function buildGeneratedProposal(
  input: GenerateEvolutionProposalInput,
  now: string,
  base: Pick<EvolutionProposal, 'id' | 'revision' | 'createdAt' | 'status' | 'evidenceRefs'>
): EvolutionProposal {
  return {
    id: base.id,
    revision: base.revision,
    createdAt: base.createdAt,
    updatedAt: now,
    status: base.status,
    source: {
      taskId: input.taskId,
      artifactRefs: [],
      generationSource: 'cli',
    },
    targetFiles: [input.targetPath],
    evidenceRefs: base.evidenceRefs,
    riskLevel: input.riskLevel ?? 'medium',
    actions: [
      {
        actionId: 'generated_proposal',
        type: 'propose_file_change',
        targetPath: input.targetPath,
        summary: input.summary,
        rationale: input.rationale,
      },
    ],
    rationale: input.rationale,
    review: {
      status: 'unreviewed',
    },
  };
}

function buildGeneratedEvidenceRef(
  input: GenerateEvolutionProposalInput,
  now: string
): EvolutionEvidenceReference {
  return {
    path: input.evidencePath,
    note: input.summary,
    addedAt: now,
    source: 'generated',
  };
}

async function rejectActiveTargetOverlap(
  store: EvolutionProposalStore,
  proposal: EvolutionProposal
): Promise<void> {
  const targetFiles = new Set(proposal.targetFiles);
  const overlaps = (await store.listProposals())
    .filter((existing) => existing.status === 'pending' || existing.status === 'refining')
    .filter((existing) => existing.targetFiles.some((targetFile) => targetFiles.has(targetFile)));

  if (overlaps.length > 0) {
    throw new PlaySpecError(
      `Active evolution proposal already targets ${proposal.targetFiles.join(', ')}: ${overlaps.map((existing) => existing.id).join(', ')}`,
      'Use `playspec evolution generate --proposal <proposalId>` to refine the active proposal, or choose a different --target for a separate improvement area.'
    );
  }
}

function toGenerateResult(result: EvolutionProposalWriteResult): GenerateEvolutionProposalResult {
  return {
    proposal: result.proposal,
    proposalPath: result.proposalPath,
    validationPath: result.validationPath,
    revisionPath: result.revisionPath,
  };
}
