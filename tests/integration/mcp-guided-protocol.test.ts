import { it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

it('lets a fresh stdio MCP client discover, create, render, complete and replay using returned calls', async () => {
  const workspace = await auditWorkspace(); const serverWorkspace = await auditWorkspace();
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', path.join(repoRoot, 'tsconfig.json'), path.join(repoRoot, 'src/mcp/index.ts')], cwd: serverWorkspace.dir, stderr: 'pipe' });
  const client = new Client({ name: 'guided-execution-regression', version: '1' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const completionTool = tools.tools.find(t => t.name === 'playspec_complete_phase')!;
    expect(completionTool.inputSchema.required).toEqual(expect.arrayContaining(['expectedPhaseId', 'requestId']));
    expect(completionTool.inputSchema.properties!.requestId).toMatchObject({ description: expect.stringContaining('execution.completion.arguments.requestId') });
    const listed = await client.callTool({ name: 'playspec_list_workflows', arguments: { workspaceRoot: workspace.dir } });
    expect((listed.structuredContent as any).workflows.some((w: any) => w.id === 'audit' && w.source === 'project')).toBe(true);
    const definition = await client.callTool({ name: 'playspec_show_workflow', arguments: { workspaceRoot: workspace.dir, workflowId: 'audit' } });
    expect((definition.structuredContent as any).definition.phaseOrder).toEqual(['a', 'b', 'c']);
    const created = await client.callTool({ name: 'playspec_create_task', arguments: { workspaceRoot: workspace.dir, workflow: 'audit', title: 'Protocol Task', taskId: 'protocol_task', bindSessionId: 'stdio', sourceProblemText: 'Verify a real MCP consumer can use returned context.' } });
    expect(created.isError).toBeUndefined();
    const createBody = created.structuredContent as any;
    const nextCall = createBody.nextActions[0];
    const rendered = await client.callTool({ name: nextCall.tool, arguments: nextCall.arguments });
    const data = rendered.structuredContent as any;
    expect(data.phaseId).toBe('a');
    expect(JSON.parse((rendered.content as any)[0].text)).toEqual(data);
    expect(data.execution.completion.arguments.workspaceRoot).toBe(workspace.dir);
    const complete = data.execution.completion;
    const result = await client.callTool({ name: complete.tool, arguments: complete.arguments });
    expect(result.isError).toBeUndefined();
    const replay = await client.callTool({ name: complete.tool, arguments: complete.arguments });
    expect((replay.structuredContent as any).completionEvent.id).toBe((result.structuredContent as any).completionEvent.id);
    // A different stale request fails with machine-readable, executable read-only recovery.
    const stale = await client.callTool({ name: complete.tool, arguments: { ...complete.arguments, requestId: 'stale-other-client' } });
    expect(stale.isError).toBe(true);
    const error = (stale.structuredContent as any).error;
    expect(error.code).toBe('phase_advanced');
    expect(error.nextActions.every((a: any) => a.tool !== 'playspec_complete_phase')).toBe(true);
    const recover = error.nextActions.find((a: any) => a.tool === 'playspec_render_next_prompt');
    const newPhase = await client.callTool({ name: recover.tool, arguments: recover.arguments });
    expect((newPhase.structuredContent as any).phaseId).toBe('b');
    expect((await workspace.store.getTask('protocol_task')).phaseHistory).toHaveLength(1);
    expect(await serverWorkspace.store.listActiveTasks()).toHaveLength(0);
  } finally { await client.close(); await transport.close(); await workspace.cleanup(); await serverWorkspace.cleanup(); }
}, 20000);
