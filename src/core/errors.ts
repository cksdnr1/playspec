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

export class IncludePathOutsideRootError extends PlaySpecError {
  constructor(includePath: string, resolvedPath: string, rootPath: string) {
    super(
      `Include path escapes .playspec root: ${includePath} -> ${resolvedPath}`,
      `Keep include paths inside ${rootPath}.`
    );
    this.name = 'IncludePathOutsideRootError';
  }
}

export class IncludeNotFoundError extends PlaySpecError {
  constructor(includePath: string, filePath: string, parentTemplatePath: string) {
    super(
      `Include file not found: ${filePath} (from ${parentTemplatePath}, include: ${includePath})`,
      'Ensure the included file exists under .playspec and the include path is correct.'
    );
    this.name = 'IncludeNotFoundError';
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
  constructor(placeholders: string[], templatePath?: string) {
    const location = templatePath ? ` in ${templatePath}` : '';
    super(
      `Unresolved template placeholders${location}: ${placeholders.join(', ')}`,
      'Ensure all template variables are defined in the task variables or workflow configuration.'
    );
    this.name = 'UnresolvedPlaceholderError';
  }
}

export class MissingRequiredVariablesError extends PlaySpecError {
  constructor(workflowId: string, phaseId: string, missingVariables: string[]) {
    super(
      `Missing required variables for workflow "${workflowId}" phase "${phaseId}": ${missingVariables.join(', ')}`,
      'Define the missing variables in task variables or remove them from workflow requiredVariables.'
    );
    this.name = 'MissingRequiredVariablesError';
  }
}

export class LockTimeoutError extends PlaySpecError {
  constructor(lockTarget: string, timeoutMs: number) {
    super(
      `Timed out waiting for write lock: ${lockTarget}`,
      `Another PlaySpec operation is holding the task lock. Retry after it finishes. Timeout: ${timeoutMs}ms.`
    );
    this.name = 'LockTimeoutError';
  }
}

export class TaskNotActiveError extends PlaySpecError {
  constructor(taskId: string, status: string) {
    super(
      `Task "${taskId}" is not active (status: ${status}).`,
      'Switch HEAD to an active task with `playspec use <TASK_ID>` or pass an active task with `--task <TASK_ID>`.'
    );
    this.name = 'TaskNotActiveError';
  }
}

export class GitEvidenceCollectionError extends PlaySpecError {
  constructor(message: string) {
    super(
      `Failed to collect git evidence: ${message}`,
      'Ensure the workspace root is inside a readable git repository and retry.'
    );
    this.name = 'GitEvidenceCollectionError';
  }
}

export class DesyncCheckFailedError extends PlaySpecError {
  constructor(message: string) {
    super(
      `Failed to check workspace desync: ${message}`,
      'Ensure the workspace root is inside a readable git repository and retry.'
    );
    this.name = 'DesyncCheckFailedError';
  }
}

export class NoRollbackSafePointError extends PlaySpecError {
  constructor(taskId: string) {
    super(
      `Task "${taskId}" has no rollback safe point.`,
      'Run `playspec complete` successfully before attempting rollback.'
    );
    this.name = 'NoRollbackSafePointError';
  }
}

export class UnsafeGitRollbackBlockedError extends PlaySpecError {
  constructor(reasons: string[]) {
    super(
      `Git rollback is blocked: ${reasons.join('; ')}`,
      'Use `playspec rollback --state-only` or clean the workspace before retrying.'
    );
    this.name = 'UnsafeGitRollbackBlockedError';
  }
}

export class RollbackSnapshotError extends PlaySpecError {
  constructor(snapshotFile: string, reason: string) {
    super(
      `Rollback snapshot "${snapshotFile}" is not usable: ${reason}`,
      'Inspect the task snapshots or choose state recovery manually.'
    );
    this.name = 'RollbackSnapshotError';
  }
}

export class InvalidRollbackOptionsError extends PlaySpecError {
  constructor() {
    super(
      'Rollback options are ambiguous.',
      'Use only one of `--state-only` or `--git-only`.'
    );
    this.name = 'InvalidRollbackOptionsError';
  }
}
