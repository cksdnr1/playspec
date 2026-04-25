import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';

export async function runSnapshot(
  workspaceRoot: string,
  taskIdOption?: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  const core = new PlaySpecCore(workspaceRoot, store);
  const result = await core.createSnapshot(task.id);

  console.log(`Created snapshot for phase ${result.phaseId} of task "${result.taskId}".`);
  console.log(`Snapshot files: ${result.snapshotFiles.join(', ')}`);
}
