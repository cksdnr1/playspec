import path from 'node:path';
import { parse } from 'yaml';
import { WorkflowDefinitionSchema } from '#core/schemas.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { WorkflowRegistry, assertSafeWorkflowId } from './workflow-registry.js';
import { WorkflowLoader } from './workflow-loader.js';
import { BASELINE_FILE, WorkflowBaselineSchema, workflowFiles, writeWorkflowBaseline } from './workflow-manifest.js';
import { resolveContainedPath } from '#utils/contained-path.js';
import { withWriteLock, writeTextFileAtomic } from '#utils/fs.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';

export class WorkflowUpdater {
  constructor(private readonly workspaceRoot: string) {}
  async update(id: string, options: { apply?: boolean; acceptCustomized?: string[]; source?: 'project' | 'user'; files?: string[] } = {}) {
    assertSafeWorkflowId(id);
    const registry = new WorkflowRegistry(this.workspaceRoot);
    const selected = await registry.resolve(id);
    const root = options.source === 'project' ? path.join(registry.getProjectRoot(), id)
      : options.source === 'user' ? path.join(registry.getUserRoot(), id) : selected.rootDir;
    if (!options.source && selected.source === 'builtin') throw new Error('No installed workflow to update.');
    // Resolve the installed root before locking; missing installations must not be created by update.
    await readFile(path.join(root, 'workflow.yaml'));
    return withWriteLock(root, async () => {
      const builtinRoot = path.join(registry.getBuiltinRoot(), id);
      await new WorkflowLoader(this.workspaceRoot).resolveFromDirectory(builtinRoot);
      const desired = await workflowFiles(builtinRoot);
      const installed = await workflowFiles(root);
      let baseline: Record<string, string> = {};
      try { baseline = WorkflowBaselineSchema.parse(JSON.parse(await readFile(await resolveContainedPath(root, BASELINE_FILE), 'utf8'))).files; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const files = Object.entries(desired).map(([file, hash]) => ({ path: file,
        status: installed[file] === hash ? 'unchanged' : installed[file] === undefined || installed[file] === baseline[file] ? 'update' : 'conflict',
      }));
      const selection = new Set(options.files ?? Object.keys(desired));
      for (const file of selection) if (!Object.hasOwn(desired, file)) throw new Error(`Unknown built-in asset: ${file}`);
      const selectedFiles = files.filter(file => selection.has(file.path));
      const nextBaseline = { ...baseline, ...Object.fromEntries(selectedFiles.map(file => [file.path, desired[file.path]])) };
      const accept = new Set(options.acceptCustomized ?? []);
      for (const file of accept) if (!selectedFiles.some(item => item.path === file && item.status === 'conflict')) throw new Error(`Not a conflicting built-in asset: ${file}`);
      const conflicts = selectedFiles.filter(file => file.status === 'conflict' && !accept.has(file.path)).map(file => file.path);
      const report = { workflowId: id, root, files, conflicts, applied: false, backupPath: undefined as string | undefined };
      if (!options.apply) return report;
      if (conflicts.length) throw new Error(`Customized workflow files require explicit --accept-customized paths: ${conflicts.join(', ')}`);
      const changes = selectedFiles.filter(file => file.status !== 'unchanged');
      const backupRoot = await resolveContainedPath(root, `.playspec-updates/${Date.now()}-${randomUUID()}`);
      await mkdir(backupRoot, { recursive: true });
      const candidateRoot = path.join(backupRoot, 'candidate');
      for (const file of new Set([...Object.keys(installed), ...selectedFiles.map(item => item.path)])) {
        const sourceRoot = selection.has(file) && Object.hasOwn(desired, file) ? builtinRoot : root;
        await writeTextFileAtomic(path.join(candidateRoot, file), await readFile(await resolveContainedPath(sourceRoot, file)));
      }
      const candidate = WorkflowDefinitionSchema.parse(parse(await readFile(path.join(candidateRoot, 'workflow.yaml'), 'utf8')));
      if (candidate.id !== id) throw new Error('Candidate workflow ID mismatch.');
      const candidateTemplates = path.join(candidateRoot, 'templates');
      await new WorkflowLoader(this.workspaceRoot).validateWorkflowDefinition(candidate, candidateTemplates);
      const renderer = new TemplateRenderer(this.workspaceRoot);
      for (const phase of Object.values(candidate.phases)) await renderer.discoverPlaceholderNames(phase.template, candidateTemplates);
      for (const task of await new YamlTaskStore(this.workspaceRoot).listActiveTasks()) {
        if (task.workflow === id && task.currentPhase && !candidate.phaseOrder.includes(task.currentPhase)) {
          throw new Error(`Update removes active phase ${task.currentPhase} of task ${task.id}`);
        }
      }
      if (!changes.length) { await writeWorkflowBaseline(root, nextBaseline); return { ...report, applied: true }; }
      report.backupPath = backupRoot;
      await writeTextFileAtomic(path.join(backupRoot, 'report.json'), JSON.stringify(report, null, 2));
      // Prepare every backup and read all replacement bytes before mutating runtime assets.
      const replacements: { target: string; content: Uint8Array }[] = [];
      for (const file of changes) {
        const target = await resolveContainedPath(root, file.path);
        if (installed[file.path] !== undefined) {
          const backup = path.join(backupRoot, 'before', file.path);
          await mkdir(path.dirname(backup), { recursive: true }); await copyFile(target, backup);
        }
        replacements.push({ target, content: await readFile(await resolveContainedPath(builtinRoot, file.path)) });
      }
      if (JSON.stringify(await workflowFiles(root)) !== JSON.stringify(installed) || JSON.stringify(await workflowFiles(builtinRoot)) !== JSON.stringify(desired)) throw new Error('Workflow changed while preparing update; retry preview.');
      try {
        for (const replacement of replacements) await writeTextFileAtomic(replacement.target, replacement.content);
        await writeWorkflowBaseline(root, nextBaseline);
        report.applied = true;
        await writeTextFileAtomic(path.join(backupRoot, 'report.json'), JSON.stringify(report, null, 2));
      } catch (error) {
        await writeTextFileAtomic(path.join(backupRoot, 'failure.json'), JSON.stringify({ error: String(error), recovery: 'Restore before/ assets or rerun explicit update after inspecting report.json.' }));
        throw error;
      }
      return report;
    });
  }
}
