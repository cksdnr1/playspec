import {
  McpTaskContextRequiredError,
  McpSessionContextEmptyError,
  McpSessionNotFoundError,
} from './errors.js';
import type { TaskIdResolver } from '#core/task-id-resolver.js';
import type { McpSessionStore } from './session-store.js';
import { assertValidMcpSessionId, assertValidMcpTaskId } from './validation.js';

export async function resolveMcpTaskId(
  input: { taskId?: unknown; sessionId?: unknown },
  sessionStore: McpSessionStore,
  taskIdResolver: TaskIdResolver
): Promise<string> {
  if (input.taskId !== undefined) {
    assertValidMcpTaskId(input.taskId);
    return (await taskIdResolver.resolve(input.taskId)).taskId;
  }

  if (input.sessionId === undefined || input.sessionId === '') {
    throw new McpTaskContextRequiredError();
  }

  assertValidMcpSessionId(input.sessionId);
  const session = await sessionStore.loadSession(input.sessionId);
  if (!session) {
    throw new McpSessionNotFoundError(input.sessionId);
  }
  if (session.currentTaskId === null) {
    throw new McpSessionContextEmptyError(input.sessionId);
  }
  return session.currentTaskId;
}
