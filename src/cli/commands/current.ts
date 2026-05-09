import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { resolveEffectivePhaseDisplay } from '../cli-utils.js';

export async function runCurrent(workspaceRoot: string): Promise<void> {
  process.stderr.write('Warning: `playspec current` is deprecated. Use `playspec current-task` instead.\n');

  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask();

  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const eph = await resolveEffectivePhaseDisplay(task, workflowLoader);

  console.log(`Task ID: ${task.id}`);
  console.log(`Title:   ${task.title}`);
  console.log(`Workflow: ${task.workflow}`);
  console.log(`Status:  ${task.status}`);
  console.log(`Phase:   ${eph.phaseDisplay}`);
  if (eph.phaseIdDisplay) {
    console.log(`Phase ID: ${eph.phaseIdDisplay}`);
  }
  if (task.contextRefs && task.contextRefs.length > 0) {
    console.log('Context:');
    for (const ref of task.contextRefs) {
      console.log(`- ${ref.path}`);
    }
  }
}
