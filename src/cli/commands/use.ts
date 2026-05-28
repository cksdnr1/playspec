import type { TaskSummary } from '#core/types.js';
import { PlaySpecError, TaskNotActiveError, TaskNotFoundError, UnsafeTaskIdError } from '#core/errors.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import type { TaskStore } from '#storage/task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { getHeadPath } from '#utils/paths.js';
import { writeTextFile } from '#utils/fs.js';
import { slugify } from '#utils/slug.js';
import {
  formatCompactCurrentTaskSummary,
  isInteractiveCli,
  readHeadTaskId,
  resolveEffectivePhaseDisplay,
} from '../cli-utils.js';
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
  let task;
  try {
    task = await store.getTask(taskId);
  } catch (err) {
    if (err instanceof TaskNotFoundError || err instanceof UnsafeTaskIdError) {
      await throwUseSuggestionError(store, taskId, err);
    }
    throw err;
  }

  if (task.status !== 'active') {
    throw new TaskNotActiveError(taskId, task.status);
  }

  await writeTextFile(getHeadPath(workspaceRoot), taskId + '\n');
  console.log(`HEAD set to: ${taskId}`);
  console.log('');
  console.log(await formatCompactCurrentTaskSummary(task, new WorkflowLoader(workspaceRoot)));
}

function formatUseSelectorRow(
  task: Pick<TaskSummary, 'id' | 'title' | 'workflow'>,
  phaseDisplay: string,
  isHead: boolean,
): string {
  const marker = isHead ? ' [HEAD]' : '';
  return `Task ID: ${task.id}${marker}  [${task.workflow}]  Phase: ${phaseDisplay}  - ${task.title}`;
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

async function throwUseSuggestionError(
  store: TaskStore,
  input: string,
  originalError: TaskNotFoundError | UnsafeTaskIdError
): Promise<never> {
  const tasks = await store.listActiveTasks();
  const matches = findTaskSuggestions(input, tasks);

  if (matches.length === 0) {
    throw originalError;
  }

  const inputLabel = `Task not found: ${input}`;
  if (matches.length === 1) {
    const match = matches[0]!;
    throw new PlaySpecError(
      inputLabel,
      [
        'Did you mean this task ID?',
        `  playspec use ${match.id}`,
        `  Task ID: ${match.id}`,
        `  Title:   ${match.title}`,
      ].join('\n')
    );
  }

  throw new PlaySpecError(
    inputLabel,
    [
      'Multiple similar tasks found. Use one of these task IDs:',
      ...matches.map((task) => `  Task ID: ${task.id}  Title: ${task.title}`),
    ].join('\n')
  );
}

function findTaskSuggestions(input: string, tasks: TaskSummary[]): TaskSummary[] {
  const normalizedInput = normalizeForMatch(input);
  const slugInput = slugify(input);
  const matches = tasks.filter((task) => {
    const normalizedId = normalizeForMatch(task.id);
    const normalizedTitle = normalizeForMatch(task.title);
    const titleSlug = slugify(task.title);

    return (
      normalizedInput === normalizedId ||
      normalizedInput === normalizedTitle ||
      slugInput === task.id ||
      slugInput === titleSlug ||
      normalizedId.includes(normalizedInput) ||
      normalizedTitle.includes(normalizedInput) ||
      normalizedInput.includes(normalizedTitle)
    );
  });

  const byId = new Map<string, TaskSummary>();
  for (const match of matches) {
    byId.set(match.id, match);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}
