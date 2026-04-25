import { PlaySpecError } from '#core/errors.js';

export class McpTaskContextRequiredError extends PlaySpecError {
  constructor() {
    super(
      'MCP tool call requires taskId or sessionId.',
      'Provide taskId or sessionId in the tool input.'
    );
    this.name = 'McpTaskContextRequiredError';
  }
}

export class McpSessionContextEmptyError extends PlaySpecError {
  constructor(sessionId: string) {
    super(
      `Session "${sessionId}" has no current task set.`,
      'Call playspec_use_session_task to bind a task to this session first.'
    );
    this.name = 'McpSessionContextEmptyError';
  }
}
