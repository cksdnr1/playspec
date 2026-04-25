import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';

export async function runComplete(
  workspaceRoot: string,
  taskIdOption?: string,
  withReview = false
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  const core = new PlaySpecCore(workspaceRoot, store);
  const result = await core.completePhase(task.id, { withReview });

  console.log(`Completed phase ${result.completedPhase} for task "${result.taskId}".`);
  if (result.nextPhase) {
    console.log(`Next phase: ${result.nextPhase}`);
  } else {
    console.log('Task status: completed');
  }
  console.log(`Snapshot files: ${result.snapshotFiles.join(', ')}`);
  console.log(`Evidence files: ${result.evidenceFiles.join(', ')}`);
  if (result.reviewFile) {
    console.log(`Review file: ${result.reviewFile}`);
  }
}
