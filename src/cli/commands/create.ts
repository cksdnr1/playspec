import { access, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as readline from 'node:readline';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import { WorkspaceNotInitializedError, AmbiguousPlanningTaskError, PlanningContextNotFoundError, SelfTaskLinkError } from '#core/errors.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { VariableResolver } from '#template/variable-resolver.js';
import { assertRequiredVariables } from '#core/required-variables.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import { slugify } from '#utils/slug.js';
import { getPlayspecRoot, getHeadPath } from '#utils/paths.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import type { ResolvedWorkflow, TaskContextRef, TaskLink, TaskRecord, TaskTarget, VariableDeclaration, WorkflowDefinition } from '#core/types.js';

export interface CreateOptions {
  phase?: string;
  /** Planning task ID (with --phase) or source problem file path (without --phase). */
  from?: string;
  fromFile?: string;
  stdin?: boolean;
  /** Open $EDITOR to write the source problem. */
  edit?: boolean;
  var?: string[];
  parent?: string;
  after?: string;
}

interface SourceOptions {
  fromFile?: string;
  stdin?: boolean;
  edit?: boolean;
}

interface SourceResult {
  relativePath: string;
  content: string;
  method: string;
}

export async function runCreate(
  workspaceRoot: string,
  workflow: string,
  title: string,
  options: CreateOptions = {}
): Promise<void> {
  const playspecRoot = getPlayspecRoot(workspaceRoot);
  try {
    await access(playspecRoot);
  } catch {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  await validateWorkflowExists(workspaceRoot, workflow);

  if (!options.phase) {
    if (options.from && options.fromFile) {
      throw new Error('--from and --from-file both specify source files. Use only one.');
    }
    // Without --phase, --from is treated as a source problem file alias.
    const fileSource = options.fromFile ?? options.from;

    const taskId = slugify(title);
    const source = await resolveSourceProblem(workspaceRoot, taskId, {
      fromFile: fileSource,
      stdin: options.stdin,
      edit: options.edit,
    });
    const links = await resolveCreateLinks(workspaceRoot, taskId, options);
    await createNormalTask(workspaceRoot, workflow, title, source, links, parseTaskVariables(options.var));
    return;
  }

  if (options.fromFile || options.stdin || options.edit) {
    throw new Error('--from-file, --stdin, and --edit are only supported for normal task creation, not --phase execution tasks.');
  }
  if (options.parent || options.after) {
    throw new Error('--parent and --after are only supported for normal task creation, not --phase execution tasks.');
  }
  const variables = parseTaskVariables(options.var);

  // Phase-execution flow
  const phaseNumber = options.phase;
  const finalTitle = normalizeExecutionTitle(title, phaseNumber);
  const taskId = slugify(finalTitle);
  const store = new YamlTaskStore(workspaceRoot);

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

  const planningTask = await store.getTask(planningTaskId);
  const planningArtifacts = await resolvePlanningArtifacts(workspaceRoot, planningTask);
  const totalSpecRelPath = planningArtifacts.totalSpec;
  const phasePlanRelPath = planningArtifacts.phasePlan;

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

  console.log(`\nAuto-linked context from "${planningTask.title}" (planning task):`);
  for (const ref of contextRefs) {
    console.log(`  - ${ref.path}`);
  }

  if (!options.from && isInteractive) {
    const confirmed = await askConfirmation('\nConfirm linking these files? [y/N] ');
    if (!confirmed) {
      console.log('Aborted. No task created.');
      return;
    }
  }

  const task = await store.createTask({ id: taskId, title: finalTitle, workflow, target, contextRefs, variables });
  await writeTextFile(getHeadPath(workspaceRoot), task.id + '\n');

  console.log(`\nCreated task "${task.id}" (${finalTitle})`);
  const variableCount = Object.keys(variables).length;
  if (variableCount > 0) {
    console.log(`Variables set: ${variableCount}`);
  }
  console.log(`HEAD set to: ${task.id}`);
}

async function validateWorkflowExists(workspaceRoot: string, workflow: string): Promise<void> {
  await new WorkflowLoader(workspaceRoot).resolve(workflow);
}

async function resolvePlanningArtifacts(
  workspaceRoot: string,
  planningTask: Awaited<ReturnType<YamlTaskStore['getTask']>>
): Promise<{ totalSpec: string; phasePlan: string }> {
  const workflow = await new WorkflowLoader(workspaceRoot).load(planningTask.workflow);
  const phaseId = planningTask.phaseHistory.at(-1)?.phase ?? workflow.phaseOrder[0];
  const definition = workflow.phases[phaseId] ?? workflow.phases[workflow.phaseOrder[0]];
  const variables = new VariableResolver().resolve(planningTask, phaseId, workflow, definition);
  const artifacts = Object.entries(workflow.artifacts ?? {}).map(([name, artifact]) => ({
    name,
    kind: artifact.kind,
    path: renderPathValue(artifact.path, variables),
  }));
  const totalSpec = artifacts.find((artifact) => artifact.kind === 'total-spec' || artifact.name === 'totalSpec');
  const phasePlan = artifacts.find((artifact) => artifact.kind === 'phase-plan' || artifact.name === 'phasePlan');
  if (!totalSpec || !phasePlan) {
    throw new PlanningContextNotFoundError(
      planningTask.id,
      'workflow artifacts totalSpec/phasePlan'
    );
  }
  return { totalSpec: totalSpec.path, phasePlan: phasePlan.path };
}

function renderPathValue(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_token, name: string) => variables[name.trim()] ?? '');
}

export async function runInteractiveCreate(workspaceRoot: string): Promise<void> {
  const playspecRoot = getPlayspecRoot(workspaceRoot);
  try {
    await access(playspecRoot);
  } catch {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  const workflowInput = (await askQuestion('Workflow [mono-spec]: ')).trim();
  const workflow = workflowInput || 'mono-spec';

  const titleInput = (await askQuestion('Task title: ')).trim();
  if (!titleInput) {
    throw new Error('Task title is required.');
  }

  const resolvedWorkflow = await new WorkflowLoader(workspaceRoot).resolve(workflow);
  const variables = await collectInteractiveRequiredWorkflowVariables(
    titleInput,
    resolvedWorkflow
  );

  console.log('\nHow would you like to provide the source problem?');
  console.log('  1. paste   — type or paste content (enter "---" on its own line to finish)');
  console.log('  2. editor  — open $EDITOR');
  console.log('  3. file    — provide a file path');
  console.log('  4. skip    — create without source problem (default)');

  const choice = (await askQuestion('\nChoice [1-4]: ')).trim();

  let sourceContent: string | undefined;
  let sourceMethod = 'create';

  if (choice === '1' || choice === 'paste') {
    console.log('\nPaste content below. Enter "---" on its own line to finish:\n');
    sourceContent = await readPasteInput();
    if (!sourceContent.trim()) {
      console.log('No content provided. Creating task without source problem.');
      sourceContent = undefined;
    }
    sourceMethod = 'paste';
  } else if (choice === '2' || choice === 'editor') {
    sourceContent = await openEditorForContent();
    if (!sourceContent || !sourceContent.trim()) {
      console.log('No content from editor. Creating task without source problem.');
      sourceContent = undefined;
    }
    sourceMethod = 'editor';
  } else if (choice === '3' || choice === 'file') {
    const filePathInput = (await askQuestion('File path: ')).trim();
    if (!filePathInput) throw new Error('File path is required.');
    const resolvedPath = path.resolve(workspaceRoot, filePathInput);
    sourceContent = await readTextFile(resolvedPath);
    sourceMethod = 'create';
  }
  // choice 4 / skip / empty / default: no source

  const taskId = slugify(titleInput);
  let sourceResult: SourceResult | undefined;
  if (sourceContent && sourceContent.trim()) {
    sourceResult = {
      relativePath: path.join('.playspec', 'tasks', 'active', taskId, 'sources', 'source_problem.md'),
      content: sourceContent.endsWith('\n') ? sourceContent : `${sourceContent}\n`,
      method: sourceMethod,
    };
  }

  await createNormalTask(workspaceRoot, workflow, titleInput, sourceResult, undefined, variables);
}

async function collectInteractiveRequiredWorkflowVariables(
  title: string,
  workflow: ResolvedWorkflow
): Promise<Record<string, string>> {
  const declarations = workflow.definition.variables ?? {};
  const requiredEntries = Object.entries(declarations).filter(
    ([, declaration]) => declaration.required === true
  );
  const variables: Record<string, string> = {};

  for (const [name, declaration] of requiredEntries) {
    if (hasUsableDefault(workflow.definition, title, variables, name, declaration)) {
      continue;
    }

    variables[name] = await askRequiredVariable(name, declaration);
  }

  return variables;
}

function hasUsableDefault(
  workflow: WorkflowDefinition,
  title: string,
  variables: Record<string, string>,
  name: string,
  declaration: VariableDeclaration
): boolean {
  if (!declaration.default) {
    return false;
  }

  const task = createTaskPreview({
    id: slugify(title),
    title,
    workflow: workflow.id,
    variables,
  });
  const phaseId = workflow.phaseOrder[0];
  if (!phaseId) {
    return false;
  }
  const definition = workflow.phases[phaseId];
  if (!definition) {
    return false;
  }

  try {
    const resolved = new VariableResolver().resolve(task, phaseId, workflow, definition);
    return resolved[name] !== undefined && resolved[name] !== '';
  } catch {
    return false;
  }
}

async function askRequiredVariable(
  name: string,
  declaration: VariableDeclaration
): Promise<string> {
  const description = declaration.description ? ` (${declaration.description})` : '';
  const prompt = `Required variable ${name}${description}: `;

  while (true) {
    let answer: string;
    try {
      answer = await askQuestion(prompt);
    } catch {
      throw new Error('Interactive variable collection cancelled. No task created.');
    }
    const value = answer.trim();
    if (value) {
      return value;
    }
    console.log(`Required variable ${name} cannot be blank.`);
  }
}

async function createNormalTask(
  workspaceRoot: string,
  workflow: string,
  title: string,
  source: SourceResult | undefined,
  links?: TaskLink[],
  variables: Record<string, string> = {}
): Promise<void> {
  const taskId = slugify(title);
  const store = new YamlTaskStore(workspaceRoot);
  const taskVariables = source
    ? { ...variables, SOURCE_PROBLEM_FILE: source.relativePath }
    : variables;
  const contextRefs: TaskContextRef[] | undefined = source
    ? [{ path: source.relativePath, role: 'source-problem', source: source.method }]
    : undefined;

  await assertInitialPhaseRequiredVariables(workspaceRoot, {
    id: taskId,
    title,
    workflow,
    variables: taskVariables,
    contextRefs,
    links,
  });

  const task = await store.createTask({
    id: taskId,
    title,
    workflow,
    variables: taskVariables,
    contextRefs,
    links,
  });
  if (source) {
    await writeTextFile(path.join(workspaceRoot, source.relativePath), source.content);
  }
  await writeTextFile(getHeadPath(workspaceRoot), task.id + '\n');
  if (links && links.length > 0) {
    console.log('Created task:');
    console.log(`  ID: ${task.id}`);
    console.log(`  Title: ${title}`);
  } else {
    console.log(`Created task "${task.id}" (${title})`);
  }
  if (source) {
    console.log(`Source problem stored: ${source.relativePath}`);
  }
  const variableCount = Object.keys(variables).length;
  if (variableCount > 0) {
    console.log(`Variables set: ${variableCount}`);
  }
  if (links && links.length > 0) {
    console.log('Links:');
    for (const link of links) {
      console.log(`  ${link.type}: ${link.targetTaskId}`);
    }
  }
  console.log(`HEAD set to: ${task.id}`);
}

async function assertInitialPhaseRequiredVariables(
  workspaceRoot: string,
  input: {
    id: string;
    title: string;
    workflow: string;
    variables: Record<string, string>;
    contextRefs?: TaskContextRef[];
    links?: TaskLink[];
  }
): Promise<void> {
  const workflow = await new WorkflowLoader(workspaceRoot).resolve(input.workflow);
  const task = createTaskPreview(input);
  const { phaseId, definition } = new PhaseResolver().resolveCurrentPhase(task, workflow.definition);
  const variables = new VariableResolver().resolve(task, phaseId, workflow.definition, definition);

  assertRequiredVariables(workflow.id, phaseId, definition, workflow.definition.variables, variables);
}

function createTaskPreview(input: {
  id: string;
  title: string;
  workflow: string;
  variables: Record<string, string>;
  contextRefs?: TaskContextRef[];
  links?: TaskLink[];
}): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: input.title,
    workflow: input.workflow,
    status: 'active',
    workflowMode: 'linear',
    currentPhase: null,
    createdAt: now,
    updatedAt: now,
    paths: {
      taskRoot: path.join('.playspec', 'tasks', 'active', input.id),
      projectDocRoot: path.join('docs', 'features', input.id),
    },
    variables: {
      FEATURE_SLUG: input.id,
      ...input.variables,
    },
    phaseHistory: [],
    stateSync: {
      lastKnownGitHead: null,
      lastCompletedAt: null,
    },
    rollback: {
      lastSafePoint: null,
    },
    ...(input.contextRefs !== undefined ? { contextRefs: input.contextRefs } : {}),
    ...(input.links !== undefined ? { links: input.links } : {}),
  };
}

function parseTaskVariables(entries: string[] | undefined): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const entry of entries ?? []) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex <= 0) {
      throw new Error(`Invalid --var value "${entry}". Expected KEY=VALUE.`);
    }
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid --var key "${key}". Use letters, numbers, and underscores, starting with a letter or underscore.`);
    }
    variables[key] = value;
  }
  return variables;
}

async function resolveCreateLinks(
  workspaceRoot: string,
  newTaskId: string,
  options: CreateOptions
): Promise<TaskLink[] | undefined> {
  const requested = [
    options.parent ? { type: 'parent' as const, input: options.parent } : undefined,
    options.after ? { type: 'after' as const, input: options.after } : undefined,
  ].filter((value): value is { type: 'parent' | 'after'; input: string } => value !== undefined);

  if (requested.length === 0) {
    return undefined;
  }

  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new TaskIdResolver(store);
  const createdAt = new Date().toISOString();
  const links: TaskLink[] = [];

  for (const request of requested) {
    const resolved = await resolver.resolve(request.input);
    if (resolved.taskId === newTaskId) {
      throw new SelfTaskLinkError(newTaskId);
    }
    if (resolved.matchedBy === 'prefix') {
      console.log(`Resolved ${request.input} -> ${resolved.taskId}`);
    }
    links.push({
      type: request.type,
      targetTaskId: resolved.taskId,
      createdAt,
      createdBy: 'cli',
    });
  }

  return links;
}

async function resolveSourceProblem(
  workspaceRoot: string,
  taskId: string,
  opts: SourceOptions
): Promise<SourceResult | undefined> {
  const activeModes = [
    opts.fromFile !== undefined,
    opts.stdin === true,
    opts.edit === true,
  ].filter(Boolean);

  if (activeModes.length > 1) {
    throw new Error('Use only one source input: --from-file (or --from), --stdin, or --edit.');
  }

  let content: string | undefined;
  let method = 'create';

  if (opts.fromFile !== undefined) {
    const sourcePath = path.resolve(workspaceRoot, opts.fromFile);
    content = await readTextFile(sourcePath);
    method = 'create';
  } else if (opts.stdin) {
    content = await readStdin();
    method = 'stdin';
  } else if (opts.edit) {
    if (process.env['PLAY_SPEC_NON_INTERACTIVE']) {
      throw new Error('--edit cannot be used in non-interactive mode. Use --stdin or --from-file for scripts.');
    }
    content = await openEditorForContent();
    method = 'editor';
    if (!content || !content.trim()) return undefined;
  } else {
    return undefined;
  }

  if (content === undefined) return undefined;

  return {
    relativePath: path.join('.playspec', 'tasks', 'active', taskId, 'sources', 'source_problem.md'),
    content: content.endsWith('\n') ? content : `${content}\n`,
    method,
  };
}

async function openEditorForContent(): Promise<string | undefined> {
  const editor = process.env['EDITOR'] || process.env['VISUAL'] || 'vi';
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'playspec-edit-'));
  const tmpFile = path.join(tmpDir, 'source_problem.md');

  try {
    await writeFile(tmpFile, '# Source Problem\n\n', 'utf-8');
    try {
      await execa(editor, [tmpFile], { stdio: 'inherit' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Editor "${editor}" failed: ${msg}. Set $EDITOR to a working editor command.`);
    }
    const raw = await readFile(tmpFile, 'utf-8');
    return raw;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function readPasteInput(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines: string[] = [];

  return new Promise<string>((resolve) => {
    rl.on('line', (line) => {
      if (line === '---') {
        rl.close();
      } else {
        lines.push(line);
      }
    });
    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    let settled = false;
    rl.question(prompt, (answer) => {
      settled = true;
      rl.close();
      resolve(answer);
    });
    rl.on('close', () => {
      if (!settled) {
        settled = true;
        reject(new Error('Input closed before a response was provided.'));
      }
    });
  });
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
