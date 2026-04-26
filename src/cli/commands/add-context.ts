import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';

export async function runAddContext(
  workspaceRoot: string,
  filePath: string,
  taskId: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const core = new PlaySpecCore(workspaceRoot, store);
  const linked = await core.addContextRef(taskId, filePath);
  if (linked) {
    console.log('Context linked.');
  } else {
    console.log('Context already linked.');
  }
}
