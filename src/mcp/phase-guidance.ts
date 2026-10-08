import type { PhaseExecutionContext } from '#core/phase-execution-context.js';
import { MissingRequiredVariablesError, PlaySpecError, ValidationGateError } from '#core/errors.js';

export interface McpCall { tool: string; arguments: Record<string, unknown> }
export interface TaskCallContext { taskId?: unknown; sessionId?: unknown; workspaceRoot?: string }

export function scopedReadCall(tool: string, context: TaskCallContext): McpCall {
  return { tool, arguments: {
    ...(typeof context.taskId === 'string' ? { taskId: context.taskId } : {}),
    ...(typeof context.sessionId === 'string' ? { sessionId: context.sessionId } : {}),
    ...(context.workspaceRoot ? { workspaceRoot: context.workspaceRoot } : {}),
  } };
}

export function phasePromptResponse(prompt: string, execution: PhaseExecutionContext, workspaceRoot: string) {
  const scoped = { ...execution, completion: execution.completion ? {
    ...execution.completion, arguments: { ...execution.completion.arguments, workspaceRoot },
  } : null };
  const instructions = scoped.completion
    ? `Use the MCP tool below after performing this phase. CLI completion examples in the workflow text describe routing; this MCP call is the completion interface for this response.\n\n${scoped.completion.instructions}\n\nAllowed results: ${JSON.stringify(scoped.allowedResults)}\n\n\`\`\`json\n${JSON.stringify(scoped.completion, null, 2)}\n\`\`\``
    : scoped.isCurrentPhase ? 'Completion is blocked by the harness. Inspect playspec_get_harness_status and obtain review before resetting.' : 'This is an inspection of a noncurrent phase. It provides no completion call. Render the current phase before performing or completing work.';
  return { workspaceRoot, taskId: scoped.taskId, phaseId: scoped.phaseId, execution: scoped,
    prompt: `${prompt.trimEnd()}\n\n## MCP execution instructions\n\n${instructions}\n`,
    nextActions: !scoped.isCurrentPhase
      ? [scopedReadCall('playspec_render_next_prompt', { taskId: scoped.taskId, workspaceRoot })]
      : scoped.harness.blocked || scoped.harness.circuitBreaker
        ? [scopedReadCall('playspec_get_harness_status', { taskId: scoped.taskId, workspaceRoot })] : [],
  };
}

export function structuredError(error: unknown, context?: TaskCallContext) {
  const name = error instanceof Error ? error.name : 'Error';
  const codes: Record<string, string> = {
    CompletionRequestConflictError: 'completion_request_conflict', PhaseAdvancedError: 'phase_advanced', PhaseRevisionError: 'phase_revision_stale', HarnessBlockedError: 'harness_blocked',
    MissingResultError: 'result_required', InvalidResultError: 'result_invalid', UnexpectedResultError: 'result_unexpected',
    TaskNotActiveError: 'task_not_active', TaskNotFoundError: 'task_not_found', TaskIdResolutionError: 'task_not_found',
    McpTaskContextRequiredError: 'task_context_required', McpSessionNotFoundError: 'session_not_bound', McpSessionContextEmptyError: 'session_not_bound',
    McpInvalidTaskIdError: 'invalid_task_id', McpInvalidSessionIdError: 'invalid_session_id',
    ValidationFeedbackExtractionError: 'feedback_capture_failed', ZodError: 'invalid_arguments', LockTimeoutError: 'lock_timeout',
    WorkflowNotFoundError: 'workflow_not_found',
    CompletionArgumentsError: 'completion_arguments_required', MissingRequiredVariablesError: 'required_variables_missing',
  };
  const nextActions: McpCall[] = [];
  const lookupErrors = ['McpTaskContextRequiredError', 'McpSessionNotFoundError', 'McpSessionContextEmptyError', 'McpInvalidTaskIdError', 'McpInvalidSessionIdError', 'TaskNotFoundError', 'TaskIdResolutionError'];
  if (context && name === 'WorkflowNotFoundError') {
    nextActions.push({ tool: 'playspec_list_workflows', arguments: context?.workspaceRoot ? { workspaceRoot: context.workspaceRoot } : {} });
  } else if (context && lookupErrors.includes(name)) {
    nextActions.push({ tool: 'playspec_list_tasks', arguments: context?.workspaceRoot ? { workspaceRoot: context.workspaceRoot } : {} });
  } else if (context && (typeof context.taskId === 'string' || typeof context.sessionId === 'string')) {
    nextActions.push(scopedReadCall('playspec_get_status', context));
    if (name === 'HarnessBlockedError') nextActions.push(scopedReadCall('playspec_get_harness_status', context));
    else if (!['TaskNotActiveError', 'TaskNotFoundError', 'TaskIdResolutionError'].includes(name)) nextActions.push(scopedReadCall('playspec_render_next_prompt', context));
  }
  if (context && error instanceof ValidationGateError && typeof error.details.phaseId === 'string') {
    const call = scopedReadCall('playspec_render_phase_prompt', context);
    nextActions.push({ ...call, arguments: { ...call.arguments, phaseId: error.details.phaseId } });
  }
  if (error instanceof MissingRequiredVariablesError) {
    nextActions.push({ tool: 'playspec_show_workflow', arguments: { workflowId: error.workflowId, ...(context?.workspaceRoot ? { workspaceRoot: context.workspaceRoot } : {}) } });
  }
  return { ...(error instanceof MissingRequiredVariablesError ? { details: { workflowId: error.workflowId, phaseId: error.phaseId, missingVariables: error.missingVariables } } : {}), ...(error instanceof ValidationGateError ? { details: error.details } : {}), code: error instanceof ValidationGateError ? error.code : codes[name] ?? 'operation_failed',
    message: error instanceof Error ? error.message : String(error),
    hint: error instanceof PlaySpecError ? error.hint ?? null : null,
    retryable: name === 'LockTimeoutError', nextActions,
  };
}

export class CompletionArgumentsError extends PlaySpecError {
  constructor() {
    super('playspec_complete_phase requires expectedPhaseId and requestId.', 'Call playspec_render_next_prompt and use execution.completion.arguments. Preserve those arguments and the chosen result on retries.');
    this.name = 'CompletionArgumentsError';
  }
}
