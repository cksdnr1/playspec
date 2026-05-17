import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';

export async function runLog(
  workspaceRoot: string,
  taskIdOption?: string,
  markdown = false
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const task = taskIdOption
    ? await store.getTask((await new TaskIdResolver(store).resolve(taskIdOption)).taskId)
    : await new ActiveTaskResolver(workspaceRoot, store).resolveTask();
  const core = new PlaySpecCore(workspaceRoot, store);
  const events = await core.listCompletionEvents(task.id);
  const newestFirst = [...events].reverse();

  if (newestFirst.length === 0) {
    console.log(`No completion events found for task "${task.id}".`);
    return;
  }

  if (markdown) {
    const bodies = await Promise.all(
      newestFirst.map((event) => core.readCompletionMarkdown(task.id, event.id))
    );
    console.log(bodies.map((body) => body.trimEnd()).join('\n\n---\n\n'));
    return;
  }

  for (const event of newestFirst) {
    console.log(`${event.id} ${pad(event.phase, 28)} ${pad(event.type, 24)} ${event.completedAt}`);
  }
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`;
}
