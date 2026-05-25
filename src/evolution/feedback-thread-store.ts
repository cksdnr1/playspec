import { access, readdir } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  FeedbackRawObservationEventSchema,
  FeedbackThreadIdSchema,
  FeedbackThreadSchema,
} from './schemas.js';
import type {
  FeedbackRawObservationEvent,
  FeedbackThread,
} from './types.js';
import { readTextFile, writeTextFileAtomic } from '#utils/fs.js';
import {
  getEvolutionFeedbackObservationPath,
  getEvolutionFeedbackThreadPath,
  getEvolutionFeedbackThreadsRoot,
} from '#utils/paths.js';

export class EvolutionFeedbackThreadStore {
  constructor(private readonly workspaceRoot: string) {}

  async saveThread(thread: FeedbackThread): Promise<string> {
    const validated = FeedbackThreadSchema.parse(thread) as FeedbackThread;
    const threadPath = getEvolutionFeedbackThreadPath(this.workspaceRoot, validated.id);

    if (await pathExists(threadPath)) {
      throw new Error(`Feedback thread already exists: ${validated.id}`);
    }

    await writeTextFileAtomic(threadPath, stringifyYaml(validated));
    return threadPath;
  }

  async upsertThread(thread: FeedbackThread): Promise<string> {
    const validated = FeedbackThreadSchema.parse(thread) as FeedbackThread;
    const threadPath = getEvolutionFeedbackThreadPath(this.workspaceRoot, validated.id);
    await writeTextFileAtomic(threadPath, stringifyYaml(validated));
    return threadPath;
  }

  async loadThread(threadId: string): Promise<FeedbackThread> {
    FeedbackThreadIdSchema.parse(threadId);
    const content = await readTextFile(getEvolutionFeedbackThreadPath(this.workspaceRoot, threadId));
    return FeedbackThreadSchema.parse(parseYaml(content) as unknown) as FeedbackThread;
  }

  async listThreads(): Promise<FeedbackThread[]> {
    let entries: string[];
    try {
      entries = await readdir(getEvolutionFeedbackThreadsRoot(this.workspaceRoot));
    } catch (error: unknown) {
      if (isMissingPathError(error)) {
        return [];
      }
      throw error;
    }

    const threads: FeedbackThread[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.yaml')) {
        continue;
      }
      const threadId = entry.slice(0, -'.yaml'.length);
      const parsedId = FeedbackThreadIdSchema.safeParse(threadId);
      if (!parsedId.success) {
        continue;
      }
      try {
        threads.push(await this.loadThread(parsedId.data));
      } catch (error: unknown) {
        if (isMissingPathError(error)) {
          continue;
        }
        throw error;
      }
    }

    return threads.sort((a, b) => a.id.localeCompare(b.id));
  }

  async saveRawObservation(event: FeedbackRawObservationEvent): Promise<string> {
    const validated = FeedbackRawObservationEventSchema.parse(event) as FeedbackRawObservationEvent;
    const timestamp = normalizeTimestampForFile(validated.createdAt);
    const observationPath = getEvolutionFeedbackObservationPath(
      this.workspaceRoot,
      validated.taskId,
      validated.phaseId,
      timestamp
    );
    await writeTextFileAtomic(observationPath, stringifyYaml(validated));
    return observationPath;
  }
}

function normalizeTimestampForFile(timestamp: string): string {
  return timestamp
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toLowerCase();
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
