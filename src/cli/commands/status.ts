import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import { TaskNotActiveError } from '#core/errors.js';
import { formatContextHeader } from '../context-header.js';
import type { TaskLinkType, TaskRecord } from '#core/types.js';

export async function runStatus(
  workspaceRoot: string,
  taskIdOption?: string,
  quiet?: boolean
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const task = taskIdOption
    ? await store.getTask((await new TaskIdResolver(store).resolve(taskIdOption)).taskId)
    : await new ActiveTaskResolver(workspaceRoot, store).resolveTask();

  if (!taskIdOption && task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  const allTasks = await loadActiveAndCompletedTasks(store);

  if (!quiet) {
    const header = formatContextHeader(task);
    console.log(header.join('\n'));
    console.log('');
  }

  console.log(`ID:       ${task.id}`);
  console.log(`Workflow: ${task.workflow}`);
  console.log(`Status:   ${task.status}`);
  console.log(`Created:  ${task.createdAt}`);
  console.log(`Updated:  ${task.updatedAt}`);

  const completed = task.phaseHistory.filter((p) => p.status === 'completed');
  if (completed.length > 0) {
    console.log(`Completed phases: ${completed.map((p) => p.phase).join(', ')}`);
  }

  printOutgoingLinks(task);
  printIncomingLinks(task, allTasks);
  printSuggestedNext(task, allTasks);
}

async function loadActiveAndCompletedTasks(store: YamlTaskStore): Promise<TaskRecord[]> {
  const summaries = [
    ...(await store.listActiveTasks()),
    ...(await store.listCompletedTasks()),
  ];
  const tasks: TaskRecord[] = [];
  for (const summary of summaries) {
    try {
      tasks.push(await store.getTask(summary.id));
    } catch {
      // Ignore tasks that disappeared or became unreadable between list and get.
    }
  }
  return tasks;
}

function printOutgoingLinks(task: TaskRecord): void {
  printLinkSection('Parents', linksOfType(task, 'parent').map((link) => link.targetTaskId));
  printLinkSection('After', linksOfType(task, 'after').map((link) => link.targetTaskId));
  printLinkSection('Related', linksOfType(task, 'related').map((link) => link.targetTaskId));
}

function printIncomingLinks(task: TaskRecord, allTasks: TaskRecord[]): void {
  const incoming = allTasks.filter((candidate) => candidate.id !== task.id);
  printLinkSection(
    'Includes',
    incoming
      .filter((candidate) => linksOfType(candidate, 'parent').some((link) => link.targetTaskId === task.id))
      .map(formatTaskRef)
  );
  printLinkSection(
    'Followed by',
    incoming
      .filter((candidate) => linksOfType(candidate, 'after').some((link) => link.targetTaskId === task.id))
      .map(formatTaskRef)
  );
  printLinkSection(
    'Related by',
    incoming
      .filter((candidate) => linksOfType(candidate, 'related').some((link) => link.targetTaskId === task.id))
      .map(formatTaskRef)
  );
}

function printSuggestedNext(task: TaskRecord, allTasks: TaskRecord[]): void {
  const children = allTasks.filter((candidate) =>
    candidate.id !== task.id &&
    linksOfType(candidate, 'parent').some((link) => link.targetTaskId === task.id)
  );
  const openChildren = children.filter((child) => child.status !== 'completed');
  if (openChildren.length === 0) {
    return;
  }

  const childById = new Map(children.map((child) => [child.id, child]));
  const unblocked = openChildren.filter((child) => {
    const afterTargets = linksOfType(child, 'after').map((link) => link.targetTaskId);
    if (afterTargets.length === 0) return true;
    return afterTargets.every((targetId) => {
      const target = childById.get(targetId);
      return target === undefined || target.status === 'completed';
    });
  });

  if (unblocked.length === 1) {
    console.log(`Suggested next: ${formatTaskRef(unblocked[0])}`);
  } else if (unblocked.length > 1) {
    printLinkSection('Open candidates', unblocked.map(formatTaskRef));
  }
}

function printLinkSection(title: string, values: string[]): void {
  if (values.length === 0) {
    return;
  }
  console.log(`${title}:`);
  for (const value of values) {
    console.log(`  - ${value}`);
  }
}

function linksOfType(task: TaskRecord, type: TaskLinkType) {
  return (task.links ?? []).filter((link) => link.type === type);
}

function formatTaskRef(task: TaskRecord): string {
  return `${task.id} (${task.status})`;
}
