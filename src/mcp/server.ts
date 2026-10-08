import { registerGuidedTool } from './tool-contract.js';
import { EvolutionProposalSchema, HumanEditObservationStatusSchema } from '#evolution/schemas.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';
import { CompletionArgumentsError, phasePromptResponse, scopedReadCall, structuredError } from './phase-guidance.js';
import type { TaskCallContext } from './phase-guidance.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { PlaySpecError } from '#core/errors.js';
import { createNormalTask } from '#core/task-creation.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import type { HarnessAttemptResult, TaskLinkType, TaskRecord, TaskStatus, TaskSummary } from '#core/types.js';
import { WorkflowEditor } from '#workflow/workflow-editor.js';
import { WorkflowInstaller } from '#workflow/workflow-installer.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import { McpApprovalRequiredError, McpConfirmationRequiredError } from './errors.js';
import { EvolutionApplyRunner, EVOLUTION_ALLOWED_TARGET_PREFIXES } from '#evolution/apply-runner.js';
import { appendFeedbackThreadEvidence } from '#evolution/feedback-updater.js';
import { generateEvolutionProposal } from '#evolution/proposal-generator.js';
import {
  EvolutionHumanEditStore,
  generateHumanEditObservationId,
} from '#evolution/human-edit-store.js';
import type { EvolutionRiskLevel, HumanEditObservation } from '#evolution/types.js';
import { McpSessionStore } from './session-store.js';
import { resolveMcpTaskId } from './context.js';
import {
  collectMcpWorkspaceDiagnostics,
  formatMcpWorkspaceDiagnostics,
  resolveMcpWorkspaceRoot,
  type McpWorkspaceDiagnostics,
} from './workspace-diagnostics.js';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data !== null && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : { data } };
}

function err(error: unknown, diagnostics?: McpWorkspaceDiagnostics, context?: TaskCallContext) {
  const structuredContent = { error: structuredError(error, context ?? (diagnostics ? { workspaceRoot: diagnostics.workspaceRoot } : undefined)), ...(diagnostics ? { diagnostics } : {}) };
  if (error instanceof PlaySpecError) {
    const text = error.hint
      ? `${error.message}\n\nHint: ${error.hint}`
      : error.message;
    return {
      content: [{
        type: 'text' as const,
        text: appendDiagnostics(text, diagnostics),
      }],
      structuredContent,
      isError: true as const,
    };
  }
  const text = error instanceof Error ? error.message : String(error);
  return {
    content: [{
      type: 'text' as const,
      text: appendDiagnostics(text, diagnostics),
    }],
    structuredContent,
    isError: true as const,
  };
}

function appendDiagnostics(text: string, diagnostics?: McpWorkspaceDiagnostics): string {
  if (!diagnostics) {
    return text;
  }
  return `${text}\n\n${formatMcpWorkspaceDiagnostics(diagnostics)}`;
}

const taskContext = {
  taskId: z.string().optional().describe("Exact task ID or unique prefix; takes precedence over sessionId. Use the canonical taskId returned by create/render."),
  sessionId: z.string().optional().describe("Session previously bound with playspec_use_session_task; required when taskId is omitted. Never uses CLI HEAD."),
  workspaceRoot: z.string().optional().describe("Workspace containing .playspec. Copy from returned completion/recovery arguments when operating outside the server workspace."),
};

const taskContextWithEvolution = {
  ...taskContext,
  withEvolutionContext: z.boolean().optional().describe('Include optional evolution evidence context; does not apply proposals.'),
  contextMode: z.enum(['compact', 'strict', 'full']).optional().describe('compact: concise context references; strict: embed context bodies; full: expanded context. Default compact.'),
};

// Reuse the canonical validator while publishing ownership/path semantics to clients.
const proposalInput = EvolutionProposalSchema.extend({
  id: EvolutionProposalSchema.shape.id.describe('Unique filesystem-safe proposal ID; use list/get to rediscover existing IDs.'),
  revision: EvolutionProposalSchema.shape.revision.describe('Positive proposal revision; normally 1 on initial store. Updates increment it on the server.'),
  createdAt: EvolutionProposalSchema.shape.createdAt.describe('Creation timestamp string; retained by the server on updates.'),
  updatedAt: EvolutionProposalSchema.shape.updatedAt.describe('Last update timestamp string; replaced by the server on updates.'),
  status: EvolutionProposalSchema.shape.status.describe('pending/refining are editable; skipped is inactive. applied/failed are apply-runner managed and cannot be initially stored.'),
  source: EvolutionProposalSchema.shape.source.describe('Source task/archive IDs and artifact references. Artifact paths are workspace-relative and must exist; generationSource is legacy provenance, not approval.'),
  targetFiles: EvolutionProposalSchema.shape.targetFiles.describe(`Workspace-relative target files. Executable writes are restricted to: ${EVOLUTION_ALLOWED_TARGET_PREFIXES.join(', ')}. Symlink containment is enforced.`),
  evidenceRefs: EvolutionProposalSchema.shape.evidenceRefs.describe('Supporting files with note, addedAt timestamp and source append-evidence/generated. Paths are workspace-relative and must exist. Omitted on update preserves existing evidence.'),
  actions: EvolutionProposalSchema.shape.actions.describe('Discriminated by type. propose_* actions are advisory; replace_file, append_section and replace_section are executable and require content. All paths are workspace-relative; section actions need sectionName. Refine advisory actions before diff/apply.'),
  rationale: EvolutionProposalSchema.shape.rationale.describe('Evidence-based reason for the complete proposal.'),
  review: EvolutionProposalSchema.shape.review.describe('Review metadata with unreviewed/needs_review/reviewed status. This does not replace explicit approved:true authorization for applying a reviewed diff.'),
});

const riskLevel = z.enum(['low', 'medium', 'high']);
const harnessAttemptResult = z.enum(['success', 'failure']);
const humanEditStatus = z.enum(['ignored', 'superseded']);
const taskLinkType = z.enum(['parent', 'after', 'related']);
const listTaskStatus = z.enum(['active', 'completed', 'archived', 'all']);
const LIST_TASKS_DEFAULT_LIMIT = 50;
const LIST_TASKS_MAX_LIMIT = 500;

type ListTasksStatus = z.infer<typeof listTaskStatus>;
type ListTasksItem = TaskSummary | TaskRecord;

interface ListTasksArgs {
  status?: ListTasksStatus;
  phase?: string;
  slug?: string;
  idContains?: string;
  summary?: boolean;
  detail?: boolean;
  limit?: number;
  offset?: number;
}

interface StatusSummaries {
  active: TaskSummary[];
  completed: TaskSummary[];
  archived: TaskSummary[];
}

interface GroupedListTasks<T extends ListTasksItem> {
  active: T[];
  completed: T[];
  archived: T[];
}

function requestedStatuses(status?: ListTasksStatus): TaskStatus[] {
  if (status === 'archived') return ['archived'];
  if (status === 'completed') return ['completed'];
  if (status === 'active') return ['active'];
  if (status === 'all') return ['active', 'completed', 'archived'];
  return ['active', 'completed'];
}

function normalizeNeedle(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function matchesListTasksFilters(task: TaskSummary, args: ListTasksArgs): boolean {
  if (args.phase !== undefined && task.currentPhase !== args.phase) {
    return false;
  }

  const slug = normalizeNeedle(args.slug);
  if (slug && !task.id.toLowerCase().includes(slug) && !task.title.toLowerCase().includes(slug)) {
    return false;
  }

  const idContains = normalizeNeedle(args.idContains);
  if (idContains && !task.id.toLowerCase().includes(idContains)) {
    return false;
  }

  return true;
}

function flattenSummariesByStatus(summaries: StatusSummaries, statuses: TaskStatus[]): TaskSummary[] {
  return statuses.flatMap((status) => summaries[status]);
}

function paginateTasks<T>(tasks: T[], limit: number, offset: number): T[] {
  return tasks.slice(offset, offset + limit);
}

function groupTasksByStatus<T extends ListTasksItem>(tasks: T[]): GroupedListTasks<T> {
  return tasks.reduce<GroupedListTasks<T>>(
    (grouped, task) => {
      grouped[task.status].push(task);
      return grouped;
    },
    { active: [], completed: [], archived: [] }
  );
}

async function expandListTaskDetails(
  taskStore: YamlTaskStore,
  tasks: TaskSummary[]
): Promise<TaskRecord[]> {
  return Promise.all(tasks.map((task) => (
    task.status === 'archived'
      ? taskStore.getArchivedTask(task.id)
      : taskStore.getTask(task.id)
  )));
}

export function buildMcpServer(workspaceRoot: string): McpServer {
  const server = new McpServer({ name: 'playspec', version: '0.1.0' });
  const getScopedTaskContext = (args: { workspaceRoot?: string }) => {
    const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
    const scopedTaskStore = new YamlTaskStore(effectiveWorkspaceRoot);
    return {
      workspaceRoot: effectiveWorkspaceRoot,
      taskStore: scopedTaskStore,
      core: new PlaySpecCore(effectiveWorkspaceRoot, scopedTaskStore),
      sessionStore: new McpSessionStore(effectiveWorkspaceRoot),
      taskIdResolver: new TaskIdResolver(scopedTaskStore),
    };
  };
  const resolveScopedTask = async (args: { taskId?: unknown; sessionId?: unknown; workspaceRoot?: string }) => {
    const scoped = getScopedTaskContext(args);
    const taskId = await resolveMcpTaskId(args, scoped.sessionStore, scoped.taskIdResolver);
    return { ...scoped, taskId };
  };
  const getScopedEvolutionContext = (args: { workspaceRoot?: string }) => {
    const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
    return {
      workspaceRoot: effectiveWorkspaceRoot,
      proposalStore: new EvolutionProposalStore(effectiveWorkspaceRoot),
      applyRunner: new EvolutionApplyRunner(effectiveWorkspaceRoot),
    };
  };

  registerGuidedTool(server, workspaceRoot,
    'playspec_list_tasks',
    'List PlaySpec tasks with server-side filtering, bounded pagination, and compact summaries by default',
    {
      workspaceRoot: z.string().optional(),
      status: listTaskStatus.optional(),
      phase: z.string().optional(),
      slug: z.string().optional(),
      idContains: z.string().optional(),
      summary: z.boolean().optional(),
      detail: z.boolean().optional(),
      limit: z.number().int().min(1).max(LIST_TASKS_MAX_LIMIT).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async (args) => {
      try {
        const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
        const scopedTaskStore = new YamlTaskStore(effectiveWorkspaceRoot);
        const statuses = requestedStatuses(args.status);
        const [active, completed, archived] = await Promise.all([
          statuses.includes('active') ? scopedTaskStore.listActiveTasks() : Promise.resolve([]),
          statuses.includes('completed') ? scopedTaskStore.listCompletedTasks() : Promise.resolve([]),
          statuses.includes('archived') ? scopedTaskStore.listArchivedTasks() : Promise.resolve([]),
        ]);
        const summaries = { active, completed, archived };
        const filtered = flattenSummariesByStatus(summaries, statuses)
          .filter((task) => matchesListTasksFilters(task, args));
        const limit = args.limit ?? LIST_TASKS_DEFAULT_LIMIT;
        const offset = args.offset ?? 0;
        const paged = paginateTasks(filtered, limit, offset);
        const detail = args.detail === true || args.summary === false;
        const grouped = groupTasksByStatus(
          detail ? await expandListTaskDetails(scopedTaskStore, paged) : paged
        );
        const diagnostics = await collectMcpWorkspaceDiagnostics(workspaceRoot, effectiveWorkspaceRoot);
        const response: Record<string, unknown> = {
          active: grouped.active,
          completed: grouped.completed,
          pagination: {
            limit,
            offset,
            total: filtered.length,
            returned: paged.length,
            hasMore: offset + paged.length < filtered.length,
          },
          diagnostics,
        };
        if (statuses.includes('archived')) {
          response['archived'] = grouped.archived;
        }
        return ok(response);
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_get_task',
    'Get full task record by taskId',
    { taskId: z.string(), workspaceRoot: z.string().optional() },
    async (args) => {
      const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
      const diagnostics = await collectMcpWorkspaceDiagnostics(workspaceRoot, effectiveWorkspaceRoot);
      try {
        const scopedTaskStore = new YamlTaskStore(effectiveWorkspaceRoot);
        const resolved = await new TaskIdResolver(scopedTaskStore).resolve(args.taskId);
        const task = await scopedTaskStore.getTask(resolved.taskId);
        return ok({ ...task, diagnostics });
      } catch (e) {
        return err(e, diagnostics);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_get_status',
    'Get a lightweight status summary for a task (current phase, status, completion) without the full record. Cheap "where am I" check; prefer this over playspec_get_task / playspec_list_tasks when you only need the current phase.',
    taskContext,
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const status = await core.getTaskStatus(taskId);
        return ok({ ...status, nextActions: [scopedReadCall(status.isWorkflowComplete ? 'playspec_get_task' : 'playspec_render_next_prompt', { taskId, workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) })] });
      } catch (e) {
        return err(e, undefined, { ...args, workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) });
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_create_task',
    'Create a PlaySpec task for an installed workflow',
    {
      workspaceRoot: z.string().optional(),
      title: z.string(),
      workflow: z.string().optional().describe('Workflow ID from playspec_list_workflows; default mono-spec. Inspect playspec_show_workflow for required variables.'),
      taskId: z.string().optional(),
      variables: z.record(z.string()).optional().describe('Values for workflow variable declarations. Required names and defaults are in playspec_show_workflow.definition.variables.'),
      sourceProblemText: z.string().optional(),
      sourceProblemFile: z.string().optional(),
      parentTaskId: z.string().optional(),
      afterTaskId: z.string().optional(),
      bindSessionId: z.string().optional(),
      adapter: z.string().optional(),
    },
    async (args) => {
      const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
      const diagnostics = await collectMcpWorkspaceDiagnostics(workspaceRoot, effectiveWorkspaceRoot);
      try {
        const created = await createNormalTask(effectiveWorkspaceRoot, {
          title: args.title,
          workflow: args.workflow ?? 'mono-spec',
          taskId: args.taskId,
          variables: args.variables,
          sourceProblemText: args.sourceProblemText,
          sourceProblemFile: args.sourceProblemFile,
          sourceProblemMethod: args.sourceProblemText !== undefined ? 'mcp' : 'create',
          parentTaskId: args.parentTaskId,
          afterTaskId: args.afterTaskId,
          linkCreatedBy: 'agent',
        });
        let boundSession = null;
        if (args.bindSessionId) {
          boundSession = await new McpSessionStore(effectiveWorkspaceRoot).setSessionTask(
            args.bindSessionId,
            created.taskId,
            args.adapter ?? 'mcp'
          );
        }
        return ok({
          taskId: created.task.id,
          title: created.task.title,
          workflow: created.task.workflow,
          status: created.task.status,
          currentPhase: created.task.currentPhase,
          taskRoot: created.task.paths.taskRoot,
          projectDocRoot: created.task.paths.projectDocRoot,
          contextRefs: created.task.contextRefs ?? [],
          sourceProblemFile: created.sourceProblemFile,
          variables: created.task.variables,
          links: created.task.links ?? [],
          boundSession,
          diagnostics,
          nextStep: 'Call playspec_render_next_prompt with taskId or bound sessionId.',
          nextActions: [scopedReadCall('playspec_render_next_prompt', { taskId: created.task.id, workspaceRoot: effectiveWorkspaceRoot })],
        });
      } catch (e) {
        return err(e, diagnostics, { taskId: args.taskId, workspaceRoot: effectiveWorkspaceRoot });
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_use_session_task',
    'Bind a task to a session so later calls can use sessionId instead of taskId',
    { sessionId: z.string(), taskId: z.string(), adapter: z.string().optional(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedTaskContext(args);
        const resolved = await scoped.taskIdResolver.resolve(args.taskId);
        const session = await scoped.sessionStore.setSessionTask(
          args.sessionId,
          resolved.taskId,
          args.adapter ?? 'mcp'
        );
        return ok(session);
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_get_session_task',
    'Get the current task bound to a session',
    { sessionId: z.string(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedTaskContext(args);
        const session = await scoped.sessionStore.loadSession(args.sessionId);
        if (!session) {
          return ok({ session: null, task: null });
        }
        let task = null;
        if (session.currentTaskId) {
          try {
            task = await scoped.taskStore.getTask(session.currentTaskId);
          } catch {
            // task may have been removed
          }
        }
        return ok({ session, task });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_link_tasks',
    'Create a direct task link. Provide sourceTaskId or taskId/sessionId for the source.',
    { ...taskContext, sourceTaskId: z.string().optional(), targetTaskId: z.string(), type: taskLinkType },
    async (args) => {
      try {
        const scoped = getScopedTaskContext(args);
        const sourceTaskId = await resolveMcpSourceTaskId(args, scoped.sessionStore, scoped.taskIdResolver);
        const target = await scoped.taskIdResolver.resolve(args.targetTaskId);
        const result = await scoped.core.addTaskLink(sourceTaskId, target.taskId, args.type as TaskLinkType);
        return ok({
          ...result,
          resolved: {
            sourceTaskId,
            target,
          },
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_unlink_tasks',
    'Remove direct task links. Provide sourceTaskId or taskId/sessionId for the source.',
    { ...taskContext, sourceTaskId: z.string().optional(), targetTaskId: z.string(), type: taskLinkType.optional() },
    async (args) => {
      try {
        const scoped = getScopedTaskContext(args);
        const sourceTaskId = await resolveMcpSourceTaskId(args, scoped.sessionStore, scoped.taskIdResolver);
        const target = await scoped.taskIdResolver.resolve(args.targetTaskId);
        const result = await scoped.core.removeTaskLink(sourceTaskId, target.taskId, args.type as TaskLinkType | undefined);
        return ok({
          ...result,
          resolved: {
            sourceTaskId,
            target,
          },
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_list_workflows',
    'List workflows for the requested workspace. Inspect playspec_show_workflow before create to discover phase and variable requirements.',
    { workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
        const scopedRegistry = new WorkflowRegistry(effectiveWorkspaceRoot);
        const scopedLoader = new WorkflowLoader(effectiveWorkspaceRoot);
        const locations = await scopedRegistry.list();
        const workflows = await Promise.all(
          locations.map(async (location) => {
            const workflow = await scopedLoader.resolve(location.id);
            return {
              id: workflow.id,
              source: workflow.source,
              rootDir: toWorkspaceRelativeOrAbsolute(effectiveWorkspaceRoot, workflow.rootDir),
              name: workflow.definition.name,
              description: workflow.definition.description,
              phaseOrder: workflow.definition.phaseOrder,
            };
          })
        );
        return ok({ workflows });
      } catch (e) {
        return err(e, undefined, { workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) });
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_show_workflow',
    'Show a workflow definition, variables, phases and gate requirements in the requested workspace. Use definition.variables to supply required create-task variables.',
    { workflowId: z.string().describe('Workflow ID returned by playspec_list_workflows.'), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
        const workflow = await new WorkflowLoader(effectiveWorkspaceRoot).resolve(args.workflowId);
        return ok({
          id: workflow.id,
          source: workflow.source,
          rootDir: toWorkspaceRelativeOrAbsolute(effectiveWorkspaceRoot, workflow.rootDir),
          templateDir: toWorkspaceRelativeOrAbsolute(effectiveWorkspaceRoot, workflow.templateDir),
          definition: workflow.definition,
        });
      } catch (e) {
        return err(e, undefined, { workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) });
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_validate_workflow',
    'Validate a workflow directory',
    { workflowPath: z.string(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        const effectiveRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
        const workflow = await new WorkflowLoader(effectiveRoot).resolveFromDirectory(resolveWorkspacePath(effectiveRoot, args.workflowPath));
        return ok({
          id: workflow.id,
          source: workflow.source,
          rootDir: toWorkspaceRelativeOrAbsolute(effectiveRoot, workflow.rootDir),
          phaseOrder: workflow.definition.phaseOrder,
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_install_workflow',
    'Install a user workflow directory',
    { workflowPath: z.string(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        const effectiveRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
        const workflowId = await new WorkflowInstaller(effectiveRoot).install(resolveWorkspacePath(effectiveRoot, args.workflowPath));
        return ok({ workflowId });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_remove_workflow',
    'Remove a user workflow. Requires confirm true.',
    { workflowId: z.string(), confirm: z.boolean(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        if (args.confirm !== true) {
          throw new McpConfirmationRequiredError(
            'MCP workflow removal requires confirm: true.',
            'Inspect playspec_list_workflows or playspec_show_workflow before removing a user workflow.'
          );
        }
        await new WorkflowInstaller(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).remove(args.workflowId);
        return ok({ workflowId: args.workflowId, removed: true });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_export_workflow',
    'Export a workflow directory',
    { workflowId: z.string(), outDir: z.string().optional(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        const effectiveRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
        const target = resolveWorkspacePath(effectiveRoot, args.outDir ?? args.workflowId);
        await new WorkflowInstaller(effectiveRoot).export(args.workflowId, target);
        return ok({
          workflowId: args.workflowId,
          targetPath: toWorkspaceRelativeOrAbsolute(effectiveRoot, target),
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_workflow_add_phase',
    'Add a phase to an installed project workflow',
    {
      workflowId: z.string(),
      afterPhaseId: z.string(),
      newPhaseId: z.string(),
      workspaceRoot: taskContext.workspaceRoot,
      title: z.string(),
      templatePath: z.string(),
    },
    async (args) => {
      try {
        return ok(await new WorkflowEditor(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).addPhase(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_workflow_remove_phase',
    'Remove a phase from an installed project workflow',
    { workflowId: z.string(), phaseId: z.string(), replacement: z.string().optional(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        return ok(await new WorkflowEditor(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).removePhase(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_workflow_reorder_phase',
    'Reorder a phase in an installed project workflow',
    { workflowId: z.string(), phaseId: z.string(), afterPhaseId: z.string(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        return ok(await new WorkflowEditor(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).reorderPhase(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_workflow_set_template',
    'Set a phase template in an installed project workflow',
    { workflowId: z.string(), phaseId: z.string(), templatePath: z.string(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        return ok(await new WorkflowEditor(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).setTemplate(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_render_next_prompt',
    'Render the current phase prompt and execution context. Returns phaseId, allowedResults, validation report schema/paths/hashes and server-issued execution.completion.arguments. Perform the phase, then submit those arguments; add result only when resultRequired is true.',
    taskContextWithEvolution,
    async (args) => {
      const recoveryContext: TaskCallContext = { ...args, workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) };
      try {
        const { core, taskId } = await resolveScopedTask(args);
        recoveryContext.taskId = taskId;
        const rendered = await core.renderPhaseExecution(taskId, {
          withEvolutionContext: args.withEvolutionContext,
          evolutionContextSource: 'mcp',
          contextMode: args.contextMode,
        });
        return ok(phasePromptResponse(rendered.prompt, rendered.execution, resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)));
      } catch (e) {
        return err(e, undefined, recoveryContext);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_render_phase_prompt',
    'Inspect a specific phase prompt and execution context. A noncurrent phase is inspection-only and returns no completion call. Requires taskId or sessionId plus phaseId.',
    { ...taskContext, phaseId: z.string(), contextMode: z.enum(['compact', 'strict', 'full']).optional() },
    async (args) => {
      const recoveryContext: TaskCallContext = { ...args, workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) };
      try {
        const { core, taskId } = await resolveScopedTask(args);
        recoveryContext.taskId = taskId;
        const rendered = await core.renderPhaseExecution(taskId, { contextMode: args.contextMode }, args.phaseId);
        return ok(phasePromptResponse(rendered.prompt, rendered.execution, resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)));
      } catch (e) {
        return err(e, undefined, recoveryContext);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_complete_phase',
    'Complete work for the rendered phase. Copy execution.completion.arguments from playspec_render_next_prompt; add result from execution.allowedResults only when required. Reuse the same arguments/result on retries. Stale phase/revision fails; re-render and perform the new phase before completing it.',
    {
      ...taskContextWithEvolution,
      withReview: z.boolean().optional(),
      result: z.string().optional().describe('Required only when execution.resultRequired is true. Choose from execution.allowedResults after reviewing the phase; do not invent a result.'),
      expectedPhaseId: z.string().trim().min(1).describe('Copy execution.completion.arguments.expectedPhaseId from the rendered phase.'),
      expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).optional().describe('Copy the server-issued revision from execution.completion.arguments. Detects stale same-phase state; omit only for legacy clients.'),
      requestId: z.string().trim().min(1).max(128).describe('Copy execution.completion.arguments.requestId. Reuse unchanged on retries of the same logical completion; never reuse for another phase/result.'),
    },
    async (args) => {
      const recoveryContext: TaskCallContext = { ...args, workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) };
      try {
        const { core, taskId } = await resolveScopedTask(args);
        recoveryContext.taskId = taskId;
        if (typeof args.expectedPhaseId !== 'string' || !args.expectedPhaseId.trim() ||
            typeof args.requestId !== 'string' || !args.requestId.trim() || args.requestId.length > 128) {
          throw new CompletionArgumentsError();
        }
        const completionResult = await core.completePhase(taskId, {
          withReview: args.withReview,
          result: args.result,
          expectedPhaseId: args.expectedPhaseId,
          expectedRevision: args.expectedRevision,
          requestId: args.requestId,
          withEvolutionContext: args.withEvolutionContext,
          contextMode: args.contextMode,
        });
        return ok({ ...completionResult, nextActions: [scopedReadCall(completionResult.replayed ? 'playspec_get_status' : completionResult.isWorkflowComplete ? 'playspec_get_task' : 'playspec_render_next_prompt', { taskId, workspaceRoot: resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot) })] });
      } catch (e) {
        return err(e, undefined, recoveryContext);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_collect_evidence',
    'Collect git evidence for the current phase. Requires taskId or sessionId.',
    taskContext,
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const evidenceResult = await core.collectEvidence(taskId);
        return ok(evidenceResult);
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_run_state_desync_check',
    'Check for desync between task state and git state. Requires taskId or sessionId.',
    taskContext,
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const desyncResult = await core.checkTaskDesync(taskId);
        return ok(desyncResult);
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_rollback_state',
    'Restore task state from the last safe point. Requires taskId or sessionId.',
    taskContext,
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const rollbackResult = await core.rollbackStateOnly(taskId);
        return ok(rollbackResult);
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_add_context',
    'Add a workspace-relative context file reference to a task. Requires taskId or sessionId.',
    { ...taskContext, path: z.string() },
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const added = await core.addContextRef(taskId, args.path);
        return ok({ taskId, path: args.path, added });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_set_current_phase',
    'Set current workflow phase for recovery. Requires taskId or sessionId.',
    { ...taskContext, phaseId: z.string() },
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        return ok(await core.setCurrentPhase(taskId, args.phaseId));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_create_snapshot',
    'Create manual task and prompt snapshots for the current phase. Requires taskId or sessionId.',
    taskContext,
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        return ok(await core.createSnapshot(taskId));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_plan_rollback',
    'Preview rollback from the last safe point. Requires taskId or sessionId.',
    taskContext,
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        return ok(await core.planRollback(taskId));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_execute_git_rollback',
    'Execute guarded git rollback. Requires taskId or sessionId and confirm true.',
    { ...taskContext, confirm: z.boolean() },
    async (args) => {
      try {
        if (args.confirm !== true) {
          throw new McpConfirmationRequiredError(
            'MCP git rollback requires confirm: true.',
            'Call playspec_plan_rollback first, inspect the plan, then call with confirm: true.'
          );
        }
        const { core, taskId } = await resolveScopedTask(args);
        return ok(await core.executeGitRollback(taskId));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_get_harness_status',
    'Get automation safety harness status. Requires taskId or sessionId.',
    { ...taskContext, phaseId: z.string().optional() },
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        return ok(await core.getHarnessStatus(taskId, args.phaseId));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_record_harness_attempt',
    'Record an automation harness attempt. Requires taskId or sessionId.',
    { ...taskContext, phaseId: z.string(), result: harnessAttemptResult, reason: z.string().optional() },
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        return ok(await core.recordHarnessAttempt(
          taskId,
          args.phaseId,
          args.result as HarnessAttemptResult,
          args.reason
        ));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_reset_harness',
    'Reset blocked harness state after review. Requires taskId or sessionId.',
    { ...taskContext, reason: z.string().optional() },
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        return ok(await core.resetHarness(taskId, args.reason));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_generate_evolution_proposal',
    'Generate or refine an evolution proposal from explicit evidence. Requires taskId or sessionId.',
    {
      ...taskContext,
      fromEvidence: z.string(),
      target: z.string(),
      summary: z.string(),
      rationale: z.string(),
      risk: riskLevel.optional(),
      proposalId: z.string().optional(),
      generatedId: z.string().optional(),
    },
    async (args) => {
      try {
        const { workspaceRoot: effectiveWorkspaceRoot, taskId } = await resolveScopedTask(args);
        const result = await generateEvolutionProposal(effectiveWorkspaceRoot, {
          taskId,
          evidencePath: args.fromEvidence,
          targetPath: args.target,
          summary: args.summary,
          rationale: args.rationale,
          riskLevel: args.risk as EvolutionRiskLevel | undefined,
          proposalId: args.proposalId,
          generatedId: args.generatedId,
        });
        return ok({ taskId, invokedBy: 'mcp', ...result });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_list_evolution_proposals',
    'List stored evolution proposals',
    { workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        return ok({ proposals: await scoped.proposalStore.listProposals() });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_get_evolution_proposal',
    'Get a stored evolution proposal and validation report when present',
    { proposalId: z.string(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        const proposal = await scoped.proposalStore.loadProposal(args.proposalId);
        return ok({
          proposal,
          validationReport: await loadValidationReportIfPresent(scoped.proposalStore, args.proposalId),
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_store_evolution_proposal',
    'Validate and store an evolution proposal object',
    { proposal: proposalInput.describe("Full canonical proposal document. Only pending/refining/skipped may be stored; inspect actions type alternatives. Does not apply target changes."), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        const validation = scoped.proposalStore.validateProposal(args.proposal);
        if (!validation.valid || !validation.proposal) {
          throw new PlaySpecError(
            `Evolution proposal is invalid: ${validation.report.errors.join('; ')}`,
            'Fix the proposal object and call the MCP tool again.'
          );
        }
        const proposalPath = await scoped.proposalStore.saveProposal(validation.proposal);
        const validationPath = await scoped.proposalStore.saveValidationReport(validation.report);
        return ok({ proposal: validation.proposal, proposalPath, validationPath, validationReport: validation.report });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_update_evolution_proposal',
    'Update an existing pending/refining evolution proposal object',
    { proposalId: z.string(), proposal: proposalInput.partial({ id: true, revision: true, createdAt: true, updatedAt: true, status: true, evidenceRefs: true }).describe("Replacement proposal document, not a partial patch. Server supplies ID, incremented revision and timestamps; omitted status/evidenceRefs are preserved. Other required fields must be provided."), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        return ok(await scoped.proposalStore.updateProposal(args.proposalId, args.proposal));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_append_evolution_evidence',
    'Append evidence to an existing pending/refining evolution proposal',
    { proposalId: z.string(), path: z.string(), note: z.string(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        return ok(await scoped.proposalStore.appendEvidence(args.proposalId, { path: args.path, note: args.note }));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_append_evolution_thread_evidence',
    'Append feedback thread evidence to an existing pending/refining evolution proposal',
    { proposalId: z.string(), threadId: z.string(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        return ok(await appendFeedbackThreadEvidence(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot), {
          proposalId: args.proposalId,
          threadId: args.threadId,
        }));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_skip_evolution_proposal',
    'Mark an evolution proposal skipped',
    { proposalId: z.string(), reason: z.string().optional(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        const proposal = await scoped.proposalStore.skipProposal(args.proposalId, {
          skippedAt: new Date().toISOString(),
          ...(args.reason ? { skipReason: args.reason } : {}),
        });
        return ok({ proposal });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_diff_evolution_proposal',
    'Preview executable evolution proposal changes',
    { proposalId: z.string(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        return ok(await scoped.applyRunner.diff(args.proposalId));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_apply_evolution_proposal',
    'Apply an approved executable evolution proposal. Requires approved true.',
    { proposalId: z.string(), approved: z.boolean(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        if (args.approved !== true) {
          throw new McpApprovalRequiredError(
            'MCP evolution apply requires approved: true.',
            'Call playspec_diff_evolution_proposal first, inspect the diff, then call with approved: true.'
          );
        }
        const scoped = getScopedEvolutionContext(args);
        return ok(await scoped.applyRunner.apply(args.proposalId, {
          approved: true,
          approvalSource: 'mcp approved:true',
        }));
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_record_human_edit_observation',
    'Record a human edit observation for future evolution review',
    {
      id: z.string().optional(),
      target: z.string(),
      summary: z.string(),
      rationale: z.string(),
      taskId: z.string().optional(),
      proposalId: z.string().optional(),
      before: z.string().optional(),
      after: z.string().optional(),
      workspaceRoot: z.string().optional(),
    },
    async (args) => {
      try {
        const scoped = getScopedTaskContext(args);
        const sourceTaskId = args.taskId
          ? await resolveMcpTaskId({ taskId: args.taskId }, scoped.sessionStore, scoped.taskIdResolver)
          : undefined;
        const now = new Date().toISOString();
        const observation: HumanEditObservation = {
          id: args.id ?? generateHumanEditObservationId(args.target),
          createdAt: now,
          updatedAt: now,
          status: 'recorded',
          targetPath: args.target,
          summary: args.summary,
          rationale: args.rationale,
          ...(sourceTaskId ? { sourceTaskId } : {}),
          ...(args.proposalId ? { proposalId: args.proposalId } : {}),
          ...(args.before ? { beforeRef: args.before } : {}),
          ...(args.after ? { afterRef: args.after } : {}),
        };
        const observationPath = await new EvolutionHumanEditStore(scoped.workspaceRoot).saveObservation(observation);
        return ok({ observation, observationPath });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_update_human_edit_observation_status',
    'Mark a human edit observation ignored or superseded',
    { editId: z.string(), status: humanEditStatus, reason: z.string().optional(), workspaceRoot: taskContext.workspaceRoot },
    async (args) => {
      try {
        const observation = await new EvolutionHumanEditStore(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).markObservationStatus(args.editId, args.status, { reason: args.reason });
        return ok({ observation });
      } catch (e) {
        return err(e);
      }
    }
  );

  registerGuidedTool(server, workspaceRoot,
    'playspec_list_feedback_threads',
    'Rediscover feedback thread IDs in this workspace. Returns compact paginated summaries; use playspec_get_feedback_thread for full history and evidence before appending to a proposal.',
    { workspaceRoot: taskContext.workspaceRoot, limit: z.number().int().min(1).max(500).optional(), offset: z.number().int().min(0).optional() },
    async (args) => {
      const root = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
      const threads = await new EvolutionFeedbackThreadStore(root).listThreads();
      const limit = args.limit ?? 50; const offset = args.offset ?? 0;
      const page = threads.slice(offset, offset + limit);
      return ok({ threads: page.map(t => ({ id: t.id, sourcePhaseId: t.sourcePhaseId, targetPath: t.targetPath, updatedAt: t.updatedAt, trend: t.trend })),
        pagination: { limit, offset, total: threads.length, returned: page.length, hasMore: offset + page.length < threads.length } });
    }
  );
  registerGuidedTool(server, workspaceRoot,
    'playspec_get_feedback_thread',
    'Read a feedback thread by ID, including compact stored history, trend and target details. Does not create or apply a proposal.',
    { workspaceRoot: taskContext.workspaceRoot, threadId: z.string() },
    async (args) => ok({ thread: await new EvolutionFeedbackThreadStore(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).loadThread(args.threadId) })
  );
  registerGuidedTool(server, workspaceRoot,
    'playspec_list_human_edit_observations',
    'Rediscover human edit observation IDs in this workspace. Returns compact paginated summaries; use playspec_get_human_edit_observation before deciding status changes.',
    { workspaceRoot: taskContext.workspaceRoot, status: HumanEditObservationStatusSchema.optional(), limit: z.number().int().min(1).max(500).optional(), offset: z.number().int().min(0).optional() },
    async (args) => {
      const observations = (await new EvolutionHumanEditStore(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).listObservations()).filter(o => !args.status || o.status === args.status);
      const limit = args.limit ?? 50; const offset = args.offset ?? 0;
      const page = observations.slice(offset, offset + limit);
      return ok({ observations: page.map(o => ({ id: o.id, status: o.status, targetPath: o.targetPath, summary: o.summary, updatedAt: o.updatedAt })),
        pagination: { limit, offset, total: observations.length, returned: page.length, hasMore: offset + page.length < observations.length } });
    }
  );
  registerGuidedTool(server, workspaceRoot,
    'playspec_get_human_edit_observation',
    'Read a human edit observation by ID, including source and before/after file references. Does not modify the observed target.',
    { workspaceRoot: taskContext.workspaceRoot, editId: z.string() },
    async (args) => ok({ observation: await new EvolutionHumanEditStore(resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot)).loadObservation(args.editId) })
  );

  return server;
}

async function loadValidationReportIfPresent(
  store: EvolutionProposalStore,
  proposalId: string
) {
  try {
    return await store.loadValidationReport(proposalId);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw error;
    }
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function resolveMcpSourceTaskId(
  input: { sourceTaskId?: string; taskId?: string; sessionId?: string },
  sessionStore: McpSessionStore,
  taskIdResolver: TaskIdResolver
): Promise<string> {
  if (input.sourceTaskId) {
    const source = await taskIdResolver.resolve(input.sourceTaskId);
    return source.taskId;
  }
  return resolveMcpTaskId(input, sessionStore, taskIdResolver);
}

function resolveWorkspacePath(workspaceRoot: string, inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(workspaceRoot, inputPath);
}

function toWorkspaceRelativeOrAbsolute(workspaceRoot: string, filePath: string): string {
  const relative = path.relative(workspaceRoot, filePath);
  if (relative === '') return '.';
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join(path.posix.sep);
  }
  return filePath;
}
