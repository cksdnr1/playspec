import { access } from 'node:fs/promises';
import path from 'node:path';
import * as readline from 'node:readline';
import { WorkspaceNotInitializedError, AmbiguousPlanningTaskError, PlanningContextNotFoundError } from '#core/errors.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { slugify } from '#utils/slug.js';
import { getPlayspecRoot, getHeadPath } from '#utils/paths.js';
import { writeTextFile } from '#utils/fs.js';
import type { TaskContextRef, TaskTarget } from '#core/types.js';

export interface CreateOptions {
  phase?: string;
  from?: string;
}

export async function runCreate(
  workspaceRoot: string,
  workflowType: string,
  title: string,
  options: CreateOptions = {}
): Promise<void> {
  const playspecRoot = getPlayspecRoot(workspaceRoot);
  try {
    await access(playspecRoot);
  } catch {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  if (!options.phase) {
    // Original create path — unchanged
    const taskId = slugify(title);
    const store = new YamlTaskStore(workspaceRoot);
    const task = await store.createTask({ id: taskId, title, workflowType });
    await writeTextFile(getHeadPath(workspaceRoot), task.id + '\n');
    console.log(`Created task "${task.id}" (${title})`);
    console.log(`HEAD set to: ${task.id}`);
    return;
  }

  // Phase-execution flow
  const phaseNumber = options.phase;
  const finalTitle = normalizeExecutionTitle(title, phaseNumber);
  const taskId = slugify(finalTitle);
  const store = new YamlTaskStore(workspaceRoot);

  // Resolve planning source
  let planningTaskId: string;
  const isInteractive = process.stdout.isTTY === true;

  if (options.from) {
    planningTaskId = options.from;
  } else {
    const completedTasks = await store.listCompletedTasks();
    const candidates = completedTasks.filter(
      (t) => t.title.toLowerCase() === title.toLowerCase()
    );

    if (candidates.length === 0) {
      throw new PlanningContextNotFoundError(
        '(none)',
        `No completed planning task found with title matching "${title}". Use --from <TASK_ID> to specify one.`
      );
    }

    if (candidates.length === 1) {
      planningTaskId = candidates[0].id;
    } else if (candidates.length > 1 && isInteractive) {
      planningTaskId = await selectPlanningTaskInteractive(
        candidates.map((c) => ({ id: c.id, title: c.title }))
      );
    } else {
      throw new AmbiguousPlanningTaskError(candidates.map((c) => c.id));
    }
  }

  // Load planning task and discover context files
  const planningTask = await store.getTask(planningTaskId);
  const featureSlug = planningTask.variables['FEATURE_SLUG'] ?? planningTask.id;
  const projectDocRoot = planningTask.paths.projectDocRoot;

  const totalSpecRelPath = path.join(projectDocRoot, `${featureSlug}_total_spec.md`);
  const phasePlanRelPath = path.join(projectDocRoot, `${featureSlug}_phase_plan.md`);

  const totalSpecAbsPath = path.resolve(workspaceRoot, totalSpecRelPath);
  const phasePlanAbsPath = path.resolve(workspaceRoot, phasePlanRelPath);

  try {
    await access(totalSpecAbsPath);
  } catch {
    throw new PlanningContextNotFoundError(planningTaskId, totalSpecRelPath);
  }
  try {
    await access(phasePlanAbsPath);
  } catch {
    throw new PlanningContextNotFoundError(planningTaskId, phasePlanRelPath);
  }

  const contextRefs: TaskContextRef[] = [
    { path: totalSpecRelPath, role: 'planning-context', source: planningTaskId },
    { path: phasePlanRelPath, role: 'planning-context', source: planningTaskId },
  ];

  const target: TaskTarget = { phaseNumber };

  // Print linked files
  console.log(`\nAuto-linked context from "${planningTask.title}" (planning task):`);
  for (const ref of contextRefs) {
    console.log(`  - ${ref.path}`);
  }

  // If auto-binding (no --from) and interactive, ask for confirmation
  if (!options.from && isInteractive) {
    const confirmed = await askConfirmation('\nConfirm linking these files? [y/N] ');
    if (!confirmed) {
      console.log('Aborted. No task created.');
      return;
    }
  }

  // Create the task
  const task = await store.createTask({ id: taskId, title: finalTitle, workflowType, target, contextRefs });
  await writeTextFile(getHeadPath(workspaceRoot), task.id + '\n');

  console.log(`\nCreated task "${task.id}" (${finalTitle})`);
  console.log(`HEAD set to: ${task.id}`);
}

function normalizeExecutionTitle(baseTitle: string, phaseNumber: string): string {
  const phasePattern = new RegExp(`\\bPhase\\s+${phaseNumber}\\b`, 'i');
  const executionPattern = /\bExecution\b/i;

  let title = baseTitle;
  if (!phasePattern.test(title)) {
    title = `${title} Phase ${phaseNumber}`;
  }
  if (!executionPattern.test(title)) {
    title = `${title} Execution`;
  }
  return title;
}

async function selectPlanningTaskInteractive(
  candidates: { id: string; title: string }[]
): Promise<string> {
  console.log('\nMultiple planning tasks found. Select one:');
  candidates.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.id} — ${c.title}`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    rl.question(`\nChoice [1-${candidates.length}]: `, (answer) => {
      rl.close();
      const index = parseInt(answer.trim(), 10) - 1;
      if (index >= 0 && index < candidates.length) {
        resolve(candidates[index].id);
      } else {
        reject(new Error(`Invalid selection. Please run the command again and choose 1-${candidates.length}.`));
      }
    });
  });
}

async function askConfirmation(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
