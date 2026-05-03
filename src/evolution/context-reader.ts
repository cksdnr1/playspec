import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { TaskRecord } from '#core/types.js';
import { writeTextFileAtomic } from '#utils/fs.js';
import { getEvolutionContextSnapshotPath } from '#utils/paths.js';
import { EvolutionHumanEditStore } from './human-edit-store.js';
import { EvolutionProposalStore } from './proposal-store.js';
import { EvolutionContextSnapshotSchema } from './schemas.js';
import type {
  EvolutionContextGenerationSource,
  EvolutionContextResult,
  EvolutionContextSnapshot,
  EvolutionProposal,
  EvolutionProposalPromptSummary,
  HumanEditObservation,
} from './types.js';

export class EvolutionContextReader {
  private readonly proposalStore: EvolutionProposalStore;
  private readonly humanEditStore: EvolutionHumanEditStore;

  constructor(private readonly workspaceRoot: string) {
    this.proposalStore = new EvolutionProposalStore(workspaceRoot);
    this.humanEditStore = new EvolutionHumanEditStore(workspaceRoot);
  }

  async collect(task: TaskRecord): Promise<EvolutionContextResult> {
    const allProposals = await this.proposalStore.listProposals();
    const activeProposals = allProposals.filter((proposal) =>
      proposal.status === 'pending' || proposal.status === 'refining'
    );
    const proposals = activeProposals.filter((proposal) => isProposalRelevant(task, proposal));
    const proposalIds = new Set(proposals.map((proposal) => proposal.id));

    const allObservations = await this.humanEditStore.listObservations();
    const recordedObservations = allObservations.filter((observation) => observation.status === 'recorded');
    const humanEditObservations = recordedObservations.filter((observation) =>
      observation.sourceTaskId === task.id || (observation.proposalId !== undefined && proposalIds.has(observation.proposalId))
    );

    return {
      proposals,
      humanEditObservations,
      proposalSummaries: proposals.map(toPromptSummary),
      omittedProposalCount: activeProposals.length - proposals.length,
      omittedHumanEditObservationCount: recordedObservations.length - humanEditObservations.length,
    };
  }

  formatPromptSection(context: EvolutionContextResult): string {
    const lines = [
      '## Evolution Context',
      '',
      `Pending/refining proposals considered: ${context.proposals.length}`,
    ];

    for (const summary of context.proposalSummaries) {
      lines.push(
        `- ${summary.id}: status=${summary.status}; revision=${summary.revision}; updatedAt=${summary.updatedAt}; risk=${summary.riskLevel}; evidenceRefs=${summary.evidenceRefCount}; targetFiles=${summary.targetFiles.join(', ') || '(none)'}; sourceTask=${summary.sourceTaskId ?? '(none)'}; archivedTask=${summary.archivedTaskId ?? '(none)'}; artifactRefs=${summary.artifactRefCount}`
      );
    }

    lines.push(`Human edit observations considered: ${context.humanEditObservations.length}`);
    if (context.humanEditObservations.length > 0) {
      lines.push(`- ${context.humanEditObservations.map((observation) => observation.id).join(', ')}`);
    }
    lines.push(`Omitted proposals: ${context.omittedProposalCount}`);
    lines.push(`Omitted human edit observations: ${context.omittedHumanEditObservationCount}`);
    return lines.join('\n');
  }

  async writeSnapshot(
    task: TaskRecord,
    phaseId: string,
    source: EvolutionContextGenerationSource,
    generatedAt = new Date()
  ): Promise<string> {
    const context = await this.collect(task);
    const timestamp = formatPathTimestamp(generatedAt);
    const snapshot: EvolutionContextSnapshot = {
      taskId: task.id,
      phaseId,
      proposalIds: context.proposals.map((proposal) => proposal.id),
      humanEditObservationIds: context.humanEditObservations.map((observation) => observation.id),
      omittedProposalCount: context.omittedProposalCount,
      omittedHumanEditObservationCount: context.omittedHumanEditObservationCount,
      generatedAt: generatedAt.toISOString(),
      generationSource: source,
    };
    const validated = EvolutionContextSnapshotSchema.parse(snapshot) as EvolutionContextSnapshot;
    const snapshotPath = getEvolutionContextSnapshotPath(this.workspaceRoot, task.id, phaseId, timestamp);
    await writeTextFileAtomic(snapshotPath, stringifyYaml(validated));
    return path.relative(this.workspaceRoot, snapshotPath);
  }
}

function isProposalRelevant(task: TaskRecord, proposal: EvolutionProposal): boolean {
  if (proposal.source.taskId === task.id) {
    return true;
  }

  const contextRefPaths = new Set((task.contextRefs ?? []).map((ref) => path.normalize(ref.path)));
  const archivedTaskIds = archivedTaskIdsFromRefs(task);
  if (proposal.source.archivedTaskId && archivedTaskIds.has(proposal.source.archivedTaskId)) {
    return true;
  }

  return proposal.source.artifactRefs.some((ref) => {
    if (ref.archivedTaskId && archivedTaskIds.has(ref.archivedTaskId)) {
      return true;
    }
    return contextRefPaths.has(path.normalize(ref.path));
  });
}

function archivedTaskIdsFromRefs(task: TaskRecord): Set<string> {
  const ids = new Set<string>();
  for (const ref of task.contextRefs ?? []) {
    const normalized = path.normalize(ref.path);
    const parts = normalized.split(path.sep);
    const tasksIndex = parts.findIndex((part, index) => part === 'tasks' && parts[index + 1] === 'archived');
    if (tasksIndex >= 0 && parts[tasksIndex + 2]) {
      ids.add(parts[tasksIndex + 2]);
    }
  }
  return ids;
}

function toPromptSummary(proposal: EvolutionProposal): EvolutionProposalPromptSummary {
  return {
    id: proposal.id,
    status: proposal.status as EvolutionProposalPromptSummary['status'],
    revision: proposal.revision,
    updatedAt: proposal.updatedAt,
    sourceTaskId: proposal.source.taskId,
    archivedTaskId: proposal.source.archivedTaskId,
    artifactRefCount: proposal.source.artifactRefs.length,
    evidenceRefCount: proposal.evidenceRefs.length,
    targetFiles: proposal.targetFiles,
    riskLevel: proposal.riskLevel,
  };
}

function formatPathTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'z').toLowerCase();
}
