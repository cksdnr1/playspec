import readline from 'node:readline';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import {
  PlaySpecError,
  TaskNotActiveError,
  AmbiguousPhaseCommandError,
} from '#core/errors.js';
import { phaseDisplayInfo } from '#workflow/phase-display.js';
import { isInteractiveCli } from '../cli-utils.js';
import type { WorkflowDefinition } from '#core/types.js';
import { selectInteractiveItem } from '../interactive-selector.js';

export interface PhaseOptions {
  task?: string;
  set?: string;
  select?: boolean;
  yes?: boolean;
}

function formatPhaseLabel(phaseId: string, workflow: WorkflowDefinition): string {
  const def = workflow.phases[phaseId];
  return def ? phaseDisplayInfo(phaseId, def).label : phaseId;
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

async function selectPhase(
  phases: { phaseId: string; label: string }[],
  initialIndex: number
): Promise<string | null> {
  try {
    return await selectInteractiveItem(
      phases.map((phase) => ({ value: phase.phaseId, label: phase.label })),
      {
        header: 'Select a phase:',
        cancelMessage: 'Cancelled. Phase not changed.',
        initialIndex,
      }
    );
  } catch (error) {
    if (error instanceof PlaySpecError && error.message === 'Cancelled. Phase not changed.') {
      return null;
    }
    throw error;
  }
}

export async function runPhase(
  workspaceRoot: string,
  phaseId: string | undefined,
  opts: PhaseOptions
): Promise<void> {
  const { set: setPhaseId, select: useSelector = false, task: taskIdOption, yes: autoConfirm = false } = opts;

  // Guard: positional phaseId + mutating option is ambiguous
  if (phaseId !== undefined && (setPhaseId !== undefined || useSelector)) {
    throw new AmbiguousPhaseCommandError();
  }

  // Guard: --set and --select are mutually exclusive
  if (setPhaseId !== undefined && useSelector) {
    throw new PlaySpecError(
      '--set and --select cannot be used together.',
      'Use one of: --set <phaseId> or --select.'
    );
  }

  // Render-only path: positional phaseId with no mutating option
  if (phaseId !== undefined) {
    const store = new YamlTaskStore(workspaceRoot);
    const resolver = new ActiveTaskResolver(workspaceRoot, store);
    const task = await resolver.resolveTask(taskIdOption);
    if (!taskIdOption && task.status !== 'active') {
      throw new TaskNotActiveError(task.id, task.status);
    }
    const core = new PlaySpecCore(workspaceRoot, store);
    const prompt = await core.renderExplicitPhasePrompt(task.id, phaseId);
    console.log(prompt);
    return;
  }

  const interactive = isInteractiveCli();

  // --select requires interactive terminal
  if (useSelector && !interactive) {
    throw new PlaySpecError(
      'phase --select requires an interactive terminal.',
      'Run in an interactive terminal or use --set <phaseId> instead.'
    );
  }

  // --set non-interactive requirements
  if (setPhaseId !== undefined && !interactive) {
    if (!taskIdOption) {
      throw new PlaySpecError(
        'Non-interactive phase --set requires --task <taskId>.',
        'Provide --task <id>, --set <phaseId>, and --yes for non-interactive use.'
      );
    }
    if (!autoConfirm) {
      throw new PlaySpecError(
        'Non-interactive phase --set requires --yes to confirm.',
        'Provide --task <id>, --set <phaseId>, and --yes for non-interactive use.'
      );
    }
  }

  // No phaseId, no --set, no --select
  if (setPhaseId === undefined && !useSelector) {
    throw new PlaySpecError(
      'No phase specified.',
      'Use `playspec phase <phaseId>` to render, `playspec phase --set <phaseId>` to set, or `playspec phase --select` to choose interactively.'
    );
  }

  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);

  if (task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const workflow = await workflowLoader.load(task.workflow);

  let targetPhaseId: string;

  if (useSelector) {
    const phases = workflow.phaseOrder.map((id) => ({
      phaseId: id,
      label: formatPhaseLabel(id, workflow),
    }));
    const preselect = task.currentPhase !== null
      ? Math.max(0, workflow.phaseOrder.indexOf(task.currentPhase))
      : 0;
    const selected = await selectPhase(phases, preselect);
    if (selected === null) {
      console.log('Cancelled. Phase not changed.');
      return;
    }
    targetPhaseId = selected;
  } else {
    targetPhaseId = setPhaseId!;
  }

  const currentLabel = task.currentPhase
    ? formatPhaseLabel(task.currentPhase, workflow)
    : '(not started)';
  const targetLabel = formatPhaseLabel(targetPhaseId, workflow);

  const currentIndex = task.currentPhase !== null
    ? workflow.phaseOrder.indexOf(task.currentPhase)
    : -1;
  const targetIndex = workflow.phaseOrder.indexOf(targetPhaseId);

  if (currentIndex !== -1 && targetIndex < currentIndex) {
    console.warn('Warning: this moves the phase pointer backward.');
  } else if (currentIndex !== -1 && targetIndex > currentIndex + 1) {
    console.warn('Warning: this skips forward past one or more phases.');
  }

  if (interactive) {
    console.log(`Task:          ${task.id}`);
    console.log(`Current phase: ${currentLabel}`);
    console.log(`Target phase:  ${targetLabel}`);
    console.log('This will change task currentPhase.');
    console.log('phaseHistory will not be deleted.');
    if (!autoConfirm) {
      const confirmed = await askConfirm('Proceed? [y/N] ');
      if (!confirmed) {
        console.log('Cancelled. Phase not changed.');
        return;
      }
    }
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  await core.setCurrentPhase(task.id, targetPhaseId);

  console.log(`Phase set: ${currentLabel} -> ${targetLabel}`);
}
