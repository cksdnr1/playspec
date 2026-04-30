import type { TaskSummary } from '#core/types.js';
import { PlaySpecError } from '#core/errors.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import type { TaskStore } from '#storage/task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { getHeadPath } from '#utils/paths.js';
import { writeTextFile } from '#utils/fs.js';
import { isInteractiveCli, readHeadTaskId, resolveEffectivePhaseDisplay } from '../cli-utils.js';

interface SelectorItem {
  task: TaskSummary;
  label: string;
}

export async function runUse(workspaceRoot: string, taskId?: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);

  if (taskId) {
    await setHeadToTask(workspaceRoot, store, taskId);
    return;
  }

  if (!isInteractiveCli()) {
    throw new PlaySpecError(
      'Missing taskId.',
      'Run:\n  playspec list-tasks\n  playspec use <taskId>'
    );
  }

  const tasks = await store.listActiveTasks();
  if (tasks.length === 0) {
    throw new PlaySpecError(
      'No active tasks found.',
      'Run: playspec create <workflow> "<title>"'
    );
  }

  const items = await buildSelectorItems(workspaceRoot, tasks);
  const selectedTask = await selectTask(items);
  await setHeadToTask(workspaceRoot, store, selectedTask.id);
  console.log(`Selected task: ${selectedTask.id} - ${selectedTask.title}`);
}

async function setHeadToTask(workspaceRoot: string, store: TaskStore, taskId: string): Promise<void> {
  // Validate the task exists
  await store.getTask(taskId);
  // Write to HEAD
  await writeTextFile(getHeadPath(workspaceRoot), taskId + '\n');
  console.log(`HEAD set to: ${taskId}`);
}

function formatUseSelectorRow(
  task: Pick<TaskSummary, 'id' | 'title' | 'workflow'>,
  phaseDisplay: string,
  isHead: boolean,
): string {
  const marker = isHead ? ' [HEAD]' : '';
  return `${task.id}${marker}  [${task.workflow}]  Phase: ${phaseDisplay}  - ${task.title}`;
}

async function buildSelectorItems(workspaceRoot: string, tasks: TaskSummary[]): Promise<SelectorItem[]> {
  const headTaskId = await readHeadTaskId(workspaceRoot);
  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const items: SelectorItem[] = [];

  for (const task of tasks) {
    const phase = await resolveEffectivePhaseDisplay(task, workflowLoader);
    items.push({
      task,
      label: formatUseSelectorRow(task, phase.phaseDisplay, task.id === headTaskId),
    });
  }

  return items;
}

async function selectTask(items: SelectorItem[]): Promise<TaskSummary> {
  let selectedIndex = 0;
  let renderedLines = 0;
  const stdin = process.stdin;
  const stdout = process.stdout;
  const wasRaw = stdin.isRaw === true;

  return new Promise<TaskSummary>((resolve, reject) => {
    let isDone = false;

    const restore = () => {
      stdin.off('data', onData);
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(wasRaw);
      }
      stdout.write('\x1b[?25h');
      if (!wasRaw) {
        stdin.pause();
      }
    };

    const finish = (result: TaskSummary) => {
      if (isDone) {
        return;
      }
      isDone = true;
      restore();
      stdout.write('\n');
      resolve(result);
    };

    const cancel = () => {
      if (isDone) {
        return;
      }
      isDone = true;
      restore();
      stdout.write('\n');
      reject(new PlaySpecError('Cancelled. No task selected.'));
    };

    const fail = (error: unknown) => {
      if (isDone) {
        return;
      }
      isDone = true;
      restore();
      stdout.write('\n');
      reject(error);
    };

    const render = () => {
      if (renderedLines > 0) {
        stdout.write(`\x1b[${renderedLines}A`);
        stdout.write('\x1b[J');
      }

      const lines = [
        'Select an active task:',
        ...items.map((item, index) => `${index === selectedIndex ? '>' : ' '} ${item.label}`),
        'Use Up/Down to move, Enter to select, Esc or Ctrl+C to cancel.',
      ];
      stdout.write(`${lines.join('\n')}\n`);
      renderedLines = lines.length;
    };

    const onData = (data: Buffer) => {
      try {
        const input = data.toString('utf8');
        let cursor = 0;

        while (cursor < input.length) {
          if (input.startsWith('\u001b[A', cursor)) {
            selectedIndex = selectedIndex === 0 ? items.length - 1 : selectedIndex - 1;
            render();
            cursor += 3;
            continue;
          }

          if (input.startsWith('\u001b[B', cursor)) {
            selectedIndex = selectedIndex === items.length - 1 ? 0 : selectedIndex + 1;
            render();
            cursor += 3;
            continue;
          }

          const char = input[cursor];
          if (char === '\u0003' || char === '\u001b') {
            cancel();
            return;
          }

          if (char === '\r' || char === '\n') {
            finish(items[selectedIndex].task);
            return;
          }

          cursor += 1;
        }
      } catch (error) {
        fail(error);
      }
    };

    try {
      stdout.write('\x1b[?25l');
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(true);
      }
      stdin.resume();
      stdin.on('data', onData);
      render();
    } catch (error) {
      fail(error);
    }
  });
}
