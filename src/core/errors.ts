export class PlaySpecError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = 'PlaySpecError';
  }
}

export class WorkspaceNotInitializedError extends PlaySpecError {
  constructor(workspaceRoot: string) {
    super(
      `Workspace not initialized at: ${workspaceRoot}`,
      'Run `playspec init --preset default` to initialize the workspace.'
    );
    this.name = 'WorkspaceNotInitializedError';
  }
}

export class TaskNotFoundError extends PlaySpecError {
  constructor(taskId: string) {
    super(
      `Task not found: ${taskId}`,
      'Check the task ID with `playspec list` and try again.'
    );
    this.name = 'TaskNotFoundError';
  }
}

export class NoActiveTaskError extends PlaySpecError {
  constructor() {
    super(
      'No active task set.',
      'Create a task with `playspec create` or switch to one with `playspec use <TASK_ID>`.'
    );
    this.name = 'NoActiveTaskError';
  }
}

export class WorkflowNotFoundError extends PlaySpecError {
  constructor(filePath: string) {
    super(
      `Workflow file not found: ${filePath}`,
      'Ensure the workflow YAML exists in .playspec/workflows/. Re-run `playspec init` if needed.'
    );
    this.name = 'WorkflowNotFoundError';
  }
}

export class PhaseNotFoundError extends PlaySpecError {
  constructor(phaseId: string, workflowId: string) {
    super(
      `Phase "${phaseId}" not found in workflow "${workflowId}".`,
      'Use `playspec next` to advance naturally or check the workflow definition for valid phase IDs.'
    );
    this.name = 'PhaseNotFoundError';
  }
}

export class TemplateNotFoundError extends PlaySpecError {
  constructor(filePath: string) {
    super(
      `Template file not found: ${filePath}`,
      'Ensure the template file exists in .playspec/templates/. Re-run `playspec init` if needed.'
    );
    this.name = 'TemplateNotFoundError';
  }
}

export class CircularIncludeError extends PlaySpecError {
  constructor(includePath: string, chain: string[]) {
    super(
      `Circular include detected: "${includePath}" (chain: ${chain.join(' → ')})`,
      'Fix the circular include in the template files under .playspec/templates/ or .playspec/rules/.'
    );
    this.name = 'CircularIncludeError';
  }
}

export class UnresolvedPlaceholderError extends PlaySpecError {
  constructor(placeholders: string[]) {
    super(
      `Unresolved template placeholders: ${placeholders.join(', ')}`,
      'Ensure all template variables are defined in the task variables or workflow configuration.'
    );
    this.name = 'UnresolvedPlaceholderError';
  }
}
