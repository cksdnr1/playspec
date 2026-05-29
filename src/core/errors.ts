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
      'Check the task ID with `playspec list-tasks` and try again.'
    );
    this.name = 'TaskNotFoundError';
  }
}

export class TaskAlreadyExistsError extends PlaySpecError {
  constructor(taskId: string) {
    super(
      `Task already exists: ${taskId}`,
      'Choose a different task title or inspect existing tasks with `playspec list-tasks`.'
    );
    this.name = 'TaskAlreadyExistsError';
  }
}

export class TaskIdResolutionError extends PlaySpecError {
  constructor(input: string) {
    super(
      `No task found matching: ${input}`,
      'Check the task ID with `playspec list-tasks` and try again.'
    );
    this.name = 'TaskIdResolutionError';
  }
}

export class AmbiguousTaskIdError extends PlaySpecError {
  constructor(input: string, matches: string[]) {
    super(
      `Ambiguous task ID prefix "${input}" matches: ${matches.join(', ')}`,
      'Use a longer task ID prefix.'
    );
    this.name = 'AmbiguousTaskIdError';
  }
}

export class InvalidTaskLinkTypeError extends PlaySpecError {
  constructor(type: string) {
    super(
      `Invalid task link type: ${type}`,
      'Use one of: parent, after, related.'
    );
    this.name = 'InvalidTaskLinkTypeError';
  }
}

export class SelfTaskLinkError extends PlaySpecError {
  constructor(taskId: string) {
    super(
      `Task "${taskId}" cannot link to itself.`,
      'Choose a different target task.'
    );
    this.name = 'SelfTaskLinkError';
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
      'Run `playspec workflow list` to see installed workflows, or install one with `playspec workflow install <path>`.'
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
      'Ensure the workflow template exists under the selected workflow templates directory.'
    );
    this.name = 'TemplateNotFoundError';
  }
}

export class IncludePathOutsideRootError extends PlaySpecError {
  constructor(includePath: string, resolvedPath: string, rootPath: string) {
    super(
      `Include path escapes template root: ${includePath} -> ${resolvedPath}`,
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
      `Circular include detected: "${includePath}" (chain: ${chain.join(' -> ')})`,
      'Fix the circular include in the workflow template files.'
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

export class UnknownVariableDefaultError extends PlaySpecError {
  constructor(workflowId: string, variableName: string, unknownName: string) {
    super(
      `Unknown variable ${unknownName} used in default for ${variableName} in workflow ${workflowId}`,
      'Declare the referenced variable in workflow variables, phase variables, or task variables.'
    );
    this.name = 'UnknownVariableDefaultError';
  }
}

export class CircularVariableDefaultError extends PlaySpecError {
  constructor(workflowId: string, chain: string[]) {
    super(
      `Circular variable default detected in workflow ${workflowId}: ${chain.join(' -> ')}`,
      'Remove the cycle from workflow or phase variable defaults.'
    );
    this.name = 'CircularVariableDefaultError';
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

export class TaskNotCompletedError extends PlaySpecError {
  constructor(taskId: string, status: string) {
    super(
      `Task "${taskId}" is not completed (status: ${status}).`,
      'Only completed tasks can be closed into archive storage.'
    );
    this.name = 'TaskNotCompletedError';
  }
}

export class PlanningTaskNotCompletedError extends PlaySpecError {
  constructor(taskId: string, status: string) {
    super(
      `Planning task "${taskId}" is not completed (status: ${status}).`,
      'Phase-execution creation requires a completed planning task. Complete the planning task first, then rerun with --from <TASK_ID>.'
    );
    this.name = 'PlanningTaskNotCompletedError';
  }
}

export class ArchivedTaskAlreadyExistsError extends PlaySpecError {
  constructor(taskId: string) {
    super(
      `Archived task already exists: ${taskId}`,
      'Choose a different task ID or inspect the existing archived task before retrying.'
    );
    this.name = 'ArchivedTaskAlreadyExistsError';
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

export class MissingContextRefError extends PlaySpecError {
  constructor(missingPath: string) {
    super(
      `Context ref file not found: ${missingPath}`,
      'Ensure the referenced context file exists or remove the stale contextRef from task.yaml.'
    );
    this.name = 'MissingContextRefError';
  }
}

export class AmbiguousPlanningTaskError extends PlaySpecError {
  constructor(candidates: string[]) {
    super(
      `Multiple completed planning tasks match. Candidates: ${candidates.join(', ')}`,
      'Use --from <TASK_ID> to specify which planning task to bind context from.'
    );
    this.name = 'AmbiguousPlanningTaskError';
  }
}

export class PlanningContextNotFoundError extends PlaySpecError {
  constructor(taskId: string, missingFile: string) {
    super(
      `Required planning context file not found for task "${taskId}": ${missingFile}`,
      'Ensure the planning task has generated its total spec and phase plan documents.'
    );
    this.name = 'PlanningContextNotFoundError';
  }
}

export class MissingResultError extends PlaySpecError {
  constructor(phaseId: string, allowedValues: string[]) {
    super(
      `Phase "${phaseId}" requires a result. Allowed values: ${allowedValues.join(', ')}`,
      'Use --result <value> in non-interactive mode or run interactively to select from the menu.'
    );
    this.name = 'MissingResultError';
  }
}

export class InvalidResultError extends PlaySpecError {
  constructor(phaseId: string, given: string, allowedValues: string[]) {
    super(
      `Invalid result "${given}" for phase "${phaseId}". Allowed values: ${allowedValues.join(', ')}`,
      'Pass one of the allowed result values with --result <value>.'
    );
    this.name = 'InvalidResultError';
  }
}

export class MissingResultMappingError extends PlaySpecError {
  constructor(phaseId: string, result: string) {
    super(
      `No nextByResult mapping found for result "${result}" in phase "${phaseId}".`,
      'Add the result mapping to the workflow YAML under nextByResult.'
    );
    this.name = 'MissingResultMappingError';
  }
}

export class InvalidRoutingTargetError extends PlaySpecError {
  constructor(phaseId: string, result: string, targetPhaseId: string, workflowId: string) {
    super(
      `nextByResult mapping for result "${result}" in phase "${phaseId}" targets unknown phase "${targetPhaseId}" in workflow "${workflowId}".`,
      'Ensure the target phase ID exists in the workflow phases definition.'
    );
    this.name = 'InvalidRoutingTargetError';
  }
}

export class LoopGuardError extends PlaySpecError {
  constructor(phaseId: string, maxVisits: number, visitCount: number) {
    super(
      `Phase "${phaseId}" has reached its maximum visit count (maxVisits: ${maxVisits}, current: ${visitCount}).`,
      'The loop guard has been triggered. Review the workflow routing or override maxVisits in the workflow YAML.'
    );
    this.name = 'LoopGuardError';
  }
}

export class HarnessBlockedError extends PlaySpecError {
  constructor(taskId: string, phaseId: string) {
    super(
      `Harness is blocked for task "${taskId}" phase "${phaseId}".`,
      'Inspect `playspec harness status --task <TASK_ID>` and run `playspec harness reset --task <TASK_ID>` after human review.'
    );
    this.name = 'HarnessBlockedError';
  }
}

export class UnexpectedResultError extends PlaySpecError {
  constructor(phaseId: string) {
    super(
      `Phase "${phaseId}" does not declare allowed results but a result was provided.`,
      'Remove --result from the command or add a results declaration to the workflow phase.'
    );
    this.name = 'UnexpectedResultError';
  }
}

export class InvalidCurrentPhaseError extends PlaySpecError {
  constructor(phaseId: string, workflowId: string, allowedValues: string[]) {
    super(
      `Phase "${phaseId}" is not a valid phase in workflow "${workflowId}". Allowed values: ${allowedValues.join(', ')}`,
      'Fix currentPhase in task.yaml or use `playspec next` to advance naturally.'
    );
    this.name = 'InvalidCurrentPhaseError';
  }
}

export class AbsoluteContextPathError extends PlaySpecError {
  constructor(contextPath: string) {
    super(
      `Context path must be workspace-relative: ${contextPath}`,
      'Use a path relative to the workspace root, not an absolute path.'
    );
    this.name = 'AbsoluteContextPathError';
  }
}

export class ContextPathEscapesWorkspaceError extends PlaySpecError {
  constructor(contextPath: string) {
    super(
      `Context path escapes workspace: ${contextPath}`,
      'Keep context paths inside the workspace root.'
    );
    this.name = 'ContextPathEscapesWorkspaceError';
  }
}

export class ContextFileNotFoundError extends PlaySpecError {
  constructor(contextPath: string) {
    super(
      `Context file not found: ${contextPath}`,
      'Ensure the file exists at the given path before linking it as context.'
    );
    this.name = 'ContextFileNotFoundError';
  }
}

export class NoExplicitPhasePointerError extends PlaySpecError {
  constructor(taskId: string) {
    super(
      `Task "${taskId}" has no explicit phase pointer yet.`,
      'Use `playspec phase --set <phaseId>` to set an explicit starting phase.'
    );
    this.name = 'NoExplicitPhasePointerError';
  }
}

export class InvalidRecoveryTargetError extends PlaySpecError {
  constructor(phaseId: string, workflowId: string, allowedValues: string[]) {
    const allowedList = allowedValues.map((p) => `  ${p}`).join('\n');
    super(
      `Invalid phase: ${phaseId}\nAllowed values:\n${allowedList}`,
      `Phase must be listed in workflow "${workflowId}" phaseOrder.`
    );
    this.name = 'InvalidRecoveryTargetError';
  }
}

export class RewindOutOfRangeError extends PlaySpecError {
  constructor(steps: number, currentIndex: number) {
    super(
      `Cannot rewind ${steps} step${steps === 1 ? '' : 's'}: current phase is at index ${currentIndex} in phaseOrder.`,
      'Use a smaller --steps value or `playspec phase --set <phaseId>` for an explicit target.'
    );
    this.name = 'RewindOutOfRangeError';
  }
}

export class InvalidRewindStepsError extends PlaySpecError {
  constructor(value: string) {
    super(
      `Invalid --steps value: "${value}". Must be a positive integer greater than zero.`,
      'Example: --steps 1 or --steps 2'
    );
    this.name = 'InvalidRewindStepsError';
  }
}

export class AmbiguousPhaseCommandError extends PlaySpecError {
  constructor() {
    super(
      'Positional phase ID cannot be combined with --set or --select.',
      'Use `playspec phase <phaseId>` for render-only, or `playspec phase --set <phaseId>` / `playspec phase --select` for recovery.'
    );
    this.name = 'AmbiguousPhaseCommandError';
  }
}
