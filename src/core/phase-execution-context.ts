import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolveContainedPath } from '#utils/contained-path.js';
import { FeedbackCauseCategorySchema, FeedbackConfidenceSchema } from '#evolution/schemas.js';
import { renderArtifactPath } from './validation-gate.js';
import type { CompletionEvent, HarnessRecord, PhaseDefinition, TaskRecord, WorkflowDefinition } from './types.js';

export interface PhaseExecutionContext {
  taskId: string;
  workflow: string;
  phaseId: string;
  phaseTitle: string;
  revision: string;
  isCurrentPhase: boolean;
  allowedResults: string[];
  resultRequired: boolean;
  nextByResult: Record<string, string>;
  requiredOutputs: string[];
  harness: { blocked: boolean; circuitBreaker: boolean };
  completion: null | {
    tool: 'playspec_complete_phase';
    arguments: { taskId: string; expectedPhaseId: string; requestId: string; expectedRevision: string };
    instructions: string;
  };
  validation: null | {
    reportPath: string;
    taskId: string;
    phaseId: string;
    threshold: number;
    approvalResult: string;
    rubric: Record<string, number> | null;
    artifacts: Array<{ path: string; sha256: string | null; status: 'present' | 'missing' | 'unreadable' }>;
    reportSchema: Record<string, unknown>;
    rules: string[];
  };
}

/** State revision, not a credential. Ledger identity protects revisits after completion/rollback. */
export function phaseExecutionRevision(task: TaskRecord, workflow: WorkflowDefinition, events: CompletionEvent[]): string {
  return createHash('sha256').update(JSON.stringify({ task, workflow, events: events.map(e => [e.id, e.completedAt, e.phase, e.result]) })).digest('hex');
}

export async function buildPhaseExecutionContext(input: {
  workspaceRoot: string; task: TaskRecord; workflow: WorkflowDefinition; phaseId: string;
  definition: PhaseDefinition; variables: Record<string, string>; events: CompletionEvent[];
  harness: HarnessRecord; isCurrentPhase: boolean; finalPhase: boolean;
}): Promise<PhaseExecutionContext> {
  const { task, workflow, definition, phaseId, variables } = input;
  const revision = phaseExecutionRevision(task, workflow, input.events);
  const allowedResults = definition.gate?.results ?? definition.results ?? [];
  const gate = definition.gate?.validation;
  const context: PhaseExecutionContext = {
    taskId: task.id, workflow: workflow.id, phaseId, phaseTitle: definition.title, revision,
    isCurrentPhase: input.isCurrentPhase, allowedResults, resultRequired: allowedResults.length > 0,
    nextByResult: definition.gate?.nextByResult ?? definition.nextByResult ?? {},
    requiredOutputs: [...new Set([...(definition.requiredOutputs ?? []), ...(input.finalPhase ? Object.values(workflow.artifacts ?? {}).filter(a => a.required).map(a => a.path) : [])].map(p => renderArtifactPath(p, variables)))],
    harness: { blocked: input.harness.blocked, circuitBreaker: input.harness.circuitBreaker },
    completion: input.isCurrentPhase && !input.harness.blocked && !input.harness.circuitBreaker ? {
      tool: 'playspec_complete_phase',
      arguments: { taskId: task.id, expectedPhaseId: phaseId, requestId: `phase-${revision}`, expectedRevision: revision },
      instructions: allowedResults.length ? 'Perform this phase, then add result chosen from allowedResults. Reuse these exact arguments and chosen result on retries. Never automatically complete a newly advanced phase.' : 'Perform this phase, then submit these arguments without result. Reuse them unchanged on retries.',
    } : null,
    validation: null,
  };
  if (gate) {
    const artifacts: NonNullable<PhaseExecutionContext['validation']>['artifacts'] = [];
    for (const pattern of gate.artifactPaths) {
      const artifactPath = renderArtifactPath(pattern, variables);
      try {
        const bytes = await readFile(await resolveContainedPath(input.workspaceRoot, artifactPath));
        artifacts.push({ path: artifactPath, sha256: createHash('sha256').update(bytes).digest('hex'), status: 'present' });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') artifacts.push({ path: artifactPath, sha256: null, status: 'missing' });
        else artifacts.push({ path: artifactPath, sha256: null, status: 'unreadable' });
      }
    }
    const causeRequired = definition.feedback?.enabled === true && definition.feedback.causeClassification.required;
    context.validation = {
      reportPath: renderArtifactPath(gate.reportPath, variables), taskId: task.id, phaseId,
      threshold: gate.threshold, approvalResult: gate.approvalResult ?? 'approved', rubric: gate.rubric ?? null,
      artifacts, reportSchema: reportSchema(task.id, phaseId, allowedResults, gate.rubric, artifacts.map(a => a.path), causeRequired, definition.feedback?.causeClassification.allowed),
      rules: [
        'Write YAML or JSON at reportPath relative to workspaceRoot using your file-editing tools.',
        'Author the report after reviewing current artifact bytes. Never copy example scores or invent evidence.',
        'Dimensions must total 100 maximum points, earned points must sum to score, and every deduction must be explained.',
        'Identify exactly the configured artifact paths with SHA-256 hashes of the current raw bytes. Rehash after edits.',
        `Approval requires score >= ${gate.threshold} and no blockers. Revision results also require a report.`,
        'Paths and hashes are guidance at read time; completion independently validates all gates and current bytes.',
      ],
    };
  }
  return context;
}

function reportSchema(taskId: string, phaseId: string, results: string[], rubric: Record<string, number> | undefined,
  paths: string[], causeRequired: boolean, allowedCauses?: string[]): Record<string, unknown> {
  const text = { type: 'string', minLength: 1 };
  return {
    $schema: 'http://json-schema.org/draft-07/schema#', type: 'object',
    required: ['version', 'taskId', 'phaseId', 'result', 'score', 'blockers', 'summary', 'dimensions', 'artifacts', ...(causeRequired ? ['cause'] : [])],
    properties: {
      version: { const: 1 }, taskId: { const: taskId }, phaseId: { const: phaseId },
      result: results.length ? { type: 'string', enum: results } : text,
      score: { type: 'number', minimum: 0, maximum: 100 }, blockers: { type: 'array', items: text }, summary: text,
      dimensions: { type: 'array', minItems: 1, ...(rubric ? { minItems: Object.keys(rubric).length, maxItems: Object.keys(rubric).length } : {}),
        items: { type: 'object', required: ['name', 'earned', 'max', 'evidence', 'deductions'], properties: {
          name: rubric ? { type: 'string', enum: Object.keys(rubric) } : text,
          earned: { type: 'number', minimum: 0 }, max: { type: 'number', exclusiveMinimum: 0 },
          evidence: { type: 'array', minItems: 1, items: text }, deductions: { type: 'string' },
        }, ...(rubric ? { oneOf: Object.entries(rubric).map(([name, max]) => ({ properties: { name: { const: name }, max: { const: max } } })) } : {}) } },
      artifacts: { type: 'array', minItems: paths.length, maxItems: paths.length, items: {
        type: 'object', required: ['path', 'sha256'], properties: { path: { type: 'string', enum: paths }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } },
      } },
      cause: { type: 'object', required: ['category', 'confidence', 'summary'], properties: {
        category: { type: 'string', enum: allowedCauses ?? FeedbackCauseCategorySchema.options },
        confidence: { type: 'string', enum: FeedbackConfidenceSchema.options }, summary: text,
      } },
      evolutionTargetPhaseId: text, dedupeFieldValues: { type: 'object', additionalProperties: { type: 'string' } },
    },
  };
}
