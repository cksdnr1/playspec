import { YamlTaskStore } from '#storage/yaml-task-store.js';

export async function runArchiveList(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const tasks = await store.listArchivedTasks();

  if (tasks.length === 0) {
    console.log('No archived tasks found.');
    return;
  }

  console.log('Archived tasks:');
  for (const task of tasks) {
    const phase = task.currentPhase ?? '(none)';
    console.log(`- ${task.id} | ${task.title} | ${task.workflow} | phase: ${phase}`);
  }
}

export async function runArchiveShow(
  workspaceRoot: string,
  taskId: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const task = await store.getArchivedTask(taskId);

  console.log(`Task ID:      ${task.id}`);
  console.log(`Title:        ${task.title}`);
  console.log(`Status:       ${task.status}`);
  console.log(`Workflow:     ${task.workflow}`);
  console.log(`Current phase:${task.currentPhase ? ` ${task.currentPhase}` : ' (none)'}`);
  console.log(`Task root:    ${task.paths.taskRoot}`);
  console.log(`Docs root:    ${task.paths.projectDocRoot}`);
  console.log(`Created:      ${task.createdAt}`);
  console.log(`Updated:      ${task.updatedAt}`);
  console.log(`Context refs: ${task.contextRefs?.length ?? 0}`);

  if (task.contextRefs && task.contextRefs.length > 0) {
    console.log('Context refs detail:');
    for (const ref of task.contextRefs) {
      console.log(`  - ${ref.path} (${ref.role}, source: ${ref.source})`);
    }
  }

  if (task.phaseHistory.length > 0) {
    console.log('Phase history:');
    for (const entry of task.phaseHistory) {
      const completedAt = entry.completedAt ? ` completed: ${entry.completedAt}` : '';
      console.log(`  - ${entry.phase} (${entry.status})${completedAt}`);
    }
  }
}
