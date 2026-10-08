import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getActiveTaskRoot } from '#utils/paths.js';
import { CompletionTransactionStore } from '#storage/completion-transaction-store.js';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { TaskRecordSchema } from '#core/schemas.js';
import {
  NoRollbackSafePointError,
  RollbackSnapshotError,
  UnsafeGitRollbackBlockedError,
} from '#core/errors.js';
import type { TaskStore } from '#storage/task-store.js';
import type {
  RollbackExecutionResult,
  RollbackPlanResult,
  RollbackSafePoint,
  TaskRecord,
} from '#core/types.js';
import { GitState, type GitNameStatusEntry } from '#core/git-state.js';
import { readTextFile, withWriteLock, writeTextFileAtomic } from '#utils/fs.js';

const ACTIVE_ARTIFACT_DIRS = ['prompts', 'reviews', 'evidence', 'snapshots'] as const;

export class RollbackManager {
  constructor(
    private readonly workspaceRoot: string,
    private readonly taskStore: TaskStore,
    private readonly gitState: GitState
  ) {}

  async plan(task: TaskRecord): Promise<RollbackPlanResult> {
    const safePoint = getSafePoint(task);
    const state = await this.gitState.getWorkspaceState();
    const safetyReasons: string[] = [];
    let affectedCommits: string[] = [];
    let committedEntries: GitNameStatusEntry[] = [];

    if (safePoint.gitHead && state.head) {
      try {
        affectedCommits = await this.gitState.listCommitsAfter(safePoint.gitHead);
      } catch {
        addSafePointComparisonFailure(safetyReasons);
      }
    }
    if (safePoint.gitHead && state.head && state.head !== safePoint.gitHead) {
      try {
        committedEntries = await this.gitState.listNameStatusSince(safePoint.gitHead);
      } catch {
        addSafePointComparisonFailure(safetyReasons);
      }
    }
    const userEntries = state.entries.filter((entry) => !entry.path.startsWith('.playspec/'));
    const dirtyEntries = userEntries.filter((entry) => entry.code !== '??');
    const untrackedFiles = state.entries
      .filter((entry) => entry.code === '??' && !entry.path.startsWith('.playspec/'))
      .map((entry) => entry.path)
      .sort();
    const changedFiles = [
      ...dirtyEntries
      .filter((entry) => !entry.code.includes('D') && !entry.code.includes('R'))
      .map((entry) => entry.path),
      ...committedEntries
        .filter((entry) => !entry.code.startsWith('D') && !entry.code.startsWith('R'))
        .map((entry) => entry.path),
    ].sort();
    const deletedFiles = [
      ...dirtyEntries
      .filter((entry) => entry.code.includes('D'))
      .map((entry) => entry.path),
      ...committedEntries
        .filter((entry) => entry.code.startsWith('D'))
        .map((entry) => entry.path),
    ].sort();
    const renamedFiles = [
      ...dirtyEntries
      .filter((entry) => entry.code.includes('R'))
      .flatMap((entry) => entry.originalPath ? [entry.originalPath, entry.path] : [entry.path]),
      ...committedEntries
        .filter((entry) => entry.code.startsWith('R'))
        .flatMap((entry) => entry.originalPath ? [entry.originalPath, entry.path] : [entry.path]),
    ].sort();
    const targetFiles = rollbackTargetFiles({
      changedFiles,
      deletedFiles,
      renamedFiles,
    });
    const untrackedDeletionRiskFiles = untrackedFiles.filter((file) => targetFiles.includes(file));

    if (dirtyEntries.length > 0) {
      safetyReasons.push('Working tree has uncommitted tracked changes.');
    }
    if (affectedCommits.length > 0) {
      safetyReasons.push('New commits exist after the rollback safe point.');
    }
    if (untrackedDeletionRiskFiles.length > 0) {
      safetyReasons.push('Untracked files conflict with rollback target files and will not be deleted.');
    }
    if (state.branchStatus.includes('ahead') || state.branchStatus.includes('behind')) {
      safetyReasons.push('Branch divergence is present in git status.');
    }

    const canExecuteGitRollback = safetyReasons.length === 0;
    return {
      taskId: task.id,
      safePoint,
      currentGitHead: state.head,
      lastKnownGitHead: safePoint.gitHead,
      changedFiles,
      deletedFiles,
      renamedFiles,
      untrackedFiles,
      affectedCommits,
      canExecuteGitRollback,
      safetyReasons: canExecuteGitRollback
        ? ['Git rollback can be confirmed safely.']
        : safetyReasons,
      recommendedAction: canExecuteGitRollback
        ? 'Run `playspec rollback --git-only --confirm` to execute the previewed Git rollback.'
        : 'Use `playspec rollback --state-only` or clean the workspace before Git rollback.',
      confirmCommand: canExecuteGitRollback ? 'playspec rollback --git-only --confirm' : null,
    };
  }

  async rollbackStateOnly(task: TaskRecord): Promise<RollbackExecutionResult> {
    const taskRoot = this.getTaskRoot(task);

    return withWriteLock(taskRoot, async () => {
      await new CompletionTransactionStore(this.workspaceRoot, this.taskStore).recover(task.id);
      task = await this.taskStore.getTask(task.id);
      const safePoint = getSafePoint(task);
      const restoredTask = await this.loadSafePointSnapshot(task, safePoint);
      const quarantinedFiles = await this.quarantineFutureArtifacts(task, safePoint);
      const updatedTask = TaskRecordSchema.parse({
        ...restoredTask,
        updatedAt: new Date().toISOString(),
        stateSync: {
          lastKnownGitHead: restoredTask.stateSync?.lastKnownGitHead ?? safePoint.gitHead,
          lastCompletedAt: restoredTask.stateSync?.lastCompletedAt ?? safePoint.createdAt,
        },
        rollback: {
          lastSafePoint: safePoint,
        },
      });

      await writeTextFileAtomic(
        path.join(taskRoot, 'completions', `rollback-${randomUUID()}.yaml`),
        stringifyYaml({ type: 'state_rollback', taskId: task.id, createdAt: updatedTask.updatedAt,
          safePointId: safePoint.id, previousPhase: task.currentPhase, restoredPhase: updatedTask.currentPhase,
          completionHistoryPreserved: true })
      );
      await writeTextFileAtomic(
        path.join(taskRoot, 'task.yaml'),
        stringifyYaml(updatedTask)
      );

      return {
        taskId: task.id,
        mode: 'state-only',
        restoredSnapshotFile: safePoint.taskSnapshotFile,
        quarantinedFiles,
        message: 'State-only rollback restored task.yaml from the last safe point.',
      };
    });
  }

  async executeGitRollback(task: TaskRecord): Promise<RollbackExecutionResult> {
    const plan = await this.plan(task);
    if (!plan.canExecuteGitRollback) {
      throw new UnsafeGitRollbackBlockedError(plan.safetyReasons);
    }
    if (!plan.safePoint.gitHead) {
      throw new UnsafeGitRollbackBlockedError(['Rollback safe point has no Git HEAD.']);
    }

    const targetFiles = rollbackTargetFiles(plan);
    if (targetFiles.length > 0) {
      await this.gitState.run([
        'restore',
        '--source',
        plan.safePoint.gitHead,
        '--',
        ...targetFiles,
      ]);
    }

    return {
      taskId: task.id,
      mode: 'git-only',
      plan,
      message: 'Git rollback executed from the last safe point.',
    };
  }

  private async loadSafePointSnapshot(
    task: TaskRecord,
    safePoint: RollbackSafePoint
  ): Promise<TaskRecord> {
    const snapshotPath = path.join(this.getTaskRoot(task), safePoint.taskSnapshotFile);
    try {
      const content = await readTextFile(snapshotPath);
      return TaskRecordSchema.parse(parseYaml(content));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new RollbackSnapshotError(safePoint.taskSnapshotFile, reason);
    }
  }

  private async quarantineFutureArtifacts(
    task: TaskRecord,
    safePoint: RollbackSafePoint
  ): Promise<string[]> {
    const taskRoot = this.getTaskRoot(task);
    const quarantineRoot = path.join(taskRoot, 'rollback', safePoint.id);
    const safeFiles = new Set([
      safePoint.taskSnapshotFile,
      safePoint.promptSnapshotFile,
    ].filter((file): file is string => Boolean(file)));
    const movedFiles: string[] = [];

    for (const dirName of ACTIVE_ARTIFACT_DIRS) {
      const dirPath = path.join(taskRoot, dirName);
      let entries: string[];
      try {
        entries = await readdir(dirPath);
      } catch {
        continue;
      }

      for (const entry of entries) {
        const relativeFile = `${dirName}/${entry}`;
        if (safeFiles.has(relativeFile)) {
          continue;
        }
        const source = path.join(dirPath, entry);
        if (!(await isFutureArtifact(source, safePoint))) {
          continue;
        }
        const destination = path.join(quarantineRoot, relativeFile);
        await mkdir(path.dirname(destination), { recursive: true });
        await rename(source, destination);
        movedFiles.push(relativeFile);
      }
    }

    return movedFiles.sort();
  }

  private getTaskRoot(task: TaskRecord): string {
    return getActiveTaskRoot(this.workspaceRoot, task.id);
  }
}

function getSafePoint(task: TaskRecord): RollbackSafePoint {
  const safePoint = task.rollback?.lastSafePoint;
  if (!safePoint) {
    throw new NoRollbackSafePointError(task.id);
  }
  return safePoint;
}

function rollbackTargetFiles(plan: Pick<RollbackPlanResult, 'changedFiles' | 'deletedFiles' | 'renamedFiles'>): string[] {
  return [...new Set([
    ...plan.changedFiles,
    ...plan.deletedFiles,
    ...plan.renamedFiles,
  ])].sort();
}

function addSafePointComparisonFailure(safetyReasons: string[]): void {
  const reason = 'Rollback safe-point Git head cannot be resolved or compared.';
  if (!safetyReasons.includes(reason)) {
    safetyReasons.push(reason);
  }
}

async function isFutureArtifact(filePath: string, safePoint: RollbackSafePoint): Promise<boolean> {
  const safePointTime = Date.parse(safePoint.createdAt);
  if (Number.isNaN(safePointTime)) {
    return false;
  }

  try {
    const fileStat = await stat(filePath);
    return fileStat.mtimeMs > safePointTime;
  } catch {
    return false;
  }
}
