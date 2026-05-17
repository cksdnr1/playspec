import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';

export async function runShowCompletion(
  workspaceRoot: string,
  completionId: string,
  taskIdOption?: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const task = taskIdOption
    ? await store.getTask((await new TaskIdResolver(store).resolve(taskIdOption)).taskId)
    : await new ActiveTaskResolver(workspaceRoot, store).resolveTask();
  const core = new PlaySpecCore(workspaceRoot, store);
  process.stdout.write(await core.readCompletionMarkdown(task.id, completionId));
}
