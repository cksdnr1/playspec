import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PlaySpecError } from '#core/errors.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import { resolveContainedPath } from '#utils/contained-path.js';
import { readTextFile, writeTextFile, writeTextFileAtomic } from '#utils/fs.js';
import {
  getEvolutionApplyBackupRoot,
  getEvolutionApplyReportPath,
} from '#utils/paths.js';
import { EvolutionProposalStore } from './proposal-store.js';
import {
  EvolutionExecutableActionSchema,
} from './schemas.js';
import type {
  EvolutionApplyActionReport,
  EvolutionApplyReport,
  EvolutionApplyResult,
  EvolutionApplyValidationReport,
  EvolutionDiffResult,
  EvolutionExecutableAction,
  EvolutionProposal,
} from './types.js';

export const EVOLUTION_ALLOWED_TARGET_PREFIXES = ['.playspec/templates/', '.playspec/rules/'] as const;

export interface EvolutionApplyRunnerOptions {
  approved?: boolean;
  approvalSource?: string;
}

export class EvolutionApplyRunner {
  private readonly store: EvolutionProposalStore;

  constructor(private readonly workspaceRoot: string) {
    this.store = new EvolutionProposalStore(workspaceRoot);
  }

  async diff(proposalId: string): Promise<EvolutionDiffResult> {
    const proposal = await this.store.loadProposal(proposalId);
    this.assertProposalCanApply(proposal);
    const actions = this.getExecutableActions(proposal);
    const targetFiles = await this.validateActionTargets(actions);
    const beforeContents = await this.readTargetContents(targetFiles);
    const afterContents = this.simulateActions(beforeContents, actions);

    return {
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      targetFiles,
      beforeHashes: hashContents(beforeContents),
      afterHashes: hashContents(afterContents),
      changedFiles: targetFiles.filter((targetPath) => beforeContents[targetPath] !== afterContents[targetPath]),
      fileDiffs: Object.fromEntries(
        targetFiles.map((targetPath) => [
          targetPath,
          buildTextDiff(targetPath, beforeContents[targetPath] ?? '', afterContents[targetPath] ?? ''),
        ])
      ),
      summary: actions.map((action) => `${action.actionId} ${action.type} ${action.targetPath}`),
    };
  }

  async apply(proposalId: string, options: EvolutionApplyRunnerOptions = {}): Promise<EvolutionApplyResult> {
    if (!options.approved) {
      throw new PlaySpecError(
        'Evolution apply requires explicit approval.',
        'Rerun with `playspec evolution apply <proposalId> --yes` after reviewing `playspec evolution diff <proposalId>`.'
      );
    }

    const proposal = await this.store.loadProposal(proposalId);
    this.assertProposalCanApply(proposal);

    const timestamp = formatPathTimestamp(new Date());
    const reportPath = getEvolutionApplyReportPath(this.workspaceRoot, proposal.id, timestamp);
    const backupRoot = getEvolutionApplyBackupRoot(this.workspaceRoot, proposal.id, timestamp);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await mkdir(backupRoot, { recursive: true });

    let actions: EvolutionExecutableAction[];
    let targetFiles: string[];
    try {
      actions = this.getExecutableActions(proposal);
      targetFiles = await this.validateActionTargets(actions);
    } catch (error: unknown) {
      const report = this.buildFailureReport(
        proposal,
        [],
        {},
        {},
        [],
        [],
        workspaceRelative(this.workspaceRoot, backupRoot),
        undefined,
        false,
        errorMessage(error),
        options.approvalSource ?? 'cli --yes'
      );
      await this.store.saveApplyReport(report, reportPath);
      await this.store.markProposalApplyStatus(proposal.id, 'failed', workspaceRelative(this.workspaceRoot, reportPath));
      throw error;
    }

    const beforeContents = await this.readTargetContents(targetFiles);
    await this.createBackups(backupRoot, beforeContents);
    const beforeHashes = hashContents(beforeContents);
    const workingContents = { ...beforeContents };
    const actionReports: EvolutionApplyActionReport[] = [];
    const writtenFiles = new Set<string>();
    let failedAction: string | undefined;
    let failureMessage: string | undefined;

    for (const action of actions) {
      try {
        workingContents[action.targetPath] = applyActionToContent(workingContents[action.targetPath] ?? '', action);
        await writeTextFileAtomic(await this.resolveAllowedTarget(action.targetPath), workingContents[action.targetPath] ?? '');
        writtenFiles.add(action.targetPath);
        actionReports.push({
          actionId: action.actionId,
          type: action.type,
          targetPath: action.targetPath,
          status: 'applied',
          summary: action.summary,
        });
      } catch (error: unknown) {
        failedAction = action.actionId;
        failureMessage = errorMessage(error);
        actionReports.push({
          actionId: action.actionId,
          type: action.type,
          targetPath: action.targetPath,
          status: 'failed',
          summary: action.summary,
          error: failureMessage,
        });
        break;
      }
    }

    const afterContents = await this.readTargetContents(targetFiles);
    const afterHashes = hashContents(afterContents);
    const changedFiles = targetFiles.filter((targetPath) => beforeHashes[targetPath] !== afterHashes[targetPath]);
    const validation = failedAction ? [] : await this.validateChangedFiles(changedFiles);
    const validationFailed = validation.some((item) => item.status === 'failed');

    if (!failedAction && validationFailed) {
      failedAction = 'validation';
      failureMessage = validation.flatMap((item) => item.errors).join('; ') || 'Post-apply validation failed.';
    }

    const report: EvolutionApplyReport = {
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      createdAt: new Date().toISOString(),
      approvalSource: options.approvalSource ?? 'cli --yes',
      targetFiles,
      actions: actionReports,
      beforeHashes,
      afterHashes,
      changedFiles,
      validation,
      status: failedAction ? 'failed' : 'success',
      ...(failedAction ? { failedAction } : {}),
      partialApply: Boolean(failedAction && (writtenFiles.size > 0 || changedFiles.length > 0)),
      recoveryGuidance: failedAction
        ? `Restore files from ${workspaceRelative(this.workspaceRoot, backupRoot)} before retrying. ${failureMessage ?? ''}`.trim()
        : `Backups are available at ${workspaceRelative(this.workspaceRoot, backupRoot)}.`,
      backupPath: workspaceRelative(this.workspaceRoot, backupRoot),
    };

    await this.store.saveApplyReport(report, reportPath);
    await this.store.markProposalApplyStatus(
      proposal.id,
      report.status === 'success' ? 'applied' : 'failed',
      workspaceRelative(this.workspaceRoot, reportPath)
    );

    if (report.status === 'failed') {
      throw new PlaySpecError(
        `Evolution apply failed for proposal ${proposal.id}: ${failureMessage ?? 'unknown failure'}`,
        `See ${workspaceRelative(this.workspaceRoot, reportPath)} and restore from ${workspaceRelative(this.workspaceRoot, backupRoot)} if needed.`
      );
    }

    return { report, reportPath, backupPath: backupRoot };
  }

  private assertProposalCanApply(proposal: EvolutionProposal): void {
    if (proposal.status !== 'pending' && proposal.status !== 'refining') {
      throw new PlaySpecError(
        `Only pending/refining proposals can be applied; current status is ${proposal.status}.`,
        'Review the proposal status before applying.'
      );
    }
  }

  private getExecutableActions(proposal: EvolutionProposal): EvolutionExecutableAction[] {
    return proposal.actions.map((action) => {
      const parsed = EvolutionExecutableActionSchema.safeParse(action);
      if (!parsed.success) {
        throw new PlaySpecError(
          `Evolution action is not executable in Phase 6.3: ${action.actionId} (${action.type})`,
          'Use only replace_file, append_section, or replace_section actions for evolution apply.'
        );
      }
      return {
        ...parsed.data,
        targetPath: normalizeWorkspacePath(parsed.data.targetPath),
      } as EvolutionExecutableAction;
    });
  }

  private async validateActionTargets(actions: EvolutionExecutableAction[]): Promise<string[]> {
    const targetFiles = [...new Set(actions.map((action) => normalizeWorkspacePath(action.targetPath)))];
    for (const targetPath of targetFiles) {
      if (!EVOLUTION_ALLOWED_TARGET_PREFIXES.some((prefix) => targetPath.startsWith(prefix))) {
        throw new PlaySpecError(
          `Evolution apply target is not allow-listed: ${targetPath}`,
          'Allowed targets are .playspec/templates/ and .playspec/rules/ only.'
        );
      }
    }
    for (const targetPath of targetFiles) await this.resolveAllowedTarget(targetPath);
    return targetFiles;
  }

  private async resolveAllowedTarget(targetPath: string): Promise<string> {
    const prefix = EVOLUTION_ALLOWED_TARGET_PREFIXES.find(root => targetPath.startsWith(root));
    if (!prefix) throw new PlaySpecError(`Evolution target is not allow-listed: ${targetPath}`);
    const root = await resolveContainedPath(this.workspaceRoot, prefix);
    const target = await resolveContainedPath(this.workspaceRoot, targetPath);
    return resolveContainedPath(root, path.relative(root, target));
  }

  private async readTargetContents(targetFiles: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    for (const targetPath of targetFiles) {
      contents[targetPath] = await readTextFile(await this.resolveAllowedTarget(targetPath));
    }
    return contents;
  }

  private async createBackups(backupRoot: string, beforeContents: Record<string, string>): Promise<void> {
    for (const [targetPath, content] of Object.entries(beforeContents)) {
      await writeTextFile(path.join(backupRoot, targetPath), content);
    }
  }

  private simulateActions(
    beforeContents: Record<string, string>,
    actions: EvolutionExecutableAction[]
  ): Record<string, string> {
    const result = { ...beforeContents };
    for (const action of actions) {
      result[action.targetPath] = applyActionToContent(result[action.targetPath] ?? '', action);
    }
    return result;
  }

  private async validateChangedFiles(changedFiles: string[]): Promise<EvolutionApplyValidationReport[]> {
    const validation: EvolutionApplyValidationReport[] = [];
    for (const targetPath of changedFiles) {
      if (targetPath.startsWith('.playspec/templates/')) {
        validation.push(await this.validateTemplate(targetPath));
      } else if (targetPath.startsWith('.playspec/rules/')) {
        validation.push(await this.validateRule(targetPath));
      }
    }
    return validation;
  }

  private async validateTemplate(targetPath: string): Promise<EvolutionApplyValidationReport> {
    const templateRoot = path.dirname(path.join(this.workspaceRoot, targetPath));
    const templatePath = path.basename(targetPath);
    try {
      await new TemplateRenderer(this.workspaceRoot).render(templatePath, representativeVariables(), templateRoot);
      return {
        path: targetPath,
        status: 'passed',
        checks: ['template-render'],
        errors: [],
      };
    } catch (error: unknown) {
      return {
        path: targetPath,
        status: 'failed',
        checks: ['template-render'],
        errors: [errorMessage(error)],
      };
    }
  }

  private async validateRule(targetPath: string): Promise<EvolutionApplyValidationReport> {
    try {
      const content = await readTextFile(await this.resolveAllowedTarget(targetPath));
      if (content.trim() === '') {
        throw new Error('Rule file must not be empty.');
      }
      return {
        path: targetPath,
        status: 'passed',
        checks: ['readable-non-empty-text'],
        errors: [],
      };
    } catch (error: unknown) {
      return {
        path: targetPath,
        status: 'failed',
        checks: ['readable-non-empty-text'],
        errors: [errorMessage(error)],
      };
    }
  }

  private buildFailureReport(
    proposal: EvolutionProposal,
    actionReports: EvolutionApplyActionReport[],
    beforeHashes: Record<string, string>,
    afterHashes: Record<string, string>,
    changedFiles: string[],
    validation: EvolutionApplyValidationReport[],
    backupPath: string,
    failedAction: string | undefined,
    partialApply: boolean,
    message: string,
    approvalSource: string
  ): EvolutionApplyReport {
    return {
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      createdAt: new Date().toISOString(),
      approvalSource,
      targetFiles: proposal.targetFiles,
      actions: actionReports,
      beforeHashes,
      afterHashes,
      changedFiles,
      validation,
      status: 'failed',
      ...(failedAction ? { failedAction } : {}),
      partialApply,
      recoveryGuidance: message,
      backupPath,
    };
  }
}

function applyActionToContent(existing: string, action: EvolutionExecutableAction): string {
  switch (action.type) {
    case 'replace_file':
      return action.content;
    case 'append_section':
      if (hasMarkdownSection(existing, action.sectionName)) {
        throw new Error(`Section already exists: ${action.sectionName}`);
      }
      return appendMarkdownSection(existing, action.sectionName, action.content);
    case 'replace_section':
      return replaceMarkdownSection(existing, action.sectionName, action.content);
  }
}

function appendMarkdownSection(existing: string, sectionName: string, content: string): string {
  const prefix = existing.trimEnd();
  const section = `## ${sectionName}\n\n${content.trim()}\n`;
  return prefix.length === 0 ? section : `${prefix}\n\n${section}`;
}

function replaceMarkdownSection(existing: string, sectionName: string, content: string): string {
  const regex = markdownSectionRegex(sectionName);
  if (!regex.test(existing)) {
    throw new Error(`Section not found: ${sectionName}`);
  }
  return existing.replace(regex, (_match, leading: string) => {
    return `${leading}## ${sectionName}\n\n${content.trim()}\n`;
  });
}

function hasMarkdownSection(existing: string, sectionName: string): boolean {
  return markdownSectionRegex(sectionName).test(existing);
}

function markdownSectionRegex(sectionName: string): RegExp {
  return new RegExp(`(^|\\n)#{1,6}\\s+${escapeRegex(sectionName)}\\s*\\n[\\s\\S]*?(?=\\n#{1,6}\\s+|\\s*$)`);
}

function hashContents(contents: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(contents).map(([targetPath, content]) => [
      targetPath,
      createHash('sha256').update(content, 'utf8').digest('hex'),
    ])
  );
}

function buildTextDiff(targetPath: string, before: string, after: string): string {
  if (before === after) {
    return '';
  }
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  return [
    `--- ${targetPath}`,
    `+++ ${targetPath}`,
    ...beforeLines.map((line) => `-${line}`),
    ...afterLines.map((line) => `+${line}`),
  ].join('\n');
}

function normalizeWorkspacePath(input: string): string {
  const normalized = path.posix.normalize(input.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new PlaySpecError(
      `Evolution apply path must stay workspace-relative: ${input}`,
      'Use a workspace-relative path under .playspec/templates/ or .playspec/rules/.'
    );
  }
  return normalized;
}

function workspaceRelative(workspaceRoot: string, absolutePath: string): string {
  return normalizeWorkspacePath(path.relative(workspaceRoot, absolutePath));
}

function formatPathTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'z').toLowerCase();
}

function representativeVariables(): Record<string, string> {
  return {
    taskId: 'sample_task',
    taskTitle: 'Sample Task',
    title: 'Sample Task',
    workflow: 'mono-spec',
    workflowId: 'mono-spec',
    phaseId: 'implementation',
    phase: 'implementation',
    phaseTitle: 'Implementation',
    currentPhase: 'implementation',
    target: 'Sample target',
    problem: 'Sample problem',
    prompt: 'Sample prompt',
    context: 'Sample context',
    evidence: 'Sample evidence',
    specPath: 'docs/features/sample/spec.md',
    planPath: 'docs/features/sample/plan.md',
    resultPath: 'docs/features/sample/result.md',
    FEATURE_SLUG: 'sample_task',
    TASK_TITLE: 'Sample Task',
    STEP_NUMBER: '1',
    STEP_ID: 'implementation',
    STEP_TITLE: 'Implementation',
    SOURCE_PROBLEM_FILE: 'docs/features/sample/source.md',
    CONTEXT_FILES: '- docs/features/sample/source.md',
    CONTEXT_REFS_DETAIL: '- docs/features/sample/source.md (role: source-problem, source: sample)',
    SPEC_FILE: 'docs/features/sample/spec.md',
    PLAN_FILE: 'docs/features/sample/plan.md',
    RESULT_FILE: 'docs/features/sample/result.md',
    PR_FILE: 'docs/features/sample/pr.md',
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
