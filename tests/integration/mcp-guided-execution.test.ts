import { it, expect, vi } from 'vitest';
import { mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation';
import { buildMcpServer } from '#mcp/server.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { McpSessionStore } from '#mcp/session-store.js';
import { ValidationReportSchema } from '#core/validation-gate.js';
import type { PhaseExecutionContext } from '#core/phase-execution-context.js';

function handlers(root: string) {
  const spy = vi.spyOn(McpServer.prototype, 'tool');
  try {
    buildMcpServer(root);
    return Object.fromEntries(spy.mock.calls.map(call => [call[0], call.at(-1)])) as Record<string, (args: Record<string, unknown>) => Promise<any>>;
  } finally { spy.mockRestore(); }
}
function body(result: any) { return JSON.parse(result.content[0].text); }

it('provides stable copyable completion args, structured content and scoped next actions', async () => {
  const w = await auditWorkspace(); const other = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    await new McpSessionStore(w.dir).setSessionTask('client', 'task', 'test');
    const h = handlers(other.dir);
    const context = { sessionId: 'client', workspaceRoot: w.dir };
    const first = await h.playspec_render_next_prompt(context); const second = await h.playspec_render_next_prompt(context);
    expect(first.isError).toBeUndefined(); expect(first.structuredContent).toEqual(body(first));
    expect(first.structuredContent.phaseId).toBe('a');
    const execution = body(first).execution;
    expect(execution.allowedResults).toEqual([]); expect(execution.resultRequired).toBe(false);
    expect(execution.completion.arguments).toEqual(body(second).execution.completion.arguments);
    expect(execution.completion.arguments.workspaceRoot).toBe(w.dir);
    expect(body(first).prompt).toContain('## MCP execution instructions');
    expect(await w.core.renderNextPrompt('task')).not.toContain('## MCP execution instructions');
    const completed = await h[execution.completion.tool](execution.completion.arguments);
    expect(completed.isError).toBeUndefined(); expect(body(completed).completedPhaseId).toBe('a');
    const replay = await h[execution.completion.tool](execution.completion.arguments);
    expect(body(replay).completionEvent.id).toBe(body(completed).completionEvent.id);
    expect(body(replay).replayed).toBe(true); expect(body(replay).nextActions[0].tool).toBe('playspec_get_status');
    expect((await w.store.getTask('task')).phaseHistory).toHaveLength(1);
    const next = body(completed).nextActions[0]; expect(next.arguments.workspaceRoot).toBe(w.dir);
    expect(body(await h[next.tool](next.arguments)).phaseId).toBe('b');
  } finally { await w.cleanup(); await other.cleanup(); }
});

it('rejects an old revision on a later visit to the same phase and still replays committed requests', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' }); const h = handlers(w.dir);
    const old = body(await h.playspec_render_next_prompt({ taskId: 'task' })).execution.completion.arguments;
    await w.core.completePhase('task', { expectedPhaseId: 'a', requestId: 'another-client' });
    await w.core.setCurrentPhase('task', 'a');
    const stale = await h.playspec_complete_phase(old);
    expect(stale.isError).toBe(true); expect(stale.structuredContent.error.code).toBe('phase_revision_stale');
    expect(stale.structuredContent.error.retryable).toBe(false);
    expect(stale.structuredContent.error.nextActions.every((a: any) => a.tool !== 'playspec_complete_phase')).toBe(true);
    const fresh = body(await h.playspec_render_next_prompt({ taskId: 'task' })).execution.completion.arguments;
    expect(fresh.requestId).not.toBe(old.requestId);
    expect((await h.playspec_complete_phase(fresh)).isError).toBeUndefined();
    expect((await h.playspec_complete_phase(fresh)).isError).toBeUndefined();
    expect((await w.store.getTask('task')).phaseHistory).toHaveLength(2);
  } finally { await w.cleanup(); }
});

it('exposes report schema/hashes and recovers a missing report without guessing any completion args', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' });
    await w.core.setCurrentPhase('task', 'tech_spec_validate');
    const artifactPath = 'docs/features/task/spec.md'; await mkdir(path.dirname(path.join(w.dir, artifactPath)), { recursive: true });
    await writeFile(path.join(w.dir, artifactPath), '# Reviewed contract\nAcceptance and failure paths.\n');
    const h = handlers(w.dir); const rendered = body(await h.playspec_render_next_prompt({ taskId: 'task' }));
    const execution = rendered.execution as PhaseExecutionContext;
    expect(execution.allowedResults).toEqual(['approved', 'needs_revision']); expect(execution.resultRequired).toBe(true);
    const validation = execution.validation!;
    expect(validation.artifacts).toEqual([{ path: artifactPath, status: 'present', sha256: createHash('sha256').update(await readFile(path.join(w.dir, artifactPath))).digest('hex') }]);
    const completion = execution.completion!; const args = { ...completion.arguments, result: 'approved' };
    const missing = await h[completion.tool](args);
    expect(missing.isError).toBe(true); expect(missing.structuredContent.error.code).toBe('validation_report_required');
    expect(missing.structuredContent.error.details.reportPath).toBe(validation.reportPath);
    const read = missing.structuredContent.error.nextActions.find((a: any) => a.tool === 'playspec_render_next_prompt');
    expect(body(await h[read.tool](read.arguments)).execution.validation.reportPath).toBe(validation.reportPath);
    // Explicit reviewer-authored test report; the production guidance never generates scores/verdicts.
    const report = { version: 1, taskId: validation.taskId, phaseId: validation.phaseId, result: 'approved', score: 96, blockers: [], summary: 'Test review confirms the stated contract.',
      dimensions: Object.entries(validation.rubric!).map(([name, max], i) => ({ name, max, earned: max - (i === 0 ? 4 : 0), evidence: [`${artifactPath}: acceptance and failure paths`], deductions: i === 0 ? 'Four points reserved for test fixture limitations.' : '' })),
      artifacts: validation.artifacts.map(({ path, sha256 }) => ({ path, sha256 })),
      cause: { category: 'artifact_quality_issue', confidence: 'high', summary: 'Artifact contract reviewed in this regression fixture.' } };
    const validate = new AjvJsonSchemaValidator().getValidator(validation.reportSchema as JsonSchemaType);
    expect(validate(report).valid).toBe(true); expect(ValidationReportSchema.safeParse(report).success).toBe(true);
    expect(validate({ ...report, cause: undefined }).valid).toBe(false);
    expect(validate({ ...report, result: 'invented' }).valid).toBe(false);
    expect(validate({ ...report, dimensions: report.dimensions.map(d => ({ ...d, max: 200 })) }).valid).toBe(false);
    await writeFile(path.join(w.dir, validation.reportPath), JSON.stringify(report));
    expect((await h[completion.tool](args)).isError).toBeUndefined();
    expect((await w.store.getTask('task')).currentPhase).toBe('implementation_plan_create');
    const conflict = await h[completion.tool]({ ...args, result: 'needs_revision' });
    expect(conflict.structuredContent.error.code).toBe('completion_request_conflict');
  } finally { await w.cleanup(); }
});

it('keeps historical phase inspection and blocked harness from offering completion calls', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' }); const h = handlers(w.dir);
    const historical = body(await h.playspec_render_phase_prompt({ taskId: 'task', phaseId: 'c' }));
    expect(historical.execution.isCurrentPhase).toBe(false); expect(historical.execution.completion).toBeNull();
    for (let i = 0; i < 3; i++) await w.core.recordHarnessAttempt('task', 'a', 'failure', 'Repeated failure');
    const blocked = body(await h.playspec_render_next_prompt({ taskId: 'task' }));
    expect(blocked.execution.harness.blocked).toBe(true); expect(blocked.execution.completion).toBeNull();
    const failure = await h.playspec_complete_phase({ taskId: 'task', expectedPhaseId: 'a', requestId: 'blocked' });
    expect(failure.structuredContent.error.code).toBe('harness_blocked');
    expect(failure.structuredContent.error.nextActions.some((a: any) => a.tool === 'playspec_reset_harness')).toBe(false);
  } finally { await w.cleanup(); }
});

it('reports missing/unreadable artifact hashes explicitly and never leaks external contents', async () => {
  const w = await auditWorkspace(); const outside = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' }); await w.core.setCurrentPhase('task', 'tech_spec_validate');
    const h = handlers(w.dir);
    expect(body(await h.playspec_render_next_prompt({ taskId: 'task' })).execution.validation.artifacts[0]).toMatchObject({ status: 'missing', sha256: null });
    await writeFile(path.join(outside.dir, 'secret.md'), 'external contents');
    await mkdir(path.join(w.dir, 'docs/features/task'), { recursive: true });
    await symlink(path.join(outside.dir, 'secret.md'), path.join(w.dir, 'docs/features/task/spec.md'));
    expect(body(await h.playspec_render_next_prompt({ taskId: 'task' })).execution.validation.artifacts[0]).toMatchObject({ status: 'unreadable', sha256: null });
  } finally { await w.cleanup(); await outside.cleanup(); }
});

it('offers terminal inspection, scoped lookup recovery and described completion args', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' }); await w.core.setCurrentPhase('task', 'c');
    const h = handlers(w.dir); const args = body(await h.playspec_render_next_prompt({ taskId: 'task' })).execution.completion.arguments;
    const done = body(await h.playspec_complete_phase(args));
    expect(done.isWorkflowComplete).toBe(true); expect(done.nextActions[0].tool).toBe('playspec_get_task');
    const status = body(await h.playspec_get_status({ taskId: 'task' }));
    expect(status.currentPhase).toBeNull(); expect(status.nextActions[0].tool).toBe('playspec_get_task');
    const unbound = await h.playspec_render_next_prompt({ sessionId: 'unbound' });
    expect(unbound.structuredContent.error.code).toBe('session_not_bound');
    expect(unbound.structuredContent.error.nextActions[0]).toEqual({ tool: 'playspec_list_tasks', arguments: { workspaceRoot: w.dir } });
  } finally { await w.cleanup(); }
});

it('recovers a pending commit before rendering fresh completion context', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' }); const h = handlers(w.dir);
    const before = body(await h.playspec_render_next_prompt({ taskId: 'task' })).execution.completion.arguments;
    const failed = vi.spyOn(w.store, 'completePhase').mockRejectedValueOnce(new Error('Injected state persistence failure'));
    try { await expect(w.core.completePhase('task', before)).rejects.toThrow('Injected'); } finally { failed.mockRestore(); }
    const recovered = body(await h.playspec_render_next_prompt({ taskId: 'task' }));
    expect(recovered.phaseId).toBe('b'); expect(recovered.execution.completion.arguments.requestId).not.toBe(before.requestId);
    const replay = await h.playspec_complete_phase(before);
    expect(replay.isError).toBeUndefined(); expect(body(replay).completedPhaseId).toBe('a');
    expect((await w.store.getTask('task')).phaseHistory).toHaveLength(1);
  } finally { await w.cleanup(); }
});

it('does not require future artifact variables while rendering an earlier phase', async () => {
  const w = await auditWorkspace();
  try {
    w.definition.artifacts = { future: { path: 'docs/{{LATE_VARIABLE}}/final.md', required: true } };
    w.definition.variables = { LATE_VARIABLE: { required: false } }; await w.writeWorkflow();
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' }); const h = handlers(w.dir);
    const first = await h.playspec_render_next_prompt({ taskId: 'task' });
    expect(first.isError).toBeUndefined(); expect(body(first).execution.requiredOutputs).toEqual([]);
    await w.core.setCurrentPhase('task', 'c');
    const final = await h.playspec_render_next_prompt({ taskId: 'task' });
    expect(final.isError).toBe(true); expect(final.structuredContent.error.code).toBe('required_variables_missing');
    expect(final.structuredContent.error.details.missingVariables).toContain('LATE_VARIABLE');
    const show = final.structuredContent.error.nextActions.find((call: any) => call.tool === 'playspec_show_workflow');
    expect(body(await h[show.tool](show.arguments)).definition.variables.LATE_VARIABLE).toBeDefined();
  } finally { await w.cleanup(); }
});

it('returns typed report errors, prerequisite inspection calls and one transition for parallel copied requests', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' }); const h = handlers(w.dir);
    await w.store.updateTask('task', { currentPhase: 'implementation' });
    const bypass = await h.playspec_complete_phase({ taskId: 'task', expectedPhaseId: 'implementation', requestId: 'bypass' });
    expect(bypass.structuredContent.error.code).toBe('validation_prerequisite_required');
    const inspect = bypass.structuredContent.error.nextActions.find((call: any) => call.tool === 'playspec_render_phase_prompt');
    expect(inspect.arguments.phaseId).toBe('tech_spec_validate');
    expect(body(await h[inspect.tool](inspect.arguments)).execution.completion).toBeNull();
    await w.core.setCurrentPhase('task', 'tech_spec_validate');
    const gate = body(await h.playspec_render_next_prompt({ taskId: 'task' })).execution;
    await mkdir(path.dirname(path.join(w.dir, gate.validation.reportPath)), { recursive: true });
    await writeFile(path.join(w.dir, gate.validation.reportPath), 'version: 1\nscore: 100\n');
    const invalid = await h.playspec_complete_phase({ ...gate.completion.arguments, result: 'approved' });
    expect(invalid.structuredContent.error.code).toBe('validation_report_invalid');
    expect((await w.store.getTask('task')).phaseHistory).toHaveLength(0);
    await w.store.createTask({ id: 'parallel', title: 'Parallel', workflow: 'audit' });
    const args = body(await h.playspec_render_next_prompt({ taskId: 'parallel' })).execution.completion.arguments;
    const both = await Promise.all([h.playspec_complete_phase(args), h.playspec_complete_phase(args)]);
    expect(both.every(result => !result.isError)).toBe(true);
    expect(body(both[0]).completionEvent.id).toBe(body(both[1]).completionEvent.id);
    expect((await w.store.getTask('parallel')).phaseHistory).toHaveLength(1);
  } finally { await w.cleanup(); }
});
