import { McpInvalidSessionIdError, McpInvalidTaskIdError } from './errors.js';

const MAX_MCP_IDENTIFIER_LENGTH = 256;
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1F\x7F]/;

function isInvalidMcpIdentifier(value: string): boolean {
  return (
    value.length === 0 ||
    value.length > MAX_MCP_IDENTIFIER_LENGTH ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes(':') ||
    CONTROL_CHARACTER_PATTERN.test(value)
  );
}

export function assertValidMcpTaskId(taskId: unknown): asserts taskId is string {
  if (typeof taskId !== 'string' || isInvalidMcpIdentifier(taskId)) {
    throw new McpInvalidTaskIdError();
  }
}

export function assertValidMcpSessionId(sessionId: unknown): asserts sessionId is string {
  if (typeof sessionId !== 'string' || isInvalidMcpIdentifier(sessionId)) {
    throw new McpInvalidSessionIdError();
  }
}
