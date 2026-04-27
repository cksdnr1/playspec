import { runListTasks } from './list-tasks.js';

export async function runList(workspaceRoot: string): Promise<void> {
  process.stderr.write('Warning: `playspec list` is deprecated. Use `playspec list-tasks` instead.\n');
  await runListTasks(workspaceRoot);
}
