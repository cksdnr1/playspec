import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { EvolutionProposalSchema } from '#evolution/schemas.js';
import {
  EvolutionProposalStore,
  generateEvolutionProposalId,
} from '#evolution/proposal-store.js';
import type {
  EvolutionProposal,
  EvolutionProposalValidationReport,
} from '#evolution/types.js';
import { writeTextFile } from '#utils/fs.js';
import {
  getEvolutionProposalPath,
  getEvolutionProposalRoot,
  getEvolutionProposalValidationPath,
} from '#utils/paths.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

function makeProposal(overrides: Partial<EvolutionProposal> = {}): EvolutionProposal {
  return {
    id: 'proposal_20260503_001',
    createdAt: '2026-05-03T00:00:00.000Z',
    status: 'pending',
    source: {
      taskId: 'source_task',
      artifactRefs: [],
    },
    targetFiles: ['docs/features/source_task/spec.md'],
    riskLevel: 'medium',
    actions: [
      {
        actionId: 'action_1',
        type: 'propose_file_change',
        targetPath: 'docs/features/source_task/spec.md',
        summary: 'Update spec wording.',
        rationale: 'The current spec is stale.',
        proposedContent: '# Updated Spec\n',
      },
    ],
    rationale: 'Keep the spec aligned with implementation.',
    review: {
      status: 'unreviewed',
    },
    ...overrides,
  };
}

function makeReport(proposalId: string): EvolutionProposalValidationReport {
  return {
    proposalId,
    createdAt: '2026-05-03T00:01:00.000Z',
    status: 'valid',
    errors: [],
    warnings: [],
    checkedPaths: ['docs/features/source_task/spec.md'],
    summary: 'Proposal is valid.',
  };
}

describe('EvolutionProposalSchema', () => {
  it('rejects unknown action types', () => {
    const proposal = makeProposal({
      actions: [
        {
          actionId: 'action_1',
          type: 'apply_file_change',
          targetPath: 'docs/features/source_task/spec.md',
          summary: 'Apply now.',
          rationale: 'This should not be executable.',
        } as unknown as EvolutionProposal['actions'][number],
      ],
    });

    expect(() => EvolutionProposalSchema.parse(proposal)).toThrow();
  });

  it('rejects workspace-escaping target and artifact paths', () => {
    expect(() => EvolutionProposalSchema.parse(makeProposal({
      targetFiles: ['../outside.md'],
    }))).toThrow();

    expect(() => EvolutionProposalSchema.parse(makeProposal({
      source: {
        taskId: 'source_task',
        artifactRefs: [
          {
            path: '../outside.md',
            role: 'archived-artifact',
          },
        ],
      },
    }))).toThrow();
  });

  it('rejects invalid proposal IDs', () => {
    expect(() => EvolutionProposalSchema.parse(makeProposal({
      id: '../bad',
    }))).toThrow();
  });
});

describe('EvolutionProposalStore', () => {
  it('persists and reloads validated proposal and validation report records', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal();
    const report = makeReport(proposal.id);

    const proposalPath = await store.saveProposal(proposal);
    const reportPath = await store.saveValidationReport(report);
    const loadedProposal = await store.loadProposal(proposal.id);
    const loadedReport = await store.loadValidationReport(proposal.id);

    expect(proposalPath).toBe(getEvolutionProposalPath(workspace.dir, proposal.id));
    expect(reportPath).toBe(getEvolutionProposalValidationPath(workspace.dir, proposal.id));
    expect(loadedProposal).toEqual(proposal);
    expect(loadedReport).toEqual(report);
  });

  it('updates skipped status while preserving proposal ID and validation report', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal();
    const report = makeReport(proposal.id);

    await store.saveProposal(proposal);
    await store.saveValidationReport(report);

    const updated = await store.updateProposalStatus(proposal.id, 'skipped', {
      skippedAt: '2026-05-03T00:02:00.000Z',
      skipReason: 'Not needed.',
    });
    const loadedReport = await store.loadValidationReport(proposal.id);

    expect(updated.id).toBe(proposal.id);
    expect(updated.status).toBe('skipped');
    expect(updated.skippedAt).toBe('2026-05-03T00:02:00.000Z');
    expect(updated.skipReason).toBe('Not needed.');
    expect(loadedReport).toEqual(report);
    await expect(access(getEvolutionProposalValidationPath(workspace.dir, proposal.id))).resolves.toBeUndefined();
  });

  it('accepts explicit archived artifact references without copying artifacts', async () => {
    const archivedPath = '.playspec/tasks/archived/done_task/outputs/result.md';
    await writeTextFile(path.join(workspace.dir, archivedPath), '# Archived Result\n');

    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal({
      source: {
        taskId: 'source_task',
        archivedTaskId: 'done_task',
        artifactRefs: [
          {
            path: archivedPath,
            role: 'archived-artifact',
            archivedTaskId: 'done_task',
          },
        ],
      },
    });

    await store.saveProposal(proposal);

    const proposalDir = getEvolutionProposalRoot(workspace.dir, proposal.id);
    const proposalYaml = parseYaml(await readFile(getEvolutionProposalPath(workspace.dir, proposal.id), 'utf8')) as {
      source: { artifactRefs: { path: string }[] };
    };
    expect(proposalYaml.source.artifactRefs[0]?.path).toBe(archivedPath);
    await expect(access(path.join(proposalDir, 'result.md'))).rejects.toThrow();
  });

  it('rejects missing archived artifact references during workspace validation', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal({
      source: {
        taskId: 'source_task',
        archivedTaskId: 'missing_task',
        artifactRefs: [
          {
            path: '.playspec/tasks/archived/missing_task/outputs/result.md',
            role: 'archived-artifact',
            archivedTaskId: 'missing_task',
          },
        ],
      },
    });

    await expect(store.saveProposal(proposal)).rejects.toThrow(
      'Evolution proposal artifact reference not found'
    );
  });

  it('generates unique filesystem-safe proposal IDs', () => {
    const first = generateEvolutionProposalId('Phase 6 Proposal');
    const second = generateEvolutionProposalId('Phase 6 Proposal');

    expect(first).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
    expect(second).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
    expect(first).not.toBe(second);
  });

  it('rejects proposal ID collisions', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal();

    await store.saveProposal(proposal);

    await expect(store.saveProposal({
      ...proposal,
      rationale: 'Different proposal with same ID.',
    })).rejects.toThrow(`Evolution proposal already exists: ${proposal.id}`);
  });

  it('rejects existing proposal ID directories even before proposal.yaml exists', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal({ id: 'proposal_empty_dir_collision' });
    await mkdir(getEvolutionProposalRoot(workspace.dir, proposal.id), { recursive: true });

    await expect(store.saveProposal(proposal)).rejects.toThrow(
      `Evolution proposal already exists: ${proposal.id}`
    );
  });

  it('returns validation reports for valid and invalid raw proposals', () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const valid = store.validateProposal(makeProposal());
    const invalid = store.validateProposal({
      ...makeProposal(),
      actions: [{ type: 'unknown' }],
    });

    expect(valid.valid).toBe(true);
    expect(valid.proposal?.id).toBe('proposal_20260503_001');
    expect(valid.report.status).toBe('valid');
    expect(invalid.valid).toBe(false);
    expect(invalid.report.status).toBe('invalid');
    expect(invalid.report.errors.length).toBeGreaterThan(0);
  });
});
