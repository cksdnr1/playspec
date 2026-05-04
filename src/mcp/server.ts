import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, ZodError } from 'zod';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { PlaySpecError } from '#core/errors.js';
import type { HarnessAttemptResult } from '#core/types.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import { EvolutionApplyRunner } from '#evolution/apply-runner.js';
import { generateEvolutionProposal } from '#evolution/proposal-generator.js';
import {
  EvolutionHumanEditStore,
  generateHumanEditObservationId,
} from '#evolution/human-edit-store.js';
import type { EvolutionRiskLevel, HumanEditObservation } from '#evolution/types.js';
import { McpSessionStore } from './session-store.js';
import { resolveMcpTaskId } from './context.js';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  if (error instanceof PlaySpecError) {
    const text = error.hint
      ? `${error.message}\n\nHint: ${error.hint}`
      : error.message;
    return { content: [{ type: 'text' as const, text }], isError: true as const };
  }
  const text = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text }], isError: true as const };
}

const taskContext = {
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
};

const taskContextWithEvolution = {
  ...taskContext,
  withEvolutionContext: z.boolean().optional(),
};

const riskLevel = z.enum(['low', 'medium', 'high']);
const harnessAttemptResult = z.enum(['success', 'failure']);
const humanEditStatus = z.enum(['ignored', 'superseded']);

export function buildMcpServer(workspaceRoot: string): McpServer {
  const server = new McpServer({ name: 'playspec', version: '0.1.0' });
  const taskStore = new YamlTaskStore(workspaceRoot);
  const core = new PlaySpecCore(workspaceRoot, taskStore);
  const sessionStore = new McpSessionStore(workspaceRoot);
  const proposalStore = new EvolutionProposalStore(workspaceRoot);
  const humanEditStore = new EvolutionHumanEditStore(workspaceRoot);

  server.tool(
    'playspec_list_tasks',
    'List active and completed PlaySpec tasks',
    async () => {
      try {
        const [active, completed] = await Promise.all([
          taskStore.listActiveTasks(),
          taskStore.listCompletedTasks(),
        ]);
        return ok({ active, completed });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_get_task',
    'Get full task record by taskId',
    { taskId: z.string() },
    async (args) => {
      try {
        const task = await taskStore.getTask(args.taskId);
        return ok(task);
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_use_session_task',
    'Bind a task to a session so later calls can use sessionId instead of taskId',
    { sessionId: z.string(), taskId: z.string(), adapter: z.string().optional() },
    async (args) => {
      try {
        await taskStore.getTask(args.taskId);
        const session = await sessionStore.setSessionTask(
          args.sessionId,
          args.taskId,
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
    { sessionId: z.string() },
    async (args) => {
      try {
        const session = await sessionStore.loadSession(args.sessionId);
        if (!session) {
          return ok({ session: null, task: null });
        }
        let task = null;
        if (session.currentTaskId) {
          try {
            task = await taskStore.getTask(session.currentTaskId);
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
    'playspec_render_next_prompt',
    'Render the next prompt for a task. Requires taskId or sessionId.',
    taskContextWithEvolution,
    async (args) => {
      try {
        const taskId = await resolveMcpTaskId(args, sessionStore);
        const prompt = await core.renderNextPrompt(taskId, {
          withEvolutionContext: args.withEvolutionContext,
          evolutionContextSource: 'mcp',
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
    { ...taskContext, phaseId: z.string() },
    async (args) => {
      try {
        const taskId = await resolveMcpTaskId(args, sessionStore);
        const prompt = await core.renderExplicitPhasePrompt(taskId, args.phaseId);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
        const completionResult = await core.completePhase(taskId, {
          withReview: args.withReview,
          result: args.result,
          withEvolutionContext: args.withEvolutionContext,
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
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
        const taskId = await resolveMcpTaskId(args, sessionStore);
        const result = await generateEvolutionProposal(workspaceRoot, {
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
    async () => {
      try {
        return ok({ proposals: await proposalStore.listProposals() });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_get_evolution_proposal',
    'Get a stored evolution proposal and validation report when present',
    { proposalId: z.string() },
    async (args) => {
      try {
        const proposal = await proposalStore.loadProposal(args.proposalId);
        return ok({ proposal, validationReport: await loadValidationReportIfPresent(proposalStore, args.proposalId) });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_store_evolution_proposal',
    'Validate and store an evolution proposal object',
    { proposal: z.unknown() },
    async (args) => {
      try {
        const validation = proposalStore.validateProposal(args.proposal);
        if (!validation.valid || !validation.proposal) {
          throw new PlaySpecError(
            `Evolution proposal is invalid: ${validation.report.errors.join('; ')}`,
            'Fix the proposal object and call the MCP tool again.'
          );
        }
        const proposalPath = await proposalStore.saveProposal(validation.proposal);
        const validationPath = await proposalStore.saveValidationReport(validation.report);
        return ok({ proposal: validation.proposal, proposalPath, validationPath, validationReport: validation.report });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_update_evolution_proposal',
    'Update an existing pending/refining evolution proposal object',
    { proposalId: z.string(), proposal: z.unknown() },
    async (args) => {
      try {
        return ok(await proposalStore.updateProposal(args.proposalId, args.proposal));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_append_evolution_evidence',
    'Append evidence to an existing pending/refining evolution proposal',
    { proposalId: z.string(), path: z.string(), note: z.string() },
    async (args) => {
      try {
        return ok(await proposalStore.appendEvidence(args.proposalId, { path: args.path, note: args.note }));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_skip_evolution_proposal',
    'Mark an evolution proposal skipped',
    { proposalId: z.string(), reason: z.string().optional() },
    async (args) => {
      try {
        const proposal = await proposalStore.skipProposal(args.proposalId, {
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
    { proposalId: z.string() },
    async (args) => {
      try {
        return ok(await new EvolutionApplyRunner(workspaceRoot).diff(args.proposalId));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'playspec_apply_evolution_proposal',
    'Apply an approved executable evolution proposal. Requires approved true.',
    { proposalId: z.string(), approved: z.boolean() },
    async (args) => {
      try {
        if (args.approved !== true) {
          throw new PlaySpecError(
            'MCP evolution apply requires approved: true.',
            'Call playspec_diff_evolution_proposal first, inspect the diff, then call with approved: true.'
          );
        }
        return ok(await new EvolutionApplyRunner(workspaceRoot).apply(args.proposalId, {
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
