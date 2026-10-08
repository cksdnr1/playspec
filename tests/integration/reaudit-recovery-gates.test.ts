import { it, expect } from 'vitest';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { writeGateReport } from '../helpers/writeGateReport.js';

it('rejects recovery past missing validations and completion from a forged late phase', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' });
    await expect(w.core.setCurrentPhase('task', 'pr_prepare')).rejects.toThrow('Validation prerequisite');
    expect((await w.store.getTask('task')).currentPhase).toBeNull();
    await w.store.updateTask('task', { currentPhase: 'implementation' });
    await expect(w.core.completePhase('task')).rejects.toThrow('Validation prerequisite');
    expect(await w.core.listCompletionEvents('task')).toHaveLength(0);
  } finally { await w.cleanup(); }
});
it('permits revision and revalidation but requires both approvals before implementation', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' });
    await w.core.setCurrentPhase('task', 'tech_spec_validate');
    await writeGateReport(w.dir, 'task', 'tech_spec_validate', 'needs_revision', 70);
    await w.core.completePhase('task', { result: 'needs_revision' }); await w.core.completePhase('task');
    await writeGateReport(w.dir, 'task', 'tech_spec_validate'); await w.core.completePhase('task', { result: 'approved' });
    await expect(w.core.setCurrentPhase('task', 'implementation')).rejects.toThrow('implementation_plan_validate');
    await w.core.setCurrentPhase('task', 'implementation_plan_validate'); await writeGateReport(w.dir, 'task', 'implementation_plan_validate');
    await w.core.completePhase('task', { result: 'approved' });
    await w.core.setCurrentPhase('task', 'implementation');
    await w.core.completePhase('task');
    await w.core.setCurrentPhase('task', 'tech_spec_validate'); await writeGateReport(w.dir, 'task', 'tech_spec_validate', 'needs_revision', 70);
    await w.core.completePhase('task', { result: 'needs_revision' });
    await expect(w.core.setCurrentPhase('task', 'implementation')).rejects.toThrow('tech_spec_validate');
  } finally { await w.cleanup(); }
});
it('preserves phase recovery for workflows without validation gates', async () => {
  const w = await auditWorkspace();
  try { await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' }); await w.core.setCurrentPhase('task', 'c'); expect((await w.core.completePhase('task')).isWorkflowComplete).toBe(true); }
  finally { await w.cleanup(); }
});

it('rejects structured migration phase jumps without approvals', async () => {
  const { MigrationRunner } = await import('#migration/migration-runner.js');
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' });
    const targetPath = '.playspec/tasks/active/task/task.yaml';
    await expect(new MigrationRunner(w.dir, w.store).run({
      id: 'phase-jump', createdAt: new Date().toISOString(), mode: 'auto', sourceRoot: '.', targetTaskId: 'task', sourceFiles: [], targetFiles: [targetPath],
      actions: [{ actionId: 'jump', type: 'update_task_state', targetPath, sourcePaths: [], reason: 'Recovery', evidence: 'Explicit', riskLevel: 'low', preview: '', backupRequired: true, requiresReview: false, fieldPath: 'currentPhase', previousValue: null, proposedValue: 'pr_prepare' }],
      statePromotions: [{ fieldPath: 'currentPhase', previousValue: null, proposedValue: 'pr_prepare', evidenceSources: [], confidence: 'deterministic', reason: 'Explicit', requiresReview: false }],
      riskLevel: 'low', requiresReview: false, summary: 'Recovery', warnings: [],
    })).rejects.toThrow('Validation prerequisite');
    expect((await w.store.getTask('task')).currentPhase).toBeNull();
  } finally { await w.cleanup(); }
});
