import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';

export async function runCurrentTask(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask();

  const workflowLoader = new WorkflowLoader(workspaceRoot);

  let phaseTitle = '';
  if (task.currentPhase !== null) {
    try {
      const workflow = await workflowLoader.load(task.workflowType);
      const definition = workflow.phases[task.currentPhase];
      if (definition) {
        phaseTitle = definition.title;
      }
    } catch {
      // leave phaseTitle empty if workflow fails to load
    }
  }

  const contextRefsCount = task.contextRefs?.length ?? 0;
  const phaseDisplay = task.currentPhase ?? '(not started)';

  console.log(`ID:           ${task.id}`);
  console.log(`Title:        ${task.title}`);
  console.log(`Workflow:     ${task.workflowType}`);
  console.log(`Status:       ${task.status}`);
  console.log(`Phase:        ${phaseDisplay}${phaseTitle ? ` — ${phaseTitle}` : ''}`);
  console.log(`Context refs: ${contextRefsCount}`);
}
