import path from 'node:path';
import * as readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecError, TaskNotActiveError } from '#core/errors.js';
import type { TaskRecord } from '#core/types.js';
import { writeTextFile } from '#utils/fs.js';
import { getTaskRoot } from '#utils/paths.js';
import { isInteractiveCli } from '../cli-utils.js';

export async function runAddContext(
  workspaceRoot: string,
  filePath: string | undefined,
  taskId?: string,
  edit?: boolean,
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
    assertTaskIsActive(task);

    if (edit) {
      // --edit without explicit --task: show task + confirm before opening editor
      console.log(`Task: ${task.id} — ${task.title}`);
      const confirmed = await askConfirmation('Add a context note to the HEAD task? [y/N] ');
      if (!confirmed) {
        console.log('Cancelled. No context linked.');
        return;
      }
    } else {
      const normalizedPath = path.normalize(filePath!);
      console.log(`Task: ${task.id} — ${task.title}`);
      console.log(`Context file: ${normalizedPath}`);
      const confirmed = await askConfirmation('Add this context to the HEAD task? [y/N] ');
      if (!confirmed) {
        console.log('Cancelled. No context linked.');
        return;
      }
    }
    resolvedTaskId = task.id;
  }

  if (edit && taskId) {
    const task = await store.getTask(resolvedTaskId);
    assertTaskIsActive(task);
  }

  let resolvedFilePath: string;

  if (edit) {
    // Open $EDITOR for a generated task-local context note
    const editor = process.env['EDITOR'] ?? 'vi';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const noteRelPath = path.join('.playspec', 'tasks', 'active', resolvedTaskId, 'sources', `context_note_${timestamp}.md`);
    const noteAbsPath = path.join(workspaceRoot, noteRelPath);
    // Write a stub so the editor opens an existing file
    await writeTextFile(noteAbsPath, '');
    const result = spawnSync(editor, [noteAbsPath], { stdio: 'inherit' });
    if (result.error) {
      throw new PlaySpecError(
        `Failed to open editor "${editor}": ${result.error.message}`,
        'Set the EDITOR environment variable to a valid editor command.'
      );
    }
    resolvedFilePath = noteRelPath;
  } else {
    if (!filePath) {
      throw new PlaySpecError(
        'add-context requires a file path or --edit.',
        'Pass a file path argument or use --edit to open an editor.'
      );
    }
    resolvedFilePath = filePath;
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const linked = await core.addContextRef(resolvedTaskId, resolvedFilePath);
  if (linked) {
    console.log('Context linked.');
  } else {
    console.log('Context already linked.');
  }
}

function assertTaskIsActive(task: TaskRecord): void {
  if (task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
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
