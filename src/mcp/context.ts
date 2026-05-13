import {
  McpTaskContextRequiredError,
  McpSessionContextEmptyError,
  McpSessionNotFoundError,
} from './errors.js';
import type { McpSessionStore } from './session-store.js';

export async function resolveMcpTaskId(
  input: { taskId?: string; sessionId?: string },
  sessionStore: McpSessionStore
): Promise<string> {
  if (input.taskId) {
    return input.taskId;
  }

  if (input.sessionId) {
    const session = await sessionStore.loadSession(input.sessionId);
    if (!session) {
      throw new McpSessionNotFoundError(input.sessionId);
    }
    if (session.currentTaskId === null) {
      throw new McpSessionContextEmptyError(input.sessionId);
    }
    return session.currentTaskId;
  }

  throw new McpTaskContextRequiredError();
}
