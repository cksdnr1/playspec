import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';

export async function runCurrent(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask();

  console.log(`ID:      ${task.id}`);
  console.log(`Title:   ${task.title}`);
  console.log(`Workflow: ${task.workflowType}`);
  console.log(`Status:  ${task.status}`);
  console.log(`Phase:   ${task.currentPhase ?? '(not started)'}`);
}
