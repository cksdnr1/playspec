import type { TaskSummary } from '#core/types.js';
import { PlaySpecError } from '#core/errors.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import type { TaskStore } from '#storage/task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { getHeadPath } from '#utils/paths.js';
import { writeTextFile } from '#utils/fs.js';
import { isInteractiveCli, readHeadTaskId, resolveEffectivePhaseDisplay } from '../cli-utils.js';
import { selectInteractiveItem } from '../interactive-selector.js';

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

async function buildSelectorItems(workspaceRoot: string, tasks: TaskSummary[]) {
  const headTaskId = await readHeadTaskId(workspaceRoot);
  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const items: { value: TaskSummary; label: string }[] = [];

  for (const task of tasks) {
    const phase = await resolveEffectivePhaseDisplay(task, workflowLoader);
    items.push({
      value: task,
      label: formatUseSelectorRow(task, phase.phaseDisplay, task.id === headTaskId),
    });
  }

  return items;
}

async function selectTask(items: { value: TaskSummary; label: string }[]): Promise<TaskSummary> {
  return selectInteractiveItem(items, {
    header: 'Select an active task:',
    cancelMessage: 'Cancelled. No task selected.',
  });
}
