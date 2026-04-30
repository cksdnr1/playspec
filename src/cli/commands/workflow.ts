import path from 'node:path';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowInstaller } from '#workflow/workflow-installer.js';

export async function runWorkflowList(workspaceRoot: string): Promise<void> {
  const registry = new WorkflowRegistry(workspaceRoot);
  const loader = new WorkflowLoader(workspaceRoot);
  const locations = await registry.list();
  for (const location of locations) {
    const workflow = await loader.resolve(location.id);
    const description = workflow.definition.description ? ` - ${workflow.definition.description}` : '';
    console.log(`${workflow.id}\t${workflow.source}${description}`);
  }
}

export async function runWorkflowShow(workspaceRoot: string, workflowId: string): Promise<void> {
  const workflow = await new WorkflowLoader(workspaceRoot).resolve(workflowId);
  console.log(`Workflow: ${workflow.id}`);
  console.log(`Source: ${workflow.source}`);
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
