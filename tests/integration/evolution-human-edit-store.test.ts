import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { HumanEditObservationSchema } from '#evolution/schemas.js';
import {
  EvolutionHumanEditStore,
  generateHumanEditObservationId,
} from '#evolution/human-edit-store.js';
import type { HumanEditObservation } from '#evolution/types.js';
import { readTextFile } from '#utils/fs.js';
import { getEvolutionHumanEditPath } from '#utils/paths.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

function makeObservation(overrides: Partial<HumanEditObservation> = {}): HumanEditObservation {
  return {
    id: 'human_edit_20260503_001',
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
    status: 'recorded',
    targetPath: '.playspec/templates/prompt.md',
    summary: 'Adjusted prompt wording.',
    rationale: 'The previous wording was ambiguous.',
    ...overrides,
  };
}

describe('HumanEditObservationSchema', () => {
  it('accepts source metadata and before/after references', () => {
    const parsed = HumanEditObservationSchema.parse(makeObservation({
      sourceTaskId: 'source_task',
      proposalId: 'proposal_human_edit',
      beforeRef: '.playspec/evolution/reports/before.md',
      afterRef: '.playspec/evolution/reports/after.md',
    })) as HumanEditObservation;

    expect(parsed.sourceTaskId).toBe('source_task');
    expect(parsed.proposalId).toBe('proposal_human_edit');
  });

  it('rejects invalid IDs and workspace-escaping paths', () => {
    expect(() => HumanEditObservationSchema.parse(makeObservation({ id: '../bad' }))).toThrow();
    expect(() => HumanEditObservationSchema.parse(makeObservation({ targetPath: '../outside.md' }))).toThrow();
    expect(() => HumanEditObservationSchema.parse(makeObservation({ beforeRef: '/tmp/before.md' }))).toThrow();
    expect(() => HumanEditObservationSchema.parse(makeObservation({ afterRef: '../outside-after.md' }))).toThrow();
  });
});

describe('EvolutionHumanEditStore', () => {
  it('persists, reloads, and lists human edit observations', async () => {
    const store = new EvolutionHumanEditStore(workspace.dir);
    const observation = makeObservation();

    const observationPath = await store.saveObservation(observation);
    const loaded = await store.loadObservation(observation.id);
    const listed = await store.listObservations();

    expect(observationPath).toBe(getEvolutionHumanEditPath(workspace.dir, observation.id));
    expect(loaded).toEqual(observation);
    expect(listed).toEqual([observation]);
  });

  it('rejects duplicate observation IDs without changing the existing file', async () => {
    const store = new EvolutionHumanEditStore(workspace.dir);
    const observation = makeObservation();

    await store.saveObservation(observation);
    await expect(store.saveObservation({ ...observation, summary: 'Different edit.' }))
      .rejects.toThrow('Human edit observation already exists: human_edit_20260503_001');

    const parsed = parseYaml(await readTextFile(getEvolutionHumanEditPath(workspace.dir, observation.id))) as HumanEditObservation;
    expect(parsed.summary).toBe('Adjusted prompt wording.');
  });

  it('marks observations ignored or superseded while preserving source fields', async () => {
    const store = new EvolutionHumanEditStore(workspace.dir);
    const observation = makeObservation({
      sourceTaskId: 'source_task',
      proposalId: 'proposal_human_edit',
      beforeRef: '.playspec/evolution/reports/before.md',
      afterRef: '.playspec/evolution/reports/after.md',
    });
    await store.saveObservation(observation);

    const ignored = await store.markObservationStatus(observation.id, 'ignored', { reason: 'Duplicate note.' });
    const superseded = await store.markObservationStatus(observation.id, 'superseded', { reason: 'Covered by later edit.' });

    expect(ignored.status).toBe('ignored');
    expect(ignored.sourceTaskId).toBe('source_task');
    expect(ignored.proposalId).toBe('proposal_human_edit');
    expect(ignored.targetPath).toBe(observation.targetPath);
    expect(superseded.status).toBe('superseded');
    expect(superseded.statusReason).toBe('Covered by later edit.');
    await expect(access(getEvolutionHumanEditPath(workspace.dir, observation.id))).resolves.toBeUndefined();
  });

  it('generates filesystem-safe human edit IDs', () => {
    expect(generateHumanEditObservationId('Prompt Edit')).toMatch(/^prompt-edit_\d{8}t\d{6}z_[a-z0-9]{6}$/);
  });
});
