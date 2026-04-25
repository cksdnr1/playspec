import path from 'node:path';

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
