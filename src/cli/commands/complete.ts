import * as readline from 'node:readline';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { gateResults, phaseDisplayInfo } from '#workflow/phase-display.js';
import { formatContextHeader } from '../context-header.js';
import { MissingResultError } from '#core/errors.js';
import { outputPrompt } from './prompt.js';

async function promptResultSelection(phaseLabel: string, results: string[]): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const menu = [
    `${phaseLabel} complete. Select result:`,
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
  resultOption?: string,
  noCopy?: boolean,
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  if (!quiet) {
    console.log(formatContextHeader(task).join('\n'));
    console.log('');
  }

  let result: string | undefined = resultOption;
  let completedPhaseLabel: string | undefined;
  let nextPhaseLabel: string | undefined;

  if (result === undefined) {
    const workflowLoader = new WorkflowLoader(workspaceRoot);
    const phaseResolver = new PhaseResolver();
    const workflow = await workflowLoader.load(task.workflow);
    const { phaseId, definition } = phaseResolver.resolveCurrentPhase(task, workflow);
    const display = phaseDisplayInfo(phaseId, definition);
    completedPhaseLabel = definition.stepNumber ? display.label : phaseId;

    const results = gateResults(definition);
    if (results.length > 0) {
      const isInteractive = process.stdin.isTTY === true;
      if (!isInteractive) {
        throw new MissingResultError(phaseId, results);
      }
      result = await promptResultSelection(completedPhaseLabel, results);
    }
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const completionResult = await core.completePhase(task.id, { withReview, result });
  if (!completedPhaseLabel || (completionResult.nextPhase && !nextPhaseLabel)) {
    const workflowLoader = new WorkflowLoader(workspaceRoot);
    const workflow = await workflowLoader.load(task.workflow);
    const completedDefinition = workflow.phases[completionResult.completedPhase];
    if (completedDefinition) {
      const display = phaseDisplayInfo(completionResult.completedPhase, completedDefinition);
      completedPhaseLabel = completedDefinition.stepNumber ? display.label : completionResult.completedPhase;
    }
    if (completionResult.nextPhase) {
      const nextDefinition = workflow.phases[completionResult.nextPhase];
      if (nextDefinition) {
        const display = phaseDisplayInfo(completionResult.nextPhase, nextDefinition);
        nextPhaseLabel = nextDefinition.stepNumber ? display.label : completionResult.nextPhase;
      }
    }
  }

  console.log(`Completed phase ${completedPhaseLabel ?? completionResult.completedPhase} for task "${completionResult.taskId}".`);
  if (completionResult.nextPhase) {
    console.log(`Next phase: ${nextPhaseLabel ?? completionResult.nextPhase}`);
  } else {
    console.log('Task status: completed');
  }
  console.log(`Snapshot files: ${completionResult.snapshotFiles.join(', ')}`);
  console.log(`Evidence files: ${completionResult.evidenceFiles.join(', ')}`);
  if (completionResult.reviewFile) {
    console.log(`Review file: ${completionResult.reviewFile}`);
  }

  if (completionResult.nextPhase) {
    console.log('');
    try {
      const updatedTask = await store.getTask(task.id);
      const prompt = await core.renderNextPrompt(updatedTask.id);
      await outputPrompt(workspaceRoot, updatedTask, prompt, { noCopy });
    } catch (err) {
      const hint = `playspec prompt --task ${task.id}`;
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Warning: Could not render next prompt after completion: ${msg}\n`);
      process.stderr.write(`Hint: Run: ${hint}\n`);
    }
  }
}
