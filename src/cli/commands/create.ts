import { access } from 'node:fs/promises';
import { WorkspaceNotInitializedError } from '../../core/errors.js';
import { YamlTaskStore } from '../../storage/yaml-task-store.js';
import { slugify } from '../../utils/slug.js';
import { getPlayspecRoot, getHeadPath } from '../../utils/paths.js';
import { writeTextFile } from '../../utils/fs.js';

export async function runCreate(
  workspaceRoot: string,
  workflowType: string,
  title: string
): Promise<void> {
  // Validate workspace is initialized
  const playspecRoot = getPlayspecRoot(workspaceRoot);
  try {
    await access(playspecRoot);
  } catch {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  const taskId = slugify(title);
  const store = new YamlTaskStore(workspaceRoot);
  const task = await store.createTask({ id: taskId, title, workflowType });

  // Write task ID to HEAD
  await writeTextFile(getHeadPath(workspaceRoot), task.id + '\n');

  console.log(`Created task "${task.id}" (${title})`);
  console.log(`HEAD set to: ${task.id}`);
}
