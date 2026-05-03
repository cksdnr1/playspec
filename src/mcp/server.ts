import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { PlaySpecError } from '#core/errors.js';
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

export function buildMcpServer(workspaceRoot: string): McpServer {
  const server = new McpServer({ name: 'playspec', version: '0.1.0' });
  const taskStore = new YamlTaskStore(workspaceRoot);
  const core = new PlaySpecCore(workspaceRoot, taskStore);
  const sessionStore = new McpSessionStore(workspaceRoot);

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

  return server;
}
