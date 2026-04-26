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

  it('renderNextPrompt refuses if a stored contextRef path is missing', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Exec Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Exec Task',
      workflowType: 'multi-spec',
      contextRefs: [
        { path: 'docs/features/exec_task/nonexistent_spec.md', role: 'planning-context', source: 'planning_task' },
      ],
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const { MissingContextRefError } = await import('#core/errors.js');
    await expect(core.renderNextPrompt(taskId)).rejects.toThrow(MissingContextRefError);
  });

  it('renderNextPrompt succeeds when contextRefs is empty', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Normal Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Normal Task',
      workflowType: 'multi-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);
    expect(prompt).toBeTruthy();
  });

  it('renders mono-spec prompts with validation criteria and target branch guidance', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const taskId = slugify('Migration Bug Fix');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'Migration Bug Fix',
      workflowType: 'mono-spec',
    });

    const core = new PlaySpecCore(workspace.dir, store);
    const validationPrompt = await core.renderExplicitPhasePrompt(taskId, 'tech_spec_validate');
    expect(validationPrompt).toContain('해결 가능한 이슈');
    expect(validationPrompt).toContain('STEP_NUMBER=`2`');
    expect(validationPrompt).toContain('STEP_ID=`tech_spec_validate`');
    expect(validationPrompt).toContain(
      'migration_bug_fix_step2_tech_spec_validate_implementation_spec.md'
    );
    expect(validationPrompt).not.toContain('phasetech_spec_validate');
    expect(validationPrompt).toContain('아직 남는 blocker');
    expect(validationPrompt).toContain('Do not treat method, helper, interface, callback, or data-structure existence');
    expect(validationPrompt).toContain('active entry point -> state/data update -> propagation/callback/event -> reset/clear -> final user-visible behavior');

    const refactorPrompt = await core.renderExplicitPhasePrompt(taskId, 'safe_refactor');
    expect(refactorPrompt).toContain('TARGET_BRANCH=`origin/master`');
    expect(refactorPrompt).toContain('Compare against `origin/master`, not stale local assumptions.');

    const prPrompt = await core.renderExplicitPhasePrompt(taskId, 'pr_prepare');
    expect(prPrompt).toContain('TARGET_BRANCH=`origin/master`');
    expect(prPrompt).toContain('Current branch diff compared against `origin/master`');
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
