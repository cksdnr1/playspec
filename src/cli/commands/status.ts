import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { formatContextHeader } from '../context-header.js';

export async function runStatus(
  workspaceRoot: string,
  taskIdOption?: string,
  quiet?: boolean
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  if (!quiet) {
    const header = formatContextHeader(task);
    console.log(header.join('\n'));
    console.log('');
  }

  console.log(`ID:       ${task.id}`);
  console.log(`Workflow: ${task.workflowType}`);
  console.log(`Status:   ${task.status}`);
  console.log(`Created:  ${task.createdAt}`);
  console.log(`Updated:  ${task.updatedAt}`);

  const completed = task.phaseHistory.filter((p) => p.status === 'completed');
  if (completed.length > 0) {
    console.log(`Completed phases: ${completed.map((p) => p.phase).join(', ')}`);
  }
}
