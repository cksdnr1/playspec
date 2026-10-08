import { expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCase, gradeResponses, loadCases } from '#eval/harness.js';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Synthetic responses test only the grader, never model quality.
async function synthetic() {
  const cases = await loadCases(repo);
  return { model: 'synthetic-grader-fixture', runId: 'unit-1', provenance: 'synthetic' as const, results: cases.map(item => {
    const score = item.expected.result === 'approved' ? 100 : 80;
    return { caseId: item.id, result: item.expected.result, score, artifactEdits: false,
      blockers: item.expected.requiredDefects.map(d => `Unresolved ${d.category}`),
      dimensions: [['correctness', 30], ['contracts', 25], ['failure_handling', 20], ['testability', 15], ['scope', 10]].map(([name, max]) => ({ name: String(name), max: Number(max), earned: Number(max) * score / 100, evidence: ['artifact.md'], deductions: score === 100 ? 'All specified contracts supported.' : 'Known fixture defect.' })),
      findings: item.expected.requiredDefects.map(d => ({ category: d.category, summary: `Concrete ${d.category} fixture defect`, evidence: [{ path: d.evidencePath, quote: [item.artifact, ...item.evidence].find(e => e.path === d.evidencePath)!.content.split('\n')[0] }] })) };
  }) };
}
it('exports actual rendered validation prompts without expected verdicts or required defect annotations', async () => {
  for (const item of await loadCases(repo)) {
    const exported = await exportCase(repo, item);
    expect(exported).not.toHaveProperty('expected');
    expect(exported).not.toHaveProperty('requiredDefects');
    expect(exported.prompt).toContain('Evidence-based evaluation');
    expect(exported.prompt).toContain('Write boundary:');
    expect(exported.prompt).not.toMatch(/\{\{[^}]+\}\}/);
    expect(exported.reviewInput.artifact).toEqual(item.artifact);
    expect(exported.responseContract.dimensions.rubric).toEqual({ correctness: 30, contracts: 25, failure_handling: 20, testability: 15, scope: 10 });
  }
});
it('accepts a complete synthetic control while explicitly labeling it as grader-only', async () => {
  const result = await gradeResponses(repo, await synthetic());
  expect(result.passed).toBe(true); expect(result.provenance).toBe('synthetic');
  expect(result.limitations).toContain('Synthetic results test the grader only');
});
it.each(['false_approval', 'false_rejection', 'missing', 'duplicate', 'unknown', 'ungrounded', 'bad_sum', 'blocker_approval', 'artifact_edit', 'missing_finding', 'invented_rubric_evidence'])('rejects %s without silently counting the run as successful', async kind => {
  const input = await synthetic(); const first = input.results[0];
  if (kind === 'false_approval') { first.result = 'approved'; first.score = 100; first.blockers = []; }
  if (kind === 'false_rejection') input.results[5].result = 'needs_revision';
  if (kind === 'missing') input.results.pop();
  if (kind === 'duplicate') input.results.push(structuredClone(first));
  if (kind === 'unknown') first.caseId = 'not-in-corpus';
  if (kind === 'ungrounded') first.findings[0].evidence[0].quote = 'Invented repository evidence';
  if (kind === 'bad_sum') first.score = 81;
  if (kind === 'blocker_approval') input.results[5].blockers.push('Unresolved safety issue');
  if (kind === 'artifact_edit') first.artifactEdits = true;
  if (kind === 'missing_finding') first.findings = [];
  if (kind === 'invented_rubric_evidence') first.dimensions[0].evidence = ['imaginary.ts'];
  const result = await gradeResponses(repo, input);
  expect(result.passed).toBe(false); expect(result.results.some(r => r.errors.length > 0)).toBe(true);
});
it('rejects malformed/unidentified model responses rather than inventing scores', async () => {
  await expect(gradeResponses(repo, { model: '', results: [] })).rejects.toThrow();
});
