import { PlaySpecCore } from '#core/playspec-core.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';

export async function runClose(workspaceRoot: string, taskId: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const core = new PlaySpecCore(workspaceRoot, store);
  const archived = await core.closeTask(taskId);

  console.log(`Closed task "${archived.id}" into archive storage.`);
  console.log(`Archive root: ${archived.paths.taskRoot}`);
}
