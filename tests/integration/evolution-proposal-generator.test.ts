import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { generateEvolutionProposal } from '#evolution/proposal-generator.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import type { EvolutionProposal } from '#evolution/types.js';
import { writeTextFile } from '#utils/fs.js';
import {
  getEvolutionApplyReportPath,
  getEvolutionProposalPath,
  getEvolutionProposalRevisionPath,
} from '#utils/paths.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function initWorkspaceWithTask(taskId = 'generator_task') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title: 'Generator Task',
    workflow: 'multi-spec',
  });
  return { core: new PlaySpecCore(workspace.dir, store), taskId };
}

async function writeEvidence(pathName = 'docs/evidence/generator.md'): Promise<string> {
  await writeTextFile(path.join(workspace.dir, pathName), '# Generator Evidence\n');
  return pathName;
}

function makeInput(taskId: string, evidencePath: string, overrides = {}) {
  return {
    taskId,
    evidencePath,
    targetPath: 'docs/features/generator/spec.md',
    summary: 'Generate proposal draft.',
    rationale: 'Evidence shows the workflow needs an update.',
    generatedId: 'generated_proposal',
    ...overrides,
  };
}

describe('generateEvolutionProposal', () => {
  it('stores generated proposals through schema validation and proposal store paths', async () => {
    const { taskId } = await initWorkspaceWithTask();
    const evidencePath = await writeEvidence();

    const result = await generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath, {
      riskLevel: 'low',
    }));
    const stored = parseYaml(await readFile(getEvolutionProposalPath(workspace.dir, 'generated_proposal'), 'utf8')) as EvolutionProposal;

    expect(result.proposal.id).toBe('generated_proposal');
    expect(result.proposal.status).toBe('pending');
    expect(result.proposal.revision).toBe(1);
    expect(stored.source).toEqual({
      taskId,
      artifactRefs: [],
      generationSource: 'cli',
    });
    expect(stored.evidenceRefs).toEqual([
      expect.objectContaining({
        path: evidencePath,
        note: 'Generate proposal draft.',
        source: 'generated',
      }),
    ]);
    expect(stored.actions).toEqual([
      expect.objectContaining({
        actionId: 'generated_proposal',
        type: 'propose_file_change',
        targetPath: 'docs/features/generator/spec.md',
      }),
    ]);
    await expect(access(result.validationPath)).resolves.toBeUndefined();
  });

  it('rejects duplicate active target overlap for new generated proposals', async () => {
    const { taskId } = await initWorkspaceWithTask();
    const evidencePath = await writeEvidence();
    await generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath));

    await expect(generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath, {
      generatedId: 'generated_duplicate',
    }))).rejects.toThrow('Active evolution proposal already targets docs/features/generator/spec.md');
  });

  it('updates existing active proposals through revision-preserving update', async () => {
    const { taskId } = await initWorkspaceWithTask();
    const evidencePath = await writeEvidence();
    const store = new EvolutionProposalStore(workspace.dir);
    const original = await generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath));
    const secondEvidencePath = await writeEvidence('docs/evidence/generator-second.md');

    const updated = await generateEvolutionProposal(workspace.dir, makeInput(taskId, secondEvidencePath, {
      proposalId: original.proposal.id,
      summary: 'Refine generated proposal.',
      rationale: 'Additional evidence narrows the proposal.',
      riskLevel: 'high',
    }));
    const revision = parseYaml(await readFile(
      getEvolutionProposalRevisionPath(workspace.dir, original.proposal.id, 1),
      'utf8'
    )) as EvolutionProposal;
    const loaded = await store.loadProposal(original.proposal.id);

    expect(updated.proposal.revision).toBe(2);
    expect(updated.revisionPath).toBe(getEvolutionProposalRevisionPath(workspace.dir, original.proposal.id, 1));
    expect(revision).toEqual(original.proposal);
    expect(loaded.riskLevel).toBe('high');
    expect(loaded.evidenceRefs.map((ref) => ref.path)).toEqual([
      evidencePath,
      secondEvidencePath,
    ]);
  });

  it('rejects generated updates to non-active proposals', async () => {
    const { taskId } = await initWorkspaceWithTask();
    const evidencePath = await writeEvidence();
    const generated = await generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath));
    await new EvolutionProposalStore(workspace.dir).skipProposal(generated.proposal.id);

    await expect(generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath, {
      proposalId: generated.proposal.id,
    }))).rejects.toThrow('Only pending/refining proposals can be changed');
  });

  it('blocks generation while the harness circuit breaker is active', async () => {
    const { core, taskId } = await initWorkspaceWithTask();
    const evidencePath = await writeEvidence();
    await core.recordHarnessAttempt(taskId, '1', 'failure');
    await core.recordHarnessAttempt(taskId, '1', 'failure');
    await core.recordHarnessAttempt(taskId, '1', 'failure');

    await expect(generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath))).rejects.toThrow(
      `Evolution generation is blocked for task "${taskId}" phase "1".`
    );
    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'proposals'))).rejects.toThrow();
  });

  it('does not mutate target files or create apply reports during generation', async () => {
    const { taskId } = await initWorkspaceWithTask();
    const evidencePath = await writeEvidence();
    const targetPath = path.join(workspace.dir, 'docs/features/generator/spec.md');
    await writeTextFile(targetPath, '# Original Spec\n');

    await generateEvolutionProposal(workspace.dir, makeInput(taskId, evidencePath));

    expect(await readFile(targetPath, 'utf8')).toBe('# Original Spec\n');
    await expect(access(getEvolutionApplyReportPath(workspace.dir, 'generated_proposal', '20260503t000000z'))).rejects.toThrow();
    await expect(access(path.join(workspace.dir, '.playspec', 'evolution', 'backups'))).rejects.toThrow();
  });
});
