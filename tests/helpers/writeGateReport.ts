import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { VariableResolver } from '#template/variable-resolver.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { renderArtifactPath, type ValidationReport } from '#core/validation-gate.js';

/** Explicit fixture artifact/report generation for tests that exercise routing rather than authoring. */
export async function writeGateReport(workspaceRoot: string, taskId: string, phaseId: string, result = 'approved', score = 96) {
  const task = await new YamlTaskStore(workspaceRoot).getTask(taskId);
  const workflow = await new WorkflowLoader(workspaceRoot).load(task.workflow);
  const definition = workflow.phases[phaseId]; const config = definition.gate?.validation;
  if (!config) throw new Error('Fixture workflow has no validation gate.');
  const variables = new VariableResolver().resolve(task, phaseId, workflow, definition);
  const artifacts = [];
  for (const pattern of config.artifactPaths) {
    const file = renderArtifactPath(pattern, variables); const absolute = path.join(workspaceRoot, file);
    try { await access(absolute); } catch { await mkdir(path.dirname(absolute), { recursive: true }); await writeFile(absolute, '# Evaluated test fixture artifact\n'); }
    artifacts.push({ path: file, sha256: createHash('sha256').update(await readFile(absolute)).digest('hex') });
  }
  let deduction = 100 - score;
  const dimensions = Object.entries(config.rubric ?? { fixture: 100 }).map(([name, max]) => {
    const lost = Math.min(max, deduction); deduction -= lost;
    return { name, max, earned: max - lost, evidence: ['Evaluated fixture artifact and test contract'], deductions: lost ? `${lost} points reserved for nonblocking fixture limitations.` : '' };
  });
  const report: ValidationReport = { version: 1, taskId, phaseId, result, score, blockers: [], summary: 'Explicit fixture review for engine regression tests.', dimensions, artifacts,
    cause: { category: 'artifact_quality_issue', confidence: 'high', summary: 'Fixture artifact quality; no inference of prompt defects.' } };
  const reportPath = path.join(workspaceRoot, renderArtifactPath(config.reportPath, variables));
  await mkdir(path.dirname(reportPath), { recursive: true }); await writeFile(reportPath, stringify(report));
  return { report, reportPath };
}
