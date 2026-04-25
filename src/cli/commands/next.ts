import path from 'node:path';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { writeTextFile } from '#utils/fs.js';
import { getTaskRoot } from '#utils/paths.js';

export async function runNext(
  workspaceRoot: string,
  taskIdOption?: string,
  write?: boolean
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  const core = new PlaySpecCore(workspaceRoot, store);
  const prompt = await core.renderNextPrompt(task.id);

  console.log(prompt);

  if (write) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const promptPath = path.join(
      getTaskRoot(workspaceRoot, task.id),
      'prompts',
      `${timestamp}.md`
    );
    await writeTextFile(promptPath, prompt);
  }
}
