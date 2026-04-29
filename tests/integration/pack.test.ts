import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');

let workspace: TempWorkspace;
let packRoot: string;
let dataRoot: string;

function runCli(args: string[], cwd = workspace.dir, env: NodeJS.ProcessEnv = {}) {
  return execa('npx', ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, ...args], {
    cwd,
    reject: false,
    env: {
      XDG_DATA_HOME: dataRoot,
      ...env,
    },
  });
}

beforeEach(async () => {
  workspace = await createTempWorkspace();
  packRoot = await mkdtemp(path.join(os.tmpdir(), 'playspec-pack-src-'));
  dataRoot = await mkdtemp(path.join(os.tmpdir(), 'playspec-pack-data-'));
  await new PresetManager().initWorkspace(workspace.dir, 'default');
  await writeCustomPack(packRoot);
});

afterEach(async () => {
  await workspace.cleanup();
  await rm(packRoot, { recursive: true, force: true });
  await rm(dataRoot, { recursive: true, force: true });
});

describe('workflow/template packs', () => {
  it('installs an external pack, creates a task with --pack, and renders pack variables/templates', async () => {
    const validate = await runCli(['pack', 'validate', packRoot]);
    expect(validate.exitCode).toBe(0);
    expect(validate.stdout).toContain('Valid pack: team-playbook@0.1.0');

    const install = await runCli(['pack', 'install', packRoot]);
    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain('Installed pack: team-playbook@0.1.0');
    expect(install.stdout).not.toContain('.playspec');

    const create = await runCli(['create', 'app-feature', 'Search Filters', '--pack', 'team-playbook']);
    expect(create.exitCode).toBe(0);
    expect(create.stdout).toContain('Workflow pack: team-playbook@0.1.0');

    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask('search_filters');
    expect(task.workflowPack).toEqual({ id: 'team-playbook', version: '0.1.0', source: 'user' });

    const prompt = await runCli(['prompt', '--print-only', '--quiet']);
    expect(prompt.exitCode).toBe(0);
    expect(prompt.stdout).toContain('TECH_SPEC_FILE=`docs/features/search_filters/search_filters_tech.md`');
    expect(prompt.stdout).toContain('Team rule included');
    expect(prompt.stdout).not.toMatch(/\{\{[^}]+\}\}/);
  }, 60_000);

  it('exports a shareable archive that can be installed in another workspace', async () => {
    expect((await runCli(['pack', 'install', packRoot])).exitCode).toBe(0);

    const archivePath = path.join(workspace.dir, 'team-playbook.tgz');
    const exported = await runCli(['pack', 'export', 'team-playbook', '--out', archivePath]);
    expect(exported.exitCode).toBe(0);
    expect(exported.stdout).toContain('Exported pack: team-playbook@0.1.0');

    const second = await createTempWorkspace();
    const secondDataRoot = await mkdtemp(path.join(os.tmpdir(), 'playspec-pack-data-'));
    try {
      await new PresetManager().initWorkspace(second.dir, 'default');
      const installArchive = await runCli(['pack', 'install', archivePath], second.dir, {
        XDG_DATA_HOME: secondDataRoot,
      });
      expect(installArchive.exitCode).toBe(0);
      expect(installArchive.stdout).toContain('Installed pack: team-playbook@0.1.0');

      const create = await runCli(['create', 'app-feature', 'Archive Install', '--pack', 'team-playbook'], second.dir, {
        XDG_DATA_HOME: secondDataRoot,
      });
      expect(create.exitCode).toBe(0);

      const prompt = await runCli(['prompt', '--print-only', '--quiet'], second.dir, {
        XDG_DATA_HOME: secondDataRoot,
      });
      expect(prompt.exitCode).toBe(0);
      expect(prompt.stdout).toContain('TECH_SPEC_FILE=`docs/features/archive_install/archive_install_tech.md`');
    } finally {
      await second.cleanup();
      await rm(secondDataRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it('keeps old default workflows renderable without workflowPack', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: 'old_task',
      title: 'Old Task',
      workflowType: 'mono-spec',
    });
    const taskYaml = await readFile(path.join(workspace.dir, '.playspec', 'tasks', 'active', 'old_task', 'task.yaml'), 'utf8');
    expect(taskYaml).not.toContain('workflowPack');

    const prompt = await runCli(['prompt', '--task', 'old_task', '--print-only', '--quiet']);
    expect(prompt.exitCode).toBe(0);
    expect(prompt.stdout).toContain('SPEC_FILE=`docs/features/old_task/spec.md`');
  });
});

async function writeCustomPack(root: string): Promise<void> {
  await mkdir(path.join(root, 'workflows'), { recursive: true });
  await mkdir(path.join(root, 'templates', 'app-feature'), { recursive: true });
  await mkdir(path.join(root, 'rules'), { recursive: true });

  await writeFile(path.join(root, 'playspec-pack.yaml'), [
    'schemaVersion: 1',
    'id: team-playbook',
    'name: Team Playbook',
    'version: 0.1.0',
    'description: Custom team workflow.',
    'variables:',
    '  TECH_SPEC_FILE:',
    '    default: "{{PROJECT_DOC_ROOT}}/{{FEATURE_SLUG}}_tech.md"',
    'workflows:',
    '  app-feature:',
    '    path: workflows/app-feature.yaml',
    'templates:',
    '  root: templates',
    'rules:',
    '  root: rules',
    '',
  ].join('\n'));

  await writeFile(path.join(root, 'workflows', 'app-feature.yaml'), [
    'id: app-feature',
    'mode: linear',
    'phaseOrder:',
    '  - draft',
    'phases:',
    '  draft:',
    '    title: Draft',
    '    template: app-feature/draft.md',
    '    requiredVariables:',
    '      - FEATURE_SLUG',
    '      - TECH_SPEC_FILE',
    '    outputs:',
    '      - "{{TECH_SPEC_FILE}}"',
    '',
  ].join('\n'));

  await writeFile(path.join(root, 'templates', 'app-feature', 'draft.md'), [
    '# Draft {{TASK_TITLE}}',
    '',
    '- TECH_SPEC_FILE=`{{TECH_SPEC_FILE}}`',
    '{{include:rules/global_rules.md}}',
    '',
  ].join('\n'));

  await writeFile(path.join(root, 'rules', 'global_rules.md'), 'Team rule included\n');
}
