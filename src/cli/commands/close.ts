import { PlaySpecCore } from '#core/playspec-core.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';

export async function runClose(workspaceRoot: string, taskId: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const core = new PlaySpecCore(workspaceRoot, store);
  const headPath = getHeadPath(workspaceRoot);
  const currentHeadTaskId = await readCurrentHeadTaskId(headPath);
  const archived = await core.closeTask(taskId);
  const closedSelectedTask = currentHeadTaskId === taskId;

  if (closedSelectedTask) {
    await writeTextFile(headPath, '');
  }

  console.log(`Closed task "${archived.id}" into archive storage.`);
  console.log(`Archive root: ${archived.paths.taskRoot}`);
  if (closedSelectedTask) {
    console.log('HEAD cleared because the selected task was closed.');
    console.log('Select another active task with `playspec use <TASK_ID>`.');
  }
}

async function readCurrentHeadTaskId(headPath: string): Promise<string | null> {
  try {
    const content = await readTextFile(headPath);
    return content.trim() || null;
  } catch {
    return null;
  }
}
