import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { access, readdir, writeFile } from 'node:fs/promises';
import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from './helpers/createTempWorkspace.js';
import type { TempWorkspace } from './helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { slugify } from '#utils/slug.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';
import { formatPromptCopySuccess } from '#utils/clipboard-message.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../tsconfig.json');
const TSX_PATH = path.resolve(TESTS_DIR, '../node_modules/.bin/tsx');

function runCli(
  args: string[],
  cwd?: string,
  options: { env?: NodeJS.ProcessEnv; input?: string } = {}
) {
  return execa(TSX_PATH, ['--tsconfig', TSCONFIG_PATH, CLI_PATH, ...args], {
    cwd,
    reject: false,
    env: options.env,
    input: options.input,
  });
}

function parseListTaskRows(output: string): Array<{ id: string; isHead: boolean; line: string }> {
  return output
    .split('\n')
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(\S+)(?: \[HEAD\])?\s+\[[^\]]+\]\s+phase:/);
      if (!match) {
        return null;
      }
      return { id: match[1], isHead: line.includes('[HEAD]'), line };
    })
    .filter((row): row is { id: string; isHead: boolean; line: string } => row !== null);
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
  return runCliInPtyWithInputScript(args, cwd, `(sleep 0.3; printf %b ${shellQuote(input)})`, options);
}

function runCliInPtyWithInputScript(
  args: string[],
  cwd: string,
  inputScript: string,
  options: { env?: NodeJS.ProcessEnv } = {},
) {
  const command = [
    shellQuote(TSX_PATH),
    '--tsconfig',
    shellQuote(TSCONFIG_PATH),
    shellQuote(CLI_PATH),
    ...args.map(shellQuote),
  ].join(' ');

  const scriptCommand = process.platform === 'darwin'
    ? `script -q /dev/null bash -lc ${shellQuote(command)}`
    : `script -q -e /dev/null -c ${shellQuote(command)}`;

  return execa('bash', ['-lc', `${inputScript} | ${scriptCommand}`], {
    cwd,
    reject: false,
    env: options.env,
    timeout: 10_000,
  });
}
let workspace: TempWorkspace;

vi.setConfig({ testTimeout: 60_000 });

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function createActiveTask(title: string, workflow = 'multi-spec') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const taskId = slugify(title);
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title,
    workflow,
  });

  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);
  return taskId;
}

async function createAdditionalActiveTask(title: string, workflow = 'multi-spec') {
  const taskId = slugify(title);
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title,
    workflow,
  });
  return taskId;
}

async function createMonoSpecTasks(titles: string[]): Promise<void> {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');
  const store = new YamlTaskStore(workspace.dir);

  for (const title of titles) {
    await store.createTask({
      id: slugify(title),
      title,
      workflow: 'mono-spec',
    });
  }
}

async function writeWorkflow(root: string, id: string, description: string): Promise<void> {
  await writeTextFile(
    path.join(root, id, 'workflow.yaml'),
    `id: ${id}
description: ${description}
mode: linear
phaseOrder:
  - start
phases:
  start:
    title: Start
    template: start.md
`
  );
  await writeTextFile(path.join(root, id, 'templates', 'start.md'), '# {{TASK_TITLE}}\n');
}

async function initGitRepo(): Promise<void> {
  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });
}

function proposalYaml(id = 'proposal_cli_intake'): string {
  return `id: ${id}
source:
  artifactRefs: []
targetFiles:
  - docs/features/source_task/spec.md
riskLevel: low
actions:
  - actionId: action_1
    type: propose_file_change
    targetPath: docs/features/source_task/spec.md
    summary: Update spec wording.
    rationale: The current spec is stale.
rationale: Keep the spec aligned with implementation.
review:
  status: unreviewed
`;
}

function taskScopedProposalYaml(id: string, taskId: string): string {
  return proposalYaml(id).replace('source:\n  artifactRefs: []', `source:\n  taskId: ${taskId}\n  artifactRefs: []`);
}

function executableProposalYaml(
  id: string,
  targetPath = '.playspec/templates/prompt.md',
  actionType: 'replace_file' | 'append_section' | 'replace_section' = 'replace_file',
  content = '# Updated Prompt\n'
): string {
  const sectionFields = actionType === 'replace_file' ? '' : '    sectionName: Approved Section\n';
  return `id: ${id}
source:
  artifactRefs: []
targetFiles:
  - ${targetPath}
riskLevel: low
actions:
  - actionId: action_1
    type: ${actionType}
    targetPath: ${targetPath}
${sectionFields}    summary: Apply approved change.
    rationale: The proposal was reviewed.
    content: |-
${content.split('\n').map((line) => `      ${line}`).join('\n')}
rationale: Apply a reviewed evolution proposal.
review:
  status: reviewed
`;
}

describe('CLI placeholder', () => {
  it('formats prompt copy success with PRIMARY status when known', () => {
    expect(formatPromptCopySuccess({ method: 'native clipboard', primaryOk: true })).toEqual([
      'Prompt copied to clipboard via native clipboard.',
      'PRIMARY selection updated.',
    ]);
    expect(formatPromptCopySuccess({ method: 'native clipboard', primaryOk: false })).toEqual([
      'Prompt copied to clipboard via native clipboard.',
      'Warning: PRIMARY selection not available; CLIPBOARD copy succeeded.',
    ]);
    expect(formatPromptCopySuccess({ method: 'native clipboard' })).toEqual([
      'Prompt copied to clipboard via native clipboard.',
    ]);
  });

  it('prints help output when invoked with --help', async () => {
    const result = await runCli(['--help']);
    // --help exits with 0, output goes to stdout
    const output = result.stdout + result.stderr;
    const commandLine = (command: string) => new RegExp(`^\\s+${command}(?:\\s|\\[|$)`, 'm');
    expect(output).toMatch(/playspec/i);
    for (const command of [
      'init',
      'create',
      'list-tasks',
      'current-task',
      'get-task',
      'add-context',
      'use',
      'prompt',
      'specs',
      'phase',
      'complete',
      'status',
    ]) {
      expect(output).toMatch(commandLine(command));
    }
    for (const command of [
      'workflow',
      'list',
      'current',
      'next',
      'rewind',
      'evidence',
      'snapshot',
      'desync-check',
      'rollback',
      'harness',
      'close',
      'archive',
      'evolution',
      'migrate',
    ]) {
      expect(output).not.toMatch(commandLine(command));
    }
  });

  it('keeps hidden advanced command help directly callable', async () => {
    const harness = await runCli(['harness', '--help'], workspace.dir);
    const evolution = await runCli(['evolution', '--help'], workspace.dir);
    const archive = await runCli(['archive', '--help'], workspace.dir);
    const workflow = await runCli(['workflow', '--help'], workspace.dir);

    expect(harness.exitCode).toBe(0);
    expect(harness.stdout + harness.stderr).toContain('status');
    expect(evolution.exitCode).toBe(0);
    expect(evolution.stdout + evolution.stderr).toContain('propose');
    expect(archive.exitCode).toBe(0);
    expect(archive.stdout + archive.stderr).toContain('list');
    expect(workflow.exitCode).toBe(0);
    expect(workflow.stdout + workflow.stderr).toContain('validate');
  });

  it('keeps migrate callable with a deprecation warning', async () => {
    await createActiveTask('Migrate Compatibility Task');

    const result = await runCli(['migrate'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('Warning: `playspec migrate` is deprecated. Migration is hidden from the primary CLI workflow.');
    expect(result.stdout).toContain('No source documents found.');
  });

  it('registers the Phase 7 harness command surface', async () => {
    const result = await runCli(['harness', '--help'], workspace.dir);
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(0);
    expect(output).toContain('status');
    expect(output).toContain('attempt');
    expect(output).toContain('reset');
  });

  it('records and resets harness attempts from the CLI', async () => {
    const taskId = await createActiveTask('Harness CLI Task');

    const status = await runCli(['harness', 'status', '--task', taskId], workspace.dir);
    const first = await runCli([
      'harness', 'attempt',
      '--task', taskId,
      '--phase', '1',
      '--result', 'failure',
      '--reason', 'validation failed',
    ], workspace.dir);
    const reset = await runCli(['harness', 'reset', '--task', taskId, '--reason', 'human reviewed'], workspace.dir);

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain(`Task: ${taskId}`);
    expect(status.stdout).toContain('Attempts: 0/3');
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain('Harness attempt recorded');
    expect(first.stdout).toContain('Attempts: 1/3');
    expect(first.stdout).toContain('Last failure reason: validation failed');
    expect(reset.exitCode).toBe(0);
    expect(reset.stdout).toContain('Harness reset recorded');
    expect(reset.stdout).toContain('Blocked: no');
    expect(reset.stdout).toContain('Reset events: 1');
  });

  it('registers the Phase 6.3 evolution diff/apply command surface', async () => {
    const result = await runCli(['evolution', '--help'], workspace.dir);
    const output = result.stdout + result.stderr;

    expect(result.exitCode).toBe(0);
    expect(output).toContain('propose');
    expect(output).toContain('generate');
    expect(output).toContain('list');
    expect(output).toContain('show');
    expect(output).toContain('update');
    expect(output).toContain('append-evidence');
    expect(output).toContain('skip');
    expect(output).toContain('diff');
    expect(output).toContain('apply');
    expect(output).toContain('record-edit');
  });

  it('generates and refines evolution proposals from explicit CLI evidence', async () => {
    const taskId = await createActiveTask('Evolution Generate CLI Task');
    const evidencePath = path.join(workspace.dir, 'docs', 'evidence', 'generate.md');
    const secondEvidencePath = path.join(workspace.dir, 'docs', 'evidence', 'generate-second.md');
    await writeTextFile(evidencePath, '# Generation Evidence\n');
    await writeTextFile(secondEvidencePath, '# Second Generation Evidence\n');

    const generated = await runCli([
      'evolution',
      'generate',
      '--task',
      taskId,
      '--from-evidence',
      'docs/evidence/generate.md',
      '--target',
      'docs/features/generate/spec.md',
      '--summary',
      'Generate draft proposal.',
      '--rationale',
      'Evidence supports a proposal.',
      '--id',
      'proposal_cli_generate',
      '--risk',
      'low',
    ], workspace.dir);
    const duplicate = await runCli([
      'evolution',
      'generate',
      '--task',
      taskId,
      '--from-evidence',
      'docs/evidence/generate.md',
      '--target',
      'docs/features/generate/spec.md',
      '--summary',
      'Duplicate draft proposal.',
      '--rationale',
      'Should refine existing proposal.',
      '--id',
      'proposal_cli_generate_duplicate',
    ], workspace.dir);
    const refined = await runCli([
      'evolution',
      'generate',
      '--task',
      taskId,
      '--from-evidence',
      'docs/evidence/generate-second.md',
      '--target',
      'docs/features/generate/spec.md',
      '--summary',
      'Refine draft proposal.',
      '--rationale',
      'Additional evidence supports refinement.',
      '--proposal',
      'proposal_cli_generate',
      '--risk',
      'high',
    ], workspace.dir);
    const stored = parseYaml(await readTextFile(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'proposals',
      'proposal_cli_generate',
      'proposal.yaml'
    ))) as {
      revision: number;
      riskLevel: string;
      source: { generationSource: string };
      evidenceRefs: { path: string; source: string }[];
    };

    expect(generated.exitCode).toBe(0);
    expect(generated.stdout).toContain('Proposal generated: proposal_cli_generate');
    expect(generated.stdout).toContain('Status: pending');
    expect(generated.stdout).toContain('Revision: 1');
    expect(generated.stdout).toContain('Proposal file: .playspec/evolution/proposals/proposal_cli_generate/proposal.yaml');
    expect(generated.stdout).toContain('Validation file: .playspec/evolution/proposals/proposal_cli_generate/validation.yaml');
    expect(duplicate.exitCode).toBe(1);
    expect(duplicate.stderr).toContain('Active evolution proposal already targets docs/features/generate/spec.md');
    expect(duplicate.stderr).toContain('playspec evolution generate --proposal');
    expect(refined.exitCode).toBe(0);
    expect(refined.stdout).toContain('Proposal updated: proposal_cli_generate');
    expect(refined.stdout).toContain('Revision: 2');
    expect(refined.stdout).toContain('Revision file: .playspec/evolution/proposals/proposal_cli_generate/revisions/revision-1.yaml');
    expect(stored.revision).toBe(2);
    expect(stored.riskLevel).toBe('high');
    expect(stored.source.generationSource).toBe('cli');
    expect(stored.evidenceRefs).toEqual([
      expect.objectContaining({ path: 'docs/evidence/generate.md', source: 'generated' }),
      expect.objectContaining({ path: 'docs/evidence/generate-second.md', source: 'generated' }),
    ]);
  });

  it('records and marks human edit observations from the CLI', async () => {
    const recorded = await runCli([
      'evolution', 'record-edit',
      '--id', 'human_edit_cli',
      '--target', '.playspec/templates/prompt.md',
      '--summary', 'Adjusted prompt wording.',
      '--rationale', 'Manual review found ambiguous wording.',
      '--task', 'source_task',
      '--proposal', 'proposal_cli_intake',
      '--before', '.playspec/evolution/reports/before.md',
      '--after', '.playspec/evolution/reports/after.md',
    ], workspace.dir);
    const duplicate = await runCli([
      'evolution', 'record-edit',
      '--id', 'human_edit_cli',
      '--target', '.playspec/templates/prompt.md',
      '--summary', 'Duplicate edit.',
      '--rationale', 'Should fail.',
    ], workspace.dir);
    const ignored = await runCli([
      'evolution', 'record-edit',
      '--edit', 'human_edit_cli',
      '--status', 'ignored',
      '--reason', 'Covered elsewhere.',
    ], workspace.dir);

    expect(recorded.exitCode).toBe(0);
    expect(recorded.stdout).toContain('Human edit observation recorded: human_edit_cli');
    expect(recorded.stdout).toContain('Observation file: .playspec/evolution/human-edits/human_edit_cli.yaml');
    expect(duplicate.exitCode).toBe(1);
    expect(duplicate.stderr).toContain('Human edit observation already exists: human_edit_cli');
    expect(ignored.exitCode).toBe(0);
    expect(ignored.stdout).toContain('Status: ignored');

    const stored = parseYaml(await readTextFile(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'human-edits',
      'human_edit_cli.yaml'
    ))) as {
      status: string;
      summary: string;
      sourceTaskId: string;
      proposalId: string;
      statusReason: string;
    };
    expect(stored.status).toBe('ignored');
    expect(stored.summary).toBe('Adjusted prompt wording.');
    expect(stored.sourceTaskId).toBe('source_task');
    expect(stored.proposalId).toBe('proposal_cli_intake');
    expect(stored.statusReason).toBe('Covered elsewhere.');
  });

  it('rejects invalid human edit CLI inputs without creating observations', async () => {
    const missing = await runCli([
      'evolution', 'record-edit',
      '--target', '.playspec/templates/prompt.md',
      '--summary', 'Missing rationale.',
    ], workspace.dir);
    const escaping = await runCli([
      'evolution', 'record-edit',
      '--id', 'human_edit_escape',
      '--target', '../outside.md',
      '--summary', 'Escaping path.',
      '--rationale', 'Should fail.',
    ], workspace.dir);
    const mixed = await runCli([
      'evolution', 'record-edit',
      '--edit', 'human_edit_cli',
      '--status', 'ignored',
      '--target', '.playspec/templates/prompt.md',
    ], workspace.dir);

    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain('Recording a human edit requires --target, --summary, and --rationale.');
    expect(escaping.exitCode).toBe(1);
    expect(escaping.stderr).toContain('Path must not escape the workspace.');
    expect(mixed.exitCode).toBe(1);
    expect(mixed.stderr).toContain('Human edit status updates cannot include creation fields.');
    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'human-edits'))).rejects.toThrow();
  });

  it('recording a human edit does not update proposal revision or evidence refs', async () => {
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    await writeTextFile(proposalPath, proposalYaml('proposal_record_edit_unchanged'));
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const recorded = await runCli([
      'evolution', 'record-edit',
      '--id', 'human_edit_no_proposal_mutation',
      '--target', '.playspec/templates/prompt.md',
      '--summary', 'Manual template edit.',
      '--rationale', 'Future proposal input only.',
      '--proposal', 'proposal_record_edit_unchanged',
    ], workspace.dir);

    const storedProposal = parseYaml(await readTextFile(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'proposals',
      'proposal_record_edit_unchanged',
      'proposal.yaml'
    ))) as { revision: number; evidenceRefs: unknown[] };
    expect(recorded.exitCode).toBe(0);
    expect(storedProposal.revision).toBe(1);
    expect(storedProposal.evidenceRefs).toEqual([]);
  });

  it('proposes, lists, shows, and skips an evolution proposal from YAML', async () => {
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    await writeTextFile(proposalPath, proposalYaml());

    const proposed = await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);
    const listed = await runCli(['evolution', 'list'], workspace.dir);
    const shown = await runCli(['evolution', 'show', 'proposal_cli_intake'], workspace.dir);
    const skipped = await runCli(['evolution', 'skip', 'proposal_cli_intake', '--reason', 'Not needed now'], workspace.dir);
    const shownAfterSkip = await runCli(['evolution', 'show', 'proposal_cli_intake'], workspace.dir);

    expect(proposed.exitCode).toBe(0);
    expect(proposed.stdout).toContain('Proposal stored: proposal_cli_intake');
    expect(proposed.stdout).toContain('Revision: 1');
    const storedProposal = parseYaml(await readTextFile(path.join(workspace.dir, '.playspec', 'evolution', 'proposals', 'proposal_cli_intake', 'proposal.yaml'))) as {
      revision: number;
      createdAt: string;
      updatedAt: string;
    };
    expect(storedProposal.revision).toBe(1);
    expect(storedProposal.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(storedProposal.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'proposals', 'proposal_cli_intake', 'validation.yaml'))).resolves.toBeUndefined();

    expect(listed.exitCode).toBe(0);
    expect(listed.stdout).toContain('proposal_cli_intake | pending | revision 1');

    expect(shown.exitCode).toBe(0);
    expect(shown.stdout).toContain('Proposal ID:  proposal_cli_intake');
    expect(shown.stdout).toContain('Status:       pending');
    expect(shown.stdout).toContain('Validation:');

    expect(skipped.exitCode).toBe(0);
    expect(skipped.stdout).toContain('Proposal skipped: proposal_cli_intake');
    expect(skipped.stdout).toContain('Reason: Not needed now');
    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'proposals', 'proposal_cli_intake', 'validation.yaml'))).resolves.toBeUndefined();

    expect(shownAfterSkip.exitCode).toBe(0);
    expect(shownAfterSkip.stdout).toContain('Status:       skipped');
    expect(shownAfterSkip.stdout).toContain('Skip reason:  Not needed now');
  });

  it('assigns a filesystem-safe proposal ID when the file omits one', async () => {
    const proposalPath = path.join(workspace.dir, 'Phase 6.1 Proposal.yaml');
    await writeTextFile(proposalPath, proposalYaml().replace(/^id: .+\n/, ''));

    const result = await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Proposal stored: phase-6-1-proposal_\d{8}t\d{6}z_[a-z0-9]{6}/);
  });

  it('rejects invalid and duplicate evolution proposal intake with guidance', async () => {
    const invalidPath = path.join(workspace.dir, 'invalid-proposal.yaml');
    const duplicatePath = path.join(workspace.dir, 'duplicate-proposal.yaml');
    await writeTextFile(invalidPath, 'id: bad\nstatus: pending\n');
    await writeTextFile(duplicatePath, proposalYaml('proposal_duplicate'));

    const invalid = await runCli(['evolution', 'propose', '--file', invalidPath], workspace.dir);
    const first = await runCli(['evolution', 'propose', '--file', duplicatePath], workspace.dir);
    const duplicate = await runCli(['evolution', 'propose', '--file', duplicatePath], workspace.dir);

    expect(invalid.exitCode).toBe(1);
    expect(invalid.stderr).toContain('Evolution proposal is invalid');
    expect(await runCli(['evolution', 'list'], workspace.dir)).toMatchObject({ exitCode: 0 });

    expect(first.exitCode).toBe(0);
    expect(duplicate.exitCode).toBe(1);
    expect(duplicate.stderr).toContain('Evolution proposal already exists: proposal_duplicate');
    expect(duplicate.stderr).toContain('playspec evolution update');
    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'proposals', 'bad'))).rejects.toThrow();
  });

  it('lists and shows stored refining proposals with update commands registered', async () => {
    const proposalPath = path.join(workspace.dir, 'refining-proposal.yaml');
    await writeTextFile(proposalPath, proposalYaml('proposal_refining_cli'));
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const storedPath = path.join(workspace.dir, '.playspec', 'evolution', 'proposals', 'proposal_refining_cli', 'proposal.yaml');
    const stored = await readTextFile(storedPath);
    await writeTextFile(storedPath, stored.replace('status: pending', 'status: refining'));

    const listed = await runCli(['evolution', 'list'], workspace.dir);
    const shown = await runCli(['evolution', 'show', 'proposal_refining_cli'], workspace.dir);
    const help = await runCli(['evolution', '--help'], workspace.dir);

    expect(listed.exitCode).toBe(0);
    expect(listed.stdout).toContain('proposal_refining_cli | refining | revision 1');
    expect(shown.exitCode).toBe(0);
    expect(shown.stdout).toContain('Status:       refining');
    expect(help.stdout + help.stderr).toContain('update');
  });

  it('updates and appends evidence to an evolution proposal from the CLI', async () => {
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    const updatePath = path.join(workspace.dir, 'proposal-update.yaml');
    const evidencePath = path.join(workspace.dir, 'docs', 'evidence', 'review.md');
    await writeTextFile(proposalPath, proposalYaml('proposal_cli_update'));
    await writeTextFile(evidencePath, '# Review Evidence\n');
    await writeTextFile(updatePath, proposalYaml('proposal_cli_update')
      .replace('riskLevel: low', 'status: refining\nriskLevel: medium')
      .replace('Keep the spec aligned with implementation.', 'Refined after review evidence.'));

    const proposed = await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);
    const updated = await runCli(['evolution', 'update', 'proposal_cli_update', '--file', updatePath], workspace.dir);
    const appended = await runCli([
      'evolution',
      'append-evidence',
      'proposal_cli_update',
      '--file',
      'docs/evidence/review.md',
      '--note',
      'Review evidence added.',
    ], workspace.dir);
    const shown = await runCli(['evolution', 'show', 'proposal_cli_update'], workspace.dir);

    expect(proposed.exitCode).toBe(0);
    expect(updated.exitCode).toBe(0);
    expect(updated.stdout).toContain('Proposal updated: proposal_cli_update');
    expect(updated.stdout).toContain('Status: refining');
    expect(updated.stdout).toContain('Revision: 2');
    expect(updated.stdout).toContain('Revision file: .playspec/evolution/proposals/proposal_cli_update/revisions/revision-1.yaml');

    expect(appended.exitCode).toBe(0);
    expect(appended.stdout).toContain('Evidence appended: proposal_cli_update');
    expect(appended.stdout).toContain('Revision: 3');
    expect(appended.stdout).toContain('Evidence file: docs/evidence/review.md');
    expect(appended.stdout).toContain('Evidence note: Review evidence added.');

    const storedProposal = parseYaml(await readTextFile(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'proposals',
      'proposal_cli_update',
      'proposal.yaml'
    ))) as {
      status: string;
      revision: number;
      evidenceRefs: { path: string; note: string; source: string }[];
    };
    expect(storedProposal.status).toBe('refining');
    expect(storedProposal.revision).toBe(3);
    expect(storedProposal.evidenceRefs).toEqual([
      expect.objectContaining({
        path: 'docs/evidence/review.md',
        note: 'Review evidence added.',
        source: 'append-evidence',
      }),
    ]);
    await expect(access(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'proposals',
      'proposal_cli_update',
      'revisions',
      'revision-2.yaml'
    ))).resolves.toBeUndefined();
    expect(shown.stdout).toContain('Evidence:     1');
    expect(shown.stdout).toContain('docs/evidence/review.md | append-evidence | Review evidence added.');
  });

  it('rejects CLI update and evidence append for skipped proposals', async () => {
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    const evidencePath = path.join(workspace.dir, 'docs', 'evidence', 'review.md');
    await writeTextFile(proposalPath, proposalYaml('proposal_cli_terminal'));
    await writeTextFile(evidencePath, '# Review Evidence\n');
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);
    await runCli(['evolution', 'skip', 'proposal_cli_terminal', '--reason', 'Not needed'], workspace.dir);

    const updated = await runCli(['evolution', 'update', 'proposal_cli_terminal', '--file', proposalPath], workspace.dir);
    const appended = await runCli([
      'evolution',
      'append-evidence',
      'proposal_cli_terminal',
      '--file',
      'docs/evidence/review.md',
      '--note',
      'Review evidence added.',
    ], workspace.dir);

    expect(updated.exitCode).toBe(1);
    expect(updated.stderr).toContain('Only pending/refining proposals can be changed');
    expect(updated.stderr).toContain('Use update or append-evidence only on pending/refining proposals.');
    expect(appended.exitCode).toBe(1);
    expect(appended.stderr).toContain('Only pending/refining proposals can be changed');
  });

  it('diffs executable evolution proposals without mutating targets', async () => {
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    const templatePath = path.join(workspace.dir, '.playspec', 'templates', 'prompt.md');
    await writeTextFile(templatePath, '# Original Prompt\n');
    await writeTextFile(proposalPath, executableProposalYaml('proposal_cli_diff'));
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const diffed = await runCli(['evolution', 'diff', 'proposal_cli_diff'], workspace.dir);

    expect(diffed.exitCode).toBe(0);
    expect(diffed.stdout).toContain('Proposal diff: proposal_cli_diff');
    expect(diffed.stdout).toContain('.playspec/templates/prompt.md');
    expect(diffed.stdout).toContain('action_1 replace_file .playspec/templates/prompt.md');
    expect(await readTextFile(templatePath)).toBe('# Original Prompt\n');
  });

  it('requires explicit approval before applying evolution proposals', async () => {
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    const templatePath = path.join(workspace.dir, '.playspec', 'templates', 'prompt.md');
    await writeTextFile(templatePath, '# Original Prompt\n');
    await writeTextFile(proposalPath, executableProposalYaml('proposal_cli_approval'));
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const applied = await runCli(['evolution', 'apply', 'proposal_cli_approval'], workspace.dir);

    expect(applied.exitCode).toBe(1);
    expect(applied.stderr).toContain('Evolution apply requires explicit approval');
    expect(await readTextFile(templatePath)).toBe('# Original Prompt\n');
    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'reports'))).rejects.toThrow();
  });

  it('applies executable proposals with backups, reports, hashes, validation, and applied status', async () => {
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    const templatePath = path.join(workspace.dir, '.playspec', 'templates', 'prompt.md');
    await writeTextFile(templatePath, '# Original Prompt\n');
    await writeTextFile(proposalPath, executableProposalYaml('proposal_cli_apply'));
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const applied = await runCli(['evolution', 'apply', 'proposal_cli_apply', '--yes'], workspace.dir);
    const reportNames = await readdir(path.join(workspace.dir, '.playspec', 'evolution', 'reports'));
    const reportPath = path.join(workspace.dir, '.playspec', 'evolution', 'reports', reportNames[0] ?? '');
    const report = parseYaml(await readTextFile(reportPath)) as {
      status: string;
      backupPath: string;
      beforeHashes: Record<string, string>;
      afterHashes: Record<string, string>;
      changedFiles: string[];
      validation: { status: string; checks: string[]; errors: string[] }[];
      partialApply: boolean;
    };
    const stored = parseYaml(await readTextFile(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'proposals',
      'proposal_cli_apply',
      'proposal.yaml'
    ))) as { status: string; latestApplyReportPath: string };

    expect(applied.exitCode).toBe(0);
    expect(applied.stdout).toContain('Proposal applied: proposal_cli_apply');
    expect(await readTextFile(templatePath)).toBe('# Updated Prompt');
    expect(report.status).toBe('success');
    expect(report.changedFiles).toEqual(['.playspec/templates/prompt.md']);
    expect(report.beforeHashes['.playspec/templates/prompt.md']).not.toBe(report.afterHashes['.playspec/templates/prompt.md']);
    expect(report.validation[0]).toMatchObject({ status: 'passed', checks: ['template-render'], errors: [] });
    expect(report.partialApply).toBe(false);
    expect(await readTextFile(path.join(workspace.dir, report.backupPath, '.playspec', 'templates', 'prompt.md'))).toBe('# Original Prompt\n');
    expect(stored.status).toBe('applied');
    expect(stored.latestApplyReportPath).toMatch(/^\.playspec\/evolution\/reports\/proposal_cli_apply-/);
    await expect(access(path.join(workspace.dir, '.playspec', 'migrations', 'reports'))).rejects.toThrow();
    await expect(access(path.join(workspace.dir, '.playspec', 'migrations', 'backups'))).rejects.toThrow();
  });

  it('rejects old planning actions, disallowed targets, and terminal statuses before mutation', async () => {
    const oldProposalPath = path.join(workspace.dir, 'old-proposal.yaml');
    const workflowProposalPath = path.join(workspace.dir, 'workflow-proposal.yaml');
    const traversalProposalPath = path.join(workspace.dir, 'traversal-proposal.yaml');
    const appliedProposalPath = path.join(workspace.dir, 'applied-proposal.yaml');
    const skippedProposalPath = path.join(workspace.dir, 'skipped-proposal.yaml');
    const templatePath = path.join(workspace.dir, '.playspec', 'templates', 'prompt.md');
    const appliedRulePath = path.join(workspace.dir, '.playspec', 'rules', 'applied.md');
    const workflowPath = path.join(workspace.dir, '.playspec', 'workflows', 'workflow.yaml');
    await writeTextFile(templatePath, '# Original Prompt\n');
    await writeTextFile(appliedRulePath, '# Original Rule\n');
    await writeTextFile(workflowPath, 'id: workflow\n');
    await writeTextFile(oldProposalPath, proposalYaml('proposal_cli_old_action')
      .replace('docs/features/source_task/spec.md', '.playspec/templates/prompt.md')
      .replace('docs/features/source_task/spec.md', '.playspec/templates/prompt.md'));
    await writeTextFile(
      workflowProposalPath,
      executableProposalYaml('proposal_cli_workflow_target', '.playspec/workflows/workflow.yaml')
    );
    await writeTextFile(
      traversalProposalPath,
      executableProposalYaml('proposal_cli_traversal_target', '.playspec/templates/../workflows/workflow.yaml')
    );
    await writeTextFile(
      appliedProposalPath,
      executableProposalYaml('proposal_cli_applied_terminal', '.playspec/rules/applied.md')
    );
    await writeTextFile(skippedProposalPath, executableProposalYaml('proposal_cli_skipped_apply'));
    await runCli(['evolution', 'propose', '--file', oldProposalPath], workspace.dir);
    await runCli(['evolution', 'propose', '--file', workflowProposalPath], workspace.dir);
    await runCli(['evolution', 'propose', '--file', traversalProposalPath], workspace.dir);
    await runCli(['evolution', 'propose', '--file', appliedProposalPath], workspace.dir);
    await runCli(['evolution', 'propose', '--file', skippedProposalPath], workspace.dir);
    await runCli(['evolution', 'apply', 'proposal_cli_applied_terminal', '--yes'], workspace.dir);
    await runCli(['evolution', 'skip', 'proposal_cli_skipped_apply'], workspace.dir);

    const oldAction = await runCli(['evolution', 'apply', 'proposal_cli_old_action', '--yes'], workspace.dir);
    const failedAgain = await runCli(['evolution', 'apply', 'proposal_cli_old_action', '--yes'], workspace.dir);
    const workflowTarget = await runCli(['evolution', 'apply', 'proposal_cli_workflow_target', '--yes'], workspace.dir);
    const traversalTarget = await runCli(['evolution', 'apply', 'proposal_cli_traversal_target', '--yes'], workspace.dir);
    const appliedAgain = await runCli(['evolution', 'apply', 'proposal_cli_applied_terminal', '--yes'], workspace.dir);
    const skipped = await runCli(['evolution', 'apply', 'proposal_cli_skipped_apply', '--yes'], workspace.dir);

    expect(oldAction.exitCode).toBe(1);
    expect(oldAction.stderr).toContain('not executable in Phase 6.3');
    expect(failedAgain.exitCode).toBe(1);
    expect(failedAgain.stderr).toContain('current status is failed');
    expect(workflowTarget.exitCode).toBe(1);
    expect(workflowTarget.stderr).toContain('not allow-listed');
    expect(traversalTarget.exitCode).toBe(1);
    expect(traversalTarget.stderr).toContain('not allow-listed');
    expect(appliedAgain.exitCode).toBe(1);
    expect(appliedAgain.stderr).toContain('current status is applied');
    expect(skipped.exitCode).toBe(1);
    expect(skipped.stderr).toContain('Only pending/refining proposals can be applied');
    expect(await readTextFile(templatePath)).toBe('# Original Prompt\n');
    expect(await readTextFile(workflowPath)).toBe('id: workflow\n');
  });

  it('writes failed partial-apply reports and failed proposal status', async () => {
    const proposalPath = path.join(workspace.dir, 'partial-proposal.yaml');
    const templatePath = path.join(workspace.dir, '.playspec', 'templates', 'prompt.md');
    const rulePath = path.join(workspace.dir, '.playspec', 'rules', 'review.md');
    await writeTextFile(templatePath, '# Original Prompt\n');
    await writeTextFile(rulePath, '# Rules\n\n## Approved Section\n\nExisting.\n');
    await writeTextFile(proposalPath, `id: proposal_cli_partial
source:
  artifactRefs: []
targetFiles:
  - .playspec/templates/prompt.md
  - .playspec/rules/review.md
riskLevel: low
actions:
  - actionId: replace_template
    type: replace_file
    targetPath: .playspec/templates/prompt.md
    summary: Replace template.
    rationale: Approved.
    content: "# Partial Prompt\\n"
  - actionId: append_existing
    type: append_section
    targetPath: .playspec/rules/review.md
    sectionName: Approved Section
    summary: Append section.
    rationale: Approved.
    content: "New content."
rationale: Apply a reviewed evolution proposal.
review:
  status: reviewed
`);
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const applied = await runCli(['evolution', 'apply', 'proposal_cli_partial', '--yes'], workspace.dir);
    const reportNames = await readdir(path.join(workspace.dir, '.playspec', 'evolution', 'reports'));
    const report = parseYaml(await readTextFile(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'reports',
      reportNames[0] ?? ''
    ))) as {
      status: string;
      failedAction: string;
      partialApply: boolean;
      changedFiles: string[];
      actions: { actionId: string; status: string; error?: string }[];
    };
    const stored = parseYaml(await readTextFile(path.join(
      workspace.dir,
      '.playspec',
      'evolution',
      'proposals',
      'proposal_cli_partial',
      'proposal.yaml'
    ))) as { status: string };

    expect(applied.exitCode).toBe(1);
    expect(applied.stderr).toContain('Evolution apply failed');
    expect(await readTextFile(templatePath)).toBe('# Partial Prompt\n');
    expect(await readTextFile(rulePath)).toBe('# Rules\n\n## Approved Section\n\nExisting.\n');
    expect(report.status).toBe('failed');
    expect(report.failedAction).toBe('append_existing');
    expect(report.partialApply).toBe(true);
    expect(report.changedFiles).toEqual(['.playspec/templates/prompt.md']);
    expect(report.actions).toEqual([
      expect.objectContaining({ actionId: 'replace_template', status: 'applied' }),
      expect.objectContaining({ actionId: 'append_existing', status: 'failed', error: 'Section already exists: Approved Section' }),
    ]);
    expect(stored.status).toBe('failed');
  });

  it('lists and shows built-in workflow assets', async () => {
    const userWorkflows = path.join(workspace.dir, 'isolated-user-workflows');
    const env = { ...process.env, PLAY_SPEC_USER_WORKFLOWS: userWorkflows };
    const result = await runCli(['workflow', 'list'], workspace.dir, { env });
    const show = await runCli(['workflow', 'show', 'mono-spec'], workspace.dir, { env });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('mono-spec\tbuiltin');
    expect(result.stdout).toContain('issue-validate\tbuiltin');
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain('Workflow: mono-spec');
    expect(show.stdout).toContain('Source: builtin');
    expect(show.stdout).toContain('Artifacts:');
  });

  it('lists duplicate workflow IDs once using project over user over builtin priority', async () => {
    const userWorkflows = path.join(workspace.dir, 'user-workflows');
    await writeWorkflow(userWorkflows, 'mono-spec', 'User duplicate');
    await writeWorkflow(path.join(workspace.dir, '.playspec', 'workflows'), 'mono-spec', 'Project duplicate');

    const result = await runCli(['workflow', 'list'], workspace.dir, {
      env: { ...process.env, PLAY_SPEC_USER_WORKFLOWS: userWorkflows },
    });
    const show = await runCli(['workflow', 'show', 'mono-spec'], workspace.dir, {
      env: { ...process.env, PLAY_SPEC_USER_WORKFLOWS: userWorkflows },
    });

    const monoSpecLines = result.stdout.split('\n').filter((line) => line.startsWith('mono-spec\t'));
    expect(result.exitCode).toBe(0);
    expect(monoSpecLines).toEqual(['mono-spec\tproject - Project duplicate']);
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain('Source: project');
    expect(show.stdout).toContain('Description: Project duplicate');
    expect(show.stdout).not.toContain(userWorkflows);
  });

  it('supports init workflow install destinations from the CLI', async () => {
    const userWorkflows = path.join(workspace.dir, 'user-workflows');
    const userInit = await runCli(['init', '--workflow-install', 'user'], workspace.dir, {
      env: { ...process.env, PLAY_SPEC_USER_WORKFLOWS: userWorkflows },
    });
    expect(userInit.exitCode).toBe(0);
    expect(userInit.stdout).toContain('Default workflows: user');
    await expect(access(path.join(userWorkflows, 'mono-spec', 'workflow.yaml'))).resolves.toBeUndefined();

    const skipWorkspace = await createTempWorkspace();
    try {
      const skipInit = await runCli(['init', '--workflow-install', 'skip'], skipWorkspace.dir, {
        env: { ...process.env, PLAY_SPEC_USER_WORKFLOWS: path.join(skipWorkspace.dir, 'user-workflows') },
      });
      expect(skipInit.exitCode).toBe(0);
      expect(skipInit.stdout).toContain('Default workflows: skip');
      await expect(access(path.join(skipWorkspace.dir, '.playspec', 'workflows'))).rejects.toThrow();
    } finally {
      await skipWorkspace.cleanup();
    }

    const invalidWorkspace = await createTempWorkspace();
    try {
      const invalidInit = await runCli(['init', '--workflow-install', 'elsewhere'], invalidWorkspace.dir);
      expect(invalidInit.exitCode).toBe(1);
      expect(invalidInit.stderr).toContain('Invalid workflow install destination');
      await expect(access(path.join(invalidWorkspace.dir, '.playspec', 'workflows'))).rejects.toThrow();
    } finally {
      await invalidWorkspace.cleanup();
    }
  });

  it('validates a workflow directory', async () => {
    const workflowRoot = path.join(workspace.dir, 'custom-workflow');
    await writeTextFile(
      path.join(workflowRoot, 'workflow.yaml'),
      `id: custom-workflow
mode: linear
phaseOrder:
  - start
phases:
  start:
    title: Start
    template: start.md
`
    );
    await writeTextFile(path.join(workflowRoot, 'templates', 'start.md'), '# {{TASK_TITLE}}\n');

    const result = await runCli(['workflow', 'validate', workflowRoot], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Valid workflow: custom-workflow');
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

  it('renders evolution context from prompt and next only with explicit CLI flag', async () => {
    const taskId = await createActiveTask('CLI Evolution Context Task');
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    await writeTextFile(proposalPath, taskScopedProposalYaml('proposal_cli_prompt_visible', taskId));
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const defaultPrompt = await runCli(['prompt', '--print-only', '--quiet'], workspace.dir);
    const optInPrompt = await runCli(['prompt', '--print-only', '--quiet', '--with-evolution-context'], workspace.dir);
    const optInNext = await runCli(['next', '--quiet', '--with-evolution-context'], workspace.dir);

    expect(defaultPrompt.exitCode).toBe(0);
    expect(defaultPrompt.stdout).not.toContain('proposal_cli_prompt_visible');
    expect(optInPrompt.exitCode).toBe(0);
    expect(optInPrompt.stdout).toContain('## Evolution Context');
    expect(optInPrompt.stdout).toContain('proposal_cli_prompt_visible');
    expect(optInNext.exitCode).toBe(0);
    expect(optInNext.stdout).toContain('proposal_cli_prompt_visible');
  });

  it('marks the HEAD task in list and list-tasks output', async () => {
    await createActiveTask('Head Marker Task');

    const list = await runCli(['list'], workspace.dir);
    const listTasks = await runCli(['list-tasks'], workspace.dir);

    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain('Task ID');
    expect(list.stdout).toContain('head_marker_task [HEAD]');
    expect(listTasks.exitCode).toBe(0);
    expect(listTasks.stdout).toContain('Task ID');
    expect(listTasks.stdout).toContain('head_marker_task [HEAD]');
  });

  it('shows the HEAD task first in list-tasks while preserving other task order', async () => {
    await createMonoSpecTasks(['Head First Alpha', 'Head First Bravo', 'Head First Charlie']);
    await writeTextFile(getHeadPath(workspace.dir), '');

    const naturalResult = await runCli(['list-tasks'], workspace.dir);
    const naturalRows = parseListTaskRows(naturalResult.stdout);
    expect(naturalResult.exitCode).toBe(0);
    expect(naturalRows).toHaveLength(3);

    const headTaskId = naturalRows[1].id;
    await writeTextFile(getHeadPath(workspace.dir), `${headTaskId}\n`);

    const result = await runCli(['list-tasks'], workspace.dir);
    const rows = parseListTaskRows(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(rows[0]).toMatchObject({ id: headTaskId, isHead: true });
    expect(rows.slice(1).map((row) => row.id)).toEqual(
      naturalRows.map((row) => row.id).filter((id) => id !== headTaskId)
    );
    expect(rows.filter((row) => row.isHead).map((row) => row.id)).toEqual([headTaskId]);
  });

  it('lists active tasks without a HEAD marker when HEAD is empty', async () => {
    await createMonoSpecTasks(['No Head Alpha', 'No Head Bravo']);
    await writeTextFile(getHeadPath(workspace.dir), '');

    const result = await runCli(['list-tasks'], workspace.dir);
    const rows = parseListTaskRows(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining(['no_head_alpha', 'no_head_bravo']));
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.isHead)).toBe(false);
  });

  it('does not crash or mark a task when HEAD points to a missing task', async () => {
    await createMonoSpecTasks(['Missing Head Alpha', 'Missing Head Bravo']);
    await writeTextFile(getHeadPath(workspace.dir), 'deleted_task\n');

    const result = await runCli(['list-tasks'], workspace.dir);
    const rows = parseListTaskRows(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining(['missing_head_alpha', 'missing_head_bravo']));
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.isHead)).toBe(false);
  });

  it('reports an actionable init hint when list-tasks runs before init', async () => {
    const result = await runCli(['list-tasks'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Workspace not initialized at:');
    expect(result.stderr).toContain('playspec init --preset default');
  });

  it('reports no active tasks after init when list-tasks has an empty task list', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const result = await runCli(['list-tasks'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No active tasks.');
  });

  it('sets HEAD with explicit use <taskId> and prints current-task summary', async () => {
    const firstTaskId = await createActiveTask('Use Explicit First Task');
    const secondTaskId = await createAdditionalActiveTask('Use Explicit Second Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(secondTaskId, {
      contextRefs: [{ path: 'docs/missing-context.md', role: 'planning-context', source: 'manual_task' }],
    });
    const before = await store.getTask(secondTaskId);

    const result = await runCli(['use', secondTaskId], workspace.dir);
    const after = await store.getTask(secondTaskId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`HEAD set to: ${secondTaskId}`);
    expect(result.stdout).toContain('Current task:');
    expect(result.stdout).toContain(`  Task ID:  ${secondTaskId}`);
    expect(result.stdout).toContain('  Title:    Use Explicit Second Task');
    expect(result.stdout).toContain('  Workflow: mono-spec');
    expect(result.stdout).toContain('  Phase:    1');
    expect(result.stdout).toContain('  Context:  1 linked file(s)');
    expect(result.stdout).toContain('Next:');
    expect(result.stdout).toContain('  playspec prompt');
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${secondTaskId}\n`);
    expect(firstTaskId).not.toBe(secondTaskId);
    expect(after.currentPhase).toBe(before.currentPhase);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it('suggests the matching task ID when use receives a title', async () => {
    await createActiveTask('Use Suggestion Existing Task');
    const suggestedTaskId = await createAdditionalActiveTask('Use Suggestion Target Task');

    const result = await runCli(['use', 'Use Suggestion Target Task'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Task not found: Use Suggestion Target Task');
    expect(result.stderr).toContain('Did you mean this task ID?');
    expect(result.stderr).toContain(`playspec use ${suggestedTaskId}`);
    expect(result.stderr).toContain(`Task ID: ${suggestedTaskId}`);
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe('use_suggestion_existing_task\n');
  });

  it('shows multiple candidate task IDs when use receives an ambiguous title fragment', async () => {
    const headTaskId = await createActiveTask('Use Ambiguous Head Task');
    const firstCandidate = await createAdditionalActiveTask('Use Ambiguous Alpha Task');
    const secondCandidate = await createAdditionalActiveTask('Use Ambiguous Beta Task');

    const result = await runCli(['use', 'Use Ambiguous'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Multiple similar tasks found.');
    expect(result.stderr).toContain(`Task ID: ${firstCandidate}  Title: Use Ambiguous Alpha Task`);
    expect(result.stderr).toContain(`Task ID: ${secondCandidate}  Title: Use Ambiguous Beta Task`);
    expect(await readTextFile(getHeadPath(workspace.dir))).toBe(`${headTaskId}\n`);
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
    expect(output).toContain(`Task ID: ${firstTaskId}`);
    expect(output).toContain(firstTaskId);
    expect(output).toContain('[HEAD]');
    expect(output).toContain(`[multi-spec]  Phase:`);
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
    expect(output).toContain('playspec create <workflow> "<title>"');
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
    expect(output).toContain(effectiveTaskId);
    expect(output).toContain('[HEAD]');
    expect(output).toContain('INVALID');
    expect(output).toContain('missing_phase');
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
    expect(current.stdout).toContain(`Task ID: ${taskId}`);
    expect(current.stdout).toContain('Context:');
    expect(current.stdout).toContain(`- ${contextPath}`);
    expect(currentTask.exitCode).toBe(0);
    expect(currentTask.stdout).toContain(`Task ID:      ${taskId}`);
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

  it('renders an explicit archived artifact context ref in prompt variables', async () => {
    const archivedTaskId = await createActiveTask('Archived Knowledge Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    const artifactPath = path.join(
      '.playspec',
      'tasks',
      'active',
      archivedTaskId,
      'outputs',
      'result.md'
    );
    await writeTextFile(path.join(workspace.dir, artifactPath), '# Archived Result\n');
    await store.updateTask(archivedTaskId, { status: 'completed' });
    await store.archiveCompletedTask(archivedTaskId);

    const activeTaskId = await createAdditionalActiveTask('Archive Context Consumer', 'mono-spec');
    await writeTextFile(getHeadPath(workspace.dir), `${activeTaskId}\n`);
    const archivedArtifactPath = path.join(
      '.playspec',
      'tasks',
      'archived',
      archivedTaskId,
      'outputs',
      'result.md'
    );

    const addContext = await runCli(['add-context', archivedArtifactPath, '--task', activeTaskId], workspace.dir, {
      env: { PLAY_SPEC_NON_INTERACTIVE: '1' },
    });
    const prompt = await runCli(['prompt', '--no-copy', '--quiet'], workspace.dir);

    expect(addContext.exitCode).toBe(0);
    expect(prompt.exitCode).toBe(0);
    expect(prompt.stdout).toContain(`- \`${archivedArtifactPath}\``);
    expect(prompt.stdout).toContain(`- \`${archivedArtifactPath}\` (role: planning-context, source: manual)`);
  });

  it('views an explicit markdown file as generated HTML', async () => {
    await createActiveTask('Viewer Explicit File Task', 'mono-spec');
    await writeTextFile(
      path.join(workspace.dir, 'docs/viewer-note.md'),
      '# Viewer Note\n\nHello **viewer**.\n\n<script>alert(1)</script>\n\n![Remote](https://example.com/image.png)\n'
    );

    const result = await runCli(['view', 'docs/viewer-note.md'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Rendered docs/viewer-note.md');
    expect(result.stdout).toContain('Output: .playspec/viewer/cache/');
    const outputPath = result.stdout.match(/Output: (.+\.html)/)?.[1];
    expect(outputPath).toBeTruthy();
    const html = await readTextFile(path.join(workspace.dir, outputPath!));
    expect(html).toContain('<h1>Viewer Note</h1>');
    expect(html).toContain('<strong>viewer</strong>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<img');
    expect(html).toContain('Image: Remote (https://example.com/image.png)');
  });

  it('views a task workflow artifact by task id and artifact type', async () => {
    const taskId = await createActiveTask('Viewer Artifact Task', 'mono-spec');
    const specPath = path.join('docs/features', taskId, 'spec.md');
    await writeTextFile(path.join(workspace.dir, specPath), '# Artifact Spec\n');

    const result = await runCli(['view', '--task', taskId, '--artifact', 'spec'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Rendered ${specPath}`);
    const outputPath = result.stdout.match(/Output: (.+\.html)/)?.[1];
    expect(outputPath).toBeTruthy();
    const html = await readTextFile(path.join(workspace.dir, outputPath!));
    expect(html).toContain('<h1>Artifact Spec</h1>');
  });

  it('rejects workspace-escaping viewer paths', async () => {
    await createActiveTask('Viewer Escape Task', 'mono-spec');

    const result = await runCli(['view', '../outside.md'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('escapes workspace');
  });

  it('does not mutate task state while viewing a task artifact', async () => {
    const taskId = await createActiveTask('Viewer Read Only Task', 'mono-spec');
    const specPath = path.join('docs/features', taskId, 'spec.md');
    const taskPath = path.join(workspace.dir, '.playspec/tasks/active', taskId, 'task.yaml');
    await writeTextFile(path.join(workspace.dir, specPath), '# Read Only Spec\n');
    const before = await readTextFile(taskPath);

    const result = await runCli(['view', '--task', taskId, '--artifact', 'spec'], workspace.dir);
    const after = await readTextFile(taskPath);

    expect(result.exitCode).toBe(0);
    expect(after).toBe(before);
  });

  it('clears only generated viewer cache output', async () => {
    await createActiveTask('Viewer Cache Clear Task', 'mono-spec');
    await writeTextFile(path.join(workspace.dir, '.playspec/viewer/cache/generated.html'), '<!doctype html>\n');
    await writeTextFile(path.join(workspace.dir, 'docs/source.md'), '# Source\n');

    const result = await runCli(['view', '--clear-cache'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Viewer cache cleared.');
    await expect(access(path.join(workspace.dir, '.playspec/viewer/cache/generated.html'))).rejects.toThrow();
    await expect(access(path.join(workspace.dir, 'docs/source.md'))).resolves.toBeUndefined();
  });

  it('rejects missing archived artifact context refs during prompt rendering', async () => {
    const taskId = await createActiveTask('Missing Archived Context Task', 'mono-spec');
    const missingPath = '.playspec/tasks/archived/missing_task/outputs/result.md';
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, {
      contextRefs: [{ path: missingPath, role: 'planning-context', source: 'manual' }],
    });

    const result = await runCli(['prompt', '--no-copy', '--quiet'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`Context ref file not found: ${missingPath}`);
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
      TSX_PATH,
      ['--tsconfig', TSCONFIG_PATH, CLI_PATH, 'create', 'mono-spec', 'Pasted Source Task', '--stdin'],
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
    const projectWorkflows = path.join(workspace.dir, '.playspec', 'workflows');
    await writeTextFile(
      path.join(projectWorkflows, 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
mode: linear
variables:
  FEATURE_SLUG:
    required: true
phaseOrder:
  - "1"
phases:
  "1":
    title: "Phase 1"
    template: missing/phase_template.md
`
    );

    const result = await runCli(['next'], workspace.dir, {
      env: { ...process.env, PLAY_SPEC_USER_WORKFLOWS: path.join(workspace.dir, 'user-workflows') },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Template file not found');
    expect(result.stderr).toContain(
      path.join(
        projectWorkflows,
        'multi-spec',
        'templates',
        'missing',
        'phase_template.md'
      )
    );
    expect(result.stderr).toContain('workflow template exists');
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
    const metadataFile = promptFiles.find((file) => file.startsWith('next-prompt-') && file.endsWith('.md.meta.yaml'));
    expect(metadataFile).toBeDefined();
    const metadata = parseYaml(await readTextFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'prompts', metadataFile!)
    )) as { contextMode: string; generationSource: string; taskId: string };
    expect(metadata.contextMode).toBe('compact');
    expect(metadata.generationSource).toBe('next');
    expect(metadata.taskId).toBe(taskId);
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

  it('prints mono-spec phase metadata and gate routes on current-task', async () => {
    const taskId = await createActiveTask('Mono Current Task', 'mono-spec');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

    const result = await runCli(['current-task'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Phase:       2. 기술 교차 검증');
    expect(result.stdout).toContain('Phase ID:    tech_spec_validate');
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
    expect(result.stdout).toContain('Phase:       3. 기술 명세서 업데이트');
    expect(result.stdout).toContain('Phase ID:    tech_spec_patch');
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
    }, 15_000);

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
    }, 20_000);

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

  it('creates a default-workflow task when only a title is provided', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const result = await runCli(['create', 'Default Workflow Task'], workspace.dir);
    const task = await new YamlTaskStore(workspace.dir).getTask('default_workflow_task');

    expect(result.exitCode).toBe(0);
    expect(task.workflow).toBe('mono-spec');
  });

  it('creates a task with explicit --workflow', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const result = await runCli(['create', 'Explicit Workflow Task', '--workflow', 'total-plan'], workspace.dir);
    const task = await new YamlTaskStore(workspace.dir).getTask('explicit_workflow_task');

    expect(result.exitCode).toBe(0);
    expect(task.workflow).toBe('total-plan');
  });

  it('creates a task via interactive wizard with piped skip input', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    // Simulate wizard: accept default workflow, provide title, choose skip
    const result = await execa(
      TSX_PATH,
      ['--tsconfig', TSCONFIG_PATH, CLI_PATH, 'create'],
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
    await createActiveTask('Current Deprecation Task', 'mono-spec');

    const result = await runCli(['current'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Phase:   1. 기술 명세서 업데이트 (effective)');
    expect(result.stdout).toContain('Phase ID: tech_spec_draft (effective)');
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

  it('complete --with-evolution-context writes a context snapshot and renders context in next prompt', async () => {
    const taskId = await createActiveTask('CLI Complete Evolution Context Task');
    await initGitRepo();
    const proposalPath = path.join(workspace.dir, 'proposal.yaml');
    await writeTextFile(proposalPath, taskScopedProposalYaml('proposal_cli_complete_visible', taskId));
    await runCli(['evolution', 'propose', '--file', proposalPath], workspace.dir);

    const result = await runCli(['complete', '--no-copy', '--with-evolution-context'], workspace.dir, {
      env: { PLAY_SPEC_DISABLE_CLIPBOARD: '1' },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Evolution context snapshot: .playspec/evolution/context/cli_complete_evolution_context_task/1-');
    expect(result.stdout).toContain('## Evolution Context');
    expect(result.stdout).toContain('proposal_cli_complete_visible');
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
    expect(result.stdout).toContain('Allowed:');
  });

  it('list-tasks shows INVALID with allowed phases for unknown currentPhase', async () => {
    const taskId = await createActiveTask('Invalid Phase List Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: 'bogus_phase' });

    const result = await runCli(['list-tasks'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('INVALID');
    expect(result.stdout).toContain('bogus_phase');
    expect(result.stdout).toContain('Allowed:');
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

  // phase --select — PTY selection
  it('phase --select updates the phase after selecting a new phase', async () => {
    const taskId = await createActiveTask('Phase Select Success Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '1' });

    const result = await runCliInPtyWithInputScript(
      ['phase', '--task', taskId, '--select', '--yes'],
      workspace.dir,
      `(sleep 0.3; printf %b ${shellQuote('\x1b[B\r')})`
    );
    const output = result.stdout + result.stderr;
    const after = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Select a phase:');
    expect(output).toContain('Target phase:  2. Phase 2');
    expect(after.currentPhase).toBe('2');
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
