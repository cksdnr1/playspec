import { describe, expect, it } from 'vitest';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import { WorkflowUpdater } from '#workflow/workflow-updater.js';
import { workflowFiles, writeWorkflowBaseline } from '#workflow/workflow-manifest.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const builtin = path.join(repo, 'src/preset/assets/workflows');
const loader = new WorkflowLoader(repo); const renderer = new TemplateRenderer(repo);
const reviews = new Set(['tech_spec_validate', 'implementation_plan_validate', 'total_spec_validate', 'phase_plan_validate', 'final_review', 'issue_validate']);

async function render(id: string, phaseId: string) {
  const workflow = await loader.resolveFromDirectory(path.join(builtin, id));
  const phase = workflow.definition.phases[phaseId];
  const vars = Object.fromEntries((await renderer.discoverPlaceholderNames(phase.template, workflow.templateDir)).map(n => [n, n.endsWith('_FILE') ? 'docs/fixture.md' : 'fixture']));
  return renderer.render(phase.template, vars, workflow.templateDir);
}

describe('bundled workflow prompt roles and contracts', () => {
  it('renders every bundled phase, keeps evaluation scoped and never leaks includes', async () => {
    let count = 0;
    for (const id of await readdir(builtin)) {
      const workflow = await loader.resolveFromDirectory(path.join(builtin, id));
      for (const [phaseId, phase] of Object.entries(workflow.definition.phases)) {
        const prompt = await render(id, phaseId); count++;
        expect(prompt).not.toMatch(/\{\{[^}]+\}\}/);
        const isReview = reviews.has(phaseId) || ['verification.md', 'review.md'].includes(phase.template);
        expect((prompt.match(/## Evidence-based evaluation/g) ?? []).length, `${id}/${phaseId}`).toBe(isReview ? 1 : 0);
        expect(prompt).toContain('execution.completion');
        expect(prompt).not.toContain('Start with a readiness score');
        expect(prompt).not.toContain('This step does not edit files directly.');
        if (isReview) expect(prompt).toContain('do not claim independent evaluation');
      }
    }
    expect(count).toBe(33);
  });

  it('preserves existing gate IDs, results, thresholds and rubric sums', async () => {
    const expected: Record<string, Record<string, { threshold: number; results: string[] }>> = {
      'mono-spec': { tech_spec_validate: { threshold: 95, results: ['approved', 'needs_revision'] }, implementation_plan_validate: { threshold: 95, results: ['approved', 'needs_revision'] } },
      'total-plan': { total_spec_validate: { threshold: 95, results: ['approved', 'needs_revision'] }, phase_plan_validate: { threshold: 95, results: ['approved', 'needs_revision'] } },
      'issue-validate': { issue_validate: { threshold: 90, results: ['approved', 'rejected'] } },
    };
    for (const [id, gates] of Object.entries(expected)) {
      const workflow = await loader.resolveFromDirectory(path.join(builtin, id));
      expect(Object.entries(workflow.definition.phases).filter(([, p]) => p.gate?.validation).map(([name]) => name).sort()).toEqual(Object.keys(gates).sort());
      for (const [phase, contract] of Object.entries(gates)) {
        const gate = workflow.definition.phases[phase].gate!;
        expect(gate.results).toEqual(contract.results); expect(gate.validation!.threshold).toBe(contract.threshold);
        expect(Object.values(gate.validation!.rubric).reduce((a, b) => a + b, 0)).toBe(100);
        const prompt = await render(id, phase);
        expect(prompt).toContain('blockers must be empty'); expect(prompt).toContain('sha256');
        expect(prompt.indexOf('findings and evidence before scoring')).toBeLessThan(prompt.indexOf('## Required engine validation report'));
      }
    }
  });

  it('separates allowed report writing from prohibited artifact changes and stops ungated final review on blockers', async () => {
    for (const phase of ['tech_spec_validate', 'implementation_plan_validate']) {
      const prompt = await render('mono-spec', phase);
      expect(prompt).toContain('You may write the required structured validation report');
      expect(prompt).toContain('reviewed artifact stays read-only');
      expect(prompt).toContain('Proposed fixes do not resolve a blocker');
      expect(prompt.indexOf('1. Findings')).toBeLessThan(prompt.indexOf('3. Rubric dimensions'));
      expect(prompt.indexOf('3. Rubric dimensions')).toBeLessThan(prompt.indexOf('4. Verdict'));
    }
    const final = await render('total-plan', 'final_review');
    expect(final).toContain('report the required correction and do not complete');
    expect(final).toContain('do not invent an approval result');
    const issue = await render('issue-validate', 'issue_validate');
    expect(issue).toContain('Score `0-89` or any unresolved blocker');
    expect(issue.indexOf('## Findings and Blocking Problems')).toBeLessThan(issue.indexOf('## Score Breakdown'));
  });

  it('gives each legacy phase its declared role without implementing during review', async () => {
    const expected = { 'multi-spec': ['spec_plan.md', 'implementation_spec.md', 'implementation.md', 'verification.md', 'review.md'], 'phase-execution': ['analysis.md', 'implementation.md', 'verification.md', 'review.md', 'handoff.md'], 'simple-bug': ['investigation_fix.md', 'verification.md'] };
    for (const [id, files] of Object.entries(expected)) {
      const workflow = await loader.resolveFromDirectory(path.join(builtin, id));
      expect(workflow.definition.phaseOrder).toEqual(files.map((_, n) => String(n + 1)));
      expect(workflow.definition.phaseOrder.map(p => workflow.definition.phases[p].template)).toEqual(files);
      for (const [phase, definition] of Object.entries(workflow.definition.phases)) {
        const prompt = await render(id, phase);
        expect(prompt).toContain('this legacy phase is ungated');
        if (definition.template === 'verification.md' || definition.template === 'review.md') {
          expect(prompt).toMatch(/(?:Do not modify|Do not patch|Keep) product code/);
          expect(prompt).not.toContain('Implement phase'); expect(prompt).not.toContain('Execute Phase');
        }
      }
    }
  });

  it('updates an older installed definition and its new templates together while preserving active phase IDs', async () => {
    const workspace = await createTempWorkspace();
    try {
      const workflow = await loader.resolveFromDirectory(path.join(builtin, 'phase-execution'));
      const root = path.join(workspace.dir, '.playspec/workflows/phase-execution');
      await mkdir(path.join(root, 'templates/rules'), { recursive: true });
      const old = structuredClone(workflow.definition);
      for (const phase of Object.values(old.phases)) phase.template = 'phase_template.md';
      await writeFile(path.join(root, 'workflow.yaml'), stringify(old));
      await writeFile(path.join(root, 'templates/phase_template.md'), '# Legacy phase {{PHASE_NUMBER}}\n');
      await writeFile(path.join(root, 'templates/rules/global_rules.md'), '# Old rules\n');
      await writeWorkflowBaseline(root, await workflowFiles(root));
      const store = new YamlTaskStore(workspace.dir);
      await store.createTask({ id: 'existing', title: 'Existing', workflow: 'phase-execution', variables: { FEATURE_SLUG: 'existing' } });
      await store.updateTask('existing', { currentPhase: '3' });
      const updater = new WorkflowUpdater(workspace.dir);
      expect((await updater.update('phase-execution', { source: 'project' })).conflicts).toEqual([]);
      const result = await updater.update('phase-execution', { source: 'project', apply: true });
      expect(result.applied).toBe(true); expect(result.backupPath).toBeTruthy();
      expect((await store.getTask('existing')).currentPhase).toBe('3');
      const installed = await new WorkflowLoader(workspace.dir).resolve('phase-execution');
      expect(installed.definition.phases['3'].template).toBe('verification.md');
      expect(await readFile(path.join(installed.templateDir, 'verification.md'), 'utf8')).toContain('Keep product code');
    } finally { await workspace.cleanup(); }
  });
});
