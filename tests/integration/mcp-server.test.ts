import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { slugify } from '#utils/slug.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';
import { McpSessionStore } from '#mcp/session-store.js';
import { resolveMcpTaskId } from '#mcp/context.js';
import { McpTaskContextRequiredError, McpSessionContextEmptyError } from '#mcp/errors.js';
import { buildMcpServer } from '#mcp/server.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import type { EvolutionProposal } from '#evolution/types.js';

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

async function initWorkspaceWithContextModeTask(title: string) {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');
  const workflowRoot = path.join(workspace.dir, '.playspec', 'workflows', 'context-mode-spec');
  await writeTextFile(
    path.join(workflowRoot, 'workflow.yaml'),
    `id: context-mode-spec
mode: linear
phaseOrder:
  - start
phases:
  start:
    title: Start
    template: start.md
    requiredVariables:
      - CONTEXT_REF_CONTENTS
`
  );
  await writeTextFile(path.join(workflowRoot, 'templates', 'start.md'), '# Context\n{{CONTEXT_REF_CONTENTS}}\n');
  const taskId = slugify(title);
  const contextPath = `docs/${taskId}/context.md`;
  await writeTextFile(path.join(workspace.dir, contextPath), `Summary line.\n${'x'.repeat(260)}MCP_SECRET_DETAIL\n`);
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title,
    workflow: 'context-mode-spec',
    contextRefs: [{ path: contextPath, role: 'planning-context', source: 'manual' }],
  });
  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);
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

function getRegisteredToolHandler(toolName: string) {
  const toolSpy = vi.spyOn(McpServer.prototype, 'tool');
  buildMcpServer(workspace.dir);
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
});

// ---------------------------------------------------------------------------
// resolveMcpTaskId — context resolver (no HEAD fallback)
// ---------------------------------------------------------------------------

describe('resolveMcpTaskId', () => {
  it('throws McpTaskContextRequiredError when neither taskId nor sessionId is provided', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(resolveMcpTaskId({}, sessionStore)).rejects.toBeInstanceOf(
      McpTaskContextRequiredError
    );
  });

  it('does not fall back to HEAD when no context is provided', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature A');
    // HEAD points to taskId but MCP must not use it
    const sessionStore = new McpSessionStore(workspace.dir);
    const error = await resolveMcpTaskId({}, sessionStore).catch((e) => e);
    expect(error).toBeInstanceOf(McpTaskContextRequiredError);
    // Crucially: it is NOT NoActiveTaskError (which HEAD fallback would throw)
    expect(error.constructor.name).toBe('McpTaskContextRequiredError');
    expect(taskId).toBeTruthy(); // HEAD is set but we still get context error
  });

  it('returns taskId directly when taskId is provided', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    const resolved = await resolveMcpTaskId({ taskId }, sessionStore);
    expect(resolved).toBe(taskId);
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
      resolveMcpTaskId({ sessionId: 'mcp.empty' }, sessionStore)
    ).rejects.toBeInstanceOf(McpSessionContextEmptyError);
  });

  it('throws McpSessionContextEmptyError when session does not exist', async () => {
    await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    await expect(
      resolveMcpTaskId({ sessionId: 'mcp.missing' }, sessionStore)
    ).rejects.toBeInstanceOf(McpSessionContextEmptyError);
  });

  it('resolves taskId from session when sessionId is provided', async () => {
    const { taskId } = await initWorkspaceWithTask('Feature A');
    const sessionStore = new McpSessionStore(workspace.dir);
    await sessionStore.setSessionTask('mcp.codex', taskId, 'codex');
    const resolved = await resolveMcpTaskId({ sessionId: 'mcp.codex' }, sessionStore);
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
    const resolved = await resolveMcpTaskId({ taskId: taskIdA, sessionId: 'mcp.codex' }, sessionStore);
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
        'playspec_skip_evolution_proposal',
        'playspec_diff_evolution_proposal',
        'playspec_apply_evolution_proposal',
        'playspec_record_human_edit_observation',
        'playspec_update_human_edit_observation_status',
      ]));
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

  it('registers evolution context opt-in only on prompt and complete tools', () => {
    const toolSpy = vi.spyOn(McpServer.prototype, 'tool');
    try {
      buildMcpServer(workspace.dir);
      const renderCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_render_next_prompt');
      const completeCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_complete_phase');
      const phaseCall = toolSpy.mock.calls.find((call) => call[0] === 'playspec_render_phase_prompt');

      expect(Object.keys(renderCall?.[2] as Record<string, unknown>)).toContain('withEvolutionContext');
      expect(Object.keys(completeCall?.[2] as Record<string, unknown>)).toContain('withEvolutionContext');
      expect(Object.keys(phaseCall?.[2] as Record<string, unknown>)).not.toContain('withEvolutionContext');
      expect(Object.keys(renderCall?.[2] as Record<string, unknown>)).toContain('contextMode');
      expect(Object.keys(completeCall?.[2] as Record<string, unknown>)).toContain('contextMode');
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

    const resolvedByTaskId = await resolveMcpTaskId({ taskId }, sessionStore);
    const resolvedBySession = await resolveMcpTaskId({ sessionId: 'mcp.claude-code' }, sessionStore);

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

    const resolved = await resolveMcpTaskId({ sessionId: 'mcp.codex' }, sessionStore);
    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(resolved, {
      withEvolutionContext: true,
      evolutionContextSource: 'mcp',
    });

    expect(prompt).toContain('## Evolution Context');
    expect(prompt).toContain('proposal_mcp_visible');
    expect(prompt).not.toContain('MCP should not embed this summary.');
  });

  it('MCP render prompt honors compact/full context modes without writing sidecars', async () => {
    const { taskId } = await initWorkspaceWithContextModeTask('MCP Context Mode Render');
    const handler = getRegisteredToolHandler('playspec_render_next_prompt');

    const compactResult = await handler({ taskId, contextMode: 'compact' });
    const fullResult = await handler({ taskId, contextMode: 'full' });
    const compactBody = parseToolJson(compactResult) as { prompt: string };
    const fullBody = parseToolJson(fullResult) as { prompt: string };

    expect(compactResult.isError).toBeUndefined();
    expect(compactBody.prompt).toContain('body: (omitted in compact context mode)');
    expect(compactBody.prompt).not.toContain('MCP_SECRET_DETAIL');
    expect(fullResult.isError).toBeUndefined();
    expect(fullBody.prompt).toContain('MCP_SECRET_DETAIL');

    await expect(
      access(path.join(
        workspace.dir,
        '.playspec',
        'tasks',
        'active',
        taskId,
        'prompts'
      ))
    ).resolves.not.toThrow();
    const promptFiles = await readdir(path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      taskId,
      'prompts'
    ));
    expect(promptFiles.some((file) => file.endsWith('.meta.yaml'))).toBe(false);
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
