import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { getHeadPath } from '#utils/paths.js';
import { writeTextFile } from '#utils/fs.js';

export async function runUse(workspaceRoot: string, taskId: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  // Validate the task exists
  await store.getTask(taskId);
  // Write to HEAD
  await writeTextFile(getHeadPath(workspaceRoot), taskId + '\n');
  console.log(`HEAD set to: ${taskId}`);
}
