import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
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
  getEvolutionProposalRevisionPath,
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
    revision: 1,
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
    status: 'pending',
    source: {
      taskId: 'source_task',
      artifactRefs: [],
    },
    targetFiles: ['docs/features/source_task/spec.md'],
    evidenceRefs: [],
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

    const updated = await store.skipProposal(proposal.id, {
      skippedAt: '2026-05-03T00:02:00.000Z',
      skipReason: 'Not needed.',
    });
    const loadedReport = await store.loadValidationReport(proposal.id);

    expect(updated.id).toBe(proposal.id);
    expect(updated.status).toBe('skipped');
    expect(updated.skippedAt).toBe('2026-05-03T00:02:00.000Z');
    expect(updated.skipReason).toBe('Not needed.');
    expect(updated.updatedAt).not.toBe(proposal.updatedAt);
    expect(loadedReport).toEqual(report);
    await expect(access(getEvolutionProposalValidationPath(workspace.dir, proposal.id))).resolves.toBeUndefined();
  });

  it('lists stored proposals with pending, refining, and skipped statuses', async () => {
    const store = new EvolutionProposalStore(workspace.dir);

    await store.saveProposal(makeProposal({ id: 'proposal_pending', status: 'pending' }));
    await store.saveProposal(makeProposal({ id: 'proposal_refining', status: 'refining' }));
    await store.saveProposal(makeProposal({ id: 'proposal_skipped', status: 'skipped' }));

    const proposals = await store.listProposals();

    expect(proposals.map((proposal) => `${proposal.id}:${proposal.status}`)).toEqual([
      'proposal_pending:pending',
      'proposal_refining:refining',
      'proposal_skipped:skipped',
    ]);
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

  it('updates active proposals, preserves previous revision, and rewrites validation report', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal();
    await store.saveProposal(proposal);
    await store.saveValidationReport(makeReport(proposal.id));

    const updated = await store.updateProposal(proposal.id, {
      ...proposal,
      id: 'different_id_is_ignored',
      revision: 99,
      createdAt: '2030-01-01T00:00:00.000Z',
      updatedAt: '2030-01-01T00:00:00.000Z',
      status: 'refining',
      rationale: 'Refined after review evidence.',
      targetFiles: ['docs/features/source_task/refined.md'],
      actions: [
        {
          actionId: 'action_2',
          type: 'propose_file_change',
          targetPath: 'docs/features/source_task/refined.md',
          summary: 'Refine spec wording.',
          rationale: 'Review found stale wording.',
        },
      ],
    });

    const loaded = await store.loadProposal(proposal.id);
    const revision = parseYaml(await readFile(
      getEvolutionProposalRevisionPath(workspace.dir, proposal.id, 1),
      'utf8'
    )) as EvolutionProposal;
    const report = await store.loadValidationReport(proposal.id);

    expect(updated.proposal.id).toBe(proposal.id);
    expect(loaded.revision).toBe(2);
    expect(loaded.createdAt).toBe(proposal.createdAt);
    expect(loaded.updatedAt).not.toBe(proposal.updatedAt);
    expect(loaded.status).toBe('refining');
    expect(loaded.rationale).toBe('Refined after review evidence.');
    expect(revision).toEqual(proposal);
    expect(report.createdAt).not.toBe('2026-05-03T00:01:00.000Z');
    expect(report.checkedPaths).toEqual(['docs/features/source_task/refined.md']);
  });

  it('appends evidence to active proposals with revision preservation', async () => {
    const evidencePath = 'docs/evidence/review.md';
    await writeTextFile(path.join(workspace.dir, evidencePath), '# Review Evidence\n');
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal();
    await store.saveProposal(proposal);
    await store.saveValidationReport(makeReport(proposal.id));

    const result = await store.appendEvidence(proposal.id, {
      path: evidencePath,
      note: 'Review found the proposal still relevant.',
    });
    const loaded = await store.loadProposal(proposal.id);
    const report = await store.loadValidationReport(proposal.id);
    const revision = parseYaml(await readFile(
      getEvolutionProposalRevisionPath(workspace.dir, proposal.id, 1),
      'utf8'
    )) as EvolutionProposal;

    expect(result.proposal.revision).toBe(2);
    expect(loaded.evidenceRefs).toHaveLength(1);
    expect(loaded.evidenceRefs[0]).toMatchObject({
      path: evidencePath,
      note: 'Review found the proposal still relevant.',
      source: 'append-evidence',
    });
    expect(loaded.evidenceRefs[0]?.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.checkedPaths).toEqual([
      'docs/features/source_task/spec.md',
      evidencePath,
    ]);
    expect(revision).toEqual(proposal);
  });

  it('rejects terminal proposals for update and evidence append', async () => {
    const evidencePath = 'docs/evidence/review.md';
    await writeTextFile(path.join(workspace.dir, evidencePath), '# Review Evidence\n');
    const store = new EvolutionProposalStore(workspace.dir);
    const skipped = makeProposal({ id: 'proposal_skipped_terminal', status: 'skipped' });
    await store.saveProposal(skipped);

    await expect(store.updateProposal(skipped.id, { ...skipped, rationale: 'No change.' })).rejects.toThrow(
      'Only pending/refining proposals can be changed'
    );
    await expect(store.appendEvidence(skipped.id, { path: evidencePath, note: 'Evidence.' })).rejects.toThrow(
      'Only pending/refining proposals can be changed'
    );

    for (const status of ['applied', 'failed'] as const) {
      const terminal = makeProposal({ id: `proposal_${status}_terminal`, status });
      await writeTextFile(
        getEvolutionProposalPath(workspace.dir, terminal.id),
        stringifyYaml(terminal)
      );
      await expect(store.updateProposal(terminal.id, terminal)).rejects.toThrow(
        'Only pending/refining proposals can be changed'
      );
      await expect(store.appendEvidence(terminal.id, { path: evidencePath, note: 'Evidence.' })).rejects.toThrow(
        'Only pending/refining proposals can be changed'
      );
    }
  });

  it('rejects applied and failed intake through saveProposal', async () => {
    const store = new EvolutionProposalStore(workspace.dir);

    await expect(store.saveProposal(makeProposal({ id: 'proposal_applied_intake', status: 'applied' }))).rejects.toThrow(
      'Evolution proposal status cannot be stored by propose: applied'
    );
    await expect(store.saveProposal(makeProposal({ id: 'proposal_failed_intake', status: 'failed' }))).rejects.toThrow(
      'Evolution proposal status cannot be stored by propose: failed'
    );
  });

  it('rejects invalid updates without rewriting proposal, validation, or revisions', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal();
    const report = makeReport(proposal.id);
    await store.saveProposal(proposal);
    await store.saveValidationReport(report);

    await expect(store.updateProposal(proposal.id, {
      status: 'refining',
      targetFiles: ['docs/features/source_task/refined.md'],
    })).rejects.toThrow('Evolution proposal is invalid');

    expect(await store.loadProposal(proposal.id)).toEqual(proposal);
    expect(await store.loadValidationReport(proposal.id)).toEqual(report);
    await expect(access(getEvolutionProposalRevisionPath(workspace.dir, proposal.id, 1))).rejects.toThrow();
  });

  it('rejects missing evidence paths without writing revisions', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    const proposal = makeProposal();
    await store.saveProposal(proposal);

    await expect(store.appendEvidence(proposal.id, {
      path: 'docs/evidence/missing.md',
      note: 'Missing evidence.',
    })).rejects.toThrow('Evolution proposal evidence reference not found');

    expect(await store.loadProposal(proposal.id)).toEqual(proposal);
    await expect(access(getEvolutionProposalRevisionPath(workspace.dir, proposal.id, 1))).rejects.toThrow();
  });
});
