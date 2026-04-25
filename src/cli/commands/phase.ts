import { YamlTaskStore } from '../../storage/yaml-task-store.js';
import { ActiveTaskResolver } from '../../core/active-task-resolver.js';
import { PlaySpecCore } from '../../core/playspec-core.js';

export async function runPhase(
  workspaceRoot: string,
  phaseId: string,
  taskIdOption?: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  const core = new PlaySpecCore(workspaceRoot, store);
  const prompt = await core.renderExplicitPhasePrompt(task.id, phaseId);

  console.log(prompt);
}
