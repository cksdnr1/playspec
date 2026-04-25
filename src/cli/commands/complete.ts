import * as readline from 'node:readline';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { formatContextHeader } from '../context-header.js';
import { MissingResultError } from '#core/errors.js';

async function promptResultSelection(phaseId: string, results: string[]): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const menu = [
    `Phase "${phaseId}" complete. Select result:`,
    ...results.map((r, i) => `  ${i + 1}. ${r}`),
    '',
    `Choice [1-${results.length}]: `,
  ].join('\n');

  return new Promise((resolve, reject) => {
    rl.question(menu, (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= results.length) {
        reject(new Error(`Invalid choice "${answer.trim()}". Enter a number between 1 and ${results.length}.`));
      } else {
        resolve(results[idx] as string);
      }
    });
  });
}

export async function runComplete(
  workspaceRoot: string,
  taskIdOption?: string,
  withReview = false,
  quiet?: boolean,
  resultOption?: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  if (!quiet) {
    console.log(formatContextHeader(task).join('\n'));
    console.log('');
  }

  // Determine if current phase has results declared (for interactive/non-interactive guard)
  let result: string | undefined = resultOption;

  if (result === undefined) {
    // Load the workflow to check if current phase has results
    const workflowLoader = new WorkflowLoader(workspaceRoot);
    const phaseResolver = new PhaseResolver();
    const workflow = await workflowLoader.load(task.workflowType);
    const { phaseId, definition } = phaseResolver.resolveCurrentPhase(task, workflow);

    if (definition.results && definition.results.length > 0) {
      const isInteractive = process.stdin.isTTY === true;
      if (!isInteractive) {
        throw new MissingResultError(phaseId, definition.results);
      }
      result = await promptResultSelection(phaseId, definition.results);
    }
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const completionResult = await core.completePhase(task.id, { withReview, result });

  console.log(`Completed phase ${completionResult.completedPhase} for task "${completionResult.taskId}".`);
  if (completionResult.nextPhase) {
    console.log(`Next phase: ${completionResult.nextPhase}`);
  } else {
    console.log('Task status: completed');
  }
  console.log(`Snapshot files: ${completionResult.snapshotFiles.join(', ')}`);
  console.log(`Evidence files: ${completionResult.evidenceFiles.join(', ')}`);
  if (completionResult.reviewFile) {
    console.log(`Review file: ${completionResult.reviewFile}`);
  }
}
