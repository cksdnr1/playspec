import path from 'node:path';

export function getPlayspecRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec');
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
