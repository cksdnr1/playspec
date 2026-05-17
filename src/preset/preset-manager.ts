import { access, cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlayspecRoot, getHeadPath } from '#utils/paths.js';
import { writeTextFile } from '#utils/fs.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import type { WorkflowInstallDestination } from '#core/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface InitWorkspaceOptions {
  workflowInstall?: WorkflowInstallDestination;
}

export class PresetManager {
  /**
   * Initialize the .playspec workspace by copying preset assets.
   * Safe to call on an already-initialized workspace.
   */
  async initWorkspace(workspaceRoot: string, presetName: string, options: InitWorkspaceOptions = {}): Promise<void> {
    const presetAssetsDir = path.join(__dirname, 'assets', presetName);
    const playspecRoot = getPlayspecRoot(workspaceRoot);
    const workflowInstall = options.workflowInstall ?? 'project';

    // Ensure .playspec state directories exist.
    await mkdir(path.join(playspecRoot, 'tasks', 'active'), { recursive: true });

    await cp(path.join(presetAssetsDir, 'sessions'), path.join(playspecRoot, 'sessions'), { recursive: true });
    await cp(path.join(presetAssetsDir, 'config.yaml'), path.join(playspecRoot, 'config.yaml'));
    if (workflowInstall !== 'skip') {
      await this.installPresetWorkflows(workspaceRoot, workflowInstall);
    }

    // Create HEAD file (empty — updated by `create` when a task is added)
    const headPath = getHeadPath(workspaceRoot);
    await writeTextFile(headPath, '');
  }

  private async installPresetWorkflows(
    workspaceRoot: string,
    destination: Exclude<WorkflowInstallDestination, 'skip'>
  ): Promise<void> {
    const registry = new WorkflowRegistry(workspaceRoot);
    const builtinRoot = registry.getBuiltinRoot();
    const targetRoot = destination === 'project' ? registry.getProjectRoot() : registry.getUserRoot();
    await mkdir(targetRoot, { recursive: true });

    const entries = await readdir(builtinRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sourceDir = path.join(builtinRoot, entry.name);
      try {
        await access(path.join(sourceDir, 'workflow.yaml'));
      } catch {
        continue;
      }

      const targetDir = path.join(targetRoot, entry.name);
      try {
        await access(path.join(targetDir, 'workflow.yaml'));
        continue;
      } catch {
        await cp(sourceDir, targetDir, { recursive: true });
      }
    }
  }
}
