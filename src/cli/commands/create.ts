import { access } from 'node:fs/promises';
import path from 'node:path';
import * as readline from 'node:readline';
import { WorkspaceNotInitializedError, AmbiguousPlanningTaskError, PlanningContextNotFoundError } from '#core/errors.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { slugify } from '#utils/slug.js';
import { getPlayspecRoot, getHeadPath } from '#utils/paths.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import type { TaskContextRef, TaskTarget } from '#core/types.js';

export interface CreateOptions {
  phase?: string;
  from?: string;
  fromFile?: string;
  stdin?: boolean;
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
    const taskId = slugify(title);
    const source = await resolveSourceProblem(workspaceRoot, taskId, options);
    const store = new YamlTaskStore(workspaceRoot);
    const task = await store.createTask({
      id: taskId,
      title,
      workflowType,
      variables: source
        ? { SOURCE_PROBLEM_FILE: source.relativePath }
        : undefined,
      contextRefs: source
        ? [{ path: source.relativePath, role: 'source-problem', source: options.stdin ? 'stdin' : 'create' }]
        : undefined,
    });
    if (source) {
      await writeTextFile(path.join(workspaceRoot, source.relativePath), source.content);
    }
    await writeTextFile(getHeadPath(workspaceRoot), task.id + '\n');
    console.log(`Created task "${task.id}" (${title})`);
    if (source) {
      console.log(`Source problem stored: ${source.relativePath}`);
    }
    console.log(`HEAD set to: ${task.id}`);
    return;
  }

  if (options.fromFile || options.stdin) {
    throw new Error('--from-file and --stdin are only supported for normal task creation, not --phase execution tasks.');
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

async function resolveSourceProblem(
  workspaceRoot: string,
  taskId: string,
  options: CreateOptions
): Promise<{ relativePath: string; content: string } | undefined> {
  if (options.fromFile && options.stdin) {
    throw new Error('Use only one source input option: --from-file or --stdin.');
  }

  let content: string | undefined;
  if (options.fromFile) {
    const sourcePath = path.resolve(workspaceRoot, options.fromFile);
    content = await readTextFile(sourcePath);
  } else if (options.stdin) {
    content = await readStdin();
  }

  if (content === undefined) {
    return undefined;
  }

  return {
    relativePath: path.join('.playspec', 'tasks', 'active', taskId, 'sources', 'source_problem.md'),
    content: content.endsWith('\n') ? content : `${content}\n`,
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
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
