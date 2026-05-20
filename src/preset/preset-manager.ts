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

    // Preset state is user-owned after first init; reruns only fill missing defaults.
    await this.copyMissing(path.join(presetAssetsDir, 'sessions'), path.join(playspecRoot, 'sessions'));
    await this.copyFileIfMissing(path.join(presetAssetsDir, 'config.yaml'), path.join(playspecRoot, 'config.yaml'));
    if (workflowInstall !== 'skip') {
      await this.installPresetWorkflows(workspaceRoot, workflowInstall);
    }

    // Create HEAD file (empty — updated by `create` when a task is added).
    const headPath = getHeadPath(workspaceRoot);
    await this.writeTextFileIfMissing(headPath, '');
  }

  private async copyMissing(sourcePath: string, targetPath: string): Promise<void> {
    const entries = await readdir(sourcePath, { withFileTypes: true });
    await mkdir(targetPath, { recursive: true });

    for (const entry of entries) {
      const sourceEntry = path.join(sourcePath, entry.name);
      const targetEntry = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        await this.copyMissing(sourceEntry, targetEntry);
        continue;
      }

      await this.copyFileIfMissing(sourceEntry, targetEntry);
    }
  }

  private async copyFileIfMissing(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await access(targetPath);
      return;
    } catch {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await cp(sourcePath, targetPath);
    }
  }

  private async writeTextFileIfMissing(filePath: string, content: string): Promise<void> {
    try {
      await access(filePath);
      return;
    } catch {
      await writeTextFile(filePath, content);
    }
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
