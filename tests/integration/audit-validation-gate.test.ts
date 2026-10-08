import { it, expect } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { writeGateReport } from '../helpers/writeGateReport.js';

async function setup() {
  const w = await auditWorkspace();
  w.definition.phases.a.gate = { results: ['approved', 'needs_revision'], nextByResult: { approved: 'b', needs_revision: 'c' }, validation: { reportPath: 'report.yaml', artifactPaths: ['artifact.md'], threshold: 95, rubric: { correctness: 60, safety: 40 } } };
  await w.writeWorkflow(); await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' }); return w;
}
it('requires a report before any snapshot, event or task transition', async () => {
  const w = await setup();
  try { await expect(w.core.completePhase('task', { result: 'approved' })).rejects.toThrow(); expect(await w.core.listCompletionEvents('task')).toEqual([]); expect((await w.store.getTask('task')).phaseHistory).toEqual([]); }
  finally { await w.cleanup(); }
});
it.each(['score', 'blocker', 'task', 'phase', 'result', 'rubric', 'dimension', 'stale'])('rejects invalid %s evidence without state mutation', async kind => {
  const w = await setup();
  try {
    const { report, reportPath } = await writeGateReport(w.dir, 'task', 'a');
    if (kind === 'score') { report.score = 94; report.dimensions[0].earned = 54; }
    if (kind === 'blocker') report.blockers = ['Missing safety contract'];
    if (kind === 'task') report.taskId = 'other';
    if (kind === 'phase') report.phaseId = 'b';
    if (kind === 'result') report.result = 'needs_revision';
    if (kind === 'rubric') report.score = 100;
    if (kind === 'dimension') report.dimensions[0].name = 'made-up';
    if (kind === 'stale') await writeFile(path.join(w.dir, 'artifact.md'), 'Changed after review');
    await writeFile(reportPath, stringify(report));
    await expect(w.core.completePhase('task', { result: 'approved' })).rejects.toThrow();
    expect(await w.core.listCompletionEvents('task')).toEqual([]); expect((await w.store.getTask('task')).phaseHistory).toEqual([]);
  } finally { await w.cleanup(); }
});
it('approves fresh evidence and permits conservative revision results', async () => {
  const w = await setup();
  try {
    await writeGateReport(w.dir, 'task', 'a'); expect((await w.core.completePhase('task', { result: 'approved' })).nextPhase).toBe('b');
    await w.core.setCurrentPhase('task', 'a'); await writeGateReport(w.dir, 'task', 'a', 'needs_revision', 70);
    expect((await w.core.completePhase('task', { result: 'needs_revision' })).nextPhase).toBe('c');
  } finally { await w.cleanup(); }
});
