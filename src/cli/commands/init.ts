import { PresetManager } from '#preset/preset-manager.js';

export async function runInit(
  workspaceRoot: string,
  preset: string
): Promise<void> {
  const manager = new PresetManager();
  await manager.initWorkspace(workspaceRoot, preset);
  console.log(`Workspace initialized with preset "${preset}" at ${workspaceRoot}`);
}
