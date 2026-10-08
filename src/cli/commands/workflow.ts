import path from 'node:path';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowInstaller } from '#workflow/workflow-installer.js';
import { WorkflowEditor } from '#workflow/workflow-editor.js';
import type { WorkflowEditResult } from '#workflow/workflow-editor.js';
import type { ResolvedWorkflow } from '#core/types.js';

export async function runWorkflowList(workspaceRoot: string): Promise<void> {
  const loader = new WorkflowLoader(workspaceRoot);
  const workflows = await loader.listWithDiagnostics();
  for (const workflow of workflows) {
    const description = workflow.definition.description ? ` - ${workflow.definition.description}` : '';
    console.log(`${workflow.id}\t${workflow.source}${description}`);
    printWorkflowDiagnostics(workflow);
  }
}

export async function runWorkflowShow(workspaceRoot: string, workflowId: string): Promise<void> {
  const workflow = await new WorkflowLoader(workspaceRoot).resolve(workflowId);
  console.log(`Workflow: ${workflow.id}`);
  console.log(`Source: ${workflow.source}`);
  if (workflow.shadow) {
    console.log(`Shadow source: ${workflow.shadow.shadowSource}`);
    console.log(`Shadow differs from builtin: ${workflow.shadow.differsFromBuiltin ? 'yes' : 'no'}`);
    console.log(`Shadow accepted: ${workflow.shadow.accepted ? 'yes' : 'no'}`);
    console.log(`Selected source: ${workflow.shadow.effectiveSource}`);
  }
  printWorkflowDiagnostics(workflow);
  if (workflow.definition.name) console.log(`Name: ${workflow.definition.name}`);
  if (workflow.definition.description) console.log(`Description: ${workflow.definition.description}`);
  console.log('Phases:');
  for (const phaseId of workflow.definition.phaseOrder) {
    const phase = workflow.definition.phases[phaseId];
    console.log(`  - ${phaseId}${phase?.title ? `: ${phase.title}` : ''}`);
  }
  console.log('Variables:');
  for (const [name, declaration] of Object.entries(workflow.definition.variables ?? {})) {
    const flags = [
      declaration.required ? 'required' : undefined,
      declaration.default ? `default: ${declaration.default}` : undefined,
    ].filter(Boolean).join(', ');
    console.log(`  - ${name}${flags ? ` (${flags})` : ''}`);
  }
  console.log('Artifacts:');
  for (const [name, artifact] of Object.entries(workflow.definition.artifacts ?? {})) {
    console.log(`  - ${name}: ${artifact.path}${artifact.kind ? ` (${artifact.kind})` : ''}`);
  }
}

function printWorkflowDiagnostics(workflow: ResolvedWorkflow): void {
  for (const diagnostic of workflow.diagnostics ?? []) {
    console.log(`Warning [${diagnostic.code}]: ${diagnostic.message}`);
    console.log(`  Active: ${diagnostic.activeSource} (${diagnostic.activeRootDir})`);
    console.log(`  Shadowed: ${diagnostic.builtinSource} (${diagnostic.builtinRootDir})`);
    console.log(`  Drift: ${diagnostic.details.map((detail) => detail.field).join(', ')}`);
  }
}

export async function runWorkflowValidate(workspaceRoot: string, workflowPath: string): Promise<void> {
  const workflow = await new WorkflowLoader(workspaceRoot).resolveFromDirectory(path.resolve(workspaceRoot, workflowPath));
  console.log(`Valid workflow: ${workflow.id}`);
}

export async function runWorkflowInstall(workspaceRoot: string, workflowPath: string): Promise<void> {
  const id = await new WorkflowInstaller(workspaceRoot).install(path.resolve(workspaceRoot, workflowPath));
  console.log(`Installed workflow: ${id}`);
}

export async function runWorkflowRemove(workspaceRoot: string, workflowId: string): Promise<void> {
  await new WorkflowInstaller(workspaceRoot).remove(workflowId);
  console.log(`Removed workflow: ${workflowId}`);
}

export async function runWorkflowExport(workspaceRoot: string, workflowId: string, outDir?: string): Promise<void> {
  const target = path.resolve(workspaceRoot, outDir ?? workflowId);
  await new WorkflowInstaller(workspaceRoot).export(workflowId, target);
  console.log(`Exported workflow ${workflowId} to ${target}`);
}

export async function runWorkflowAddPhase(
  workspaceRoot: string,
  opts: { workflow: string; after: string; id: string; title: string; template: string }
): Promise<void> {
  const result = await new WorkflowEditor(workspaceRoot).addPhase({
    workflowId: opts.workflow,
    afterPhaseId: opts.after,
    newPhaseId: opts.id,
    title: opts.title,
    templatePath: opts.template,
  });
  printWorkflowEditResult('Added phase', result);
}

export async function runWorkflowRemovePhase(
  workspaceRoot: string,
  opts: { workflow: string; id: string; replacement?: string }
): Promise<void> {
  const result = await new WorkflowEditor(workspaceRoot).removePhase({
    workflowId: opts.workflow,
    phaseId: opts.id,
    replacement: opts.replacement,
  });
  printWorkflowEditResult('Removed phase', result);
}

export async function runWorkflowReorderPhase(
  workspaceRoot: string,
  opts: { workflow: string; id: string; after: string }
): Promise<void> {
  const result = await new WorkflowEditor(workspaceRoot).reorderPhase({
    workflowId: opts.workflow,
    phaseId: opts.id,
    afterPhaseId: opts.after,
  });
  printWorkflowEditResult('Reordered phase', result);
}

export async function runWorkflowSetTemplate(
  workspaceRoot: string,
  opts: { workflow: string; phase: string; template: string }
): Promise<void> {
  const result = await new WorkflowEditor(workspaceRoot).setTemplate({
    workflowId: opts.workflow,
    phaseId: opts.phase,
    templatePath: opts.template,
  });
  printWorkflowEditResult('Updated phase template', result);
}

function printWorkflowEditResult(prefix: string, result: WorkflowEditResult): void {
  console.log(`${prefix} in workflow: ${result.workflowId}`);
  console.log(`Target: ${result.targetPath}`);
  console.log(`Backup: ${result.backupPath}`);
  console.log(`Report: ${result.reportPath}`);
}

export async function runWorkflowUpdate(workspaceRoot: string, id: string, opts: { apply?: boolean; acceptCustomized?: string[]; source?: 'project' | 'user'; files?: string[] }): Promise<void> {
  const { WorkflowUpdater } = await import('#workflow/workflow-updater.js');
  console.log(JSON.stringify(await new WorkflowUpdater(workspaceRoot).update(id, opts), null, 2));
}
