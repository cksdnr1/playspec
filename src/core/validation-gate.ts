import { createHash } from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';
import { resolveContainedPath } from '#utils/contained-path.js';
import { getActiveTaskRoot } from '#utils/paths.js';
import type { CompletionEvent, WorkflowDefinition, PhaseDefinition, TaskRecord } from './types.js';
import { PlaySpecError } from './errors.js';
import { FeedbackCauseCategorySchema, FeedbackConfidenceSchema } from '#evolution/schemas.js';

export const ValidationReportSchema = z.object({
  cause: z.object({ category: FeedbackCauseCategorySchema, confidence: FeedbackConfidenceSchema, summary: z.string().trim().min(1) }).optional(),
  evolutionTargetPhaseId: z.string().min(1).optional(),
  dedupeFieldValues: z.record(z.string()).optional(),
  version: z.literal(1), taskId: z.string().min(1), phaseId: z.string().min(1), result: z.string().min(1),
  score: z.number().min(0).max(100), blockers: z.array(z.string().trim().min(1)), summary: z.string().trim().min(1),
  dimensions: z.array(z.object({
    name: z.string().trim().min(1), earned: z.number().nonnegative(), max: z.number().positive(),
    evidence: z.array(z.string().trim().min(1)).min(1), deductions: z.string(),
  })).min(1),
  artifacts: z.array(z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export function renderArtifactPath(pattern: string, variables: Record<string, string>): string {
  const rendered = pattern.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_token, key: string) => {
    const value = variables[key.trim()];
    if (!value || value.startsWith('(not provided)')) throw new Error(`Validation artifact variable is missing: ${key}`);
    return value;
  });
  const normalized = rendered.replace(/\\/g, '/');
  if (!normalized || path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`Validation artifact must stay workspace-relative: ${rendered}`);
  }
  return path.posix.normalize(normalized);
}

export async function validateGateReport(input: {
  workspaceRoot: string; task: TaskRecord; phaseId: string; definition: PhaseDefinition;
  variables: Record<string, string>; result?: string;
}): Promise<{ report: ValidationReport; path: string; content: string; artifacts: Array<{ path: string; sha256: string; bytes: Uint8Array }> } | undefined> {
  const config = input.definition.gate?.validation;
  if (!config) return undefined;
  const reportPath = renderArtifactPath(config.reportPath, input.variables);
  let content: string;
  try { content = await readFile(await resolveContainedPath(input.workspaceRoot, reportPath), 'utf8'); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new PlaySpecError(`Validation report is required at ${reportPath}.`, 'Write a current evidence-bound report using docs/validation-reports.md before completing this phase.');
    }
    throw error;
  }
  const report = ValidationReportSchema.parse(parse(content));
  if (report.taskId !== input.task.id || report.phaseId !== input.phaseId || report.result !== input.result) {
    throw new Error('Validation report task, phase or result does not match this completion.');
  }
  const maxima = report.dimensions.reduce((sum, dimension) => sum + dimension.max, 0);
  const earned = report.dimensions.reduce((sum, dimension) => sum + dimension.earned, 0);
  if (Math.abs(maxima - 100) > 1e-6 || Math.abs(earned - report.score) > 1e-6 ||
      new Set(report.dimensions.map(d => d.name)).size !== report.dimensions.length ||
      report.dimensions.some(d => d.earned > d.max || (d.earned < d.max && !d.deductions.trim()))) {
    throw new Error('Validation rubric must total 100, match the score, and explain deductions.');
  }
  if (config.rubric && (report.dimensions.length !== Object.keys(config.rubric).length ||
      report.dimensions.some(d => config.rubric?.[d.name] !== d.max))) {
    throw new Error('Validation dimensions must match the configured rubric names and maxima.');
  }
  const expectedPaths = config.artifactPaths.map(pattern => renderArtifactPath(pattern, input.variables));
  if (report.artifacts.length !== expectedPaths.length || new Set(report.artifacts.map(a => a.path)).size !== expectedPaths.length) {
    throw new Error('Validation report must identify exactly the configured evaluated artifacts.');
  }
  const artifacts: Array<{ path: string; sha256: string; bytes: Uint8Array }> = [];
  for (const artifactPath of expectedPaths) {
    const artifact = report.artifacts.find(candidate => candidate.path === artifactPath);
    const bytes = await readFile(await resolveContainedPath(input.workspaceRoot, artifactPath));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (!artifact || artifact.sha256 !== hash) throw new Error(`Validation report is stale or mismatched for ${artifactPath}.`);
    artifacts.push({ path: artifactPath, sha256: hash, bytes });
  }
  if (input.result === (config.approvalResult ?? 'approved') && (report.score < config.threshold || report.blockers.length > 0)) {
    throw new Error(`Approval requires score >= ${config.threshold} and no blockers.`);
  }
  return { report, path: reportPath, content, artifacts };
}

export async function assertArtifactHashes(workspaceRoot: string, artifacts: Array<{ path: string; sha256: string }>): Promise<void> {
  for (const artifact of artifacts) {
    const bytes = await readFile(await resolveContainedPath(workspaceRoot, artifact.path));
    if (createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) {
      throw new Error(`Approved artifact changed: ${artifact.path}. Revalidate before proceeding.`);
    }
  }
}

/** Only the latest decision for a gate can authorize consumption of its artifacts. */
export async function assertApprovalFreshness(workspaceRoot: string, task: TaskRecord, workflow: WorkflowDefinition,
  phaseId: string, events: CompletionEvent[], requireApproval = false): Promise<void> {
  const targetIndex = workflow.phaseOrder.indexOf(phaseId);
  for (const gateId of workflow.phaseOrder.slice(0, targetIndex)) {
    const gate = workflow.phases[gateId].gate;
    if (!gate?.validation) continue;
    const approval = gate.validation.approvalResult ?? 'approved';
    if (Object.entries(gate.nextByResult ?? {}).some(([result, target]) => result !== approval && target === phaseId)) continue;
    const latest = events.filter(event => event.phase === gateId).at(-1);
    if (!latest || latest.result !== approval) {
      if (requireApproval) throw new Error(`Validation prerequisite ${gateId} requires its latest approved decision before ${phaseId}.`);
      continue;
    }
    if (requireApproval && !latest.evaluatedArtifacts?.length && !latest.validationReportFile) {
      throw new Error(`Validation prerequisite ${gateId} has no retained evidence. Revalidate before proceeding.`);
    }
    let artifacts = latest.evaluatedArtifacts;
    if (!artifacts && latest.validationReportFile) {
      const report = ValidationReportSchema.parse(parse(await readFile(await resolveContainedPath(getActiveTaskRoot(workspaceRoot, task.id), latest.validationReportFile), 'utf8')));
      await assertArtifactHashes(workspaceRoot, report.artifacts);
    } else if (artifacts) {
      await assertArtifactHashes(workspaceRoot, artifacts);
      await assertArtifactHashes(getActiveTaskRoot(workspaceRoot, task.id), artifacts.map(a => ({ path: a.snapshotFile, sha256: a.sha256 })));
    }
  }
}
