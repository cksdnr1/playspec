import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { execa } from 'execa';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import { slugify } from '#utils/slug.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';
import { McpSessionStore } from '#mcp/session-store.js';
import { resolveMcpTaskId } from '#mcp/context.js';
import {
  McpInvalidSessionIdError,
  McpInvalidTaskIdError,
  McpTaskContextRequiredError,
  McpSessionContextEmptyError,
  McpSessionNotFoundError,
} from '#mcp/errors.js';
import { buildMcpServer } from '#mcp/server.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import type { EvolutionProposal, FeedbackThread } from '#evolution/types.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const MCP_PATH = path.resolve(TESTS_DIR, '../../src/mcp/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');
const TSX_PATH = path.resolve(TESTS_DIR, '../../node_modules/.bin/tsx');

let workspace: TempWorkspace;

vi.setConfig({ testTimeout: 15_000 });

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function initWorkspaceWithTask(title: string, workflow = 'multi-spec') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');
  const taskId = slugify(title);
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({ id: taskId, title, workflow });
  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);
  return { taskId, store };
}

async function initWorkspaceWithFeedbackTask() {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');
  await writeTextFile(
    path.join(workspace.dir, '.playspec', 'workflows', 'feedback-flow', 'workflow.yaml'),
    `id: feedback-flow
mode: linear
phaseOrder:
  - validate
  - target
phases:
  validate:
    title: Validate
    template: validate.md
    gate:
      results:
        - approved
      nextByResult:
        approved: target
    feedback:
      enabled: true
      kind: prompt_evolution_signal
      feedbackThreshold: 90
      thresholdMode: greater_or_equal
      required: true
      onFailure: fail_completion
      sourcePhaseId: validate
      evaluatedArtifactPhaseId: validate
      evolutionTargetPhaseId: target
      scoreSource:
        artifactRole: prompt_snapshot
        preferredBlock: playspecFeedback
        markdownFallback: false
      approval:
        threshold: 60
        resultSource: completion_result
      causeClassification:
        required: true
        allowed:
          - authoring_prompt_gap
          - extractor_or_parser_error
      targetPromptSnapshot:
        required: true
        hashAlgorithm: sha256
      dedupe:
        enabled: true
        fields:
          - artifactRole
      evolution:
        mode: thread_only
        storageMode: thread_with_compact_history
        targetFiles:
          - target.md
      workflowSource:
        kind: project_local
        root: .playspec/workflows/feedback-flow
        rootPathKind: workspace_relative
      targetPromptTemplate:
        path: target.md
        pathKind: workflow_relative
        writable: true
      compactHistoryPolicy:
        maxEntries: 5
        keepFirst: true
        keepLatest: 4
        summarizeOverflow: true
      proposalReadinessPolicy:
        mode: manual_only_initial
        minRunCount: 2
        minNegativeCount: 1
        minConfidence: medium
        requireHumanReviewBeforeProposal: true
  target:
    title: Target
    template: target.md
`
  );
  await writeTextFile(
    path.join(workspace.dir, '.playspec', 'workflows', 'feedback-flow', 'templates', 'validate.md'),
    `# Validate
\`\`\`playspecFeedback
sourcePhaseId: validate
evaluatedArtifactPhaseId: validate
evolutionTargetPhaseId: target
score: 72
cause:
  category: authoring_prompt_gap
  confidence: medium
summary: MCP feedback capture.
dedupeFieldValues:
  artifactRole: prompt_snapshot
\`\`\`
`
  );
  await writeTextFile(
    path.join(workspace.dir, '.playspec', 'workflows', 'feedback-flow', 'templates', 'target.md'),
    '# Target\n'
  );
  const store = new YamlTaskStore(workspace.dir);
  const taskId = 'mcp_feedback_task';
  await store.createTask({ id: taskId, title: 'MCP Feedback Task', workflow: 'feedback-flow' });
  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);
  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });
  return { taskId, store };
}

function makeProposal(id: string, taskId: string): EvolutionProposal {
  return {
    id,
    revision: 1,
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
    status: 'pending',
    source: { taskId, artifactRefs: [] },
    targetFiles: ['docs/features/source_task/spec.md'],
    evidenceRefs: [],
    riskLevel: 'low',
    actions: [
      {
        actionId: 'action_1',
        type: 'propose_file_change',
        targetPath: 'docs/features/source_task/spec.md',
        summary: 'MCP should not embed this summary.',
        rationale: 'Only compact metadata is allowed.',
      },
    ],
    rationale: 'MCP context proposal.',
    review: { status: 'unreviewed' },
  };
}

function makeFeedbackThread(id = 'feedback_thread_mcp'): FeedbackThread {
  return {
    id,
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:01.000Z',
    dedupeKey: {
      version: 1,
      workflowId: 'mono-spec',
      feedbackKind: 'prompt_evolution_signal',
      sourcePhaseId: 'tech_spec_validate',
      evaluatedArtifactPhaseId: 'tech_spec_draft',
      evolutionTargetPhaseId: 'tech_spec_draft',
      causeCategory: 'authoring_prompt_gap',
      fields: {
        artifactRole: 'spec',
      },
    },
    dedupeKeyHash: 'e'.repeat(64),
    sourcePhaseId: 'tech_spec_validate',
    evaluatedArtifactPhaseId: 'tech_spec_draft',
    evolutionTargetPhaseId: 'tech_spec_draft',
    workflowSource: {
      kind: 'project_local',
      root: '.playspec/workflows/mono-spec',
      rootPathKind: 'workspace_relative',
    },
    targetPromptTemplate: {
      path: 'tech_spec_draft.md',
      pathKind: 'workflow_relative',
      writable: true,
    },
    targetWritable: true,
    targetPath: '.playspec/workflows/mono-spec/templates/tech_spec_draft.md',
    compactHistoryPolicy: {
      maxEntries: 3,
      keepFirst: true,
      keepLatest: 2,
      summarizeOverflow: true,
    },
    proposalReadinessPolicy: {
      mode: 'manual_only_initial',
      minRunCount: 2,
      minNegativeCount: 1,
      minConfidence: 'medium',
      requireHumanReviewBeforeProposal: true,
    },
    mutationStrategy: 'manual_review_only',
    trend: {
      totalEvents: 1,
      positiveCount: 0,
      negativeCount: 1,
      neutralCount: 0,
      parseFailureCount: 0,
      direction: 'declining',
      confidence: 'medium',
      readinessState: 'ready_for_review',
      lastEventAt: '2026-05-25T00:00:01.000Z',
    },
    events: [
      {
        eventId: 'event_mcp_1',
        taskId: 'task_mcp',
        phaseId: 'tech_spec_validate',
        createdAt: '2026-05-25T00:00:01.000Z',
        approvalResult: 'needs_revision',
        feedbackResult: 'negative',
        score: 72,
        causeClassification: {
          selected: 'authoring_prompt_gap',
          confidence: 'medium',
        },
        summary: 'MCP validation feedback summary.',
        promptSnapshot: {
          algorithm: 'sha256',
          hash: 'f'.repeat(64),
          renderedByteLength: 120,
          targetPhaseId: 'tech_spec_draft',
          templatePath: 'tech_spec_draft.md',
          templatePathKind: 'workflow_relative',
          createdAt: '2026-05-25T00:00:01.000Z',
        },
      },
    ],
  };
}

function getRegisteredToolHandler(toolName: string, serverWorkspaceRoot = workspace.dir) {
  const toolSpy = vi.spyOn(McpServer.prototype, 'tool');
  buildMcpServer(serverWorkspaceRoot);
  const call = toolSpy.mock.calls.find((entry) => entry[0] === toolName);
  toolSpy.mockRestore();
  if (!call) throw new Error(`Tool not registered: ${toolName}`);
  return call.at(-1) as (args: Record<string, unknown>) => Promise<{
    content: { type: 'text'; text: string }[];
    isError?: boolean;
  }>;
}

function parseToolJson(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function makeTaskIdResolver() {
  return new TaskIdResolver(new YamlTaskStore(workspace.dir));
}

// ---------------------------------------------------------------------------
// McpSessionStore
// ---------------------------------------------------------------------------

describe('McpSessionStore', () => {
  it('returns null for a non-existent session', async () => {
    await initWorkspaceWithTask('Feature X');
    const sessionStore = new McpSessionStore(workspace.dir);
    const result = await sessionStore.loadSession('mcp.nonexistent');
    expect(result).toBeNull();
  });

  it.each([
    ['slash path separator', '../mcp.codex'],
    ['backslash path separator', '..\\mcp.codex'],
    ['colon', 'mcp:codex'],
    ['empty string', ''],
    ['null byte', 'mcp.codex\0suffix'],
    ['control character', 'mcp.codex\nsuffix'],
    ['over 256 characters', 'a'.repeat(257)],
  ])('rejects malformed sessionId when loading a session with %s', async (_reason, sessionId) => {
    await initWorkspaceWithTask('Feature X');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(sessionStore.loadSession(sessionId)).rejects.toBeInstanceOf(McpInvalidSessionIdError);
  });

  it('creates a session file with setSessionTask', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature X');
    const sessionStore = new McpSessionStore(workspace.dir);
    const session = await sessionStore.setSessionTask('mcp.codex', taskId, 'codex');
    expect(session.sessionId).toBe('mcp.codex');
    expect(session.currentTaskId).toBe(taskId);
    expect(session.adapter).toBe('codex');
  });

  it('loads the session back after setSessionTask', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature X');
    const sessionStore = new McpSessionStore(workspace.dir);
    await sessionStore.setSessionTask('mcp.codex', taskId, 'codex');
    const loaded = await sessionStore.loadSession('mcp.codex');
    expect(loaded).not.toBeNull();
    expect(loaded?.currentTaskId).toBe(taskId);
  });

  it('updates currentTaskId when setSessionTask is called again', async () => {
    const { store } = await initWorkspaceWithTask('Feature X');
    const taskId2 = slugify('Feature Y');
    await store.createTask({ id: taskId2, title: 'Feature Y', workflow: 'multi-spec' });
    const sessionStore = new McpSessionStore(workspace.dir);
    const first = await sessionStore.setSessionTask('mcp.codex', slugify('Feature X'), 'codex');
    expect(first.currentTaskId).toBe(slugify('Feature X'));
    const second = await sessionStore.setSessionTask('mcp.codex', taskId2, 'codex');
    expect(second.currentTaskId).toBe(taskId2);
    const loaded = await sessionStore.loadSession('mcp.codex');
    expect(loaded?.currentTaskId).toBe(taskId2);
  });

  it('rejects unsafe sessionId when binding a session', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature X');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(
      sessionStore.setSessionTask('../mcp.codex', taskId, 'codex')
    ).rejects.toBeInstanceOf(McpInvalidSessionIdError);
  });

  it('rejects unsafe taskId when binding a session', async () => {
    await initWorkspaceWithTask('Feature X');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(
      sessionStore.setSessionTask('mcp.codex', 'feature:x', 'codex')
    ).rejects.toBeInstanceOf(McpInvalidTaskIdError);
  });
});

// ---------------------------------------------------------------------------
// resolveMcpTaskId — context resolver (no HEAD fallback)
// ---------------------------------------------------------------------------

describe('resolveMcpTaskId', () => {
  it('throws McpTaskContextRequiredError when neither taskId nor sessionId is provided', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    const error = await resolveMcpTaskId({}, sessionStore, makeTaskIdResolver()).catch((e) => e);

    expect(error).toBeInstanceOf(McpTaskContextRequiredError);
    expect(error.hint).toContain('taskId');
    expect(error.hint).toContain('sessionId');
    expect(error.hint).toContain('playspec_use_session_task');
  });

  it('does not fall back to HEAD when no context is provided', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature A');
    // HEAD points to taskId but MCP must not use it
    const sessionStore = new McpSessionStore(workspace.dir);
    const error = await resolveMcpTaskId({}, sessionStore, makeTaskIdResolver()).catch((e) => e);
    expect(error).toBeInstanceOf(McpTaskContextRequiredError);
    // Crucially: it is NOT NoActiveTaskError (which HEAD fallback would throw)
    expect(error.constructor.name).toBe('McpTaskContextRequiredError');
    expect(taskId).toBeTruthy(); // HEAD is set but we still get context error
  });

  it('resolves an exact taskId when taskId is provided', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    const resolved = await resolveMcpTaskId({ taskId }, sessionStore, makeTaskIdResolver());
    expect(resolved).toBe(taskId);
  });

  it('rejects empty string sessionId as context required', async () => {
    await initWorkspaceWithTask('Test');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(resolveMcpTaskId({ sessionId: '' }, sessionStore, makeTaskIdResolver())).rejects.toBeInstanceOf(
      McpTaskContextRequiredError
    );
  });

  it('prioritizes valid taskId over empty-string sessionId', async () => {
    const { taskId } = await initWorkspaceWithTask('Test');
    const sessionStore = new McpSessionStore(workspace.dir);
    const resolved = await resolveMcpTaskId({ taskId, sessionId: '' }, sessionStore, makeTaskIdResolver());
    expect(resolved).toBe(taskId);
  });

  it.each([
    ['slash path separator', '../feature_a'],
    ['backslash path separator', '..\\feature_a'],
    ['colon', 'feature:a'],
    ['null byte', 'feature_a\0suffix'],
    ['control character', 'feature_a\nsuffix'],
    ['over 256 characters', 'a'.repeat(257)],
  ])('rejects direct taskId with %s', async (_reason, taskId) => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(resolveMcpTaskId({ taskId }, sessionStore, makeTaskIdResolver())).rejects.toBeInstanceOf(
      McpInvalidTaskIdError
    );
  });

  it('documents direct taskId validation rules in the error hint', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    const error = await resolveMcpTaskId(
      { taskId: '../feature_a' },
      sessionStore,
      makeTaskIdResolver()
    ).catch((e) => e);
    expect(error).toBeInstanceOf(McpInvalidTaskIdError);
    expect(error.hint).toContain('256 characters or fewer');
    expect(error.hint).toContain('colons');
    expect(error.hint).toContain('path separators');
    expect(error.hint).toContain('null bytes');
    expect(error.hint).toContain('control characters');
  });

  it.each([
    ['slash path separator', '../mcp.codex'],
    ['backslash path separator', '..\\mcp.codex'],
    ['colon', 'mcp:codex'],
    ['non-string', null],
  ])('rejects malformed sessionId with %s', async (_reason, sessionId) => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(resolveMcpTaskId({ sessionId }, sessionStore, makeTaskIdResolver())).rejects.toBeInstanceOf(
      McpInvalidSessionIdError
    );
  });

  it('documents context identifier validation rules in the required-context hint', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    const error = await resolveMcpTaskId({ sessionId: '' }, sessionStore, makeTaskIdResolver()).catch((e) => e);
    expect(error).toBeInstanceOf(McpTaskContextRequiredError);
    expect(error.hint).toContain('non-empty taskId or sessionId');
    expect(error.hint).toContain('256 characters or fewer');
    expect(error.hint).toContain('colons');
    expect(error.hint).toContain('path separators');
  });

  it('throws McpSessionContextEmptyError when session has null currentTaskId', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    // Create a session with null currentTaskId via saveSession
    await sessionStore.saveSession({
      sessionId: 'mcp.empty',
      adapter: 'mcp',
      currentTaskId: null,
    });
    await expect(
      resolveMcpTaskId({ sessionId: 'mcp.empty' }, sessionStore, makeTaskIdResolver())
    ).rejects.toBeInstanceOf(McpSessionContextEmptyError);
  });

  it('throws McpSessionNotFoundError when session file does not exist', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(
      resolveMcpTaskId({ sessionId: 'nonexistent.session' }, sessionStore, makeTaskIdResolver())
    ).rejects.toBeInstanceOf(McpSessionNotFoundError);
  });

  it('uses a create-session hint when session file does not exist', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    const error = await resolveMcpTaskId(
      { sessionId: 'nonexistent.session' },
      sessionStore,
      makeTaskIdResolver()
    ).catch((e) => e);
    expect(error).toBeInstanceOf(McpSessionNotFoundError);
    expect(error.hint).toContain('create and bind the session');
  });

  it('resolves taskId from session when sessionId is provided', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    await sessionStore.setSessionTask('mcp.codex', taskId, 'codex');
    const resolved = await resolveMcpTaskId({ sessionId: 'mcp.codex' }, sessionStore, makeTaskIdResolver());
    expect(resolved).toBe(taskId);
  });

  it('prefers taskId over sessionId when both are provided', async () => {
    const { store } = await initWorkspaceWithTask('Feature A');
    const taskIdA = slugify('Feature A');
    const taskIdB = slugify('Feature B');
    await store.createTask({ id: taskIdB, title: 'Feature B', workflow: 'multi-spec' });
    const sessionStore = new McpSessionStore(workspace.dir);
    await sessionStore.setSessionTask('mcp.codex', taskIdB, 'codex');
    // session points to B, but explicit taskId A should take precedence
    const resolved = await resolveMcpTaskId({ taskId: taskIdA, sessionId: 'mcp.codex' }, sessionStore, makeTaskIdResolver());
    expect(resolved).toBe(taskIdA);
  });
});

// ---------------------------------------------------------------------------
// buildMcpServer — instantiation
// ---------------------------------------------------------------------------

describe('buildMcpServer', () => {
  it('instantiates McpServer without throwing', () => {
    expect(() => buildMcpServer(workspace.dir)).not.toThrow();
  });

  it('returns null session and task for a valid nonexistent MCP session lookup', async () => {
    await initWorkspaceWithTask('MCP Missing Session Lookup');
    const handler = getRegisteredToolHandler('playspec_get_session_task');

    const result = await handler({ sessionId: 'mcp.nonexistent' });
    const body = parseToolJson(result);

    expect(result.isError).toBeUndefined();
    expect(body['session']).toBeNull();
    expect(body['task']).toBeNull();
  });

  it.each([
    ['slash path separator', '../mcp.codex'],
    ['colon', 'mcp:codex'],
    ['control character', 'mcp.codex\nsuffix'],
  ])('rejects malformed playspec_get_session_task sessionId with %s', async (_reason, sessionId) => {
    await initWorkspaceWithTask('MCP Unsafe Session Lookup');
    const handler = getRegisteredToolHandler('playspec_get_session_task');

    const result = await handler({ sessionId });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid MCP sessionId.');
    expect(result.content[0].text).toContain('path separators');
    expect(result.content[0].text).toContain('control characters');
  });

  it('retrieves a same-workspace task with diagnostics', async () => {
    const { taskId } = await initWorkspaceWithTask('MCP Same Workspace Lookup');
    const handler = getRegisteredToolHandler('playspec_get_task');

    const result = await handler({ taskId });
    const body = parseToolJson(result);

    expect(result.isError).toBeUndefined();
    expect(body['id']).toBe(taskId);
    expect(body['diagnostics']).toMatchObject({
      serverWorkspaceRoot: workspace.dir,
      workspaceRoot: workspace.dir,
      playspecRoot: path.join(workspace.dir, '.playspec'),
      headTaskId: taskId,
      cache: {
        enabled: false,
        status: 'not used; task state is read from disk per request',
      },
    });
  });

  it('retrieves an explicit workspace task when the server workspace differs', async () => {
    const serverWorkspace = await createTempWorkspace();
    try {
      const { taskId } = await initWorkspaceWithTask('MCP Explicit Workspace Lookup');
      const handler = getRegisteredToolHandler('playspec_get_task', serverWorkspace.dir);

      const result = await handler({ taskId, workspaceRoot: workspace.dir });
      const body = parseToolJson(result);

      expect(result.isError).toBeUndefined();
      expect(body['id']).toBe(taskId);
      expect(body['diagnostics']).toMatchObject({
        serverWorkspaceRoot: serverWorkspace.dir,
        workspaceRoot: workspace.dir,
        taskSearchPaths: {
          active: path.join(workspace.dir, '.playspec', 'tasks', 'active'),
          completed: path.join(workspace.dir, '.playspec', 'tasks', 'active'),
          archived: path.join(workspace.dir, '.playspec', 'tasks', 'archived'),
        },
      });
    } finally {
      await serverWorkspace.cleanup();
    }
  });

  it('lists explicit workspace tasks with diagnostics when the server workspace differs', async () => {
    const serverWorkspace = await createTempWorkspace();
    try {
      const { taskId } = await initWorkspaceWithTask('MCP Explicit Workspace List');
      const handler = getRegisteredToolHandler('playspec_list_tasks', serverWorkspace.dir);

      const result = await handler({ workspaceRoot: workspace.dir });
      const body = parseToolJson(result);

      expect(result.isError).toBeUndefined();
      expect(body['active']).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: taskId }),
      ]));
      expect(body['diagnostics']).toMatchObject({
        serverWorkspaceRoot: serverWorkspace.dir,
        workspaceRoot: workspace.dir,
        playspecRoot: path.join(workspace.dir, '.playspec'),
      });
    } finally {
      await serverWorkspace.cleanup();
    }
  });

  it('includes workspace diagnostics when explicit task lookup misses', async () => {
    await initWorkspaceWithTask('MCP Missing Lookup Diagnostics');
    const handler = getRegisteredToolHandler('playspec_get_task');

    const result = await handler({ taskId: 'missing_task' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Task not found: missing_task');
    expect(result.content[0].text).toContain(`effective workspace root: ${workspace.dir}`);
    expect(result.content[0].text).toContain(
      `task search paths.active: ${path.join(workspace.dir, '.playspec', 'tasks', 'active')}`
    );
    expect(result.content[0].text).toContain('cache: not used; task state is read from disk per request');
  });

  it('returns feedback capture metadata through MCP complete-phase delegation', async () => {
    const { taskId } = await initWorkspaceWithFeedbackTask();
    const handler = getRegisteredToolHandler('playspec_complete_phase');

    const result = await handler({ taskId, result: 'approved' });
    const body = parseToolJson(result);

    expect(result.isError).toBeUndefined();
    expect(body['taskId']).toBe(taskId);
    expect(body['feedback']).toMatchObject({
      status: 'captured',
      approvalResult: 'approved',
      feedbackResult: 'negative',
      score: 72,
    });
  });

  it('does not register archive lookup tools in Phase 5', () => {
    const toolSpy = vi.spyOn(McpServer.prototype, 'tool');
    try {
      buildMcpServer(workspace.dir);
      const toolNames = toolSpy.mock.calls.map((call) => String(call[0]));
      expect(toolNames.filter((name) => name.includes('archive'))).toEqual([]);
      expect(toolNames).not.toContain('playspec_get_archived_task');
      expect(toolNames).not.toContain('playspec_list_archived_tasks');
    } finally {
      toolSpy.mockRestore();
    }
  });

  it('registers MCP tools for current task lifecycle, harness, and evolution capabilities', () => {
    const toolSpy = vi.spyOn(McpServer.prototype, 'tool');
    try {
      buildMcpServer(workspace.dir);
      const toolNames = toolSpy.mock.calls.map((call) => String(call[0]));
      expect(toolNames).toEqual(expect.arrayContaining([
        'playspec_add_context',
        'playspec_set_current_phase',
        'playspec_create_snapshot',
        'playspec_plan_rollback',
        'playspec_execute_git_rollback',
        'playspec_get_harness_status',
        'playspec_record_harness_attempt',
        'playspec_reset_harness',
        'playspec_generate_evolution_proposal',
        'playspec_list_evolution_proposals',
        'playspec_get_evolution_proposal',
        'playspec_store_evolution_proposal',
        'playspec_update_evolution_proposal',
        'playspec_append_evolution_evidence',
        'playspec_append_evolution_thread_evidence',
        'playspec_skip_evolution_proposal',
        'playspec_diff_evolution_proposal',
        'playspec_apply_evolution_proposal',
        'playspec_record_human_edit_observation',
        'playspec_update_human_edit_observation_status',
        'playspec_link_tasks',
        'playspec_unlink_tasks',
        'playspec_list_workflows',
        'playspec_show_workflow',
        'playspec_validate_workflow',
        'playspec_install_workflow',
        'playspec_remove_workflow',
        'playspec_export_workflow',
        'playspec_workflow_add_phase',
        'playspec_workflow_remove_phase',
        'playspec_workflow_reorder_phase',
        'playspec_workflow_set_template',
      ]));
      const threadEvidenceCall = toolSpy.mock.calls.find(
        (call) => call[0] === 'playspec_append_evolution_thread_evidence'
      );
      expect(Object.keys(threadEvidenceCall?.[2] as Record<string, unknown>)).toEqual(['proposalId', 'threadId']);
    } finally {
      toolSpy.mockRestore();
    }
  });

  it('registers explicit mutation gates for git rollback and evolution apply', () => {
    const toolSpy = vi.spyOn(McpServer.prototype, 'tool');
    try {
      buildMcpServer(workspace.dir);
      const rollbackCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_execute_git_rollback');
      const applyCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_apply_evolution_proposal');

      expect(Object.keys(rollbackCall?.[2] as Record<string, unknown>)).toContain('confirm');
      expect(Object.keys(applyCall?.[2] as Record<string, unknown>)).toContain('approved');
    } finally {
      toolSpy.mockRestore();
    }
  });

  it('rejects MCP git rollback and evolution apply without explicit approval booleans', async () => {
    await initWorkspaceWithTask('MCP Mutation Gates');
    const rollbackHandler = getRegisteredToolHandler('playspec_execute_git_rollback');
    const applyHandler = getRegisteredToolHandler('playspec_apply_evolution_proposal');

    const rollbackResult = await rollbackHandler({ confirm: false });
    const applyResult = await applyHandler({ proposalId: 'proposal_missing', approved: false });

    expect(rollbackResult.isError).toBe(true);
    expect(rollbackResult.content[0].text).toContain('confirm: true');
    expect(applyResult.isError).toBe(true);
    expect(applyResult.content[0].text).toContain('approved: true');
  });

  it('generates an evolution proposal through MCP with explicit session context', async () => {
    const { taskId } = await initWorkspaceWithTask('MCP Generate Proposal');
    await writeTextFile(path.join(workspace.dir, 'evidence.md'), 'Observed update.\n');
    const sessionStore = new McpSessionStore(workspace.dir);
    await sessionStore.setSessionTask('mcp.codex', taskId, 'codex');

    const handler = getRegisteredToolHandler('playspec_generate_evolution_proposal');
    const result = await handler({
      sessionId: 'mcp.codex',
      fromEvidence: 'evidence.md',
      target: '.playspec/templates/generated.md',
      summary: 'Generate via MCP',
      rationale: 'MCP parity coverage.',
      risk: 'low',
      generatedId: 'mcp_generated_proposal',
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body['taskId']).toBe(taskId);
    expect(body['invokedBy']).toBe('mcp');
    expect((body['proposal'] as EvolutionProposal).id).toBe('mcp_generated_proposal');
  });

  it('appends feedback thread evidence through MCP with explicit proposal and thread IDs', async () => {
    const { taskId } = await initWorkspaceWithTask('MCP Thread Evidence');
    await new EvolutionProposalStore(workspace.dir).saveProposal(makeProposal('mcp_thread_proposal', taskId));
    await new EvolutionFeedbackThreadStore(workspace.dir).saveThread(makeFeedbackThread());

    const handler = getRegisteredToolHandler('playspec_append_evolution_thread_evidence');
    const result = await handler({
      proposalId: 'mcp_thread_proposal',
      threadId: 'feedback_thread_mcp',
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect((body['proposal'] as EvolutionProposal).revision).toBe(2);
    expect(body['threadId']).toBe('feedback_thread_mcp');
    expect(body['evidencePath']).toBe('.playspec/evolution/feedback/threads/feedback_thread_mcp.yaml');
    expect(String(body['evidenceNote'])).toContain('MCP validation feedback summary.');
  });

  it('links and unlinks tasks through MCP without HEAD fallback', async () => {
    const { taskId, store } = await initWorkspaceWithTask('MCP Link Source');
    await store.createTask({ id: 'mcp_link_target', title: 'MCP Link Target', workflow: 'multi-spec' });
    await writeTextFile(getHeadPath(workspace.dir), 'mcp_link_target\n');

    const linkHandler = getRegisteredToolHandler('playspec_link_tasks');
    const unlinkHandler = getRegisteredToolHandler('playspec_unlink_tasks');

    const missingContext = await linkHandler({ targetTaskId: 'mcp_link_target', type: 'related' });
    const linked = await linkHandler({
      taskId,
      targetTaskId: 'mcp_link_target',
      type: 'related',
    });
    const linkedTask = await store.getTask(taskId);
    const unlinked = await unlinkHandler({
      sourceTaskId: taskId,
      targetTaskId: 'mcp_link_target',
      type: 'related',
    });

    expect(missingContext.isError).toBe(true);
    expect(missingContext.content[0].text).toContain('requires taskId or sessionId');
    expect(linked.isError).toBeUndefined();
    expect(parseToolJson(linked)['changed']).toBe(true);
    expect(linkedTask.links).toMatchObject([
      { type: 'related', targetTaskId: 'mcp_link_target' },
    ]);
    expect(unlinked.isError).toBeUndefined();
    expect(parseToolJson(unlinked)['changed']).toBe(true);
    expect((await store.getTask(taskId)).links).toBeUndefined();
    expect(missingContext.content[0].text).toContain('playspec_use_session_task');
  });

  it('renders with a unique MCP taskId prefix and returns the canonical taskId', async () => {
    const { taskId } = await initWorkspaceWithTask('MCP Prefix Render Target');
    const handler = getRegisteredToolHandler('playspec_render_next_prompt');

    const result = await handler({ taskId: 'mcp_prefix_render' });
    const body = parseToolJson(result);

    expect(result.isError).toBeUndefined();
    expect(body['taskId']).toBe(taskId);
    expect(String(body['prompt'])).toContain('MCP Prefix Render Target');
  });

  it('rejects ambiguous MCP taskId prefixes with resolver guidance', async () => {
    const { store } = await initWorkspaceWithTask('MCP Ambiguous Alpha');
    await store.createTask({
      id: 'mcp_ambiguous_beta',
      title: 'MCP Ambiguous Beta',
      workflow: 'multi-spec',
    });
    const handler = getRegisteredToolHandler('playspec_render_next_prompt');

    const result = await handler({ taskId: 'mcp_ambiguous' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Ambiguous task ID prefix "mcp_ambiguous"');
    expect(result.content[0].text).toContain('mcp_ambiguous_alpha');
    expect(result.content[0].text).toContain('mcp_ambiguous_beta');
    expect(result.content[0].text).toContain('Use a longer task ID prefix.');
  });

  it('binds MCP sessions to canonical task IDs when given a unique prefix', async () => {
    const { taskId } = await initWorkspaceWithTask('MCP Session Prefix Target');
    const bindHandler = getRegisteredToolHandler('playspec_use_session_task');
    const renderHandler = getRegisteredToolHandler('playspec_render_next_prompt');

    const bound = await bindHandler({
      sessionId: 'mcp.prefix',
      taskId: 'mcp_session_prefix',
      adapter: 'codex',
    });
    const session = await new McpSessionStore(workspace.dir).loadSession('mcp.prefix');
    const rendered = await renderHandler({ sessionId: 'mcp.prefix' });
    const body = parseToolJson(rendered);

    expect(bound.isError).toBeUndefined();
    expect(parseToolJson(bound)['currentTaskId']).toBe(taskId);
    expect(session?.currentTaskId).toBe(taskId);
    expect(rendered.isError).toBeUndefined();
    expect(body['taskId']).toBe(taskId);
  });

  it('rejects ambiguous prefixes when binding MCP sessions', async () => {
    const { store } = await initWorkspaceWithTask('MCP Session Ambiguous Alpha');
    await store.createTask({
      id: 'mcp_session_ambiguous_beta',
      title: 'MCP Session Ambiguous Beta',
      workflow: 'multi-spec',
    });
    const bindHandler = getRegisteredToolHandler('playspec_use_session_task');

    const result = await bindHandler({
      sessionId: 'mcp.ambiguous',
      taskId: 'mcp_session_ambiguous',
    });
    const session = await new McpSessionStore(workspace.dir).loadSession('mcp.ambiguous');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Ambiguous task ID prefix "mcp_session_ambiguous"');
    expect(result.content[0].text).toContain('Use a longer task ID prefix.');
    expect(session).toBeNull();
  });

  it('shows and edits project workflows through MCP', async () => {
    await initWorkspaceWithTask('MCP Workflow Edit', 'multi-spec');
    const showHandler = getRegisteredToolHandler('playspec_show_workflow');
    const addPhaseHandler = getRegisteredToolHandler('playspec_workflow_add_phase');
    const reorderHandler = getRegisteredToolHandler('playspec_workflow_reorder_phase');
    const setTemplateHandler = getRegisteredToolHandler('playspec_workflow_set_template');
    const removePhaseHandler = getRegisteredToolHandler('playspec_workflow_remove_phase');

    const shown = await showHandler({ workflowId: 'mono-spec' });
    const added = await addPhaseHandler({
      workflowId: 'mono-spec',
      afterPhaseId: 'tech_spec_draft',
      newPhaseId: 'mcp_review',
      title: 'MCP Review',
      templatePath: 'phase_template.md',
    });
    const reordered = await reorderHandler({
      workflowId: 'mono-spec',
      phaseId: 'mcp_review',
      afterPhaseId: 'implementation_plan_create',
    });
    const templated = await setTemplateHandler({
      workflowId: 'mono-spec',
      phaseId: 'mcp_review',
      templatePath: 'implementation.md',
    });
    const removed = await removePhaseHandler({
      workflowId: 'mono-spec',
      phaseId: 'mcp_review',
    });

    expect(shown.isError).toBeUndefined();
    expect(parseToolJson(shown)['source']).toBe('project');
    expect(added.isError).toBeUndefined();
    expect(parseToolJson(added)['afterPhaseIds']).toContain('mcp_review');
    expect(reordered.isError).toBeUndefined();
    expect(templated.isError).toBeUndefined();
    expect(removed.isError).toBeUndefined();
    expect(parseToolJson(removed)['afterPhaseIds']).not.toContain('mcp_review');
  });

  it('registers evolution context opt-in only on prompt and complete tools', () => {
    const toolSpy = vi.spyOn(McpServer.prototype, 'tool');
    try {
      buildMcpServer(workspace.dir);
      const renderCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_render_next_prompt');
      const completeCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_complete_phase');
      const phaseCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_render_phase_prompt');

      expect(Object.keys(renderCall?.[2] as Record<string, unknown>)).toContain('withEvolutionContext');
      expect(Object.keys(renderCall?.[2] as Record<string, unknown>)).toContain('contextMode');
      expect(Object.keys(completeCall?.[2] as Record<string, unknown>)).toContain('withEvolutionContext');
      expect(Object.keys(completeCall?.[2] as Record<string, unknown>)).toContain('contextMode');
      expect(Object.keys(phaseCall?.[2] as Record<string, unknown>)).not.toContain('withEvolutionContext');
      expect(Object.keys(phaseCall?.[2] as Record<string, unknown>)).toContain('contextMode');
    } finally {
      toolSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// MCP render path matches Core render path
// ---------------------------------------------------------------------------

describe('MCP render matches Core render', () => {
  it('resolveMcpTaskId + renderNextPrompt equals PlaySpecCore.renderNextPrompt', async () => {
    const { taskId, store } = await initWorkspaceWithTask('Login Feature');
    const sessionStore = new McpSessionStore(workspace.dir);
    await sessionStore.setSessionTask('mcp.claude-code', taskId, 'claude-code');

    const resolvedByTaskId = await resolveMcpTaskId({ taskId }, sessionStore, makeTaskIdResolver());
    const resolvedBySession = await resolveMcpTaskId({ sessionId: 'mcp.claude-code' }, sessionStore, makeTaskIdResolver());

    expect(resolvedByTaskId).toBe(taskId);
    expect(resolvedBySession).toBe(taskId);

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('MCP explicit task/session context can render evolution context without HEAD fallback', async () => {
    const { taskId, store } = await initWorkspaceWithTask('MCP Evolution Context');
    const proposalStore = new EvolutionProposalStore(workspace.dir);
    await proposalStore.saveProposal(makeProposal('proposal_mcp_visible', taskId));
    const sessionStore = new McpSessionStore(workspace.dir);
    await sessionStore.setSessionTask('mcp.codex', taskId, 'codex');

    const resolved = await resolveMcpTaskId({ sessionId: 'mcp.codex' }, sessionStore, makeTaskIdResolver());
    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(resolved, {
      withEvolutionContext: true,
      evolutionContextSource: 'mcp',
    });

    expect(prompt).toContain('## Evolution Context');
    expect(prompt).toContain('proposal_mcp_visible');
    expect(prompt).not.toContain('MCP should not embed this summary.');
  });

  it('MCP prompt contextMode matches core rendering and writes no sidecar metadata', async () => {
    const manager = new PresetManager();
    await manager.initWorkspace(workspace.dir, 'default');
    await writeTextFile(
      path.join(workspace.dir, 'docs', 'mcp-context.md'),
      '# MCP Context\n\nStrict mode embeds this body.\n'
    );
    const taskId = slugify('MCP Context Mode');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: taskId,
      title: 'MCP Context Mode',
      workflow: 'multi-spec',
      contextRefs: [
        { path: 'docs/mcp-context.md', role: 'planning-context', source: 'test' },
      ],
    });

    const handler = getRegisteredToolHandler('playspec_render_next_prompt');
    const result = await handler({ taskId, contextMode: 'strict' });
    const body = parseToolJson(result);
    const corePrompt = await new PlaySpecCore(workspace.dir, store).renderNextPrompt(taskId, {
      contextMode: 'strict',
    });

    expect(result.isError).toBeUndefined();
    expect(body['prompt']).toBe(corePrompt);
    expect(body['prompt']).toContain('Strict mode embeds this body.');
    const promptArtifacts = await readdir(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'prompts'));
    expect(promptArtifacts.some((file) => file.endsWith('.meta.yaml'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MCP server process start test
// ---------------------------------------------------------------------------

describe('MCP server process', () => {
  it('starts over stdio and exits cleanly when stdin closes', async () => {
    await initWorkspaceWithTask('Feature A');
    const result = await execa(
      TSX_PATH,
      ['--tsconfig', TSCONFIG_PATH, MCP_PATH],
      {
        cwd: workspace.dir,
        input: '',
        reject: false,
        timeout: 15000,
      }
    );
    // The server should exit cleanly (code 0) when stdin is closed
    // It must not crash with a non-zero exit code before stdin closes
    expect(result.exitCode).toBe(0);
  });
});
