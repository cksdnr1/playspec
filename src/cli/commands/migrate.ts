import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import chalk from 'chalk';
import { TaskNotActiveError, WorkspaceNotInitializedError } from '#core/errors.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { readTextFile } from '#utils/fs.js';
import { getPlayspecRoot } from '#utils/paths.js';
import { MigrationPlanSchema } from '#migration/schemas.js';
import { MigrationRunner } from '#migration/migration-runner.js';
import { generateMigrationId } from '#migration/migration-store.js';
import type { MigrationPlan, MigrationAction, MigrationMode } from '#migration/types.js';

export interface MigrateOptions {
  mode?: MigrationMode;
  source?: string;
  task?: string;
  plan?: string;
  targetTotalSpec?: string;
  targetPhasePlan?: string;
  withArchive?: boolean;
}

export async function runMigrate(
  workspaceRoot: string,
  options: MigrateOptions = {}
): Promise<void> {
  process.stderr.write('Warning: `playspec migrate` is deprecated. Migration is hidden from the primary CLI workflow.\n');

  const playspecRoot = getPlayspecRoot(workspaceRoot);
  try {
    await access(playspecRoot);
  } catch {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  const mode: MigrationMode = options.mode ?? 'review';

  if (mode === 'dry-run') {
    console.log(chalk.yellow('[DRY RUN] No files will be mutated.\n'));
  } else if (mode === 'auto') {
    console.log(chalk.yellow('[AUTO] Applying low-risk validated (deterministic) actions only.\n'));
  }

  // Resolve target task
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(options.task);
  if (task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  // Load or generate migration plan
  let plan: MigrationPlan;

  if (options.plan) {
    // External plan file (e.g. from Claude)
    plan = await loadExternalPlan(options.plan, task.id, mode);
  } else {
    // Auto-generate plan from source docs
    const sourceFiles = await discoverSourceFiles(workspaceRoot, options);
    if (sourceFiles.length === 0) {
      console.log('No source documents found. Provide --source <dir> or --plan <file>.');
      return;
    }
    console.log(`Found ${sourceFiles.length} source document(s).\n`);
    plan = generatePlan(workspaceRoot, task, sourceFiles, mode, options);
  }

  console.log(`Migration Plan: ${plan.id}`);
  console.log(`Mode: ${plan.mode}`);
  console.log(`Risk: ${plan.riskLevel}`);
  console.log(`${plan.actions.length} action(s) proposed.`);

  if (plan.warnings.length > 0) {
    for (const warning of plan.warnings) {
      console.log(chalk.yellow(`Warning: ${warning}`));
    }
  }

  console.log('');

  const runner = new MigrationRunner(workspaceRoot, store);
  const { planPath, reportPath } = await runner.run(plan, { withArchive: options.withArchive });

  console.log('');
  console.log(`Plan saved:   ${path.relative(workspaceRoot, planPath)}`);
  console.log(`Report saved: ${path.relative(workspaceRoot, reportPath)}`);
}

async function loadExternalPlan(
  planFilePath: string,
  taskId: string,
  mode: MigrationMode
): Promise<MigrationPlan> {
  const content = await readTextFile(planFilePath);
  const raw = parseYaml(content) as unknown;
  const plan = MigrationPlanSchema.parse(raw);
  // Override mode and taskId from CLI flags if needed
  return { ...plan, mode, targetTaskId: plan.targetTaskId || taskId };
}

async function discoverSourceFiles(
  workspaceRoot: string,
  options: MigrateOptions
): Promise<string[]> {
  const files = new Set<string>();

  if (options.targetTotalSpec) {
    const abs = path.resolve(workspaceRoot, options.targetTotalSpec);
    try {
      await access(abs);
      files.add(abs);
    } catch { /* skip missing */ }
  }

  if (options.targetPhasePlan) {
    const abs = path.resolve(workspaceRoot, options.targetPhasePlan);
    try {
      await access(abs);
      files.add(abs);
    } catch { /* skip missing */ }
  }

  if (options.source) {
    const abs = path.resolve(workspaceRoot, options.source);
    try {
      const s = await stat(abs);
      if (s.isDirectory()) {
        const entries = await readdir(abs);
        for (const entry of entries) {
          if (entry.endsWith('.md')) {
            files.add(path.join(abs, entry));
          }
        }
      } else if (abs.endsWith('.md')) {
        files.add(abs);
      }
    } catch { /* skip inaccessible */ }
  }

  return [...files];
}

function generatePlan(
  workspaceRoot: string,
  task: import('#core/types.js').TaskRecord,
  absoluteSourceFiles: string[],
  mode: MigrationMode,
  options: MigrateOptions
): MigrationPlan {
  const planId = generateMigrationId();
  const now = new Date().toISOString();
  const taskYamlRelPath = path.join(
    '.playspec', 'tasks', 'active', task.id, 'task.yaml'
  );

  const existingRefPaths = new Set(
    (task.contextRefs ?? []).map((r) => path.normalize(r.path))
  );

  const actions: MigrationAction[] = [];
  const sourceFiles: string[] = [];
  const sourceRoot = options.source ?? path.dirname(absoluteSourceFiles[0] ?? workspaceRoot);

  for (const absFile of absoluteSourceFiles) {
    const relFile = path.relative(workspaceRoot, absFile);
    sourceFiles.push(relFile);

    if (existingRefPaths.has(path.normalize(relFile))) {
      continue; // Already linked — skip
    }

    const actionId = `action_${String(actions.length + 1).padStart(3, '0')}`;
    actions.push({
      actionId,
      type: 'add_context_ref',
      targetPath: taskYamlRelPath,
      sourcePaths: [relFile],
      reason: `Document "${relFile}" found in source directory and not yet linked as a context reference.`,
      evidence: `File exists at: ${relFile}`,
      riskLevel: 'medium',
      preview: `contextRefs:\n  + - path: ${relFile}\n  +   role: planning-context\n  +   source: ${planId}`,
      backupRequired: true,
      requiresReview: true,
      contextRef: {
        path: relFile,
        role: 'planning-context',
        source: planId,
      },
    });
  }

  const warnings: string[] = [];
  const skippedCount = absoluteSourceFiles.length - actions.length;
  if (skippedCount > 0) {
    warnings.push(`${skippedCount} file(s) already linked as context references — skipped.`);
  }

  const overallRisk: 'low' | 'medium' | 'high' = actions.length > 0 ? 'medium' : 'low';
  const summary =
    actions.length === 0
      ? 'No new context references to add.'
      : `${actions.length} add_context_ref action(s) proposed.`;

  return {
    id: planId,
    createdAt: now,
    mode,
    sourceRoot: path.relative(workspaceRoot, path.resolve(workspaceRoot, options.source ?? '')),
    targetTaskId: task.id,
    sourceFiles,
    targetFiles: actions.length > 0 ? [taskYamlRelPath] : [],
    actions,
    statePromotions: [],
    riskLevel: overallRisk,
    requiresReview: actions.some((a) => a.requiresReview),
    summary,
    warnings,
  };
}
