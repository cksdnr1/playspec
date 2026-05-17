import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { CompletionLedgerSchema } from '#core/schemas.js';
import type { CompletionEvent, CompletionLedger, TaskRecord } from '#core/types.js';
import { readTextFile, writeTextFileAtomic } from '#utils/fs.js';
import { getCompletionIndexPath, getCompletionRoot } from '#utils/paths.js';

export class CompletionLedgerStore {
  constructor(private readonly workspaceRoot: string) {}

  async readLedger(taskId: string): Promise<CompletionLedger> {
    try {
      const content = await readTextFile(getCompletionIndexPath(this.workspaceRoot, taskId));
      return CompletionLedgerSchema.parse(parseYaml(content) as unknown);
    } catch (error) {
      if (isNotFoundError(error)) {
        return { taskId, events: [] };
      }
      throw error;
    }
  }

  async listEvents(taskId: string): Promise<CompletionEvent[]> {
    return (await this.readLedger(taskId)).events;
  }

  async appendEvent(task: TaskRecord, event: CompletionEvent, markdown: string): Promise<CompletionEvent> {
    const existing = await this.readLedger(task.id);
    const ledger = CompletionLedgerSchema.parse({
      taskId: task.id,
      events: [...existing.events, event],
    });

    await writeTextFileAtomic(
      path.join(this.workspaceRoot, task.paths.taskRoot, event.markdownFile),
      markdown
    );
    await writeTextFileAtomic(
      getCompletionIndexPath(this.workspaceRoot, task.id),
      stringifyYaml(ledger)
    );

    return event;
  }

  async readMarkdown(taskId: string, completionId: string): Promise<{ event: CompletionEvent; markdown: string }> {
    const events = await this.listEvents(taskId);
    const event = events.find((candidate) => candidate.id === completionId);
    if (!event) {
      const available = events.map((candidate) => candidate.id);
      const suffix = available.length > 0 ? ` Available completions: ${available.join(', ')}.` : '';
      throw new Error(`Completion "${completionId}" not found for task "${taskId}".${suffix}`);
    }
    const markdown = await readTextFile(
      path.join(getCompletionRoot(this.workspaceRoot, taskId), path.basename(event.markdownFile))
    );
    return { event, markdown };
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
