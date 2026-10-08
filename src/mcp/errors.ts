import { PlaySpecError } from '#core/errors.js';

export class McpTaskContextRequiredError extends PlaySpecError {
  constructor() {
    super(
      'MCP tool call requires taskId or sessionId.',
      'Provide a non-empty taskId or sessionId directly, or call playspec_use_session_task to bind a task to a session and then pass that sessionId. IDs must be 256 characters or fewer and must not contain colons, path separators (`/` or `\\`), null bytes, or control characters.'
    );
    this.name = 'McpTaskContextRequiredError';
  }
}

export class McpInvalidTaskIdError extends PlaySpecError {
  constructor() {
    super(
      'Invalid MCP taskId.',
      'Use a non-empty taskId of 256 characters or fewer without colons, path separators (`/` or `\\`), null bytes, or control characters.'
    );
    this.name = 'McpInvalidTaskIdError';
  }
}

export class McpInvalidSessionIdError extends PlaySpecError {
  constructor() {
    super(
      'Invalid MCP sessionId.',
      'Use a non-empty sessionId of 256 characters or fewer without colons, path separators (`/` or `\\`), null bytes, or control characters.'
    );
    this.name = 'McpInvalidSessionIdError';
  }
}

export class McpSessionNotFoundError extends PlaySpecError {
  constructor(sessionId: string) {
    super(
      `Session "${sessionId}" was not found.`,
      'Call playspec_use_session_task with this sessionId and a taskId to create and bind the session.'
    );
    this.name = 'McpSessionNotFoundError';
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

export class McpConfirmationRequiredError extends PlaySpecError {
  constructor(message: string, hint: string) {
    super(message, hint);
    this.name = 'McpConfirmationRequiredError';
  }
}

export class McpApprovalRequiredError extends PlaySpecError {
  constructor(message: string, hint: string) {
    super(message, hint);
    this.name = 'McpApprovalRequiredError';
  }
}
