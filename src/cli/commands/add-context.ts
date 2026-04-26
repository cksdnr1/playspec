import path from 'node:path';
import * as readline from 'node:readline';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecError } from '#core/errors.js';
import { isInteractiveCli } from '../cli-utils.js';

export async function runAddContext(
  workspaceRoot: string,
  filePath: string,
  taskId?: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  let resolvedTaskId = taskId;

  if (!resolvedTaskId) {
    if (!isInteractiveCli()) {
      throw new PlaySpecError(
        'add-context requires --task <id> in non-interactive mode.',
        'Pass --task <id>, or run interactively to confirm the current HEAD task.'
      );
    }

    const resolver = new ActiveTaskResolver(workspaceRoot, store);
    const task = await resolver.resolveTask();
    const normalizedPath = path.normalize(filePath);
    console.log(`Task: ${task.id} — ${task.title}`);
    console.log(`Context file: ${normalizedPath}`);
    const confirmed = await askConfirmation('Add this context to the HEAD task? [y/N] ');
    if (!confirmed) {
      console.log('Cancelled. No context linked.');
      return;
    }
    resolvedTaskId = task.id;
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const linked = await core.addContextRef(resolvedTaskId, filePath);
  if (linked) {
    console.log('Context linked.');
  } else {
    console.log('Context already linked.');
  }
}

async function askConfirmation(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}
