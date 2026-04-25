import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { MissingRequiredVariablesError } from '#core/errors.js';
import { slugify } from '#utils/slug.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

describe('PresetManager.initWorkspace — structure verification', () => {
  it('creates expected .playspec directory structure', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const ps = path.join(workspace.dir, '.playspec');
    await expect(access(path.join(ps, 'HEAD'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'config.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'workflows', 'multi-spec.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'templates'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'rules', 'global_rules.md'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'sessions', 'cli.default.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(ps, 'tasks', 'active'))).resolves.not.toThrow();
  });

  it('creates HEAD as an empty file on init', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const { readFile } = await import('node:fs/promises');
    const headContent = await readFile(getHeadPath(workspace.dir), 'utf8');
    expect(headContent.trim()).toBe('');
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
      workflowType: 'multi-spec',
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
      workflowType: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderExplicitPhasePrompt(taskId, '3');

    expect(prompt).toContain('my_task');
    expect(prompt).toContain('My Task');
    // PHASE_NUMBER should be resolved to 3
    expect(prompt).toMatch(/Phase 3/);
  });

  it('fails when a workflow phase requires a missing variable', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec.yaml'),
      `id: multi-spec
mode: linear
phaseOrder:
  - "1"
phases:
  "1":
    title: "Phase 1"
    template: multi-spec/phase_template.md
    requiredVariables:
      - FEATURE_SLUG
      - CUSTOM_REQUIRED
`
    );

    const taskId = slugify('Missing Variable Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Missing Variable Task',
      workflowType: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(
      MissingRequiredVariablesError
    );
  });
});
