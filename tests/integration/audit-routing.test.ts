import { describe, it, expect } from 'vitest';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

describe('workflow route integrity', () => {
  it('rejects a next typo before any completion record or state mutation', async () => {
    const w = await auditWorkspace();
    try {
      w.definition.phases.a.next = 'typo'; await w.writeWorkflow();
      await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
      await expect(w.core.completePhase('task')).rejects.toThrow(/next references/);
      expect((await w.store.getTask('task')).phaseHistory).toEqual([]);
      expect(await w.core.listCompletionEvents('task')).toEqual([]);
    } finally { await w.cleanup(); }
  });
  it.each(['empty', 'duplicate', 'extra-result', 'missing-result', 'unordered-target'])('rejects %s graph errors', async kind => {
    const w = await auditWorkspace();
    try {
      if (kind === 'empty') w.definition.phaseOrder = [];
      if (kind === 'duplicate') w.definition.phaseOrder.push('a');
      if (kind === 'extra-result') w.definition.phases.a.nextByResult = { surprise: 'b' };
      if (kind === 'missing-result') w.definition.phases.a.results = ['approved'];
      if (kind === 'unordered-target') { w.definition.phaseOrder = ['a', 'b']; w.definition.phases.a.next = 'c'; }
      await w.writeWorkflow();
      await expect(new WorkflowLoader(w.dir).load('audit')).rejects.toThrow();
    } finally { await w.cleanup(); }
  });
  it('keeps explicit termination and valid loops', async () => {
    const w = await auditWorkspace();
    try {
      w.definition.phases.a.next = null; w.definition.phases.c.next = 'b'; await w.writeWorkflow();
      await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
      expect((await w.core.completePhase('task')).status).toBe('completed');
    } finally { await w.cleanup(); }
  });
});
