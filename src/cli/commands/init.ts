import { PresetManager } from '#preset/preset-manager.js';
import { PlaySpecError } from '#core/errors.js';
import type { WorkflowInstallDestination } from '#core/types.js';
import { isInteractiveCli } from '../cli-utils.js';
import readline from 'node:readline/promises';

export interface InitOptions {
  workflowInstall?: string;
}

export async function runInit(
  workspaceRoot: string,
  preset: string,
  opts: InitOptions = {}
): Promise<void> {
  const workflowInstall = await resolveWorkflowInstallDestination(opts.workflowInstall);
  const manager = new PresetManager();
  await manager.initWorkspace(workspaceRoot, preset, { workflowInstall });
  console.log(`Workspace initialized with preset "${preset}" at ${workspaceRoot}`);
  console.log(`Default workflows: ${workflowInstall}`);
}

async function resolveWorkflowInstallDestination(value: string | undefined): Promise<WorkflowInstallDestination> {
  if (value !== undefined) {
    return parseWorkflowInstallDestination(value);
  }

  if (!isInteractiveCli()) {
    return 'project';
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question('Install default workflows? [project/user/skip] (project): ')).trim();
    return parseWorkflowInstallDestination(answer || 'project');
  } finally {
    rl.close();
  }
}

function parseWorkflowInstallDestination(value: string): WorkflowInstallDestination {
  if (value === 'project' || value === 'user' || value === 'skip') {
    return value;
  }
  throw new PlaySpecError(
    `Invalid workflow install destination: ${value}`,
    'Use one of: project, user, skip.'
  );
}
