import { YamlTaskStore } from '#storage/yaml-task-store.js';

export async function runGetTask(workspaceRoot: string, taskId: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const task = await store.getTask(taskId);

  const contextRefsCount = task.contextRefs?.length ?? 0;
  const phaseDisplay = task.currentPhase ?? '(not started)';

  console.log(`ID:           ${task.id}`);
  console.log(`Title:        ${task.title}`);
  console.log(`Workflow:     ${task.workflowType}`);
  console.log(`Status:       ${task.status}`);
  console.log(`Phase:        ${phaseDisplay}`);
  console.log(`Context refs: ${contextRefsCount}`);
}
