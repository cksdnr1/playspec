import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { SessionRecordSchema } from '#core/schemas.js';
import type { SessionRecord } from '#core/types.js';
import { readTextFile, writeTextFileAtomic } from '#utils/fs.js';
import { getPlayspecRoot } from '#utils/paths.js';
import { assertValidMcpSessionId, assertValidMcpTaskId } from './validation.js';

export class McpSessionStore {
  constructor(private readonly workspaceRoot: string) {}

  private sessionPath(sessionId: string): string {
    return path.join(getPlayspecRoot(this.workspaceRoot), 'sessions', `${sessionId}.yaml`);
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    try {
      const content = await readTextFile(this.sessionPath(sessionId));
      const raw = parseYaml(content) as unknown;
      return SessionRecordSchema.parse(raw);
    } catch {
      return null;
    }
  }

  async saveSession(session: SessionRecord): Promise<void> {
    const validated = SessionRecordSchema.parse(session);
    await writeTextFileAtomic(this.sessionPath(validated.sessionId), stringifyYaml(validated));
  }

  async setSessionTask(sessionId: string, taskId: string, adapter: string): Promise<SessionRecord> {
    assertValidMcpSessionId(sessionId);
    assertValidMcpTaskId(taskId);
    const existing = await this.loadSession(sessionId);
    const session: SessionRecord = existing
      ? { ...existing, currentTaskId: taskId }
      : { sessionId, adapter, currentTaskId: taskId };
    await this.saveSession(session);
    return session;
  }
}
