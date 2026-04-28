import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, readdir, writeFile } from 'node:fs/promises';
import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTempWorkspace } from './helpers/createTempWorkspace.js';
import type { TempWorkspace } from './helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { slugify } from '#utils/slug.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../tsconfig.json');

function runCli(
  args: string[],
  cwd?: string,
  options: { env?: NodeJS.ProcessEnv; input?: string } = {}
) {
  return execa('npx', ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, ...args], {
    cwd,
    reject: false,
    env: options.env,
    input: options.input,
  });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function runCliInPty(
  args: string[],
  cwd: string,
  input: string,
  options: { env?: NodeJS.ProcessEnv } = {},
) {
  const command = [
    'npx',
    'tsx',
    '--tsconfig',
    shellQuote(TSCONFIG_PATH),
    shellQuote(CLI_PATH),
    ...args.map(shellQuote),
  ].join(' ');
  const delayedInput = `(sleep 0.3; printf %b ${shellQuote(input)})`;

  return execa('bash', ['-lc', `${delayedInput} | script -q -e /dev/null -c ${shellQuote(command)}`], {
    cwd,
    reject: false,
    env: options.env,
    timeout: 10_000,
  });
}
let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function createActiveTask(title: string, workflowType = 'multi-spec') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const taskId = slugify(title);
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title,
    workflowType,
  });

  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);
  return taskId;
}

async function createAdditionalActiveTask(title: string, workflowType = 'multi-spec') {
  const taskId = slugify(title);
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title,
    workflowType,
  });
  return taskId;
}

async function initGitRepo(): Promise<void> {
  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });
}

describe('CLI placeholder', () => {
  it('prints help output when invoked with --help', async () => {
    const result = await runCli(['--help']);
    // --help exits with 0, output goes to stdout
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/playspec/i);
  });

  it('renders the next prompt for the active task via the CLI', async () => {
    await createActiveTask('Feature Name');

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('feature_name');
    expect(result.stdout).toContain('Feature Name');
    expect(result.stdout).toContain('Phase 1');
    expect(result.stdout).toContain('Global Rules');
    expect(result.stdout).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('renders total-plan through prompt and deprecated next CLI paths', async () => {
    await createActiveTask('CLI Planning Task', 'total-plan');

    const prompt = await runCli(['prompt', '--print-only', '--quiet'], workspace.dir);
    const next = await runCli(['next', '--quiet'], workspace.dir);

    expect(prompt.exitCode).toBe(0);
    expect(prompt.stdout).toContain('TOTAL_SPEC_FILE=`docs/features/cli_planning_task/cli_planning_task_total_spec.md`');
    expect(prompt.stdout).not.toMatch(/\{\{[^}]+\}\}/);
    expect(next.exitCode).toBe(0);
    expect(next.stderr).toContain('Warning: `playspec next` is deprecated.');
    expect(next.stdout).toContain('TOTAL_SPEC_FILE=`docs/features/cli_planning_task/cli_planning_task_total_spec.md`');
    expect(next.stdout).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('marks the HEAD task in list and list-tasks output', async () => {
    await createActiveTask('Head Marker Task');

    const list = await runCli(['list'], workspace.dir);
    const listTasks = await runCli(['list-tasks'], workspace.dir);

    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain('head_marker_task [HEAD]');
    expect(listTasks.exitCode).toBe(0);
    expect(listTasks.stdout).toContain('head_marker_task [HEAD]');
  });

  it('sets HEAD with explicit use <taskId>', async () => {
    const firstTaskId = await createActiveTask('Use Explicit First Task');
    const secondTaskId = await createAdditionalActiveTask('Use Explicit Second Task');

    const result = await runCli(['use', secondTaskId], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`HEAD set to: ${secondTaskId}`);
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${secondTaskId}\n`);
    expect(firstTaskId).not.toBe(secondTaskId);
  });

  it('rejects no-arg use in non-interactive mode without changing HEAD', async () => {
    const taskId = await createActiveTask('Use Non Interactive Task');

    const result = await runCli(['use'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Missing taskId.');
    expect(result.stderr).toContain('playspec list-tasks');
    expect(result.stderr).toContain('playspec use <taskId>');
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${taskId}\n`);
  });

  it('selects an active task with no-arg use in an interactive terminal', async () => {
    const firstTaskId = await createActiveTask('Use Interactive Alpha Task');
    const secondTaskId = await createAdditionalActiveTask('Use Interactive Zulu Task');
    const store = new YamlTaskStore(workspace.dir);
    const before = await store.getTask(secondTaskId);

    const result = await runCliInPty(['use'], workspace.dir, '\x1b[B\r');
    const after = await store.getTask(secondTaskId);
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Select an active task:');
    expect(output).toContain(`${firstTaskId} [HEAD]`);
    expect(output).toContain(`[multi-spec]  Phase:`);
    expect(output).toContain('Use Interactive Zulu Task');
    expect(output).toContain(`HEAD set to: ${secondTaskId}`);
    expect(output).toContain(`Selected task: ${secondTaskId} - Use Interactive Zulu Task`);
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${secondTaskId}\n`);
    expect(after.currentPhase).toBe(before.currentPhase);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it('cancels no-arg interactive use without changing HEAD', async () => {
    const taskId = await createActiveTask('Use Cancel Task');

    const result = await runCliInPty(['use'], workspace.dir, '\x1b');
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(1);
    expect(output).toContain('Cancelled. No task selected.');
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${taskId}\n`);
  });

  it('reports no active tasks for no-arg interactive use without mutating HEAD', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await writeTextFile(getHeadPath(workspace.dir), 'stale_head\n');

    const result = await runCliInPty(['use'], workspace.dir, '');
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(1);
    expect(output).toContain('No active tasks found.');
    expect(output).toContain('playspec create <workflowType> "<title>"');
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe('stale_head\n');
  });

  it('shows effective and invalid phase displays in the interactive use selector', async () => {
    const effectiveTaskId = await createActiveTask('Use Effective Phase Task');
    const invalidTaskId = await createAdditionalActiveTask('Use Invalid Phase Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(invalidTaskId, { currentPhase: 'missing_phase' });

    const result = await runCliInPty(['use'], workspace.dir, '\x1b[B\r');
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(0);
    expect(output).toContain(`${effectiveTaskId} [HEAD]`);
    expect(output).toContain('(effective)');
    expect(output).toContain('INVALID');
    expect(output).toContain('missing_phase');
    expect(output).toContain('allowed:');
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${invalidTaskId}\n`);
  });

  it('shows context paths in current and rich context details in current-task', async () => {
    const taskId = await createActiveTask('Context Visibility Task');
    const contextPath = 'docs/context_visibility_task/notes.md';
    await writeTextFile(path.join(workspace.dir, contextPath), '# Notes\n');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, {
      contextRefs: [{ path: contextPath, role: 'planning-context', source: 'manual_task' }],
    });

    const current = await runCli(['current'], workspace.dir);
    const currentTask = await runCli(['current-task'], workspace.dir);

    expect(current.exitCode).toBe(0);
    expect(current.stdout).toContain('Context:');
    expect(current.stdout).toContain(`- ${contextPath}`);
    expect(currentTask.exitCode).toBe(0);
    expect(currentTask.stdout).toContain('Docs root:');
    expect(currentTask.stdout).toContain('Context refs detail:');
    expect(currentTask.stdout).toContain(`${contextPath} (planning-context, source: manual_task)`);
  });

  it('renders a manually linked context file in next prompt variables', async () => {
    const taskId = await createActiveTask('Manual Context Prompt Task', 'mono-spec');
    const contextPath = 'cross_project_cli_import_alias_bug.md';
    await writeTextFile(path.join(workspace.dir, contextPath), '# Bug\n');

    const addContext = await runCli(['add-context', contextPath, '--task', taskId], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });
    const currentTask = await runCli(['current-task'], workspace.dir);
    const next = await runCli(['next'], workspace.dir);

    expect(addContext.exitCode).toBe(0);
    expect(currentTask.stdout).toContain(`${contextPath} (planning-context, source: manual)`);
    expect(next.exitCode).toBe(0);
    expect(next.stdout).toContain(`SOURCE_PROBLEM_FILE=\`${contextPath}\``);
    expect(next.stdout).toContain(`- \`${contextPath}\``);
    expect(next.stdout).toContain(`- \`${contextPath}\` (role: planning-context, source: manual)`);
  });

  it('lists relevant existing files for HEAD with specs --path-only', async () => {
    const taskId = await createActiveTask('Specs Path Only Task', 'mono-spec');
    const specPath = `docs/features/${taskId}/spec.md`;
    await writeTextFile(path.join(workspace.dir, specPath), '# Spec\n');

    const result = await runCli(['specs', '--path-only'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.split('\n')).toContain(specPath);
    expect(result.stdout).not.toContain(`docs/features/${taskId}/plan.md`);
  });

  it('resolves specs --task without changing HEAD', async () => {
    const firstTaskId = await createActiveTask('Specs Head Task', 'mono-spec');
    const secondTaskId = await createAdditionalActiveTask('Specs Explicit Task', 'mono-spec');
    const secondSpec = `docs/features/${secondTaskId}/spec.md`;
    await writeTextFile(path.join(workspace.dir, `docs/features/${firstTaskId}/spec.md`), '# First\n');
    await writeTextFile(path.join(workspace.dir, secondSpec), '# Second\n');

    const result = await runCli(['specs', '--task', secondTaskId, '--path-only'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.split('\n')).toContain(secondSpec);
    expect(result.stdout).not.toContain(`docs/features/${firstTaskId}/spec.md`);
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${firstTaskId}\n`);
  });

  it('reports missing specs paths on stderr while keeping --path-only stdout script-safe', async () => {
    const taskId = await createActiveTask('Specs Missing Task', 'mono-spec');
    const specPath = `docs/features/${taskId}/spec.md`;
    const planPath = `docs/features/${taskId}/plan.md`;
    await writeTextFile(path.join(workspace.dir, specPath), '# Spec\n');

    const result = await runCli(['specs', '--path-only', '--show-missing'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.split('\n')).toContain(specPath);
    expect(result.stdout).not.toContain(planPath);
    expect(result.stderr).toContain('Missing expected files:');
    expect(result.stderr).toContain(planPath);
  });

  it('rejects plain non-interactive specs with an output-mode hint', async () => {
    const taskId = await createActiveTask('Specs Non Interactive Task', 'mono-spec');
    await writeTextFile(path.join(workspace.dir, `docs/features/${taskId}/spec.md`), '# Spec\n');

    const result = await runCli(['specs'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Non-interactive specs requires an output mode.');
    expect(result.stderr).toContain('playspec specs --path-only');
    expect(result.stderr).toContain('playspec specs --print');
  });

  it('prints all existing UTF-8 relevant files with deterministic separators', async () => {
    const taskId = await createActiveTask('Specs Print Task', 'mono-spec');
    const specPath = `docs/features/${taskId}/spec.md`;
    const planPath = `docs/features/${taskId}/plan.md`;
    await writeTextFile(path.join(workspace.dir, specPath), '# Spec\n');
    await writeTextFile(path.join(workspace.dir, planPath), '# Plan\n');

    const result = await runCli(['specs', '--print'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`===== ${planPath} =====`);
    expect(result.stdout).toContain('# Plan');
    expect(result.stdout).toContain(`===== ${specPath} =====`);
    expect(result.stdout).toContain('# Spec');
  });

  it('skips binary and large files for non-interactive specs --print but keeps paths visible', async () => {
    const taskId = await createActiveTask('Specs Binary Large Task', 'mono-spec');
    const specPath = `docs/features/${taskId}/spec.md`;
    const binaryPath = `docs/features/${taskId}/binary.md`;
    const largePath = `docs/features/${taskId}/large.md`;
    await writeTextFile(path.join(workspace.dir, specPath), '# Spec\n');
    await writeFile(path.join(workspace.dir, binaryPath), Buffer.from([0, 1, 2, 3]));
    await writeTextFile(path.join(workspace.dir, largePath), `${'x'.repeat(1024 * 1024 + 1)}\n`);

    const pathOnly = await runCli(['specs', '--path-only'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });
    const printed = await runCli(['specs', '--print'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(pathOnly.exitCode).toBe(0);
    expect(pathOnly.stdout.split('\n')).toContain(binaryPath);
    expect(pathOnly.stdout.split('\n')).toContain(largePath);
    expect(printed.exitCode).toBe(0);
    expect(printed.stdout).toContain(`===== ${specPath} =====`);
    expect(printed.stdout).not.toContain(`===== ${binaryPath} =====`);
    expect(printed.stdout).not.toContain(`===== ${largePath} =====`);
    expect(printed.stderr).toContain('binary or non-UTF-8 content');
    expect(printed.stderr).toContain('larger than 1 MiB');
  });

  it('selects a relevant file interactively with specs --no-copy without mutating task state', async () => {
    const taskId = await createActiveTask('Specs Interactive Task', 'mono-spec');
    const specPath = `docs/features/${taskId}/spec.md`;
    await writeTextFile(path.join(workspace.dir, specPath), '# Spec\n');
    const taskYamlPath = path.join(workspace.dir, '.playspec/tasks/active', taskId, 'task.yaml');
    const beforeTaskYaml = await readTextFile(taskYamlPath);
    const beforeHead = await readTextFile(getHeadPath(workspace.dir));

    const result = await runCliInPty(['specs', '--no-copy'], workspace.dir, '\r');
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Select a relevant file:');
    expect(output).toContain(`Selected file: ${specPath}`);
    expect(await readTextFile(taskYamlPath)).toBe(beforeTaskYaml);
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(beforeHead);
  });

  it('rejects non-interactive add-context without --task before mutation', async () => {
    const taskId = await createActiveTask('Add Context Non Interactive Task');
    const contextPath = 'docs/add_context_non_interactive_task/notes.md';
    await writeTextFile(path.join(workspace.dir, contextPath), '# Notes\n');

    const result = await runCli(['add-context', contextPath], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });
    const task = await new YamlTaskStore(workspace.dir).getTask(taskId);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('requires --task <id>');
    expect(task.contextRefs ?? []).toHaveLength(0);
  });

  it('keeps explicit add-context --task script-safe without confirmation', async () => {
    const taskId = await createActiveTask('Add Context Explicit Task');
    const contextPath = 'docs/add_context_explicit_task/notes.md';
    await writeTextFile(path.join(workspace.dir, contextPath), '# Notes\n');

    const result = await runCli(['add-context', contextPath, '--task', taskId], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });
    const task = await new YamlTaskStore(workspace.dir).getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Context linked.');
    expect(task.contextRefs).toContainEqual({
      path: contextPath,
      role: 'planning-context',
      source: 'manual',
    });
  });

  it('creates a mono-spec task from a source file and stores an internal markdown source', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await writeTextFile(path.join(workspace.dir, 'problem.md'), '# Problem\n\nMigration bug details.\n');

    const result = await runCli(
      ['create', 'mono-spec', 'Migration Bug Fix', '--from-file', 'problem.md'],
      workspace.dir
    );
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask('migration_bug_fix');
    const sourcePath = path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      'migration_bug_fix',
      'sources',
      'source_problem.md'
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Source problem stored: .playspec/tasks/active/migration_bug_fix/sources/source_problem.md');
    expect(task.variables.SOURCE_PROBLEM_FILE).toBe('.playspec/tasks/active/migration_bug_fix/sources/source_problem.md');
    expect(task.contextRefs).toContainEqual({
      path: '.playspec/tasks/active/migration_bug_fix/sources/source_problem.md',
      role: 'source-problem',
      source: 'create',
    });
    await expect(access(sourcePath)).resolves.not.toThrow();
    expect(await readTextFile(sourcePath)).toContain('Migration bug details.');
  });

  it('creates a mono-spec task from stdin source text', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const result = await execa(
      'npx',
      ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, 'create', 'mono-spec', 'Pasted Source Task', '--stdin'],
      { cwd: workspace.dir, reject: false, input: 'Pasted problem text\n' }
    );
    const sourcePath = path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      'pasted_source_task',
      'sources',
      'source_problem.md'
    );

    expect(result.exitCode).toBe(0);
    expect(await readTextFile(sourcePath)).toBe('Pasted problem text\n');
    const task = await new YamlTaskStore(workspace.dir).getTask('pasted_source_task');
    expect(task.contextRefs).toContainEqual({
      path: '.playspec/tasks/active/pasted_source_task/sources/source_problem.md',
      role: 'source-problem',
      source: 'stdin',
    });

    const next = await runCli(['next'], workspace.dir);
    expect(next.exitCode).toBe(0);
    expect(next.stdout).toContain(
      'SOURCE_PROBLEM_FILE=`.playspec/tasks/active/pasted_source_task/sources/source_problem.md`'
    );
  });

  it('renders an explicit phase prompt via the CLI', async () => {
    await createActiveTask('Feature Name');

    const result = await runCli(['phase', '3'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('feature_name');
    expect(result.stdout).toContain('Feature Name');
    expect(result.stdout).toContain('Phase 3');
    expect(result.stdout).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('reports the missing template path via the CLI when rendering fails', async () => {
    await createActiveTask('Broken Template Task');
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec.yaml'),
      `id: multi-spec
mode: linear
phaseOrder:
  - "1"
phases:
  "1":
    title: "Phase 1"
    template: missing/phase_template.md
`
    );

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Template file not found');
    expect(result.stderr).toContain(
      path.join(
        workspace.dir,
        '.playspec',
        'templates',
        'missing',
        'phase_template.md'
      )
    );
    expect(result.stderr).toContain('Re-run `playspec init` if needed.');
  });

  it('completes the current phase and writes review artifacts via the CLI', async () => {
    const taskId = await createActiveTask('CLI Complete Task');
    await initGitRepo();

    const result = await runCli(['complete', '--with-review'], workspace.dir);
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Completed phase 1');
    expect(task.currentPhase).toBe('2');
    expect(task.phaseHistory).toContainEqual(
      expect.objectContaining({
        phase: '1',
        status: 'completed',
        reviewFile: 'reviews/phase1_review.yaml',
      })
    );
    await expect(
      access(
        path.join(
          workspace.dir,
          '.playspec',
          'tasks',
          'active',
          taskId,
          'reviews',
          'phase1_review.yaml'
        )
      )
    ).resolves.not.toThrow();
  });

  it('marks the task completed on the final workflow phase via the CLI', async () => {
    const taskId = await createActiveTask('CLI Final Phase Task');
    await initGitRepo();
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '5' });

    const result = await runCli(['complete'], workspace.dir);
    const task = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Completed phase 5');
    expect(result.stdout).toContain('Task status: completed');
    expect(result.stdout).not.toContain('Review file:');
    expect(task.status).toBe('completed');
    expect(task.currentPhase).toBeNull();
    expect(task.phaseHistory).toContainEqual(
      expect.objectContaining({
        phase: '5',
        status: 'completed',
      })
    );
    await expect(
      access(
        path.join(
          workspace.dir,
          '.playspec',
          'tasks',
          'active',
          taskId,
          'reviews',
          'phase5_review.yaml'
        )
      )
    ).rejects.toThrow();
  });

  it('creates evidence and snapshot artifacts via the CLI without phase mutation', async () => {
    const taskId = await createActiveTask('CLI Artifact Task');
    await initGitRepo();
    const store = new YamlTaskStore(workspace.dir);

    const evidenceResult = await runCli(['evidence'], workspace.dir);
    const snapshotResult = await runCli(['snapshot'], workspace.dir);
    const task = await store.getTask(taskId);

    expect(evidenceResult.exitCode).toBe(0);
    expect(snapshotResult.exitCode).toBe(0);
    expect(evidenceResult.stdout).toContain('Collected evidence for phase 1');
    expect(snapshotResult.stdout).toContain('Created snapshot for phase 1');
    expect(task.currentPhase).toBeNull();
    expect(task.phaseHistory).toEqual([]);
    const evidenceFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'evidence')
    );
    const snapshotFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'snapshots')
    );

    expect(evidenceFiles.some((file) => file.startsWith('phase1'))).toBe(true);
    expect(snapshotFiles.some((file) => file.startsWith('phase1'))).toBe(true);
  });

  it('reports desync details via the CLI', async () => {
    const taskId = await createActiveTask('CLI Desync Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');

    const result = await runCli(['desync-check'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Task: ${taskId}`);
    expect(result.stdout).toContain('Severity: medium');
    expect(result.stdout).toContain('src/app.ts');
  });

  it('reports untracked files through desync-check', async () => {
    await createActiveTask('CLI Untracked Desync Task');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'untracked.ts'), 'export const value = 1;\n');

    const result = await runCli(['desync-check'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Severity: medium');
    expect(result.stdout).toContain('Untracked files: src/untracked.ts');
  });

  it('prints a high desync warning before next prompt output', async () => {
    await createActiveTask('CLI Next Desync Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');
    await execa('git', ['add', 'src/app.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'source change'], { cwd: workspace.dir });

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('High desync warning');
    expect(result.stdout.indexOf('High desync warning')).toBeLessThan(
      result.stdout.indexOf('Phase 2')
    );
  });

  it('restores task state with rollback --state-only and leaves source files untouched', async () => {
    const taskId = await createActiveTask('CLI Rollback Task');
    const sourcePath = path.join(workspace.dir, 'src', 'app.ts');
    await writeTextFile(sourcePath, 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await runCli(['snapshot'], workspace.dir);

    const result = await runCli(['rollback', '--state-only'], workspace.dir);
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask(taskId);
    const activeSnapshots = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'snapshots')
    );
    const quarantineRoot = path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      taskId,
      'rollback'
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('State-only rollback restored task.yaml');
    expect(task.currentPhase).toBeNull();
    expect(task.phaseHistory).toEqual([]);
    expect(task.stateSync?.lastKnownGitHead).toEqual(task.rollback?.lastSafePoint?.gitHead);
    expect(task.stateSync?.lastCompletedAt).toEqual(task.rollback?.lastSafePoint?.createdAt);
    await expect(access(sourcePath)).resolves.not.toThrow();
    expect(activeSnapshots).not.toContain('phase2_manual_task.yaml');
    await expect(
      access(path.join(quarantineRoot, task.rollback?.lastSafePoint?.id ?? '', 'snapshots', 'phase2_manual_task.yaml'))
    ).resolves.not.toThrow();
  });

  it('blocks confirmed git rollback when tracked source files are dirty', async () => {
    await createActiveTask('CLI Dirty Rollback Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');

    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Git rollback is blocked');
    expect(result.stderr).toContain('state-only');
  });

  it('prints rollback preview output by default and with --git-only', async () => {
    await createActiveTask('CLI Rollback Preview Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);

    const defaultPreview = await runCli(['rollback'], workspace.dir);
    const gitOnlyPreview = await runCli(['rollback', '--git-only'], workspace.dir);

    for (const result of [defaultPreview, gitOnlyPreview]) {
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Safe point:');
      expect(result.stdout).toContain('Git rollback eligible: yes');
      expect(result.stdout).toContain('Confirm command: playspec rollback --git-only --confirm');
    }
  });

  it('blocks confirmed git rollback when new commits exist after the safe point', async () => {
    await createActiveTask('CLI New Commit Rollback Task');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'new-commit.ts'), 'export const value = 1;\n');
    await execa('git', ['add', 'src/new-commit.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'new commit after safe point'], { cwd: workspace.dir });

    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Git rollback is blocked');
    expect(result.stderr).toContain('New commits exist after the rollback safe point.');
  });

  it('blocks confirmed git rollback when untracked files conflict with rollback targets', async () => {
    await createActiveTask('CLI Untracked Rollback Task');
    const sourcePath = path.join(workspace.dir, 'src', 'app.ts');
    await writeTextFile(sourcePath, 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await execa('git', ['rm', 'src/app.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'delete tracked file after safe point'], { cwd: workspace.dir });
    await writeTextFile(sourcePath, 'export const value = 2;\n');

    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Git rollback is blocked');
    expect(result.stderr).toContain('Untracked files conflict with rollback target files and will not be deleted.');
  });

  it('executes confirmed git rollback when safety gates pass', async () => {
    await createActiveTask('CLI Clean Git Rollback Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);

    const preview = await runCli(['rollback', '--git-only'], workspace.dir);
    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(preview.exitCode).toBe(0);
    expect(preview.stdout).toContain('Confirm command: playspec rollback --git-only --confirm');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Git rollback executed from the last safe point');
  });

  // Phase 3.5: Context Header and Task Visibility

  it('prints compact Context Header before prompt output on next', async () => {
    await createActiveTask('Feature Name');

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    const taskLineIndex = result.stdout.indexOf('Task: Feature Name');
    const phaseLineIndex = result.stdout.indexOf('Phase:');
    const promptBodyIndex = result.stdout.indexOf('Global Rules');
    expect(taskLineIndex).toBeGreaterThanOrEqual(0);
    expect(phaseLineIndex).toBeGreaterThan(taskLineIndex);
    expect(taskLineIndex).toBeLessThan(promptBodyIndex);
  });

  it('suppresses Context Header with --quiet on next', async () => {
    await createActiveTask('Feature Name');

    const result = await runCli(['next', '--quiet'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Task: Feature Name');
    expect(result.stdout).not.toMatch(/^Phase:/m);
    expect(result.stdout).toContain('Global Rules');
  });

  it('writes next --out without printing the full prompt', async () => {
    await createActiveTask('Next Out Task');
    const outputPath = 'tmp/prompt.md';

    const result = await runCli(['next', '--out', outputPath], workspace.dir);
    const written = await readTextFile(path.join(workspace.dir, outputPath));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Resolved phase:');
    expect(result.stdout).toContain('Prompt written: tmp/prompt.md');
    expect(result.stdout).not.toContain('Global Rules');
    expect(written).toContain('Global Rules');
  });

  it('writes copy fallback file and does not dump prompt when clipboard fails', async () => {
    const taskId = await createActiveTask('Next Copy Fallback Task');

    const result = await runCli(['next', '--copy'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });
    const promptFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'prompts')
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Resolved phase:');
    expect(result.stdout).toContain('Clipboard unavailable. Prompt written to: .playspec/tasks/active/next_copy_fallback_task/prompts/next-prompt-');
    expect(result.stdout).not.toContain('Global Rules');
    expect(promptFiles.some((file) => file.startsWith('next-prompt-'))).toBe(true);
  });

  it('writes next --copy --out even when clipboard fails without extra fallback', async () => {
    const taskId = await createActiveTask('Next Copy Out Task');
    const outputPath = 'tmp/copy-out.md';

    const result = await runCli(['next', '--copy', '--out', outputPath], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });
    const written = await readTextFile(path.join(workspace.dir, outputPath));
    const promptFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'prompts')
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Clipboard unavailable. Prompt written to: tmp/copy-out.md');
    expect(result.stdout).not.toContain('Global Rules');
    expect(written).toContain('Global Rules');
    expect(promptFiles.some((file) => file.startsWith('next-prompt-'))).toBe(false);
  });

  it('prints mono-spec step metadata and gate routes on next for gated steps', async () => {
    const taskId = await createActiveTask('Mono Gate Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Current step: 2. 기술 교차 검증');
    expect(result.stdout).toContain('id: tech_spec_validate');
    expect(result.stdout).toContain('Gate:');
    expect(result.stdout).toContain('- approved -> 4. 구현 계획서 생성');
    expect(result.stdout).toContain('- needs_revision -> 3. 기술 명세서 업데이트');
  });

  it('prints mono-spec next route on next for explicit-next steps', async () => {
    const taskId = await createActiveTask('Mono Next Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'tech_spec_patch' });

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Current step: 3. 기술 명세서 업데이트');
    expect(result.stdout).toContain('id: tech_spec_patch');
    expect(result.stdout).toContain('Next:');
    expect(result.stdout).toContain('- 2. 기술 교차 검증');
    expect(result.stdout).not.toContain('Gate:');
  });

  it('prints mono-spec step metadata and gate routes on current-task', async () => {
    const taskId = await createActiveTask('Mono Current Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

    const result = await runCli(['current-task'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Step:        2. 기술 교차 검증');
    expect(result.stdout).toContain('Step ID:      tech_spec_validate');
    expect(result.stdout).toContain('Gate:');
    expect(result.stdout).toContain('- approved -> 4. 구현 계획서 생성');
    expect(result.stdout).toContain('- needs_revision -> 3. 기술 명세서 업데이트');
  });

  it('prints mono-spec next route on current-task for explicit-next steps', async () => {
    const taskId = await createActiveTask('Mono Current Next Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'tech_spec_patch' });

    const result = await runCli(['current-task'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Step:        3. 기술 명세서 업데이트');
    expect(result.stdout).toContain('Step ID:      tech_spec_patch');
    expect(result.stdout).toContain('Next:');
    expect(result.stdout).toContain('- 2. 기술 교차 검증');
    expect(result.stdout).not.toContain('Gate:');
  });

  it('prints compact Context Header before completion output on complete', async () => {
    await createActiveTask('CLI Header Complete Task');
    await initGitRepo();

    const result = await runCli(['complete'], workspace.dir);

    expect(result.exitCode).toBe(0);
    const taskLineIndex = result.stdout.indexOf('Task: CLI Header Complete Task');
    const completedLineIndex = result.stdout.indexOf('Completed phase');
    expect(taskLineIndex).toBeGreaterThanOrEqual(0);
    expect(taskLineIndex).toBeLessThan(completedLineIndex);
  });

  it('completes mono-spec gated step with result and prints routed step label', async () => {
    const taskId = await createActiveTask('Mono Complete Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });
    await initGitRepo();

    const result = await runCli(['complete', '--result', 'approved'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Completed phase 2. 기술 교차 검증');
    expect(result.stdout).toContain('Next phase: 4. 구현 계획서 생성');
    const task = await store.getTask(taskId);
    expect(task.currentPhase).toBe('implementation_plan_create');
  });

  describe('mono-spec workflow transitions', () => {
    async function createMonoTask(title: string) {
      const taskId = await createActiveTask(title, 'mono-spec');
      await initGitRepo();
      return { taskId, store: new YamlTaskStore(workspace.dir) };
    }

    it('step 1 complete routes to step 2 (tech_spec_draft -> tech_spec_validate)', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step1');
      // currentPhase is null → resolves to tech_spec_draft (step 1)

      const result = await runCli(['complete'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Completed phase 1. 기술 명세서 업데이트');
      expect(result.stdout).toContain('Next phase: 2. 기술 교차 검증');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('tech_spec_validate');
    });

    it('step 2 complete --result approved routes to step 4, skipping step 3', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step2 Approved');
      await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

      const result = await runCli(['complete', '--result', 'approved'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Next phase: 4. 구현 계획서 생성');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation_plan_create');
    });

    it('step 2 complete --result needs_revision routes to step 3', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step2 Revision');
      await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

      const result = await runCli(['complete', '--result', 'needs_revision'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Next phase: 3. 기술 명세서 업데이트');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('tech_spec_patch');
    });

    it('step 2 plain complete fails in non-interactive mode', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step2 NoResult');
      await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

      const result = await runCli(['complete'], workspace.dir, { env: { ...process.env, PLAY_SPEC_NON_INTERACTIVE: '1' } });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/requires a result|missing.*result/i);
    });

    it('step 3 complete routes back to step 2 (tech_spec_patch -> tech_spec_validate)', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step3');
      await store.updateTask(taskId, { currentPhase: 'tech_spec_patch' });

      const result = await runCli(['complete'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Completed phase 3. 기술 명세서 업데이트');
      expect(result.stdout).toContain('Next phase: 2. 기술 교차 검증');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('tech_spec_validate');
    });

    it('step 4 complete routes to step 5 (implementation_plan_create -> implementation_plan_validate)', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step4');
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_create' });

      const result = await runCli(['complete'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Next phase: 5. 구현 계획서 교차 검증');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation_plan_validate');
    });

    it('step 5 complete --result approved routes to step 7, skipping step 6', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step5 Approved');
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_validate' });

      const result = await runCli(['complete', '--result', 'approved'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Next phase: 7. 기술 구현');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation');
    });

    it('step 5 complete --result needs_revision routes to step 6', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step5 Revision');
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_validate' });

      const result = await runCli(['complete', '--result', 'needs_revision'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Next phase: 6. 구현 계획서 업데이트');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation_plan_patch');
    });

    it('step 5 plain complete fails in non-interactive mode', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step5 NoResult');
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_validate' });

      const result = await runCli(['complete'], workspace.dir, { env: { ...process.env, PLAY_SPEC_NON_INTERACTIVE: '1' } });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/requires a result|missing.*result/i);
    });

    it('step 6 complete routes back to step 5 (implementation_plan_patch -> implementation_plan_validate)', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step6');
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_patch' });

      const result = await runCli(['complete'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Completed phase 6. 구현 계획서 업데이트');
      expect(result.stdout).toContain('Next phase: 5. 구현 계획서 교차 검증');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation_plan_validate');
    });

    it('step 7 routes to step 8, step 8 to step 9, step 9 to step 10', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Linear');

      for (const [from, toPhase, toLabel] of [
        ['implementation', 'focused_tests', '8. 테스트'],
        ['focused_tests', 'safe_refactor', '9. 리팩토링'],
        ['safe_refactor', 'pr_prepare', '10. PR 준비'],
      ] as [string, string, string][]) {
        await store.updateTask(taskId, { currentPhase: from });
        const result = await runCli(['complete'], workspace.dir);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(`Next phase: ${toLabel}`);
        const task = await store.getTask(taskId);
        expect(task.currentPhase).toBe(toPhase);
      }
    });

    it('step 10 complete marks workflow done', async () => {
      const { taskId, store } = await createMonoTask('Mono Trans Step10');
      await store.updateTask(taskId, { currentPhase: 'pr_prepare' });

      const result = await runCli(['complete'], workspace.dir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Task status: completed');
      const task = await store.getTask(taskId);
      expect(task.status).toBe('completed');
    });

    it('step numbers are 1 through 10 with no hidden gate phase', async () => {
      const { store } = await createMonoTask('Mono Step Numbers');
      const { PresetManager } = await import('#preset/preset-manager.js');
      const manager = new PresetManager();
      await manager.initWorkspace(workspace.dir, 'default');
      const { WorkflowLoader } = await import('#workflow/workflow-loader.js');
      const loader = new WorkflowLoader(workspace.dir);
      const workflow = await loader.load('mono-spec');

      const stepNumbers = Object.values(workflow.phases)
        .map((p) => p.stepNumber)
        .filter(Boolean)
        .sort();
      expect(stepNumbers).toEqual(['1', '10', '2', '3', '4', '5', '6', '7', '8', '9']);
      expect(workflow.phaseOrder).toHaveLength(10);
    });
  });

  it('suppresses Context Header with --quiet on complete', async () => {
    await createActiveTask('CLI Quiet Complete Task');
    await initGitRepo();

    const result = await runCli(['complete', '--quiet'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Task: CLI Quiet Complete Task');
    expect(result.stdout).not.toMatch(/^Phase:/m);
    expect(result.stdout).toContain('Completed phase');
  });

  it('status command exists and shows compact header plus fuller task detail', async () => {
    await createActiveTask('CLI Status Task');

    const result = await runCli(['status'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Task: CLI Status Task');
    expect(result.stdout).toMatch(/^Phase:/m);
    expect(result.stdout).toContain('ID:');
    expect(result.stdout).toContain('Workflow:');
    expect(result.stdout).toContain('Status:');
  });

  it('status --quiet suppresses header but keeps task detail', async () => {
    await createActiveTask('CLI Status Quiet Task');

    const result = await runCli(['status', '--quiet'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Task: CLI Status Quiet Task');
    expect(result.stdout).not.toMatch(/^Phase:/m);
    expect(result.stdout).toContain('ID:');
    expect(result.stdout).toContain('Workflow:');
  });

  it('--quiet does not suppress high desync warning on next', async () => {
    await createActiveTask('CLI Quiet Desync Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');
    await execa('git', ['add', 'src/app.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'source change'], { cwd: workspace.dir });

    const result = await runCli(['next', '--quiet'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('High desync warning');
    expect(result.stdout).not.toContain('Task: CLI Quiet Desync Task');
  });

  it('status omits Target and Context lines when not present in task state', async () => {
    await createActiveTask('CLI Status No Extras Task');

    const result = await runCli(['status'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Target:');
    expect(result.stdout).not.toContain('Context:');
  });

  // create UX improvements

  it('creates a mono-spec task using --from <file> as a source problem file alias', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await writeTextFile(path.join(workspace.dir, 'bug.md'), '# Bug\n\nReproduction details.\n');

    const result = await runCli(
      ['create', 'mono-spec', 'From Alias Task', '--from', 'bug.md'],
      workspace.dir
    );
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask('from_alias_task');
    const sourcePath = path.join(
      workspace.dir,
      '.playspec', 'tasks', 'active', 'from_alias_task', 'sources', 'source_problem.md'
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Source problem stored: .playspec/tasks/active/from_alias_task/sources/source_problem.md');
    expect(task.variables['SOURCE_PROBLEM_FILE']).toBe('.playspec/tasks/active/from_alias_task/sources/source_problem.md');
    expect(task.contextRefs).toContainEqual({
      path: '.playspec/tasks/active/from_alias_task/sources/source_problem.md',
      role: 'source-problem',
      source: 'create',
    });
    await expect(access(sourcePath)).resolves.not.toThrow();
    expect(await readTextFile(sourcePath)).toContain('Reproduction details.');
  });

  it('rejects --from and --from-file used together', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await writeTextFile(path.join(workspace.dir, 'bug.md'), '# Bug\n');
    await writeTextFile(path.join(workspace.dir, 'bug2.md'), '# Bug2\n');

    const result = await runCli(
      ['create', 'mono-spec', 'Double Source Task', '--from', 'bug.md', '--from-file', 'bug2.md'],
      workspace.dir
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--from and --from-file both specify source files');
  });

  it('creates a mono-spec task using --edit with a fake editor', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const fakeEditorPath = path.join(workspace.dir, 'fake-editor.sh');
    await writeTextFile(fakeEditorPath, '#!/bin/sh\nprintf "Problem from editor" > "$1"\n');
    await execa('chmod', ['+x', fakeEditorPath]);

    const result = await runCli(
      ['create', 'mono-spec', 'Editor Source Task', '--edit'],
      workspace.dir,
      { env: { ...process.env, EDITOR: fakeEditorPath } }
    );
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask('editor_source_task');
    const sourcePath = path.join(
      workspace.dir,
      '.playspec', 'tasks', 'active', 'editor_source_task', 'sources', 'source_problem.md'
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Source problem stored: .playspec/tasks/active/editor_source_task/sources/source_problem.md');
    expect(await readTextFile(sourcePath)).toContain('Problem from editor');
    expect(task.contextRefs).toContainEqual({
      path: '.playspec/tasks/active/editor_source_task/sources/source_problem.md',
      role: 'source-problem',
      source: 'editor',
    });
  });

  it('rejects --edit in non-interactive mode (PLAY_SPEC_NON_INTERACTIVE=1)', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const result = await runCli(
      ['create', 'mono-spec', 'Edit Non Interactive Task', '--edit'],
      workspace.dir,
      { env: { ...process.env, PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('non-interactive mode');
  });

  it('rejects the interactive wizard in non-interactive mode', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const result = await runCli(['create'], workspace.dir, {
      env: { ...process.env, PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Interactive wizard requires a terminal');
  });

  it('rejects partial args (only workflowType, no title)', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const result = await runCli(['create', 'mono-spec'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Both workflow type and title are required');
  });

  it('creates a task via interactive wizard with piped skip input', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    // Simulate wizard: accept default workflow, provide title, choose skip
    const result = await execa(
      'npx',
      ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, 'create'],
      {
        cwd: workspace.dir,
        reject: false,
        // empty for workflow (default mono-spec), title, choice 4 (skip)
        input: '\nWizard Skip Task\n4\n',
        env: { ...process.env, PLAY_SPEC_NON_INTERACTIVE: undefined },
      }
    );
    const store = new YamlTaskStore(workspace.dir);

    // Wizard output goes to stdout which is piped (not a TTY), so PLAY_SPEC_NON_INTERACTIVE
    // is the standard way to gate. In piped mode stdout.isTTY is falsy, so the
    // wizard guard fires. We verify the guard is triggered here.
    // If the process is a TTY (CI with pseudo-TTY), the wizard would run.
    // In most CI / test environments, stdout is piped so the guard triggers.
    if (result.exitCode !== 0) {
      // Non-TTY environment: guard triggered, which is expected
      expect(result.stderr).toContain('Interactive wizard requires a terminal');
    } else {
      // TTY environment: wizard ran and created the task
      const task = await store.getTask('wizard_skip_task');
      expect(task.title).toBe('Wizard Skip Task');
      expect(task.contextRefs ?? []).toHaveLength(0);
    }
  });

  it('rejects HEAD-based phase rendering for completed tasks via the CLI', async () => {
    const taskId = await createActiveTask('Completed Phase Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, {
      status: 'completed',
      currentPhase: null,
    });

    const result = await runCli(['phase', '1'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`Task "${taskId}" is not active`);
  });

  // ui_ux_update_260427

  it('prompt copies by default (clipboard unavailable → fallback written, no body printed)', async () => {
    const taskId = await createActiveTask('Prompt Copy Default Task');

    const result = await runCli(['prompt'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });
    const promptFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'prompts')
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Resolved phase:');
    expect(result.stdout).toContain('Clipboard unavailable. Prompt written to:');
    expect(result.stdout).not.toContain('Global Rules');
    expect(promptFiles.some((f) => f.startsWith('next-prompt-'))).toBe(true);
  });

  it('prompt --no-copy prints prompt body without clipboard', async () => {
    await createActiveTask('Prompt No Copy Task');

    const result = await runCli(['prompt', '--no-copy'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Resolved phase:');
    expect(result.stdout).toContain('Global Rules');
    expect(result.stdout).not.toContain('Clipboard');
  });

  it('prompt --print-only prints only raw prompt body with no metadata', async () => {
    await createActiveTask('Prompt Print Only Task');

    const result = await runCli(['prompt', '--print-only'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Global Rules');
    expect(result.stdout).not.toContain('Resolved phase:');
    expect(result.stdout).not.toContain('Clipboard');
  });

  it('prompt --out writes to file (clipboard fails → fallback uses outFile path)', async () => {
    await createActiveTask('Prompt Out Task');
    const outputPath = 'tmp/prompt-out.md';

    const result = await runCli(['prompt', '--out', outputPath], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });
    const written = await readTextFile(path.join(workspace.dir, outputPath));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Resolved phase:');
    expect(written).toContain('Global Rules');
    expect(result.stdout).not.toContain('Global Rules');
  });

  it('next shows deprecation warning on stderr', async () => {
    await createActiveTask('Next Deprecation Task');

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('`playspec next` is deprecated');
    expect(result.stderr).toContain('`playspec prompt`');
  });

  it('current shows deprecation warning on stderr', async () => {
    await createActiveTask('Current Deprecation Task');

    const result = await runCli(['current'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('`playspec current` is deprecated');
    expect(result.stderr).toContain('`playspec current-task`');
  });

  it('list shows deprecation warning on stderr', async () => {
    await createActiveTask('List Deprecation Task');

    const result = await runCli(['list'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('`playspec list` is deprecated');
    expect(result.stderr).toContain('`playspec list-tasks`');
  });

  it('complete renders next prompt after phase completion', async () => {
    const taskId = await createActiveTask('Complete Renders Next Task');
    await initGitRepo();

    const result = await runCli(['complete'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Completed phase');
    expect(result.stdout).toContain('Next phase:');
    expect(result.stdout).toContain('Resolved phase:');
    expect(result.stdout).toContain('Clipboard unavailable. Prompt written to:');
    expect(task.currentPhase).toBe('2');
  });

  it('complete --no-copy renders next prompt body after completion without clipboard', async () => {
    const taskId = await createActiveTask('Complete No Copy Task');
    await initGitRepo();

    const result = await runCli(['complete', '--no-copy'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Completed phase');
    expect(result.stdout).toContain('Resolved phase:');
    expect(result.stdout).toContain('Global Rules');
    expect(result.stdout).not.toContain('Clipboard');
  });

  it('prompt does not mutate task.yaml (read-only check)', async () => {
    const taskId = await createActiveTask('Prompt ReadOnly Task');
    const store = new YamlTaskStore(workspace.dir);
    const before = await store.getTask(taskId);

    await runCli(['prompt', '--no-copy'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });
    const after = await store.getTask(taskId);

    expect(after.currentPhase).toBe(before.currentPhase);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.phaseHistory).toEqual(before.phaseHistory);
  });

  it('current-task does not mutate task.yaml (read-only check)', async () => {
    const taskId = await createActiveTask('CurrentTask ReadOnly Task');
    const store = new YamlTaskStore(workspace.dir);
    const before = await store.getTask(taskId);

    await runCli(['current-task'], workspace.dir);
    const after = await store.getTask(taskId);

    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.currentPhase).toBe(before.currentPhase);
  });

  it('list-tasks does not mutate task.yaml (read-only check)', async () => {
    const taskId = await createActiveTask('ListTasks ReadOnly Task');
    const store = new YamlTaskStore(workspace.dir);
    const before = await store.getTask(taskId);

    await runCli(['list-tasks'], workspace.dir);
    const after = await store.getTask(taskId);

    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.currentPhase).toBe(before.currentPhase);
  });

  it('get-task does not mutate task.yaml (read-only check)', async () => {
    const taskId = await createActiveTask('GetTask ReadOnly Task');
    const store = new YamlTaskStore(workspace.dir);
    const before = await store.getTask(taskId);

    await runCli(['get-task', '--task', taskId], workspace.dir);
    const after = await store.getTask(taskId);

    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.currentPhase).toBe(before.currentPhase);
  });

  it('current-task shows effective first phase when currentPhase is null', async () => {
    await createActiveTask('Effective Phase Current Task');

    const result = await runCli(['current-task'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('(effective)');
    expect(result.stdout).not.toContain('(not started)');
  });

  it('list-tasks shows effective first phase when currentPhase is null', async () => {
    await createActiveTask('Effective Phase List Task');

    const result = await runCli(['list-tasks'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('(effective)');
    expect(result.stdout).not.toContain('(not started)');
  });

  it('get-task shows effective first phase when currentPhase is null', async () => {
    const taskId = await createActiveTask('Effective Phase Get Task');

    const result = await runCli(['get-task', '--task', taskId], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('(effective)');
    expect(result.stdout).not.toContain('(not started)');
  });

  it('current-task shows INVALID with allowed phases for unknown currentPhase', async () => {
    const taskId = await createActiveTask('Invalid Phase Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'nonexistent_phase' });

    const result = await runCli(['current-task'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('INVALID');
    expect(result.stdout).toContain('nonexistent_phase');
    expect(result.stdout).toContain('allowed:');
  });

  it('list-tasks shows INVALID with allowed phases for unknown currentPhase', async () => {
    const taskId = await createActiveTask('Invalid Phase List Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'bogus_phase' });

    const result = await runCli(['list-tasks'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('INVALID');
    expect(result.stdout).toContain('bogus_phase');
    expect(result.stdout).toContain('allowed:');
  });

  it('get-task --json emits task record as JSON', async () => {
    const taskId = await createActiveTask('GetTask JSON Task');

    const result = await runCli(['get-task', '--task', taskId, '--json'], workspace.dir);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.id).toBe(taskId);
    expect(parsed.title).toBe('GetTask JSON Task');
    expect(parsed).toHaveProperty('status');
    expect(parsed).toHaveProperty('currentPhase');
  });

  // rewind — non-interactive success
  it('rewind non-interactive moves currentPhase back one step', async () => {
    const taskId = await createActiveTask('Rewind Noninteractive Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '2' });

    const result = await runCli(
      ['rewind', '--task', taskId, '--steps', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Rewound:');
    const after = await store.getTask(taskId);
    expect(after.currentPhase).toBe('1');
  });

  // rewind — non-interactive missing --task
  it('rewind non-interactive fails without --task', async () => {
    await createActiveTask('Rewind No Task Task');

    const result = await runCli(
      ['rewind', '--steps', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--task');
  });

  // rewind — non-interactive missing --steps
  it('rewind non-interactive fails without --steps', async () => {
    const taskId = await createActiveTask('Rewind No Steps Task');

    const result = await runCli(
      ['rewind', '--task', taskId, '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--steps');
  });

  // rewind — non-interactive missing --yes
  it('rewind non-interactive fails without --yes', async () => {
    const taskId = await createActiveTask('Rewind No Yes Task');

    const result = await runCli(
      ['rewind', '--task', taskId, '--steps', '1'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--yes');
  });

  // rewind — currentPhase null
  it('rewind fails when currentPhase is null', async () => {
    const taskId = await createActiveTask('Rewind Null Phase Task');

    const result = await runCli(
      ['rewind', '--task', taskId, '--steps', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('has no explicit phase pointer');
  });

  // rewind — out-of-range
  it('rewind fails when steps would exceed phaseOrder start', async () => {
    const taskId = await createActiveTask('Rewind Out Of Range Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '1' });

    const result = await runCli(
      ['rewind', '--task', taskId, '--steps', '2', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Cannot rewind');
  });

  // rewind — invalid --steps value
  it('rewind fails with invalid --steps value', async () => {
    const taskId = await createActiveTask('Rewind Invalid Steps Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '2' });

    const result = await runCli(
      ['rewind', '--task', taskId, '--steps', '0', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid --steps value');
  });

  // rewind — inactive task
  it('rewind fails on inactive task', async () => {
    const taskId = await createActiveTask('Rewind Inactive Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { status: 'completed', currentPhase: null });

    const result = await runCli(
      ['rewind', '--task', taskId, '--steps', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('is not active');
  });

  // rewind — interactive confirm via PTY
  it('rewind interactive asks for confirmation and mutates on yes', async () => {
    const taskId = await createActiveTask('Rewind Interactive Confirm Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '2' });

    const result = await runCliInPty(['rewind', '--task', taskId], workspace.dir, 'y\n');
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Proceed? [y/N]');
    expect(output).toContain('Rewound:');
    const after = await store.getTask(taskId);
    expect(after.currentPhase).toBe('1');
  });

  // rewind — interactive cancel via PTY
  it('rewind interactive cancels without mutation on no', async () => {
    const taskId = await createActiveTask('Rewind Interactive Cancel Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '2' });
    const before = await store.getTask(taskId);

    const result = await runCliInPty(['rewind', '--task', taskId], workspace.dir, 'n\n');
    const output = result.stdout + result.stderr;
    const after = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Cancelled. Phase not changed.');
    expect(after.currentPhase).toBe(before.currentPhase);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  // rewind — phaseHistory preserved
  it('rewind preserves phaseHistory after rewinding', async () => {
    const taskId = await createActiveTask('Rewind History Task', 'multi-spec');
    const store = new YamlTaskStore(workspace.dir);
    // Directly set currentPhase to simulate having been in phase 2
    await store.updateTask(taskId, { currentPhase: '2', phaseHistory: [{ phase: '1', status: 'completed', completedAt: '2025-01-01T00:00:00.000Z' }] });

    const result = await runCli(
      ['rewind', '--task', taskId, '--steps', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(0);
    const after = await store.getTask(taskId);
    expect(after.currentPhase).toBe('1');
    expect(after.phaseHistory).toHaveLength(1);
    expect(after.phaseHistory[0]?.phase).toBe('1');
    expect(after.phaseHistory[0]?.status).toBe('completed');
  });

  // phase --set — non-interactive success
  it('phase --set non-interactive moves currentPhase to target', async () => {
    const taskId = await createActiveTask('Phase Set Noninteractive Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '2' });

    const result = await runCli(
      ['phase', '--task', taskId, '--set', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Phase set:');
    const after = await store.getTask(taskId);
    expect(after.currentPhase).toBe('1');
  });

  // phase --set — invalid target
  it('phase --set fails on invalid target phase', async () => {
    const taskId = await createActiveTask('Phase Set Invalid Task');

    const result = await runCli(
      ['phase', '--task', taskId, '--set', 'bogus_phase', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid phase: bogus_phase');
  });

  // phase --set — missing --task non-interactive
  it('phase --set non-interactive fails without --task', async () => {
    await createActiveTask('Phase Set No Task Task');

    const result = await runCli(
      ['phase', '--set', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--task');
  });

  // phase --set — missing --yes non-interactive
  it('phase --set non-interactive fails without --yes', async () => {
    const taskId = await createActiveTask('Phase Set No Yes Task');

    const result = await runCli(
      ['phase', '--task', taskId, '--set', '1'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--yes');
  });

  // phase --set — backward warning
  it('phase --set warns when moving backward', async () => {
    const taskId = await createActiveTask('Phase Set Backward Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '3' });

    const result = await runCli(
      ['phase', '--task', taskId, '--set', '1', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('backward');
  });

  // phase --set — skip-forward warning
  it('phase --set warns when skipping forward', async () => {
    const taskId = await createActiveTask('Phase Set Skip Forward Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '1' });

    const result = await runCli(
      ['phase', '--task', taskId, '--set', '3', '--yes'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('skips forward');
  });

  // phase --select — non-interactive fails
  it('phase --select fails in non-interactive mode', async () => {
    await createActiveTask('Phase Select Noninteractive Task');

    const result = await runCli(
      ['phase', '--select'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('interactive terminal');
  });

  // phase --select — PTY cancel
  it('phase --select cancels without mutation on Esc', async () => {
    const taskId = await createActiveTask('Phase Select Cancel Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '2' });
    const before = await store.getTask(taskId);

    const result = await runCliInPty(['phase', '--task', taskId, '--select'], workspace.dir, '\x1b');
    const output = result.stdout + result.stderr;
    const after = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Cancelled. Phase not changed.');
    expect(after.currentPhase).toBe(before.currentPhase);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  // phase <phaseId> — still render-only (no state change)
  it('phase <phaseId> renders prompt without mutating state', async () => {
    const taskId = await createActiveTask('Phase Render Only Task');
    const store = new YamlTaskStore(workspace.dir);
    const before = await store.getTask(taskId);

    const result = await runCli(['phase', '1'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    const after = await store.getTask(taskId);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Phase 1');
    expect(after.currentPhase).toBe(before.currentPhase);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  // phase set <phaseId> treated as render-only positional (not a mutating alias)
  it('playspec phase set is treated as render-only positional phase ID', async () => {
    const taskId = await createActiveTask('Phase Set Alias Task');
    const store = new YamlTaskStore(workspace.dir);
    const before = await store.getTask(taskId);

    // There is no phase named "set", so this fails with PhaseNotFoundError (render-only behavior)
    const result = await runCli(['phase', 'set'], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });

    expect(result.exitCode).toBe(1);
    // Should fail as a phase-not-found error, not as a mutating command
    expect(result.stderr).not.toContain('Non-interactive phase --set requires');
    const after = await store.getTask(taskId);
    expect(after.currentPhase).toBe(before.currentPhase);
  });

  // phase <phaseId> + --set is ambiguous
  it('phase <phaseId> combined with --set fails with ambiguity error', async () => {
    const taskId = await createActiveTask('Phase Ambiguous Task');

    const result = await runCli(
      ['phase', '1', '--set', '2'],
      workspace.dir,
      { env: { PLAY_SPEC_NON_INTERACTIVE: '1' } }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('cannot be combined with --set or --select');
  });
});
