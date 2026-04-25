import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { SessionRecordSchema } from './schemas.js';
import type { SessionRecord } from './types.js';
import { readTextFile } from '#utils/fs.js';
import { getPlayspecRoot } from '#utils/paths.js';

export class SessionResolver {
  constructor(private readonly workspaceRoot: string) {}

  async loadSession(sessionId = 'cli.default'): Promise<SessionRecord> {
    const sessionPath = path.join(
      getPlayspecRoot(this.workspaceRoot),
      'sessions',
      `${sessionId}.yaml`
    );
    const content = await readTextFile(sessionPath);
    const raw = parseYaml(content) as unknown;
    return SessionRecordSchema.parse(raw);
  }
}
