import { it, expect } from 'vitest';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { PresetManager } from '#preset/preset-manager.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { writeGateReport } from '../helpers/writeGateReport.js';

it.each([{ score: 96, result: 'approved', feedback: 'positive' }, { score: 89, result: 'needs_revision', feedback: 'negative' }])('captures actual score $score instead of prompt examples', async ({ score, result, feedback }) => {
  const w = await auditWorkspace();
  try {
    await new PresetManager().initWorkspace(w.dir, 'default');
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec', currentPhase: 'tech_spec_validate' });
    const template = path.join(w.dir, '.playspec/workflows/mono-spec/templates/tech_spec_validate.md');
    await writeFile(template, 'Score: 100/100\n```playspecFeedback\nscore: X\n```\n'+await readFile(template, 'utf8'));
    await writeGateReport(w.dir, 'task', 'tech_spec_validate', result, score);
    const completed = await w.core.completePhase('task', { result });
    expect(completed.feedback).toMatchObject({ status: 'captured', score, feedbackResult: feedback, approvalResult: result });
    expect(completed.completionEvent?.validationReportFile).toMatch(/_validation.yaml$/);
  } finally { await w.cleanup(); }
});
it('records missing cause explicitly without substituting prompt output', async () => {
  const w = await auditWorkspace();
  try {
    await new PresetManager().initWorkspace(w.dir, 'default');
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec', currentPhase: 'tech_spec_validate' });
    const { report, reportPath } = await writeGateReport(w.dir, 'task', 'tech_spec_validate'); delete report.cause;
    await writeFile(reportPath, stringify(report));
    const completed = await w.core.completePhase('task', { result: 'approved' });
    expect(completed.feedback).toMatchObject({ status: 'failed', stage: 'extraction' });
    expect(completed.feedback?.status === 'failed' && completed.feedback.message).toContain('cause classification');
  } finally { await w.cleanup(); }
});
