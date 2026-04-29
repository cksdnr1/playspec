import path from 'node:path';
import os from 'node:os';

export function getPlayspecRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec');
}

export function getTasksRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'tasks', 'active');
}

export function getTaskRoot(workspaceRoot: string, taskId: string): string {
  return path.join(workspaceRoot, '.playspec', 'tasks', 'active', taskId);
}

export function getHeadPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.playspec', 'HEAD');
}

export function getWorkflowPath(workspaceRoot: string, workflowType: string): string {
  return path.join(workspaceRoot, '.playspec', 'workflows', `${workflowType}.yaml`);
}

export function getTemplatePath(workspaceRoot: string, templatePath: string): string {
  return path.join(workspaceRoot, '.playspec', 'templates', templatePath);
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

export function getUserDataRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform === 'win32') {
    return path.join(env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'playspec');
  }

  return path.join(env['XDG_DATA_HOME'] ?? path.join(os.homedir(), '.local', 'share'), 'playspec');
}

export function getUserPacksRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getUserDataRoot(env), 'packs');
}

export function getUserPackRoot(
  packId: string,
  version: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return path.join(getUserPacksRoot(env), packId, version);
}
