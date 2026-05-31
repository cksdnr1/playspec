import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { PlaySpecError } from '#core/errors.js';
import { createNormalTask } from '#core/task-creation.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import type { HarnessAttemptResult, TaskLinkType } from '#core/types.js';
import { WorkflowEditor } from '#workflow/workflow-editor.js';
import { WorkflowInstaller } from '#workflow/workflow-installer.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import { EvolutionApplyRunner } from '#evolution/apply-runner.js';
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
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown, diagnostics?: McpWorkspaceDiagnostics) {
  if (error instanceof PlaySpecError) {
    const text = error.hint
      ? `${error.message}\n\nHint: ${error.hint}`
      : error.message;
    return {
      content: [{
        type: 'text' as const,
        text: appendDiagnostics(text, diagnostics),
      }],
      isError: true as const,
    };
  }
  const text = error instanceof Error ? error.message : String(error);
  return {
    content: [{
      type: 'text' as const,
      text: appendDiagnostics(text, diagnostics),
    }],
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
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  workspaceRoot: z.string().optional(),
};

const taskContextWithEvolution = {
  ...taskContext,
  withEvolutionContext: z.boolean().optional(),
  contextMode: z.enum(['compact', 'strict', 'full']).optional(),
};

const riskLevel = z.enum(['low', 'medium', 'high']);
const harnessAttemptResult = z.enum(['success', 'failure']);
const humanEditStatus = z.enum(['ignored', 'superseded']);
const taskLinkType = z.enum(['parent', 'after', 'related']);

export function buildMcpServer(workspaceRoot: string): McpServer {
  const server = new McpServer({ name: 'playspec', version: '0.1.0' });
  const workflowRegistry = new WorkflowRegistry(workspaceRoot);
  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const workflowInstaller = new WorkflowInstaller(workspaceRoot);
  const workflowEditor = new WorkflowEditor(workspaceRoot);
  const proposalStore = new EvolutionProposalStore(workspaceRoot);
  const humanEditStore = new EvolutionHumanEditStore(workspaceRoot);
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

  server.tool(
    'playspec_list_tasks',
    'List active and completed PlaySpec tasks',
    { workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
        const scopedTaskStore = new YamlTaskStore(effectiveWorkspaceRoot);
        const [active, completed] = await Promise.all([
          scopedTaskStore.listActiveTasks(),
          scopedTaskStore.listCompletedTasks(),
        ]);
        const diagnostics = await collectMcpWorkspaceDiagnostics(workspaceRoot, effectiveWorkspaceRoot);
        return ok({ active, completed, diagnostics });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_get_task',
    'Get full task record by taskId',
    { taskId: z.string(), workspaceRoot: z.string().optional() },
    async (args) => {
      const effectiveWorkspaceRoot = resolveMcpWorkspaceRoot(workspaceRoot, args.workspaceRoot);
      const diagnostics = await collectMcpWorkspaceDiagnostics(workspaceRoot, effectiveWorkspaceRoot);
      try {
        const scopedTaskStore = new YamlTaskStore(effectiveWorkspaceRoot);
        const task = await scopedTaskStore.getTask(args.taskId);
        return ok({ ...task, diagnostics });
      } catch (e) {
        return err(e, diagnostics);
      }
    }
  );

  server.tool(
    'playspec_create_task',
    'Create a PlaySpec task for an installed workflow',
    {
      workspaceRoot: z.string().optional(),
      title: z.string(),
      workflow: z.string().optional(),
      taskId: z.string().optional(),
      variables: z.record(z.string()).optional(),
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
        });
      } catch (e) {
        return err(e, diagnostics);
      }
    }
  );

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
    'playspec_list_workflows',
    'List available workflows with effective project/user/builtin priority',
    async () => {
      try {
        const locations = await workflowRegistry.list();
        const workflows = await Promise.all(
          locations.map(async (location) => {
            const workflow = await workflowLoader.resolve(location.id);
            return {
              id: workflow.id,
              source: workflow.source,
              rootDir: toWorkspaceRelativeOrAbsolute(workspaceRoot, workflow.rootDir),
              name: workflow.definition.name,
              description: workflow.definition.description,
              phaseOrder: workflow.definition.phaseOrder,
            };
          })
        );
        return ok({ workflows });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_show_workflow',
    'Show a workflow definition and source details',
    { workflowId: z.string() },
    async (args) => {
      try {
        const workflow = await workflowLoader.resolve(args.workflowId);
        return ok({
          id: workflow.id,
          source: workflow.source,
          rootDir: toWorkspaceRelativeOrAbsolute(workspaceRoot, workflow.rootDir),
          templateDir: toWorkspaceRelativeOrAbsolute(workspaceRoot, workflow.templateDir),
          definition: workflow.definition,
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_validate_workflow',
    'Validate a workflow directory',
    { workflowPath: z.string() },
    async (args) => {
      try {
        const workflow = await workflowLoader.resolveFromDirectory(resolveWorkspacePath(workspaceRoot, args.workflowPath));
        return ok({
          id: workflow.id,
          source: workflow.source,
          rootDir: toWorkspaceRelativeOrAbsolute(workspaceRoot, workflow.rootDir),
          phaseOrder: workflow.definition.phaseOrder,
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_install_workflow',
    'Install a user workflow directory',
    { workflowPath: z.string() },
    async (args) => {
      try {
        const workflowId = await workflowInstaller.install(resolveWorkspacePath(workspaceRoot, args.workflowPath));
        return ok({ workflowId });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_remove_workflow',
    'Remove a user workflow. Requires confirm true.',
    { workflowId: z.string(), confirm: z.boolean() },
    async (args) => {
      try {
        if (args.confirm !== true) {
          throw new PlaySpecError(
            'MCP workflow removal requires confirm: true.',
            'Inspect playspec_list_workflows or playspec_show_workflow before removing a user workflow.'
          );
        }
        await workflowInstaller.remove(args.workflowId);
        return ok({ workflowId: args.workflowId, removed: true });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_export_workflow',
    'Export a workflow directory',
    { workflowId: z.string(), outDir: z.string().optional() },
    async (args) => {
      try {
        const target = resolveWorkspacePath(workspaceRoot, args.outDir ?? args.workflowId);
        await workflowInstaller.export(args.workflowId, target);
        return ok({
          workflowId: args.workflowId,
          targetPath: toWorkspaceRelativeOrAbsolute(workspaceRoot, target),
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_workflow_add_phase',
    'Add a phase to an installed project workflow',
    {
      workflowId: z.string(),
      afterPhaseId: z.string(),
      newPhaseId: z.string(),
      title: z.string(),
      templatePath: z.string(),
    },
    async (args) => {
      try {
        return ok(await workflowEditor.addPhase(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_workflow_remove_phase',
    'Remove a phase from an installed project workflow',
    { workflowId: z.string(), phaseId: z.string(), replacement: z.string().optional() },
    async (args) => {
      try {
        return ok(await workflowEditor.removePhase(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_workflow_reorder_phase',
    'Reorder a phase in an installed project workflow',
    { workflowId: z.string(), phaseId: z.string(), afterPhaseId: z.string() },
    async (args) => {
      try {
        return ok(await workflowEditor.reorderPhase(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_workflow_set_template',
    'Set a phase template in an installed project workflow',
    { workflowId: z.string(), phaseId: z.string(), templatePath: z.string() },
    async (args) => {
      try {
        return ok(await workflowEditor.setTemplate(args));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_render_next_prompt',
    'Render the next prompt for a task. Requires taskId or sessionId.',
    taskContextWithEvolution,
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const prompt = await core.renderNextPrompt(taskId, {
          withEvolutionContext: args.withEvolutionContext,
          evolutionContextSource: 'mcp',
          contextMode: args.contextMode,
        });
        return ok({ taskId, prompt });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_render_phase_prompt',
    'Render a specific workflow phase prompt. Requires taskId or sessionId plus phaseId.',
    { ...taskContext, phaseId: z.string(), contextMode: z.enum(['compact', 'strict', 'full']).optional() },
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const prompt = await core.renderExplicitPhasePrompt(taskId, args.phaseId, {
          contextMode: args.contextMode,
        });
        return ok({ taskId, phaseId: args.phaseId, prompt });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_complete_phase',
    'Complete the current workflow phase. Requires taskId or sessionId.',
    { ...taskContextWithEvolution, withReview: z.boolean().optional(), result: z.string().optional() },
    async (args) => {
      try {
        const { core, taskId } = await resolveScopedTask(args);
        const completionResult = await core.completePhase(taskId, {
          withReview: args.withReview,
          result: args.result,
          withEvolutionContext: args.withEvolutionContext,
          contextMode: args.contextMode,
        });
        return ok(completionResult);
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
    'playspec_execute_git_rollback',
    'Execute guarded git rollback. Requires taskId or sessionId and confirm true.',
    { ...taskContext, confirm: z.boolean() },
    async (args) => {
      try {
        if (args.confirm !== true) {
          throw new PlaySpecError(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
    'playspec_store_evolution_proposal',
    'Validate and store an evolution proposal object',
    { proposal: z.unknown(), workspaceRoot: z.string().optional() },
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

  server.tool(
    'playspec_update_evolution_proposal',
    'Update an existing pending/refining evolution proposal object',
    { proposalId: z.string(), proposal: z.unknown(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        const scoped = getScopedEvolutionContext(args);
        return ok(await scoped.proposalStore.updateProposal(args.proposalId, args.proposal));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
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

  server.tool(
    'playspec_append_evolution_thread_evidence',
    'Append feedback thread evidence to an existing pending/refining evolution proposal',
    { proposalId: z.string(), threadId: z.string() },
    async (args) => {
      try {
        return ok(await appendFeedbackThreadEvidence(workspaceRoot, {
          proposalId: args.proposalId,
          threadId: args.threadId,
        }));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
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

  server.tool(
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

  server.tool(
    'playspec_apply_evolution_proposal',
    'Apply an approved executable evolution proposal. Requires approved true.',
    { proposalId: z.string(), approved: z.boolean(), workspaceRoot: z.string().optional() },
    async (args) => {
      try {
        if (args.approved !== true) {
          throw new PlaySpecError(
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

  server.tool(
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
    },
    async (args) => {
      try {
        const now = new Date().toISOString();
        const observation: HumanEditObservation = {
          id: args.id ?? generateHumanEditObservationId(args.target),
          createdAt: now,
          updatedAt: now,
          status: 'recorded',
          targetPath: args.target,
          summary: args.summary,
          rationale: args.rationale,
          ...(args.taskId ? { sourceTaskId: args.taskId } : {}),
          ...(args.proposalId ? { proposalId: args.proposalId } : {}),
          ...(args.before ? { beforeRef: args.before } : {}),
          ...(args.after ? { afterRef: args.after } : {}),
        };
        const observationPath = await humanEditStore.saveObservation(observation);
        return ok({ observation, observationPath });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_update_human_edit_observation_status',
    'Mark a human edit observation ignored or superseded',
    { editId: z.string(), status: humanEditStatus, reason: z.string().optional() },
    async (args) => {
      try {
        const observation = await humanEditStore.markObservationStatus(args.editId, args.status, { reason: args.reason });
        return ok({ observation });
      } catch (e) {
        return err(e);
      }
    }
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
