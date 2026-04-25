import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlayspecRoot, getHeadPath } from '#utils/paths.js';
import { writeTextFile } from '#utils/fs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PresetManager {
  /**
   * Initialize the .playspec workspace by copying preset assets.
   * Safe to call on an already-initialized workspace.
   */
  async initWorkspace(workspaceRoot: string, presetName: string): Promise<void> {
    const presetAssetsDir = path.join(__dirname, 'assets', presetName);
    const playspecRoot = getPlayspecRoot(workspaceRoot);

    // Ensure .playspec root and tasks/active directory exist
    await mkdir(path.join(playspecRoot, 'tasks', 'active'), { recursive: true });

    // Copy all preset assets into .playspec/
    await cp(presetAssetsDir, playspecRoot, { recursive: true });

    // Create HEAD file (empty — updated by `create` when a task is added)
    const headPath = getHeadPath(workspaceRoot);
    await writeTextFile(headPath, '');
  }
}
