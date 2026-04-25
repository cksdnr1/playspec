import path from 'node:path';
import { rename } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { MigrationPlanSchema, MigrationReportSchema } from './schemas.js';
import type { MigrationPlan, MigrationReport } from './types.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import {
  getMigrationPlansDir,
  getMigrationReportsDir,
  getMigrationBackupsDir,
  getMigrationArchivedDir,
} from '#utils/paths.js';

export function generateMigrationId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `migration_${date}_${time}`;
}

export function escapePathForFilename(filePath: string): string {
  return filePath.replace(/[/\\:]/g, '_');
}

export class MigrationStore {
  constructor(private readonly workspaceRoot: string) {}

  async savePlan(plan: MigrationPlan): Promise<string> {
    MigrationPlanSchema.parse(plan); // schema validation — rejects unknown action types
    const planPath = path.join(getMigrationPlansDir(this.workspaceRoot), `${plan.id}.yaml`);
    await writeTextFile(planPath, stringifyYaml(plan));
    return planPath;
  }

  async loadPlan(planId: string): Promise<MigrationPlan> {
    const planPath = path.join(getMigrationPlansDir(this.workspaceRoot), `${planId}.yaml`);
    const content = await readTextFile(planPath);
    return MigrationPlanSchema.parse(parseYaml(content) as unknown) as MigrationPlan;
  }

  async saveReport(report: MigrationReport): Promise<string> {
    MigrationReportSchema.parse(report); // schema validation
    const reportPath = path.join(
      getMigrationReportsDir(this.workspaceRoot),
      `${report.planId}_report.yaml`
    );
    await writeTextFile(reportPath, stringifyYaml(report));
    return reportPath;
  }

  async createBackup(planId: string, absoluteTargetPath: string): Promise<string> {
    const relPath = path.relative(this.workspaceRoot, absoluteTargetPath);
    const escaped = escapePathForFilename(relPath);
    const backupPath = path.join(
      getMigrationBackupsDir(this.workspaceRoot, planId),
      `${escaped}.bak`
    );
    const content = await readTextFile(absoluteTargetPath);
    await writeTextFile(backupPath, content);
    return backupPath;
  }

  async archiveFile(absoluteSourcePath: string): Promise<string> {
    const relPath = path.relative(this.workspaceRoot, absoluteSourcePath);
    const escaped = escapePathForFilename(relPath);
    const archivedPath = path.join(getMigrationArchivedDir(this.workspaceRoot), escaped);
    await writeTextFile(archivedPath, ''); // ensure dir
    await rename(absoluteSourcePath, archivedPath);
    return archivedPath;
  }
}
