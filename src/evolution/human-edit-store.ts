import { access, readdir } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  HumanEditObservationIdSchema,
  HumanEditObservationSchema,
  HumanEditObservationStatusSchema,
} from './schemas.js';
import type {
  HumanEditObservation,
  HumanEditObservationStatus,
} from './types.js';
import { slugify } from '#utils/slug.js';
import { readTextFile, writeTextFileAtomic } from '#utils/fs.js';
import {
  getEvolutionHumanEditPath,
  getEvolutionHumanEditsRoot,
} from '#utils/paths.js';

export function generateHumanEditObservationId(prefix = 'human-edit'): string {
  const safePrefix = slugify(prefix).replace(/_/g, '-').replace(/[^a-z0-9-]/g, '') || 'human-edit';
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'z')
    .toLowerCase();
  const entropy = Math.random().toString(36).slice(2, 8);
  return HumanEditObservationIdSchema.parse(`${safePrefix}_${timestamp}_${entropy}`);
}

export class EvolutionHumanEditStore {
  constructor(private readonly workspaceRoot: string) {}

  async saveObservation(observation: HumanEditObservation): Promise<string> {
    const validated = HumanEditObservationSchema.parse(observation) as HumanEditObservation;
    const observationPath = getEvolutionHumanEditPath(this.workspaceRoot, validated.id);

    if (await pathExists(observationPath)) {
      throw new Error(`Human edit observation already exists: ${validated.id}`);
    }

    await writeTextFileAtomic(observationPath, stringifyYaml(validated));
    return observationPath;
  }

  async loadObservation(editId: string): Promise<HumanEditObservation> {
    HumanEditObservationIdSchema.parse(editId);
    const content = await readTextFile(getEvolutionHumanEditPath(this.workspaceRoot, editId));
    return HumanEditObservationSchema.parse(parseYaml(content) as unknown) as HumanEditObservation;
  }

  async listObservations(): Promise<HumanEditObservation[]> {
    let entries: string[];
    try {
      entries = await readdir(getEvolutionHumanEditsRoot(this.workspaceRoot));
    } catch (error: unknown) {
      if (isMissingPathError(error)) {
        return [];
      }
      throw error;
    }

    const observations: HumanEditObservation[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.yaml')) {
        continue;
      }
      const editId = entry.slice(0, -'.yaml'.length);
      const parsedId = HumanEditObservationIdSchema.safeParse(editId);
      if (!parsedId.success) {
        continue;
      }
      try {
        observations.push(await this.loadObservation(parsedId.data));
      } catch (error: unknown) {
        if (isMissingPathError(error)) {
          continue;
        }
        throw error;
      }
    }

    return observations.sort((a, b) => a.id.localeCompare(b.id));
  }

  async markObservationStatus(
    editId: string,
    status: Extract<HumanEditObservationStatus, 'ignored' | 'superseded'>,
    metadata: { reason?: string } = {}
  ): Promise<HumanEditObservation> {
    HumanEditObservationIdSchema.parse(editId);
    const parsedStatus = HumanEditObservationStatusSchema.parse(status);
    if (parsedStatus === 'recorded') {
      throw new Error('Human edit observation status update must be ignored or superseded.');
    }

    const existing = await this.loadObservation(editId);
    const updated: HumanEditObservation = {
      ...existing,
      status: parsedStatus,
      updatedAt: new Date().toISOString(),
      ...(metadata.reason ? { statusReason: metadata.reason } : {}),
    };
    const validated = HumanEditObservationSchema.parse(updated) as HumanEditObservation;
    await writeTextFileAtomic(getEvolutionHumanEditPath(this.workspaceRoot, editId), stringifyYaml(validated));
    return validated;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
