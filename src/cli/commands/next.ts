import path from 'node:path';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { TaskNotActiveError } from '#core/errors.js';
import { printDesyncResult } from './desync-check.js';
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
  if (!taskIdOption && task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const desync = await core.checkTaskDesync(task.id);
  if (desync.severity === 'high') {
    console.log('High desync warning: workspace reality differs from the last safe point.');
    printDesyncResult(desync);
    console.log('');
  }

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
