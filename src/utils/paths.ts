import path from 'node:path';

export function getPlayspecRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec');
}

export function getProjectWorkflowsRoot(workspaceRoot: string): string {
  return path.join(getPlayspecRoot(workspaceRoot), 'workflows');
}

export function getTasksRoot(workspaceRoot: string): string {
  return getActiveTasksRoot(workspaceRoot);
}

export function getActiveTasksRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'tasks', 'active');
}

export function getTaskRoot(workspaceRoot: string, taskId: string): string {
  return getActiveTaskRoot(workspaceRoot, taskId);
}

export function getActiveTaskRoot(workspaceRoot: string, taskId: string): string {
  return path.join(workspaceRoot, '.playspec', 'tasks', 'active', taskId);
}

export function getHarnessRecordPath(workspaceRoot: string, taskId: string): string {
  return path.join(getActiveTaskRoot(workspaceRoot, taskId), 'harness.yaml');
}

export function getArchivedTasksRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'tasks', 'archived');
}

export function getArchivedTaskRoot(workspaceRoot: string, taskId: string): string {
  return path.join(workspaceRoot, '.playspec', 'tasks', 'archived', taskId);
}

export function getHeadPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'HEAD');
}

export function getMigrationsRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'migrations');
}

export function getMigrationPlansDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'migrations', 'plans');
}

export function getMigrationReportsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'migrations', 'reports');
}

export function getMigrationBackupsDir(workspaceRoot: string, planId: string): string {
  return path.join(workspaceRoot, '.playspec', 'migrations', 'backups', planId);
}

export function getMigrationArchivedDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'migrations', 'archived');
}

export function getEvolutionRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'evolution');
}

export function getEvolutionProposalsRoot(workspaceRoot: string): string {
  return path.join(getEvolutionRoot(workspaceRoot), 'proposals');
}

export function getEvolutionHumanEditsRoot(workspaceRoot: string): string {
  return path.join(getEvolutionRoot(workspaceRoot), 'human-edits');
}

export function getEvolutionHumanEditPath(workspaceRoot: string, editId: string): string {
  return path.join(getEvolutionHumanEditsRoot(workspaceRoot), `${editId}.yaml`);
}

export function getEvolutionContextRoot(workspaceRoot: string): string {
  return path.join(getEvolutionRoot(workspaceRoot), 'context');
}

export function getEvolutionContextTaskRoot(workspaceRoot: string, taskId: string): string {
  return path.join(getEvolutionContextRoot(workspaceRoot), taskId);
}

export function getEvolutionContextSnapshotPath(
  workspaceRoot: string,
  taskId: string,
  phaseId: string,
  timestamp: string
): string {
  return path.join(getEvolutionContextTaskRoot(workspaceRoot, taskId), `${phaseId}-${timestamp}.yaml`);
}

export function getEvolutionReportsRoot(workspaceRoot: string): string {
  return path.join(getEvolutionRoot(workspaceRoot), 'reports');
}

export function getEvolutionBackupsRoot(workspaceRoot: string): string {
  return path.join(getEvolutionRoot(workspaceRoot), 'backups');
}

export function getEvolutionApplyReportPath(
  workspaceRoot: string,
  proposalId: string,
  timestamp: string
): string {
  return path.join(getEvolutionReportsRoot(workspaceRoot), `${proposalId}-${timestamp}.yaml`);
}

export function getEvolutionApplyBackupRoot(
  workspaceRoot: string,
  proposalId: string,
  timestamp: string
): string {
  return path.join(getEvolutionBackupsRoot(workspaceRoot), `${proposalId}-${timestamp}`);
}

export function getEvolutionProposalRoot(workspaceRoot: string, proposalId: string): string {
  return path.join(getEvolutionProposalsRoot(workspaceRoot), proposalId);
}

export function getEvolutionProposalPath(workspaceRoot: string, proposalId: string): string {
  return path.join(getEvolutionProposalRoot(workspaceRoot, proposalId), 'proposal.yaml');
}

export function getEvolutionProposalValidationPath(workspaceRoot: string, proposalId: string): string {
  return path.join(getEvolutionProposalRoot(workspaceRoot, proposalId), 'validation.yaml');
}

export function getEvolutionProposalRevisionsRoot(workspaceRoot: string, proposalId: string): string {
  return path.join(getEvolutionProposalRoot(workspaceRoot, proposalId), 'revisions');
}

export function getEvolutionProposalRevisionPath(
  workspaceRoot: string,
  proposalId: string,
  revision: number
): string {
  return path.join(getEvolutionProposalRevisionsRoot(workspaceRoot, proposalId), `revision-${revision}.yaml`);
}
