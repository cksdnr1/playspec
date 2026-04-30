import readline from 'node:readline';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import {
  PlaySpecError,
  TaskNotActiveError,
  NoExplicitPhasePointerError,
  InvalidCurrentPhaseError,
  RewindOutOfRangeError,
  InvalidRewindStepsError,
} from '#core/errors.js';
import { phaseDisplayInfo } from '#workflow/phase-display.js';
import { isInteractiveCli } from '../cli-utils.js';

export interface RewindOptions {
  steps?: string;
  task?: string;
  yes?: boolean;
}

function parseStepsValue(raw: string): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
    throw new InvalidRewindStepsError(raw);
  }
  return num;
}

async function askConfirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

export async function runRewind(workspaceRoot: string, opts: RewindOptions): Promise<void> {
  const interactive = isInteractiveCli();

  let steps: number;
  if (opts.steps !== undefined) {
    steps = parseStepsValue(opts.steps);
  } else if (interactive) {
    steps = 1;
  } else {
    throw new PlaySpecError(
      'Non-interactive rewind requires --steps <n>.',
      'Provide --task <id>, --steps <n>, and --yes for non-interactive use.'
    );
  }

  if (!interactive) {
    if (!opts.task) {
      throw new PlaySpecError(
        'Non-interactive rewind requires --task <taskId>.',
        'Provide --task <id>, --steps <n>, and --yes for non-interactive use.'
      );
    }
    if (!opts.yes) {
      throw new PlaySpecError(
        'Non-interactive rewind requires --yes to confirm.',
        'Provide --task <id>, --steps <n>, and --yes for non-interactive use.'
      );
    }
  }

  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(opts.task);

  if (task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const workflow = await workflowLoader.load(task.workflow);

  if (task.currentPhase === null) {
    throw new NoExplicitPhasePointerError(task.id);
  }

  const currentIndex = workflow.phaseOrder.indexOf(task.currentPhase);
  if (currentIndex === -1) {
    throw new InvalidCurrentPhaseError(task.currentPhase, workflow.id, workflow.phaseOrder);
  }

  const targetIndex = currentIndex - steps;
  if (targetIndex < 0) {
    throw new RewindOutOfRangeError(steps, currentIndex);
  }

  const targetPhaseId = workflow.phaseOrder[targetIndex]!;
  const currentDef = workflow.phases[task.currentPhase];
  const targetDef = workflow.phases[targetPhaseId]!;
  const currentLabel = currentDef
    ? phaseDisplayInfo(task.currentPhase, currentDef).label
    : task.currentPhase;
  const targetLabel = phaseDisplayInfo(targetPhaseId, targetDef).label;

  if (interactive) {
    console.log(`Task:          ${task.id}`);
    console.log(`Current phase: ${currentLabel}`);
    console.log(`Target phase:  ${targetLabel}`);
    console.log('This will change task currentPhase.');
    console.log('phaseHistory will not be deleted.');
    const confirmed = await askConfirm('Proceed? [y/N] ');
    if (!confirmed) {
      console.log('Cancelled. Phase not changed.');
      return;
    }
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  await core.setCurrentPhase(task.id, targetPhaseId);

  console.log(`Rewound: ${currentLabel} -> ${targetLabel}`);
}
