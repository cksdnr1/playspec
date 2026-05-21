import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getActiveTasksRoot,
  getArchivedTasksRoot,
  getHeadPath,
  getPlayspecRoot,
} from '#utils/paths.js';

export interface McpWorkspaceDiagnostics {
  serverWorkspaceRoot: string;
  workspaceRoot: string;
  playspecRoot: string;
  headTaskId: string | null;
  taskSearchPaths: {
    active: string;
    completed: string;
    archived: string;
  };
  cache: {
    enabled: false;
    status: string;
  };
}

export function resolveMcpWorkspaceRoot(
  serverWorkspaceRoot: string,
  inputWorkspaceRoot?: string
): string {
  if (!inputWorkspaceRoot) {
    return serverWorkspaceRoot;
  }
  return path.isAbsolute(inputWorkspaceRoot)
    ? inputWorkspaceRoot
    : path.resolve(serverWorkspaceRoot, inputWorkspaceRoot);
}

export async function collectMcpWorkspaceDiagnostics(
  serverWorkspaceRoot: string,
  workspaceRoot: string
): Promise<McpWorkspaceDiagnostics> {
  return {
    serverWorkspaceRoot,
    workspaceRoot,
    playspecRoot: getPlayspecRoot(workspaceRoot),
    headTaskId: await readHeadTaskId(workspaceRoot),
    taskSearchPaths: {
      active: getActiveTasksRoot(workspaceRoot),
      completed: getActiveTasksRoot(workspaceRoot),
      archived: getArchivedTasksRoot(workspaceRoot),
    },
    cache: {
      enabled: false,
      status: 'not used; task state is read from disk per request',
    },
  };
}

export function formatMcpWorkspaceDiagnostics(
  diagnostics: McpWorkspaceDiagnostics
): string {
  return [
    'Workspace diagnostics:',
    `- server workspace root: ${diagnostics.serverWorkspaceRoot}`,
    `- effective workspace root: ${diagnostics.workspaceRoot}`,
    `- .playspec path: ${diagnostics.playspecRoot}`,
    `- active HEAD: ${diagnostics.headTaskId ?? '(none)'}`,
    `- task search paths.active: ${diagnostics.taskSearchPaths.active}`,
    `- task search paths.completed: ${diagnostics.taskSearchPaths.completed}`,
    `- task search paths.archived: ${diagnostics.taskSearchPaths.archived}`,
    `- cache: ${diagnostics.cache.status}`,
  ].join('\n');
}

async function readHeadTaskId(workspaceRoot: string): Promise<string | null> {
  try {
    const content = await readFile(getHeadPath(workspaceRoot), 'utf8');
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
