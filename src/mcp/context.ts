import {
  McpInvalidTaskIdError,
  McpTaskContextRequiredError,
  McpSessionContextEmptyError,
  McpSessionNotFoundError,
} from './errors.js';
import type { McpSessionStore } from './session-store.js';

const MAX_MCP_TASK_ID_LENGTH = 256;
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1F\x7F]/;

export async function resolveMcpTaskId(
  input: { taskId?: string; sessionId?: string },
  sessionStore: McpSessionStore
): Promise<string> {
  if (input.taskId) {
    assertValidMcpTaskId(input.taskId);
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

function assertValidMcpTaskId(taskId: string): void {
  if (
    taskId.length > MAX_MCP_TASK_ID_LENGTH ||
    taskId.includes('/') ||
    taskId.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(taskId)
  ) {
    throw new McpInvalidTaskIdError();
  }
}
