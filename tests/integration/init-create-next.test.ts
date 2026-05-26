import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { MissingRequiredVariablesError, TaskNotActiveError } from '#core/errors.js';
import { slugify } from '#utils/slug.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import { EvolutionHumanEditStore } from '#evolution/human-edit-store.js';
import type { TaskStore } from '#storage/task-store.js';
import type { EvolutionProposal, HumanEditObservation } from '#evolution/types.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, '../..');
const CLI_PATH = path.resolve(TESTS_DIR, '../../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');
const TSX_PATH = path.resolve(TESTS_DIR, '../../node_modules/.bin/tsx');

let workspace: TempWorkspace;
let previousUserWorkflows: string | undefined;

vi.setConfig({ testTimeout: 60_000 });

function runCli(args: string[]) {
  return execa(TSX_PATH, ['--tsconfig', TSCONFIG_PATH, CLI_PATH, ...args], {
    cwd: workspace.dir,
    reject: false,
  });
}

beforeEach(async () => {
  workspace = await createTempWorkspace();
  previousUserWorkflows = process.env['PLAY_SPEC_USER_WORKFLOWS'];
  process.env['PLAY_SPEC_USER_WORKFLOWS'] = path.join(workspace.dir, 'user-workflows');
});

afterEach(async () => {
  if (previousUserWorkflows === undefined) {
    delete process.env['PLAY_SPEC_USER_WORKFLOWS'];
  } else {
    process.env['PLAY_SPEC_USER_WORKFLOWS'] = previousUserWorkflows;
  }
  await workspace.cleanup();
});

async function initGitRepo(): Promise<void> {
  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });
}

function makeStoredProposal(id: string): EvolutionProposal {
  return {
    id,
    revision: 1,
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
    status: 'pending',
    source: {
      taskId: 'source_task',
      artifactRefs: [],
    },
    targetFiles: ['docs/features/source_task/spec.md'],
    riskLevel: 'low',
    actions: [
      {
        actionId: 'action_1',
        type: 'propose_file_change',
        targetPath: 'docs/features/source_task/spec.md',
        summary: 'Proposal summary should stay out of prompts.',
        rationale: 'Stored proposals are not prompt context in Phase 6.',
      },
    ],
    rationale: 'Proposal rationale should stay out of prompts.',
    review: {
      status: 'unreviewed',
    },
  };
}

function makeStoredProposalForTask(id: string, taskId: string): EvolutionProposal {
  return {
    ...makeStoredProposal(id),
    source: {
      taskId,
      artifactRefs: [],
    },
    actions: [
      {
        actionId: 'action_1',
        type: 'propose_file_change',
        targetPath: 'docs/features/source_task/spec.md',
        summary: 'Proposal summary should not be embedded.',
        rationale: 'Only compact metadata is allowed in prompts.',
      },
    ],
  };
}

function makeStoredHumanEdit(id: string): HumanEditObservation {
  return {
    id,
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
    status: 'recorded',
    targetPath: '.playspec/templates/prompt.md',
    summary: 'Human edit summary should stay out of prompts.',
    rationale: 'Human edit rationale should stay out of prompts.',
  };
}

function makeStoredHumanEditForTask(id: string, taskId: string): HumanEditObservation {
  return {
    ...makeStoredHumanEdit(id),
    sourceTaskId: taskId,
  };
}

describe('PresetManager.initWorkspace — structure verification', () => {
  it('creates expected .playspec directory structure', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const ps = path.join(workspace.dir, '.playspec');
    await expect(access(path.join(ps, 'HEAD'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'config.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'sessions', 'cli.default.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'tasks', 'active'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'workflows', 'mono-spec', 'workflow.yaml'))).resolves.not.toThrow();
    await expect(
      access(path.join(ps, 'workflows', 'mono-spec', 'templates', 'tech_spec_draft.md'))
    ).resolves.not.toThrow();
    await expect(access(path.join(ps, 'workflows', 'multi-spec', 'workflow.yaml'))).resolves.not.toThrow();
  });

  it('can install default workflows into user scope', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default', { workflowInstall: 'user' });

    await expect(access(path.join(workspace.dir, 'user-workflows', 'mono-spec', 'workflow.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(workspace.dir, '.playspec', 'workflows'))).rejects.toThrow();
  });

  it('repairs a partial project workflow directory during default workflow installation', async () => {
    const workflowDir = path.join(workspace.dir, '.playspec', 'workflows', 'mono-spec');
    await mkdir(workflowDir, { recursive: true });

    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await expect(access(path.join(workflowDir, 'workflow.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(workflowDir, 'templates', 'tech_spec_draft.md'))).resolves.not.toThrow();
  });

  it('repairs a partial user workflow directory during default workflow installation', async () => {
    const workflowDir = path.join(workspace.dir, 'user-workflows', 'mono-spec');
    await mkdir(workflowDir, { recursive: true });

    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default', { workflowInstall: 'user' });

    await expect(access(path.join(workflowDir, 'workflow.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(workflowDir, 'templates', 'tech_spec_draft.md'))).resolves.not.toThrow();
    await expect(access(path.join(workspace.dir, '.playspec', 'workflows'))).rejects.toThrow();
  });

  it('can skip default workflow installation', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default', { workflowInstall: 'skip' });

    await expect(access(path.join(workspace.dir, '.playspec', 'workflows'))).rejects.toThrow();
    await expect(access(path.join(workspace.dir, 'user-workflows'))).rejects.toThrow();
  });

  it.each([
    ['slash traversal', '../default', 'path separators'],
    ['backslash traversal', '..\\default', 'path separators'],
    ['posix absolute path', '/tmp/default', 'relative'],
    ['windows absolute path', 'C:\\default', 'relative'],
    ['slash separator', 'bad/name', 'path separators'],
    ['backslash separator', 'bad\\name', 'path separators'],
    ['null byte', 'bad\0name', 'null bytes'],
    ['single dot', '.', 'preset asset directory'],
    ['double dot', '..', 'preset asset directory'],
  ])('rejects unsafe preset name before workspace mutation: %s', async (_label, presetName, expectedMessage) => {
    const manager = new PresetManager();

    await expect(manager.initWorkspace(workspace.dir, presetName)).rejects.toThrow(expectedMessage);
    await expect(access(path.join(workspace.dir, '.playspec'))).rejects.toThrow();
  });

  it('gitignore keeps project workflows committable while ignoring runtime state', async () => {
    const gitignore = await readFile(path.join(REPO_ROOT, '.gitignore'), 'utf8');
    await writeFile(path.join(workspace.dir, '.gitignore'), gitignore, 'utf8');
    await writeTextFile(path.join(workspace.dir, '.playspec', 'tasks', 'active', 'task.yaml'), 'id: task\n');
    await writeTextFile(path.join(workspace.dir, '.playspec', 'workflows', 'mono-spec', 'workflow.yaml'), 'id: mono-spec\n');
    await execa('git', ['init'], { cwd: workspace.dir });

    const status = await execa('git', ['status', '--short', '--ignored', '--untracked-files=all'], {
      cwd: workspace.dir,
    });

    expect(status.stdout).toContain('?? .playspec/workflows/mono-spec/workflow.yaml');
    expect(status.stdout).toContain('!! .playspec/tasks/active/task.yaml');
  });

  it('creates HEAD as an empty file on init', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const { readFile } = await import('node:fs/promises');
    const headContent = await readFile(getHeadPath(workspace.dir), 'utf8');
    expect(headContent.trim()).toBe('');
  });

  it('does not overwrite already installed workflows on init', async () => {
    const workflowDir = path.join(workspace.dir, '.playspec', 'workflows', 'mono-spec');
    const workflowFile = path.join(workflowDir, 'workflow.yaml');
    const customWorkflow = 'id: mono-spec\nmode: linear\nphaseOrder: []\nphases: {}\n';
    await mkdir(workflowDir, { recursive: true });
    await writeFile(workflowFile, customWorkflow, 'utf8');

    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await expect(readFile(workflowFile, 'utf8')).resolves.toBe(customWorkflow);
  });

  it('preserves existing config, HEAD, sessions, and workflows when init reruns', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const playspecRoot = path.join(workspace.dir, '.playspec');
    const configFile = path.join(playspecRoot, 'config.yaml');
    const headFile = getHeadPath(workspace.dir);
    const sessionFile = path.join(playspecRoot, 'sessions', 'cli.default.yaml');
    const workflowFile = path.join(playspecRoot, 'workflows', 'mono-spec', 'workflow.yaml');
    const customConfig = 'version: 1\ncustom: preserved\n';
    const customHead = 'existing_head_task\n';
    const customSession = 'id: cli.default\ncustom: preserved\n';
    const customWorkflow = 'id: mono-spec\nmode: linear\nphaseOrder: []\nphases: {}\n';

    await writeFile(configFile, customConfig, 'utf8');
    await writeFile(headFile, customHead, 'utf8');
    await writeFile(sessionFile, customSession, 'utf8');
    await writeFile(workflowFile, customWorkflow, 'utf8');

    await manager.initWorkspace(workspace.dir, 'default');

    await expect(readFile(configFile, 'utf8')).resolves.toBe(customConfig);
    await expect(readFile(headFile, 'utf8')).resolves.toBe(customHead);
    await expect(readFile(sessionFile, 'utf8')).resolves.toBe(customSession);
    await expect(readFile(workflowFile, 'utf8')).resolves.toBe(customWorkflow);
  });
});

describe('init → create → next (end-to-end)', () => {
  it('renders a prompt to stdout after init and create', async () => {
    // 1. Init workspace
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    // 2. Create task
    const taskId = slugify('Feature Name');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Feature Name',
      workflow: 'multi-spec',
    });

    // 3. Set HEAD
    await writeTextFile(getHeadPath(workspace.dir), taskId + '\n');

    // 4. Render next prompt
    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('feature_name');
    expect(prompt).toContain('Feature Name');
    expect(prompt).toContain('multi-spec');
    expect(prompt).toContain('Phase 1');
    expect(prompt).toContain('Global Rules');
  });

  it('renders an explicit phase prompt', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('My Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'My Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderExplicitPhasePrompt(taskId, '3');

    expect(prompt).toContain('my_task');
    expect(prompt).toContain('My Task');
    // PHASE_NUMBER should be resolved to 3
    expect(prompt).toMatch(/Phase 3/);
  });

  it('core prompt render helpers reject completed tasks', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Completed Render Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Completed Render Task',
      workflow: 'multi-spec',
    });
    await store.updateTask(taskId, {
      status: 'completed',
      currentPhase: null,
    });

    const core = new PlaySpecCore(workspace.dir, store);

    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(TaskNotActiveError);
    await expect(core.renderExplicitPhasePrompt(taskId, '1')).rejects.toThrow(TaskNotActiveError);
  });

  it('core prompt render helpers reject archived task records', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Archived Render Task');
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.createTask({
      id: taskId,
      title: 'Archived Render Task',
      workflow: 'multi-spec',
    });
    const archivedStore = {
      getTask: async () => ({
        ...task,
        status: 'archived' as const,
        paths: {
          ...task.paths,
          taskRoot: path.join('.playspec', 'tasks', 'archived', taskId),
        },
      }),
    } as TaskStore;

    const core = new PlaySpecCore(workspace.dir, archivedStore);

    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(TaskNotActiveError);
    await expect(core.renderExplicitPhasePrompt(taskId, '1')).rejects.toThrow(TaskNotActiveError);
  });

  it('renderNextPrompt refuses if a stored contextRef path is missing', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Exec Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Exec Task',
      workflow: 'multi-spec',
      contextRefs: [
        { path: 'docs/features/exec_task/nonexistent_spec.md', role: 'planning-context', source: 'planning_task' },
      ],
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const { MissingContextRefError } = await import('#core/errors.js');
    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(MissingContextRefError);
  });

  it('renderNextPrompt refuses a sibling contextRef path that shares the workspace path prefix', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const siblingDir = `${workspace.dir}-sibling`;
    const siblingContextPath = path.join(siblingDir, 'context.md');
    await mkdir(siblingDir, { recursive: true });
    await writeTextFile(siblingContextPath, '# Escaping Context\n');

    try {
      const taskId = slugify('Sibling Context Escape Task');
      const store = new YamlTaskStore(workspace.dir);
      await store.createTask({
        id: taskId,
        title: 'Sibling Context Escape Task',
        workflow: 'multi-spec',
        contextRefs: [
          {
            path: path.join('..', path.basename(siblingDir), 'context.md'),
            role: 'planning-context',
            source: 'manual_yaml',
          },
        ],
      });

      const core = new PlaySpecCore(workspace.dir, store);
      const { MissingContextRefError } = await import('#core/errors.js');
      await expect(core.renderNextPrompt(taskId)).rejects.toThrow(MissingContextRefError);
    } finally {
      await rm(siblingDir, { recursive: true, force: true });
    }
  });

  it('renderExplicitPhasePrompt refuses a sibling contextRef path that shares the workspace path prefix', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const siblingDir = `${workspace.dir}-sibling`;
    const siblingContextPath = path.join(siblingDir, 'explicit-context.md');
    await mkdir(siblingDir, { recursive: true });
    await writeTextFile(siblingContextPath, '# Escaping Explicit Context\n');

    try {
      const taskId = slugify('Explicit Sibling Context Escape Task');
      const store = new YamlTaskStore(workspace.dir);
      await store.createTask({
        id: taskId,
        title: 'Explicit Sibling Context Escape Task',
        workflow: 'multi-spec',
        contextRefs: [
          {
            path: path.join('..', path.basename(siblingDir), 'explicit-context.md'),
            role: 'planning-context',
            source: 'manual_yaml',
          },
        ],
      });

      const core = new PlaySpecCore(workspace.dir, store);
      const { MissingContextRefError } = await import('#core/errors.js');
      await expect(core.renderExplicitPhasePrompt(taskId, '1')).rejects.toThrow(MissingContextRefError);
    } finally {
      await rm(siblingDir, { recursive: true, force: true });
    }
  });

  it('renders compact, strict, and full context modes with explicit context refs', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await mkdir(path.join(workspace.dir, 'docs', 'features', 'context_modes'), { recursive: true });
    await writeTextFile(
      path.join(workspace.dir, 'docs', 'features', 'context_modes', 'source.md'),
      '# Source Problem\n\nImplement context modes.\n'
    );

    const taskId = slugify('Context Mode Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Context Mode Task',
      workflow: 'multi-spec',
      contextRefs: [
        { path: 'docs/features/context_modes/source.md', role: 'source-problem', source: 'test' },
      ],
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const compactPrompt = await core.renderNextPrompt(taskId, { contextMode: 'compact' });
    const strictPrompt = await core.renderNextPrompt(taskId, { contextMode: 'strict' });
    const fullPrompt = await core.renderNextPrompt(taskId, { contextMode: 'full' });

    expect(compactPrompt).toContain('## Compact Context Summary');
    expect(compactPrompt).toContain('docs/features/context_modes/source.md');
    expect(compactPrompt).not.toContain('```');
    expect(strictPrompt).toContain('## Context Files');
    expect(strictPrompt).toContain('# Source Problem');
    expect(fullPrompt).toContain('## Context Files');
    expect(fullPrompt).toContain('Implement context modes.');
  });

  it('renders compact, strict, and full context modes with explicit archived context refs', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const archivedArtifactPath = '.playspec/tasks/archived/done_task/outputs/result.md';
    await mkdir(path.dirname(path.join(workspace.dir, archivedArtifactPath)), { recursive: true });
    await writeTextFile(
      path.join(workspace.dir, archivedArtifactPath),
      '# Archived Result\n\nReusable archived context.\n'
    );

    const taskId = slugify('Archived Context Mode Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Archived Context Mode Task',
      workflow: 'multi-spec',
      contextRefs: [
        { path: archivedArtifactPath, role: 'planning-context', source: 'archived_task' },
      ],
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const compactPrompt = await core.renderNextPrompt(taskId, { contextMode: 'compact' });
    const strictPrompt = await core.renderNextPrompt(taskId, { contextMode: 'strict' });
    const fullPrompt = await core.renderNextPrompt(taskId, { contextMode: 'full' });

    expect(compactPrompt).toContain('## Compact Context Summary');
    expect(compactPrompt).toContain(archivedArtifactPath);
    expect(compactPrompt).toContain('# Archived Result');
    expect(compactPrompt).not.toContain('```');
    expect(strictPrompt).toContain('## Context Files');
    expect(strictPrompt).toContain(`### ${archivedArtifactPath}`);
    expect(strictPrompt).toContain('# Archived Result');
    expect(fullPrompt).toContain('## Context Files');
    expect(fullPrompt).toContain(`### ${archivedArtifactPath}`);
    expect(fullPrompt).toContain('Reusable archived context.');
  });

  it('renderNextPrompt succeeds when contextRefs is empty', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Normal Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Normal Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);
    expect(prompt).toBeTruthy();
  });

  it('prompt --write records context mode metadata sidecar next to prompt snapshots', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await mkdir(path.join(workspace.dir, 'docs', 'features', 'metadata'), { recursive: true });
    await writeTextFile(
      path.join(workspace.dir, 'docs', 'features', 'metadata', 'context.md'),
      '# Metadata Context\n\nThis body is omitted in compact mode.\n'
    );

    const taskId = slugify('Prompt Metadata Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Prompt Metadata Task',
      workflow: 'multi-spec',
      contextRefs: [
        { path: 'docs/features/metadata/context.md', role: 'planning-context', source: 'test' },
      ],
    });
    await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

    const result = await runCli(['prompt', '--print-only', '--write', '--context-mode', 'compact']);
    const promptDir = path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'prompts');
    const metadataFiles = (await readdir(promptDir)).filter((file) => file.endsWith('.md.meta.yaml'));
    const metadata = parseYaml(await readFile(path.join(promptDir, metadataFiles[0]!), 'utf-8')) as {
      contextMode: string;
      generationSource: string;
      taskId: string;
      omittedContext: Array<{ path: string }>;
    };

    expect(result.exitCode).toBe(0);
    expect(metadataFiles).toHaveLength(1);
    expect(metadata.contextMode).toBe('compact');
    expect(metadata.generationSource).toBe('prompt');
    expect(metadata.taskId).toBe(taskId);
    expect(metadata.omittedContext[0]?.path).toBe('docs/features/metadata/context.md');
  });

  it('renderNextPrompt ignores stored evolution proposals in Phase 6', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Prompt Ignores Proposals');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Prompt Ignores Proposals',
      workflow: 'multi-spec',
    });

    const proposalStore = new EvolutionProposalStore(workspace.dir);
    await proposalStore.saveProposal(makeStoredProposal('proposal_prompt_hidden'));

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('Prompt Ignores Proposals');
    expect(prompt).not.toContain('proposal_prompt_hidden');
    expect(prompt).not.toContain('Proposal summary should stay out of prompts.');
    expect(prompt).not.toContain('evolution context');
  });

  it('renderNextPrompt ignores stored human edit observations in Phase 6.4', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Prompt Ignores Human Edits');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Prompt Ignores Human Edits',
      workflow: 'multi-spec',
    });

    const humanEditStore = new EvolutionHumanEditStore(workspace.dir);
    await humanEditStore.saveObservation(makeStoredHumanEdit('human_edit_prompt_hidden'));

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('Prompt Ignores Human Edits');
    expect(prompt).not.toContain('human_edit_prompt_hidden');
    expect(prompt).not.toContain('Human edit summary should stay out of prompts.');
    expect(prompt).not.toContain('Human edit rationale should stay out of prompts.');
    expect(prompt).not.toContain('evolution context');
  });

  it('renderNextPrompt surfaces compact evolution context only when explicitly requested', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Prompt Shows Evolution Context');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Prompt Shows Evolution Context',
      workflow: 'multi-spec',
    });

    const proposalStore = new EvolutionProposalStore(workspace.dir);
    await proposalStore.saveProposal(makeStoredProposalForTask('proposal_prompt_visible', taskId));
    const humanEditStore = new EvolutionHumanEditStore(workspace.dir);
    await humanEditStore.saveObservation(makeStoredHumanEditForTask('human_edit_prompt_visible', taskId));

    const core = new PlaySpecCore(workspace.dir, store);
    const defaultPrompt = await core.renderNextPrompt(taskId);
    const optInPrompt = await core.renderNextPrompt(taskId, { withEvolutionContext: true });

    expect(defaultPrompt).not.toContain('proposal_prompt_visible');
    expect(optInPrompt).toContain('## Evolution Context');
    expect(optInPrompt).toContain('proposal_prompt_visible');
    expect(optInPrompt).toContain('status=pending');
    expect(optInPrompt).toContain('revision=1');
    expect(optInPrompt).toContain('risk=low');
    expect(optInPrompt).toContain('human_edit_prompt_visible');
    expect(optInPrompt).not.toContain('Proposal summary should not be embedded.');
    expect(optInPrompt).not.toContain('Only compact metadata is allowed in prompts.');
  });

  it('renderNextPrompt ignores malformed evolution records unless evolution context is requested', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Prompt Ignores Malformed Evolution');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Prompt Ignores Malformed Evolution',
      workflow: 'multi-spec',
    });

    const badProposalDir = path.join(workspace.dir, '.playspec', 'evolution', 'proposals', 'bad_proposal');
    await mkdir(badProposalDir, { recursive: true });
    await writeFile(path.join(badProposalDir, 'proposal.yaml'), 'id: bad_proposal\nstatus: pending\n', 'utf8');

    const core = new PlaySpecCore(workspace.dir, store);
    await expect(core.renderNextPrompt(taskId)).resolves.toContain('Prompt Ignores Malformed Evolution');
    await expect(core.renderNextPrompt(taskId, { withEvolutionContext: true })).rejects.toThrow();
  });

  it('completePhase does not create evolution context snapshots when proposals exist', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await initGitRepo();

    const taskId = slugify('Completion Ignores Proposals');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Completion Ignores Proposals',
      workflow: 'multi-spec',
    });

    const proposalStore = new EvolutionProposalStore(workspace.dir);
    await proposalStore.saveProposal(makeStoredProposal('proposal_completion_hidden'));

    const core = new PlaySpecCore(workspace.dir, store);
    await core.completePhase(taskId);

    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'context'))).rejects.toThrow();
  });

  it('completePhase does not create evolution context snapshots when human edits exist', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await initGitRepo();

    const taskId = slugify('Completion Ignores Human Edits');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Completion Ignores Human Edits',
      workflow: 'multi-spec',
    });

    const humanEditStore = new EvolutionHumanEditStore(workspace.dir);
    await humanEditStore.saveObservation(makeStoredHumanEdit('human_edit_completion_hidden'));

    const core = new PlaySpecCore(workspace.dir, store);
    await core.completePhase(taskId);

    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'context'))).rejects.toThrow();
  });

  it('completePhase writes a validated evolution context snapshot only when requested', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await initGitRepo();

    const taskId = slugify('Completion Writes Evolution Context');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Completion Writes Evolution Context',
      workflow: 'multi-spec',
    });

    const proposalStore = new EvolutionProposalStore(workspace.dir);
    await proposalStore.saveProposal(makeStoredProposalForTask('proposal_completion_visible', taskId));
    const humanEditStore = new EvolutionHumanEditStore(workspace.dir);
    await humanEditStore.saveObservation(makeStoredHumanEditForTask('human_edit_completion_visible', taskId));

    const core = new PlaySpecCore(workspace.dir, store);
    const result = await core.completePhase(taskId, { withEvolutionContext: true });

    expect(result.evolutionContextSnapshotFile).toMatch(
      /^\.playspec\/evolution\/context\/completion_writes_evolution_context\/1-\d{8}t\d{6}z\.yaml$/
    );
    const snapshot = parseYaml(
      await readFile(path.join(workspace.dir, result.evolutionContextSnapshotFile!), 'utf8')
    ) as {
      taskId: string;
      phaseId: string;
      proposalIds: string[];
      humanEditObservationIds: string[];
      omittedProposalCount: number;
      omittedHumanEditObservationCount: number;
      generationSource: string;
    };
    expect(snapshot.taskId).toBe(taskId);
    expect(snapshot.phaseId).toBe('1');
    expect(snapshot.proposalIds).toEqual(['proposal_completion_visible']);
    expect(snapshot.humanEditObservationIds).toEqual(['human_edit_completion_visible']);
    expect(snapshot.omittedProposalCount).toBe(0);
    expect(snapshot.omittedHumanEditObservationCount).toBe(0);
    expect(snapshot.generationSource).toBe('complete');
  });

  it('closes a completed task into archive storage from the CLI', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Done Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Done Task',
      workflow: 'mono-spec',
    });
    await store.updateTask(taskId, { status: 'completed' });

    const result = await runCli(['close', '--task', taskId]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Closed task "${taskId}" into archive storage.`);
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId))
    ).rejects.toThrow();
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'archived', taskId, 'task.yaml'))
    ).resolves.toBeUndefined();
  });

  it('clears HEAD when closing the selected completed task from the CLI', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Selected Done Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Selected Done Task',
      workflow: 'mono-spec',
    });
    await store.updateTask(taskId, { status: 'completed' });
    await writeFile(getHeadPath(workspace.dir), taskId, 'utf-8');

    const result = await runCli(['close', '--task', taskId]);
    const currentTask = await runCli(['current-task']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Closed task "${taskId}" into archive storage.`);
    expect(result.stdout).toContain('HEAD cleared because the selected task was closed.');
    expect(result.stdout).toContain('Select another active task with `playspec use <TASK_ID>`.');
    await expect(readFile(getHeadPath(workspace.dir), 'utf-8')).resolves.toBe('');
    expect(currentTask.exitCode).not.toBe(0);
    expect(currentTask.stderr).toContain('No active task set.');
    expect(currentTask.stderr).toContain(
      'Create a task with `playspec create` or switch to one with `playspec use <TASK_ID>`.'
    );
    expect(currentTask.stderr).not.toContain(`Task not found: ${taskId}`);
  });

  it('preserves HEAD when closing a different completed task from the CLI', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const selectedTaskId = slugify('Still Selected Task');
    const closedTaskId = slugify('Other Done Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: selectedTaskId,
      title: 'Still Selected Task',
      workflow: 'mono-spec',
    });
    await store.createTask({
      id: closedTaskId,
      title: 'Other Done Task',
      workflow: 'mono-spec',
    });
    await store.updateTask(closedTaskId, { status: 'completed' });
    await writeFile(getHeadPath(workspace.dir), selectedTaskId, 'utf-8');

    const result = await runCli(['close', '--task', closedTaskId]);
    const currentTask = await runCli(['current-task']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Closed task "${closedTaskId}" into archive storage.`);
    expect(result.stdout).not.toContain('HEAD cleared because the selected task was closed.');
    await expect(readFile(getHeadPath(workspace.dir), 'utf-8')).resolves.toBe(selectedTaskId);
    expect(currentTask.exitCode).toBe(0);
    expect(currentTask.stdout).toContain(`Task ID:      ${selectedTaskId}`);
  });

  it('lists and shows archived tasks without mixing them into active lists', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Archived CLI Task');
    const activeTaskId = slugify('Still Active Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Archived CLI Task',
      workflow: 'mono-spec',
    });
    await store.createTask({
      id: activeTaskId,
      title: 'Still Active Task',
      workflow: 'multi-spec',
    });
    await store.updateTask(taskId, {
      status: 'completed',
      phaseHistory: [
        {
          phase: 'implementation',
          status: 'completed',
          completedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'outputs', 'result.md'),
      '# Result\n'
    );
    await store.archiveCompletedTask(taskId);

    const rootHelp = await runCli(['--help']);
    const archiveHelp = await runCli(['archive', '--help']);
    const archiveList = await runCli(['archive', 'list']);
    const archiveShow = await runCli(['archive', 'show', '--task', taskId]);
    const activeList = await runCli(['list']);
    const activeListTasks = await runCli(['list-tasks']);

    expect(rootHelp.exitCode).toBe(0);
    expect(rootHelp.stdout).not.toMatch(/^\s+close(?:\s|\[|$)/m);
    expect(rootHelp.stdout).not.toMatch(/^\s+archive(?:\s|\[|$)/m);
    expect(archiveHelp.exitCode).toBe(0);
    expect(archiveHelp.stdout).toMatch(/^\s+list\b/m);
    expect(archiveHelp.stdout).toMatch(/^\s+show\b/m);
    expect(archiveList.exitCode).toBe(0);
    expect(archiveList.stdout).toContain('Archived tasks:');
    expect(archiveList.stdout).toContain(`${taskId} | Archived CLI Task | mono-spec`);
    expect(archiveList.stdout).not.toContain(activeTaskId);
    expect(archiveShow.exitCode).toBe(0);
    expect(archiveShow.stdout).toContain(`Task ID:      ${taskId}`);
    expect(archiveShow.stdout).toContain('Title:        Archived CLI Task');
    expect(archiveShow.stdout).toContain('Status:       archived');
    expect(archiveShow.stdout).toContain(`Task root:    .playspec/tasks/archived/${taskId}`);
    expect(archiveShow.stdout).toContain('Phase history:');
    expect(activeList.exitCode).toBe(0);
    expect(activeList.stdout).toContain(activeTaskId);
    expect(activeList.stdout).not.toContain(taskId);
    expect(activeListTasks.exitCode).toBe(0);
    expect(activeListTasks.stdout).toContain(activeTaskId);
    expect(activeListTasks.stdout).not.toContain(taskId);
  }, 60_000);

  it('renders mono-spec prompts with validation criteria and target branch guidance', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Migration Bug Fix');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Migration Bug Fix',
      workflow: 'mono-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const validationPrompt = await core.renderExplicitPhasePrompt(taskId, 'tech_spec_validate');
    expect(validationPrompt).toContain('Risks and questions');
    expect(validationPrompt).toContain('STEP_NUMBER=`2`');
    expect(validationPrompt).toContain('STEP_ID=`tech_spec_validate`');
    expect(validationPrompt).toContain('SPEC_FILE=`docs/features/migration_bug_fix/spec.md`');
    expect(validationPrompt).toContain('PLAN_FILE=`docs/features/migration_bug_fix/plan.md`');
    expect(validationPrompt).toContain('RESULT_FILE=`docs/features/migration_bug_fix/result.md`');
    expect(validationPrompt).toContain('PR_FILE=`docs/features/migration_bug_fix/pr.md`');
    expect(validationPrompt).toContain('playspec complete --result approved');
    expect(validationPrompt).not.toContain('MASTER_SPEC_FILE');
    expect(validationPrompt).not.toContain('MASTER_PHASE_FILE');
    expect(validationPrompt).not.toContain('PHASE_SPEC_FILE');
    expect(validationPrompt).not.toContain('PHASE_HANDOFF_FILE');
    expect(validationPrompt).toContain('Minimum remaining spec work');
    expect(validationPrompt).toContain('Do not treat helper, interface, callback, command option, function, or data-structure existence');
    expect(validationPrompt).toContain('active entry point -> validation -> state/data update -> persistence -> propagation/callback/event -> reset/clear -> final user-visible behavior -> tests');
    expect(validationPrompt).toContain('Codex/the code agent');
    expect(validationPrompt).toContain('Score: X/100');
    expect(validationPrompt).toContain('technical spec readiness score is `>= 95/100`, no blockers remain');
    expect(validationPrompt).toContain('technical spec readiness score is below `95/100`, any blocker remains');
    expect(validationPrompt).not.toMatch(/external GPT|Web GPT|pasted|PASTED|Paste the|Copy the full spec/);

    const specPatchPrompt = await core.renderExplicitPhasePrompt(taskId, 'tech_spec_patch');
    expect(specPatchPrompt).toContain('Latest markdown technical validation/risk score output from Step 2');
    expect(specPatchPrompt).toContain('Score: X/100');
    expect(specPatchPrompt).toContain('reference the latest Step 2 score');

    const planValidationPrompt = await core.renderExplicitPhasePrompt(taskId, 'implementation_plan_validate');
    expect(planValidationPrompt).toContain('Score: X/100');
    expect(planValidationPrompt).toContain('implementation plan readiness score is `>= 95/100`, no blockers remain');
    expect(planValidationPrompt).toContain('implementation plan readiness score is below `95/100`, any blocker remains');

    const planPatchPrompt = await core.renderExplicitPhasePrompt(taskId, 'implementation_plan_patch');
    expect(planPatchPrompt).toContain('Latest markdown implementation plan validation/risk score output from Step 5');
    expect(planPatchPrompt).toContain('Score: X/100');
    expect(planPatchPrompt).toContain('reference the latest Step 5 score');

    const refactorPrompt = await core.renderExplicitPhasePrompt(taskId, 'safe_refactor');
    expect(refactorPrompt).toContain('TARGET_BRANCH=`origin/master`');
    expect(refactorPrompt).toContain('Compare against `origin/master`, not stale local assumptions.');

    const prPrompt = await core.renderExplicitPhasePrompt(taskId, 'pr_prepare');
    expect(prPrompt).toContain('TARGET_BRANCH=`origin/master`');
    expect(prPrompt).toContain('Current branch diff compared against `origin/master`');
    expect(prPrompt).toContain('PR_FILE=`docs/features/migration_bug_fix/pr.md`');
    expect(prPrompt).toContain('Do not write a summary-only PR body.');
    expect(prPrompt).toContain('Why this PR: what triggered the work');
    expect(prPrompt).toContain('Problem: the specific broken, missing, confusing, or risky behavior');
    expect(prPrompt).toContain('How it was fixed: code-anchored bullets naming the main files/functions');
    expect(prPrompt).toContain('Validation: exact commands run and their pass/fail result');
    expect(prPrompt).toContain('Risks / follow-ups: unresolved risks, intentional non-goals');
    expect(prPrompt).toContain('Update `docs/features/migration_bug_fix/result.md`');
  });

  it('renders total-plan first prompt with phase-execution-compatible output variables', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Large Feature');
    const sourcePath = path.join('.playspec', 'tasks', 'active', taskId, 'sources', 'source_problem.md');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Large Feature',
      workflow: 'total-plan',
      variables: { SOURCE_PROBLEM_FILE: sourcePath },
      contextRefs: [{ path: sourcePath, role: 'source-problem', source: 'stdin' }],
    });
    await writeTextFile(path.join(workspace.dir, sourcePath), 'Build a large planning feature.\n');

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('TOTAL_SPEC_FILE=`docs/features/large_feature/large_feature_total_spec.md`');
    expect(prompt).toContain('PHASE_PLAN_FILE=`docs/features/large_feature/large_feature_phase_plan.md`');
    expect(prompt).toContain(`SOURCE_PROBLEM_FILE=\`${sourcePath}\``);
    expect(prompt).toContain('- `.playspec/tasks/active/large_feature/sources/source_problem.md`');
    expect(prompt).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('renders every total-plan phase template without unresolved placeholders', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Template Smoke');
    const sourcePath = path.join('.playspec', 'tasks', 'active', taskId, 'sources', 'source_problem.md');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Template Smoke',
      workflow: 'total-plan',
      variables: { SOURCE_PROBLEM_FILE: sourcePath },
      contextRefs: [{ path: sourcePath, role: 'source-problem', source: 'stdin' }],
    });
    await writeTextFile(path.join(workspace.dir, sourcePath), 'Smoke test all planning templates.\n');

    const core = new PlaySpecCore(workspace.dir, store);
    const phases = [
      'total_spec_draft',
      'total_spec_validate',
      'total_spec_patch',
      'phase_plan_create',
      'phase_plan_validate',
      'phase_plan_patch',
      'final_review',
    ];

    for (const phaseId of phases) {
      const prompt = await core.renderExplicitPhasePrompt(taskId, phaseId);
      expect(prompt).toContain('TOTAL_SPEC_FILE=`docs/features/template_smoke/template_smoke_total_spec.md`');
      expect(prompt).toContain('PHASE_PLAN_FILE=`docs/features/template_smoke/template_smoke_phase_plan.md`');
      expect(prompt).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });

  it('renders total-plan no-source fallback guidance', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('No Source Planning');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'No Source Planning',
      workflow: 'total-plan',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('SOURCE_PROBLEM_FILE=`(not provided)`');
    expect(prompt).toContain('(none)');
    expect(prompt).toContain('start from `TASK_TITLE` and the current repository code');
  });

  it('renders total-plan validation prompts with explicit 95 score routing rules', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Validation Rules');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Validation Rules',
      workflow: 'total-plan',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const totalSpecValidation = await core.renderExplicitPhasePrompt(taskId, 'total_spec_validate');
    const phasePlanValidation = await core.renderExplicitPhasePrompt(taskId, 'phase_plan_validate');

    for (const prompt of [totalSpecValidation, phasePlanValidation]) {
      expect(prompt).toContain('playspec complete --result approved');
      expect(prompt).toContain('readiness score is `>= 95`');
      expect(prompt).toContain('playspec complete --result needs_revision');
      expect(prompt).toContain('readiness score is below `95` or unresolved blockers remain');
    }
  });

  it('routes total-plan validation loops and stops at final review', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await initGitRepo();

    const taskId = slugify('Planning Routes');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Planning Routes',
      workflow: 'total-plan',
    });

    const core = new PlaySpecCore(workspace.dir, store);

    await store.updateTask(taskId, { currentPhase: 'total_spec_validate' });
    expect((await core.completePhase(taskId, { result: 'approved' })).nextPhase).toBe('phase_plan_create');

    await store.updateTask(taskId, { currentPhase: 'total_spec_validate' });
    expect((await core.completePhase(taskId, { result: 'needs_revision' })).nextPhase).toBe('total_spec_patch');

    await store.updateTask(taskId, { currentPhase: 'phase_plan_validate' });
    expect((await core.completePhase(taskId, { result: 'approved' })).nextPhase).toBe('final_review');

    await store.updateTask(taskId, { currentPhase: 'phase_plan_validate' });
    expect((await core.completePhase(taskId, { result: 'needs_revision' })).nextPhase).toBe('phase_plan_patch');

    await store.updateTask(taskId, { currentPhase: 'final_review' });
    const finalResult = await core.completePhase(taskId);
    expect(finalResult.nextPhase).toBeNull();
    expect(finalResult.status).toBe('completed');
  });

  it('uses total-plan output filenames for phase-execution creation context', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const planningTaskId = slugify('Compatible Planning');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: planningTaskId,
      title: 'Compatible Planning',
      workflow: 'total-plan',
    });
    await writeTextFile(
      path.join(workspace.dir, 'docs', 'features', planningTaskId, `${planningTaskId}_total_spec.md`),
      '# Total Spec\n'
    );
    await writeTextFile(
      path.join(workspace.dir, 'docs', 'features', planningTaskId, `${planningTaskId}_phase_plan.md`),
      '# Phase Plan\n'
    );
    await store.updateTask(planningTaskId, { status: 'completed', currentPhase: null });

    const createResult = await runCli([
      'create',
      'phase-execution',
      'Compatible Planning',
      '--phase',
      '2',
      '--from',
      planningTaskId,
    ]);
    expect(createResult.exitCode).toBe(0);

    const executionTask = await store.getTask(slugify('Compatible Planning Phase 2 Execution'));
    expect(executionTask.currentPhase).toBe('2');
    expect(executionTask.target).toEqual({ phaseNumber: '2' });
    expect(executionTask.contextRefs).toEqual([
      {
        path: 'docs/features/compatible_planning/compatible_planning_total_spec.md',
        role: 'planning-context',
        source: planningTaskId,
      },
      {
        path: 'docs/features/compatible_planning/compatible_planning_phase_plan.md',
        role: 'planning-context',
        source: planningTaskId,
      },
    ]);

    const promptResult = await runCli(['prompt', '--no-copy']);
    expect(promptResult.exitCode).toBe(0);
    expect(promptResult.stdout).toContain('Resolved phase: 2. Phase 2 — Implementation');
    expect(promptResult.stdout).toContain('Execute Phase 2 for compatible_planning.');
    expect(promptResult.stdout).toContain('**Feature:** compatible_planning');
    expect(promptResult.stdout).toContain('**Phase spec:** docs/compatible_planning/compatible_planning_phase2_implementation_spec.md');
    expect(promptResult.stdout).toContain('**Phase handoff:** docs/compatible_planning/compatible_planning_phase2_handoff.md');
  });

  it('rejects unknown phase-execution workflow before creating task state or changing HEAD', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const planningTaskId = slugify('Compatible Planning');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: planningTaskId,
      title: 'Compatible Planning',
      workflow: 'total-plan',
    });
    await writeTextFile(
      path.join(workspace.dir, 'docs', 'features', planningTaskId, `${planningTaskId}_total_spec.md`),
      '# Total Spec\n'
    );
    await writeTextFile(
      path.join(workspace.dir, 'docs', 'features', planningTaskId, `${planningTaskId}_phase_plan.md`),
      '# Phase Plan\n'
    );
    await store.updateTask(planningTaskId, { status: 'completed', currentPhase: null });
    await store.createTask({
      id: 'existing_head_task',
      title: 'Existing Head Task',
      workflow: 'mono-spec',
    });
    await writeTextFile(getHeadPath(workspace.dir), 'existing_head_task\n');

    const createResult = await runCli([
      'create',
      'Compatible Planning',
      '--workflow',
      'definitely-missing',
      '--phase',
      '2',
      '--from',
      planningTaskId,
    ]);

    await expect(access(path.join(workspace.dir, '.playspec', 'tasks', 'active', 'compatible_planning_phase_2_execution'))).rejects.toThrow();
    expect(await readFile(getHeadPath(workspace.dir), 'utf8')).toBe('existing_head_task\n');
    expect(createResult.exitCode).toBe(1);
    expect(createResult.stderr).toContain('Workflow file not found: definitely-missing');
    expect(createResult.stderr).toContain('list');
    expect(createResult.stderr).toContain('install');
  });

  it('fails when a workflow phase requires a missing variable', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
phaseOrder:
  - "1"
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
    requiredVariables:
      - FEATURE_SLUG
      - CUSTOM_REQUIRED
`
    );
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      '# {{TASK_TITLE}}\n'
    );

    const taskId = slugify('Missing Variable Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Missing Variable Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(
      MissingRequiredVariablesError
    );
  });

  it('renders a required TARGET_BRANCH from a workflow declaration default', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
phaseOrder:
  - "1"
variables:
  TARGET_BRANCH:
    default: origin/main
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
    requiredVariables:
      - TARGET_BRANCH
`
    );
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      'Target: {{TARGET_BRANCH}}\n'
    );

    const taskId = slugify('Target Branch Default Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Target Branch Default Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('Target: origin/main');
  });

  it('reports a missing required variable referenced indirectly by a default', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
phaseOrder:
  - "1"
variables:
  PROJECT_KEY:
    required: true
  OUTPUT_FILE:
    default: "docs/{{PROJECT_KEY}}/out.md"
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
`
    );
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      '# {{TASK_TITLE}}\n\nOutput: {{OUTPUT_FILE}}\n'
    );

    const taskId = slugify('Indirect Missing Variable Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Indirect Missing Variable Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(
      MissingRequiredVariablesError
    );
  });

  it('preserves workflow required metadata when a phase declaration only changes description', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
phaseOrder:
  - "1"
variables:
  PROJECT_KEY:
    required: true
    description: "Workflow project key"
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
    variables:
      PROJECT_KEY:
        description: "Phase-specific label"
`
    );
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      '# {{TASK_TITLE}}\n'
    );

    const taskId = slugify('Phase Description Required Metadata Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Phase Description Required Metadata Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(
      MissingRequiredVariablesError
    );
  });

  it('lets a phase declaration override a workflow default without restating required metadata', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
phaseOrder:
  - "1"
variables:
  PROJECT_KEY:
    required: true
    default: workflow-default
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
    variables:
      PROJECT_KEY:
        default: phase-default
`
    );
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      '# {{TASK_TITLE}}\n\nProject: {{PROJECT_KEY}}\n'
    );

    const taskId = slugify('Phase Default Override Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Phase Default Override Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('Project: phase-default');
  });

  it('allows an explicit phase required false declaration to relax workflow required metadata', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
phaseOrder:
  - "1"
variables:
  PROJECT_KEY:
    required: true
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
    variables:
      PROJECT_KEY:
        required: false
`
    );
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      '# {{TASK_TITLE}}\n'
    );

    const taskId = slugify('Phase Explicit Optional Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Phase Explicit Optional Task',
      workflow: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('# Phase Explicit Optional Task');
  });

  it('renders a required workflow variable default when the task variable is empty', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
phaseOrder:
  - "1"
variables:
  CUSTOM_REQUIRED:
    required: true
    default: resolved-default
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
`
    );
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      '# {{TASK_TITLE}}\n\nCustom: {{CUSTOM_REQUIRED}}\n'
    );

    const taskId = slugify('Defaulted Required Variable Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Defaulted Required Variable Task',
      workflow: 'multi-spec',
      variables: {
        CUSTOM_REQUIRED: '',
      },
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('Custom: resolved-default');
  });
});
