import { z } from 'zod';
import { EVOLUTION_ALLOWED_TARGET_PREFIXES } from '#evolution/apply-runner.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpWorkspaceRoot } from './workspace-diagnostics.js';
import { structuredError, type McpCall } from './phase-guidance.js';

const fields: Record<string, string> = {
  workspaceRoot: 'Workspace containing .playspec; defaults to server workspace. Relative overrides resolve against server workspace. Keep this value in every follow-up call. User-global workflow install/remove remain global.',
  taskId: 'Exact task ID or unique prefix from playspec_list_tasks; takes precedence over sessionId.',
  sessionId: 'Caller-chosen session identifier bound by playspec_use_session_task in this workspace; no CLI HEAD fallback.',
  contextMode: 'compact: context references; strict: embed context bodies; full: expanded context. Default compact.',
  withReview: 'Save a review prompt when completing the phase; does not run an independent reviewer or grant approval.',
  title: 'Human-readable title.', workflow: 'Installed workflow ID; inspect playspec_list_workflows and playspec_show_workflow first. Default mono-spec.',
  workflowId: 'Workflow ID from playspec_list_workflows in the same workspace.',
  phaseId: 'Phase ID from playspec_show_workflow.definition.phaseOrder or playspec_get_status, not the displayed step number.',
  afterPhaseId: 'Existing phase ID after which to insert/move the phase; inspect playspec_show_workflow.',
  newPhaseId: 'New unique phase ID within this workflow.',
  templatePath: 'Existing template file relative to the workflow templateDir returned by playspec_show_workflow; not relative to workspaceRoot.',
  workflowPath: 'Workflow directory containing workflow.yaml and templates; its basename must match definition.id. Absolute or relative to workspaceRoot.',
  outDir: 'Export destination directory, absolute or relative to workspaceRoot. Default workflowId. Export copies files into this directory; use workflowId as the basename if it will later be validated/installed.',
  replacement: 'Optional replacement phase recorded in the edit report; does not migrate active tasks or rewrite routing. Remove references first; active-task compatibility checks still apply.',
  sourceTaskId: 'Source task ID or unique prefix; takes precedence over taskId/sessionId.',
  targetTaskId: 'Target task ID or unique prefix from playspec_list_tasks in the same workspace.',
  type: 'Link direction from source to target: parent means target is source’s parent; after means source follows target; related is a direct association.',
  adapter: 'Session adapter label stored as metadata. Default mcp.',
  bindSessionId: 'Optional caller-chosen session identifier to bind to the newly created task.',
  parentTaskId: 'Existing task ID/prefix to link as the new task’s parent.',
  afterTaskId: 'Existing task ID/prefix that the new task follows.',
  variables: 'Workflow variable values; inspect playspec_show_workflow.definition.variables for required names and defaults.',
  sourceProblemText: 'Inline source problem text saved with the new task; do not combine with sourceProblemFile.',
  sourceProblemFile: 'Existing source problem file, absolute or relative to workspaceRoot; do not combine with sourceProblemText.',
  status: 'Task status filter. Default active and completed; all includes archived.',
  phase: 'Exact current phase ID filter, not a step number.',
  slug: 'Case-insensitive substring of task ID or title.',
  idContains: 'Case-insensitive substring of task ID.',
  summary: 'Compact records by default; false requests full records, as does detail:true.',
  detail: 'True requests full records; otherwise compact summaries unless summary:false.',
  limit: 'Maximum page size. Default 50; maximum 500.', offset: 'Zero-based page offset. Default 0; increase by returned count while hasMore is true.',
  path: 'Workspace-relative file reference; must not escape the workspace.',
  fromEvidence: 'Existing workspace-relative evidence file used to generate/refine the proposal.',
  target: `Workspace-relative target file; no absolute paths or workspace escapes. Executable evolution targets must be under: ${EVOLUTION_ALLOWED_TARGET_PREFIXES.join(', ')}. Advisory targets may identify other files.`,
  rationale: 'Evidence-based reason for this change or observation.', risk: 'Proposal risk level; default medium.',
  proposalId: 'Proposal ID returned by generate/store or playspec_list_evolution_proposals; use the same workspace.',
  generatedId: 'Optional filesystem-safe ID for a new proposal; omitted generates an ID. Use proposalId to refine an existing proposal instead.',
  threadId: 'Feedback thread ID from playspec_list_feedback_threads or completion.feedback.threadId; inspect playspec_get_feedback_thread first.',
  note: 'Explain how this evidence supports the proposal.',
  reason: 'Reason for this explicit status/recovery operation; retain review evidence when resetting a harness.',
  id: 'Optional unique filesystem-safe observation ID; omitted generates one.',
  editId: 'Observation ID from playspec_list_human_edit_observations or the record response.',
  before: 'Workspace-relative reference to a file containing the before version; this is a path, not inline content.',
  after: 'Workspace-relative reference to a file containing the after version; this is a path, not inline content.',
  approved: 'Set true only after explicit approval of the inspected proposal diff. This flag authorizes writes; never infer approval from nextActions.',
  confirm: 'Set true only after reviewing the operation’s impact and obtaining authorization; false does not execute.',
  result: 'Observed harness attempt outcome: success or failure; recording may block further automation.',
};

const overrides: Record<string, Record<string, string>> = {
  playspec_create_task: { taskId: 'Optional exact new task ID; omitted derives it from title. Must not already exist.' },
  playspec_unlink_tasks: { type: `${fields.type} Omit to remove all direct link types between source and target.` },
  playspec_generate_evolution_proposal: { proposalId: 'Existing pending/refining proposal ID to refine; omit to create a new proposal.', summary: 'Brief description of the proposed change, used for the generated action.' },
  playspec_record_human_edit_observation: { summary: 'Brief description of the human edit; records evidence only and does not modify the target file.' },
  playspec_update_human_edit_observation_status: { status: 'ignored excludes this observation from future context; superseded marks it replaced. Does not alter the target file.' },
  playspec_list_human_edit_observations: { status: 'Optional exact observation status filter: recorded, ignored or superseded. Omit for all.' },
};

const descriptions: Record<string, string> = {
  playspec_install_workflow: 'Install a workflow directory into the user-global workflow store, shared across projects. workspaceRoot selects the source path base, not installation scope. Does not create a project-local editable copy.',
  playspec_remove_workflow: 'Remove a user-global workflow shared across projects; project-local copies are unaffected. Inspect source with playspec_show_workflow and obtain authorization before confirm:true.',
  playspec_export_workflow: 'Copy a resolved workflow to outDir. To create an editable project override, explicitly choose .playspec/workflows/<workflowId> as outDir, then inspect it.',
  playspec_update_evolution_proposal: 'Replace an existing pending/refining proposal document. Supply source, targetFiles, riskLevel, actions, rationale and review. Server preserves ID/creation time and increments revision; omitted status/evidenceRefs are preserved. Does not apply changes.',
  playspec_store_evolution_proposal: 'Validate and store a new full canonical proposal document. IDs must be unique; applied/failed status cannot be stored. Only replace_file/append_section/replace_section actions are executable; propose_* actions need refinement. Does not apply changes.',
  playspec_rollback_state: 'Restore task state from its last safe point; does not roll back git files. Inspect playspec_plan_rollback and desync status before choosing recovery; inspect status afterwards.',
  playspec_set_current_phase: 'Explicit recovery: change task current phase using a phase ID from its workflow. Existing validation gates still apply. Inspect status and workflow first; this does not perform phase work.',
  playspec_execute_git_rollback: 'Execute guarded git recovery from the last safe point; may change git/worktree state. First inspect playspec_plan_rollback, obtain authorization, then confirm:true. Never use as routine phase advancement.',
  playspec_reset_harness: 'Clear blocked automation harness state only after reviewing the cause and deciding to resume. Inspect playspec_get_harness_status first and provide the review reason. Does not complete a phase.',
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function guidance(name: string, args: Record<string, unknown>, body: Record<string, unknown>, root: string, failed: boolean): McpCall[] {
  const calls: McpCall[] = [];
  const add = (tool: string, values: Record<string, unknown> = {}) => calls.push({ tool, arguments: { ...values, workspaceRoot: root } });
  const proposal = record(body.proposal);
  const observation = record(body.observation);
  const taskId = typeof body.taskId === 'string' ? body.taskId : typeof body.sourceTaskId === 'string' ? body.sourceTaskId : typeof args.sourceTaskId === 'string' ? args.sourceTaskId : args.taskId;
  const task = typeof taskId === 'string' ? { taskId } : typeof args.sessionId === 'string' ? { sessionId: args.sessionId } : null;
  if (name.includes('workflow') && !name.includes('render')) {
    if (failed || name === 'playspec_remove_workflow' || name === 'playspec_validate_workflow') add('playspec_list_workflows');
    else if (typeof args.workflowId === 'string' || typeof body.workflowId === 'string' || typeof body.id === 'string') {
      const workflowId = body.workflowId ?? args.workflowId ?? body.id;
      if (name !== 'playspec_show_workflow') add('playspec_show_workflow', { workflowId });
    }
  } else if (name.includes('feedback_thread')) {
    if (failed || name === 'playspec_get_feedback_thread') add('playspec_list_feedback_threads');
    else if (Array.isArray(body.threads)) for (const item of body.threads) add('playspec_get_feedback_thread', { threadId: record(item).id });
  } else if (name.includes('human_edit_observation')) {
    if (failed || name === 'playspec_get_human_edit_observation') add('playspec_list_human_edit_observations');
    else if (typeof observation.id === 'string') add('playspec_get_human_edit_observation', { editId: observation.id });
    else if (Array.isArray(body.observations)) for (const item of body.observations) add('playspec_get_human_edit_observation', { editId: record(item).id });
  } else if (name.includes('evolution')) {
    if (failed) {
      add('playspec_list_evolution_proposals');
      if (name === 'playspec_generate_evolution_proposal' && task) { add('playspec_list_tasks'); add('playspec_get_harness_status', task); }
      if (name === 'playspec_append_evolution_thread_evidence') add('playspec_list_feedback_threads');
      else if (typeof args.proposalId === 'string') add('playspec_get_evolution_proposal', { proposalId: args.proposalId });
    } else {
      const proposalId = proposal.id ?? args.proposalId;
      if (typeof proposalId === 'string') {
        if (name !== 'playspec_get_evolution_proposal') add('playspec_get_evolution_proposal', { proposalId });
        if (name !== 'playspec_diff_evolution_proposal' && executable(proposal) && (proposal.status === 'pending' || proposal.status === 'refining')) add('playspec_diff_evolution_proposal', { proposalId });
      } else if (Array.isArray(body.proposals)) for (const item of body.proposals) add('playspec_get_evolution_proposal', { proposalId: record(item).id });
    }
  } else if (name.includes('session_task')) {
    const session = name === 'playspec_use_session_task' ? body : record(body.session);
    if (typeof session.currentTaskId === 'string') add('playspec_get_status', { taskId: session.currentTaskId });
    else add('playspec_list_tasks');
  } else if (task) {
    if (failed) add('playspec_list_tasks');
    add('playspec_get_status', task);
    if ((name === 'playspec_add_context' || name.includes('link_tasks')) && typeof task.taskId === 'string') add('playspec_get_task', { taskId: task.taskId });
    if (name.includes('harness')) add('playspec_get_harness_status', task);
    if (name.includes('rollback') || name.includes('desync')) {
      add('playspec_run_state_desync_check', task);
      if (name !== 'playspec_plan_rollback') add('playspec_plan_rollback', task);
    }
    if (name === 'playspec_set_current_phase') add('playspec_render_next_prompt', task);
  } else if (failed) add('playspec_list_tasks');
  return calls;
}

function executable(proposal: Record<string, unknown>): boolean {
  return Array.isArray(proposal.actions) && proposal.actions.length > 0 && proposal.actions.every(a => ['replace_file', 'append_section', 'replace_section'].includes(String(record(a).type)));
}

export const READ_ONLY_TOOLS = new Set([
  'playspec_list_tasks', 'playspec_get_task', 'playspec_get_status', 'playspec_get_session_task',
  'playspec_list_workflows', 'playspec_show_workflow', 'playspec_validate_workflow',
  'playspec_run_state_desync_check', 'playspec_plan_rollback', 'playspec_get_harness_status',
  'playspec_list_evolution_proposals', 'playspec_get_evolution_proposal', 'playspec_diff_evolution_proposal',
  'playspec_list_feedback_threads', 'playspec_get_feedback_thread', 'playspec_list_human_edit_observations', 'playspec_get_human_edit_observation',
]);
// Rendering can recover a pending transaction and store prompt/context snapshots. It is
// safe inspection guidance but is not annotated read-only at the protocol boundary.
const INSPECTION_TOOLS = new Set([...READ_ONLY_TOOLS, 'playspec_render_next_prompt', 'playspec_render_phase_prompt']);

function instructions(name: string, body: Record<string, unknown>): string | undefined {
  const proposal = record(body.proposal);
  if (typeof proposal.id === 'string' && (proposal.status === 'pending' || proposal.status === 'refining')) {
    return executable(proposal)
      ? 'Inspect playspec_diff_evolution_proposal. Apply only after explicit approval; nextActions never supplies approved:true.'
      : 'This proposal contains advisory actions. Review the evidence and author a replacement document with executable replace_file/append_section/replace_section actions using playspec_update_evolution_proposal before diff/apply. Do not treat generated advice as approved changes.';
  }
  if (name === 'playspec_plan_rollback') return 'Review the safe point, target files and safety reasons. State-only recovery changes task state; git recovery may change worktree files and requires explicit authorization plus confirm:true. No mutation is authorized by this preview.';
  if (name === 'playspec_get_harness_status') return 'If blocked, review the failure cause before explicitly resetting with a review reason. A reset does not complete the current phase.';
  return undefined;
}

/** One transport boundary keeps all tools self-describing and all suggested calls inspection operations. */
export function registerGuidedTool<Shape extends z.ZodRawShape>(
  server: McpServer, root: string, name: string, description: string, shape: Shape,
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<CallToolResult>,
) {
  const described = Object.fromEntries(Object.entries(shape).map(([key, schema]) => {
    const text = overrides[name]?.[key] ?? schema.description ?? fields[key];
    if (!text) throw new Error(`Missing MCP argument description: ${name}.${key}`);
    return [key, schema.describe(text)];
  })) as Shape;
  server.tool(name, descriptions[name] ?? description, described as z.ZodRawShape, { readOnlyHint: READ_ONLY_TOOLS.has(name), destructiveHint: ['playspec_execute_git_rollback', 'playspec_rollback_state', 'playspec_set_current_phase', 'playspec_reset_harness', 'playspec_remove_workflow', 'playspec_apply_evolution_proposal', 'playspec_update_evolution_proposal', 'playspec_update_human_edit_observation_status', 'playspec_unlink_tasks', 'playspec_workflow_add_phase', 'playspec_workflow_remove_phase', 'playspec_workflow_reorder_phase', 'playspec_workflow_set_template', 'playspec_export_workflow'].includes(name), openWorldHint: false }, async (args): Promise<CallToolResult> => {
    const input = args as Record<string, unknown>;
    const workspaceRoot = resolveMcpWorkspaceRoot(root, typeof input.workspaceRoot === 'string' ? input.workspaceRoot : undefined);
    let result: CallToolResult;
    try { result = await handler(args as z.infer<z.ZodObject<Shape>>); }
    catch (error) {
      result = { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], structuredContent: { error: structuredError(error) } };
    }
    const body = record(result.structuredContent);
    const nextActions = guidance(name, input, body, workspaceRoot, result.isError === true);
    const scopeCalls = (calls: unknown[]) => calls.map(value => {
      const call = record(value);
      if (typeof call.tool !== 'string' || !INSPECTION_TOOLS.has(call.tool)) throw new Error('MCP nextActions must contain inspection calls only.');
      return { tool: call.tool, arguments: { ...record(call.arguments), workspaceRoot } };
    });
    if (result.isError) {
      const error = record(body.error);
      const existing = Array.isArray(error.nextActions) ? error.nextActions : [];
      return { ...result, structuredContent: { ...body, workspaceRoot, error: { ...error, nextActions: scopeCalls(existing.length ? existing : nextActions) } } };
    }
    const usage = instructions(name, body);
    const enriched = { ...body, workspaceRoot, ...(usage ? { instructions: usage } : {}), nextActions: scopeCalls(Array.isArray(body.nextActions) ? body.nextActions : nextActions) };
    return { ...result, structuredContent: enriched, content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] };
  });
}
