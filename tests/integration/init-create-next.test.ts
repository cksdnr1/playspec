import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { MissingRequiredVariablesError } from '#core/errors.js';
import { slugify } from '#utils/slug.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import { EvolutionHumanEditStore } from '#evolution/human-edit-store.js';
import type { EvolutionProposal, HumanEditObservation } from '#evolution/types.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');

let workspace: TempWorkspace;
let previousUserWorkflows: string | undefined;

function runCli(args: string[]) {
  return execa('npx', ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, ...args], {
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
    await expect(access(path.join(workspace.dir, 'user-workflows', 'mono-spec', 'workflow.yaml'))).resolves.not.toThrow();
    await expect(
      access(path.join(workspace.dir, 'user-workflows', 'mono-spec', 'templates', 'tech_spec_draft.md'))
    ).resolves.not.toThrow();
    await expect(access(path.join(workspace.dir, 'user-workflows', 'multi-spec', 'workflow.yaml'))).resolves.not.toThrow();
  });

  it('creates HEAD as an empty file on init', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    const { readFile } = await import('node:fs/promises');
    const headContent = await readFile(getHeadPath(workspace.dir), 'utf8');
    expect(headContent.trim()).toBe('');
  });

  it('does not overwrite already installed workflows on init', async () => {
    const workflowDir = path.join(workspace.dir, 'user-workflows', 'mono-spec');
    const workflowFile = path.join(workflowDir, 'workflow.yaml');
    const customWorkflow = 'id: mono-spec\nmode: linear\nphaseOrder: []\nphases: {}\n';
    await mkdir(workflowDir, { recursive: true });
    await writeFile(workflowFile, customWorkflow, 'utf8');

    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

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
    expect(rootHelp.stdout).toContain('close');
    expect(rootHelp.stdout).toMatch(/^\s+archive\b/m);
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
  }, 30_000);

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
  });

  it('fails when a workflow phase requires a missing variable', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');

    await writeTextFile(
      path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
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
      path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'multi-spec', 'templates', 'phase_template.md'),
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
});
