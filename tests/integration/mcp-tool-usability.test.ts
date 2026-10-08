import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildMcpServer } from '#mcp/server.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import { EvolutionHumanEditStore } from '#evolution/human-edit-store.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';
import type { EvolutionProposal, FeedbackThread } from '#evolution/types.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = '.playspec/templates/usability.md';
const now = '2026-10-08T00:00:00.000Z';
function proposal(): EvolutionProposal {
  return { id: 'usable', revision: 1, createdAt: now, updatedAt: now, status: 'pending', source: { artifactRefs: [] }, targetFiles: [target], evidenceRefs: [], riskLevel: 'low',
    actions: [{ actionId: 'replace', type: 'replace_file', targetPath: target, content: '# Improved\n', summary: 'Improve prompt', rationale: 'Fixture evidence' }], rationale: 'Fixture evidence', review: { status: 'unreviewed' } };
}
function thread(): FeedbackThread {
  return { id: 'thread_b', createdAt: now, updatedAt: now,
    dedupeKey: { version: 1, workflowId: 'audit', feedbackKind: 'prompt_evolution_signal', sourcePhaseId: 'b', evaluatedArtifactPhaseId: 'a', evolutionTargetPhaseId: 'a', causeCategory: 'authoring_prompt_gap', fields: {} },
    dedupeKeyHash: 'e'.repeat(64), sourcePhaseId: 'b', evaluatedArtifactPhaseId: 'a', evolutionTargetPhaseId: 'a',
    workflowSource: { kind: 'project_local', root: '.playspec/workflows/audit', rootPathKind: 'workspace_relative' },
    targetPromptTemplate: { path: 'step.md', pathKind: 'workflow_relative', writable: true }, targetWritable: true, targetPath: '.playspec/workflows/audit/templates/step.md',
    compactHistoryPolicy: { maxEntries: 3, keepFirst: true, keepLatest: 2, summarizeOverflow: true },
    proposalReadinessPolicy: { mode: 'manual_only_initial', minRunCount: 2, minNegativeCount: 1, minConfidence: 'medium', requireHumanReviewBeforeProposal: true }, mutationStrategy: 'manual_review_only',
    trend: { totalEvents: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0, parseFailureCount: 0, direction: 'unknown', confidence: 'low', readinessState: 'not_ready' }, events: [] };
}

describe('remaining MCP tools through a real stdio client', () => {
  let a: Awaited<ReturnType<typeof auditWorkspace>>;
  let b: Awaited<ReturnType<typeof auditWorkspace>>;
  let client: Client; let transport: StdioClientTransport;
  let schemas: Map<string, z.ZodObject<z.ZodRawShape>>;
  beforeEach(async () => {
    a = await auditWorkspace(); b = await auditWorkspace();
    const spy = vi.spyOn(McpServer.prototype, 'tool');
    const server = buildMcpServer(a.dir);
    schemas = new Map(spy.mock.calls.map(call => [String(call[0]), z.object(call[2] as z.ZodRawShape)]));
    spy.mockRestore(); await server.close();
    transport = new StdioClientTransport({ command: process.execPath, args: [path.join(repo, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', path.join(repo, 'tsconfig.json'), path.join(repo, 'src/mcp/index.ts')], cwd: a.dir, stderr: 'pipe', env: { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')), PLAY_SPEC_USER_WORKFLOWS: path.join(a.dir, '.playspec/user-workflows') } });
    client = new Client({ name: 'remaining-tool-usability', version: '1' });
    await client.connect(transport);
  });
  afterEach(async () => { await client?.close(); await transport?.close(); await a?.cleanup(); await b?.cleanup(); });
  async function call(name: string, args: Record<string, unknown> = {}, error = false) {
    const result = await client.callTool({ name, arguments: { workspaceRoot: b.dir, ...args } });
    expect(Boolean(result.isError), JSON.stringify(result)).toBe(error);
    const body = result.structuredContent as any;
    if (body) {
      expect(body.workspaceRoot).toBe(b.dir);
      if (!error) expect(JSON.parse((result.content as any)[0].text)).toEqual(body);
      for (const next of error ? body.error.nextActions : body.nextActions) {
        expect(next.arguments.workspaceRoot).toBe(b.dir);
        expect(schemas.has(next.tool)).toBe(true);
        expect(schemas.get(next.tool)!.safeParse(next.arguments).success, JSON.stringify(next)).toBe(true);
        expect(next.tool).not.toMatch(/complete_phase|apply_evolution|reset_harness|execute_git_rollback|rollback_state|remove_workflow|set_current_phase/);
      }
    }
    return body;
  }
  async function follow(next: any) { return call(next.tool, next.arguments); }

  it('publishes complete argument descriptions and canonical proposal action schemas', async () => {
    const tools = (await client.listTools()).tools;
    expect(tools).toHaveLength(48);
    for (const tool of tools) {
      for (const property of Object.values(tool.inputSchema.properties ?? {})) expect((property as any).description, tool.name).toBeTruthy();
      expect(tool.inputSchema.properties).toHaveProperty('workspaceRoot');
    }
    const store = tools.find(t => t.name === 'playspec_store_evolution_proposal')!;
    const schema = store.inputSchema.properties!.proposal as any;
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(expect.arrayContaining(['id', 'revision', 'source', 'actions', 'review']));
    expect(JSON.stringify(schema.properties.actions)).toContain('replace_section');
    const update = tools.find(t => t.name === 'playspec_update_evolution_proposal')!;
    const replacement = update.inputSchema.properties!.proposal as any;
    expect(replacement.required).toEqual(expect.arrayContaining(['source', 'targetFiles', 'riskLevel', 'actions', 'rationale', 'review']));
    expect(replacement.required).not.toContain('revision');
    expect(replacement.required).not.toContain('evidenceRefs');
    expect(tools.find(t => t.name === 'playspec_install_workflow')!.description).toContain('user-global');
    expect(tools.find(t => t.name === 'playspec_collect_evidence')!.annotations!.readOnlyHint).toBe(false);
    expect(tools.find(t => t.name === 'playspec_apply_evolution_proposal')!.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.find(t => t.name === 'playspec_get_feedback_thread')!.annotations!.readOnlyHint).toBe(true);
  });

  it('validates, exports and edits the explicitly inspected project workflow, leaving server project intact', async () => {
    const originalA = await readFile(path.join(a.workflowRoot, 'workflow.yaml'), 'utf8');
    await writeFile(path.join(b.workflowRoot, 'templates/extra.md'), '# Extra\n');
    await call('playspec_validate_workflow', { workflowPath: '.playspec/workflows/audit' });
    const exported = await call('playspec_export_workflow', { workflowId: 'audit', outDir: 'exported' });
    expect(await readFile(path.join(b.dir, exported.targetPath, 'workflow.yaml'), 'utf8')).toContain('audit');
    const added = await call('playspec_workflow_add_phase', { workflowId: 'audit', afterPhaseId: 'a', newPhaseId: 'extra', title: 'Extra', templatePath: 'extra.md' });
    const inspected = await follow(added.nextActions[0]);
    expect(inspected.definition.phaseOrder).toEqual(['a', 'extra', 'b', 'c']);
    await call('playspec_workflow_reorder_phase', { workflowId: 'audit', phaseId: 'extra', afterPhaseId: 'c' });
    await call('playspec_workflow_set_template', { workflowId: 'audit', phaseId: 'extra', templatePath: 'step.md' });
    await call('playspec_workflow_remove_phase', { workflowId: 'audit', phaseId: 'extra' });
    const invalid = await call('playspec_workflow_set_template', { workflowId: 'audit', phaseId: 'a', templatePath: 'missing.md' }, true);
    expect((await follow(invalid.error.nextActions[0])).workflows.some((w: any) => w.id === 'audit')).toBe(true);
    expect(await readFile(path.join(a.workflowRoot, 'workflow.yaml'), 'utf8')).toBe(originalA);
  });

  it('resolves install sources in the requested workspace while keeping installation user-global', async () => {
    const source = path.join(b.dir, 'isolated-user/templates');
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'step.md'), '# User workflow\n');
    await writeFile(path.join(b.dir, 'isolated-user/workflow.yaml'), 'id: isolated-user\nmode: linear\nphaseOrder: [a]\nphases:\n  a:\n    title: A\n    template: step.md\n');
    // Validating an external workflow must not suggest inspecting a different installed definition.
    const validated = await call('playspec_validate_workflow', { workflowPath: 'isolated-user' });
    expect(validated.nextActions[0].tool).toBe('playspec_list_workflows');
    const installed = await call('playspec_install_workflow', { workflowPath: 'isolated-user' });
    expect(installed.workflowId).toBe('isolated-user');
    expect((await follow(installed.nextActions[0])).source).toBe('user');
    expect(await readFile(path.join(a.dir, '.playspec/user-workflows/isolated-user/workflow.yaml'), 'utf8')).toContain('isolated-user');
    await call('playspec_remove_workflow', { workflowId: 'isolated-user', confirm: false }, true);
    await call('playspec_remove_workflow', { workflowId: 'isolated-user', confirm: true }); // Isolated fixture only.
    expect((await call('playspec_list_workflows')).workflows.some((w: any) => w.id === 'isolated-user')).toBe(false);
    expect(await readFile(path.join(b.workflowRoot, 'workflow.yaml'), 'utf8')).toContain('audit');
  });

  it('rediscovers observations after a lost response and changes status only in the requested project', async () => {
    await call('playspec_record_human_edit_observation', { id: 'edit_b', target: 'docs/prompt.md', summary: 'Human edit', rationale: 'Clearer instructions', before: 'docs/before.md', after: 'docs/after.md' });
    // Rediscover without retaining the write response.
    const listed = await call('playspec_list_human_edit_observations', { status: 'recorded', limit: 1 });
    expect(listed.pagination).toMatchObject({ total: 1, returned: 1, hasMore: false });
    const found = await follow(listed.nextActions[0]);
    expect(found.observation).toMatchObject({ id: 'edit_b', beforeRef: 'docs/before.md', afterRef: 'docs/after.md' });
    const changed = await call('playspec_update_human_edit_observation_status', { editId: found.observation.id, status: 'superseded', reason: 'Replaced by later edit' });
    expect((await follow(changed.nextActions[0])).observation.status).toBe('superseded');
    expect((await call('playspec_list_human_edit_observations', { status: 'recorded' })).observations).toEqual([]);
    expect(await new EvolutionHumanEditStore(a.dir).listObservations()).toEqual([]);
    const missing = await call('playspec_update_human_edit_observation_status', { editId: 'lost', status: 'ignored' }, true);
    expect(missing.error.code).toBe('resource_not_found');
    expect((await follow(missing.error.nextActions[0])).observations[0].id).toBe('edit_b');
  });

  it('stores and replaces canonical proposals, preserves metadata/evidence and previews without approval', async () => {
    await mkdir(path.dirname(path.join(b.dir, target)), { recursive: true }); await writeFile(path.join(b.dir, target), '# Before\n');
    await writeFile(path.join(b.dir, 'evidence.md'), 'Fixture supporting evidence\n');
    const stored = await call('playspec_store_evolution_proposal', { proposal: proposal() });
    expect((await follow(stored.nextActions.find((n: any) => n.tool === 'playspec_diff_evolution_proposal'))).changedFiles).toEqual([target]);
    await call('playspec_append_evolution_evidence', { proposalId: 'usable', path: 'evidence.md', note: 'Support the proposed prompt edit' });
    const { id, revision, createdAt, updatedAt, status, evidenceRefs, ...replacement } = proposal();
    const updated = await call('playspec_update_evolution_proposal', { proposalId: 'usable', proposal: { ...replacement, rationale: 'Revised reason' } });
    expect(updated.proposal).toMatchObject({ id: 'usable', revision: 3, createdAt: now, status: 'pending' });
    expect(updated.proposal.evidenceRefs).toHaveLength(1);
    const denied = await call('playspec_apply_evolution_proposal', { proposalId: 'usable', approved: false }, true);
    expect(denied.error.code).toBe('approval_required');
    expect(denied.error.nextActions.some((n: any) => n.tool === 'playspec_get_evolution_proposal')).toBe(true);
    expect(await readFile(path.join(b.dir, target), 'utf8')).toBe('# Before\n');
    expect(await new EvolutionProposalStore(a.dir).listProposals()).toEqual([]);
    const invalid = await client.callTool({ name: 'playspec_store_evolution_proposal', arguments: { workspaceRoot: b.dir, proposal: { id: 'incomplete' } } });
    expect(invalid.isError).toBe(true); // SDK rejects before handler; no fabricated defaults.
  });

  it('discovers feedback IDs and appends thread evidence in the same explicit workspace', async () => {
    await new EvolutionProposalStore(b.dir).saveProposal(proposal());
    await new EvolutionFeedbackThreadStore(b.dir).saveThread(thread());
    const listed = await call('playspec_list_feedback_threads', { limit: 1 });
    expect(listed.threads[0]).not.toHaveProperty('events');
    const full = await follow(listed.nextActions[0]);
    expect(full.thread.id).toBe('thread_b');
    const appended = await call('playspec_append_evolution_thread_evidence', { proposalId: 'usable', threadId: full.thread.id });
    expect(appended.proposal.evidenceRefs[0].path).toBe(appended.threadPath);
    expect((await follow(appended.nextActions[0])).proposal.revision).toBe(2);
    expect(await new EvolutionFeedbackThreadStore(a.dir).listThreads()).toEqual([]);
    const bad = await call('playspec_append_evolution_thread_evidence', { proposalId: 'usable', threadId: 'unknown' }, true);
    expect((await follow(bad.error.nextActions.find((n: any) => n.tool === 'playspec_list_feedback_threads'))).threads[0].id).toBe('thread_b');
    expect((await call('playspec_list_feedback_threads', { offset: 1, limit: 1 })).pagination).toMatchObject({ total: 1, returned: 0, hasMore: false });
  });

  it('guides advisory proposal refinement instead of offering an unusable diff', async () => {
    await call('playspec_create_task', { workflow: 'audit', title: 'Advice', taskId: 'advice' });
    await writeFile(path.join(b.dir, 'evidence.md'), 'Observed weakness');
    const generated = await call('playspec_generate_evolution_proposal', { taskId: 'advice', fromEvidence: 'evidence.md', target, summary: 'Improve instructions', rationale: 'Observed weakness', generatedId: 'advisory' });
    expect(generated.instructions).toContain('playspec_update_evolution_proposal');
    expect(generated.nextActions.map((n: any) => n.tool)).toEqual(['playspec_get_evolution_proposal']);
    expect((await follow(generated.nextActions[0])).instructions).toContain('advisory');
  });

  it('provides scoped inspection calls for task links, contexts, evidence and snapshots', async () => {
    await call('playspec_create_task', { workflow: 'audit', title: 'Source', taskId: 'source', bindSessionId: 'link-session' });
    await call('playspec_create_task', { workflow: 'audit', title: 'Target', taskId: 'target_task' });
    const linked = await call('playspec_link_tasks', { sessionId: 'link-session', targetTaskId: 'target_task', type: 'after' });
    expect((await follow(linked.nextActions.find((n: any) => n.tool === 'playspec_get_task'))).links[0]).toMatchObject({ type: 'after', targetTaskId: 'target_task' });
    const unlinked = await call('playspec_unlink_tasks', { sourceTaskId: 'source', targetTaskId: 'target_task' });
    expect((await follow(unlinked.nextActions.find((n: any) => n.tool === 'playspec_get_task'))).links ?? []).toEqual([]);
    await writeFile(path.join(b.dir, 'context.md'), 'Task context');
    const context = await call('playspec_add_context', { taskId: 'source', path: 'context.md' });
    expect((await follow(context.nextActions.find((n: any) => n.tool === 'playspec_get_task'))).contextRefs[0].path).toBe('context.md');
    const evidence = await call('playspec_collect_evidence', { sessionId: 'link-session' });
    expect((await follow(evidence.nextActions[0])).id).toBe('source');
    const snapshot = await call('playspec_create_snapshot', { taskId: 'source' });
    expect((await follow(snapshot.nextActions[0])).currentPhase).toBe('a');
    expect((await a.store.listActiveTasks())).toEqual([]);
  });

  it('keeps recovery suggestions scoped and never supplies mutation approval or harness reset', async () => {
    await call('playspec_create_task', { workflow: 'audit', title: 'Recovery', taskId: 'recover', bindSessionId: 'session_b' });
    const bound = await call('playspec_get_session_task', { sessionId: 'session_b' });
    expect((await follow(bound.nextActions[0])).currentPhase).toBe('a');
    const unbound = await call('playspec_get_session_task', { sessionId: 'unknown' });
    expect(unbound.nextActions[0].tool).toBe('playspec_list_tasks');
    const noSafePoint = await call('playspec_plan_rollback', { sessionId: 'session_b' }, true);
    expect(noSafePoint.error.code).toBe('rollback_safe_point_missing');
    expect(noSafePoint.error.retryable).toBe(false);
    await follow(noSafePoint.error.nextActions.find((n: any) => n.tool === 'playspec_get_status'));
    const denied = await call('playspec_execute_git_rollback', { taskId: 'recover', confirm: false }, true);
    expect(denied.error.code).toBe('confirmation_required');
    expect(denied.error.nextActions.some((n: any) => n.tool === 'playspec_plan_rollback')).toBe(true);
    await call('playspec_record_harness_attempt', { taskId: 'recover', phaseId: 'a', result: 'failure', reason: 'Test failure' });
    const harness = await call('playspec_get_harness_status', { taskId: 'recover' });
    expect(harness.instructions).toContain('review');
    const missingContext = await call('playspec_add_context', { taskId: 'recover', path: 'missing.md' }, true);
    expect(missingContext.error.code).toBe('context_file_not_found');
    await follow(missingContext.error.nextActions.find((n: any) => n.tool === 'playspec_get_status'));
    expect((await b.store.getTask('recover')).phaseHistory).toHaveLength(0);
  });
});
