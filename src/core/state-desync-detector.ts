import path from 'node:path';
import type {
  DesyncCheckResult,
  DesyncSeverity,
  TaskRecord,
} from '#core/types.js';
import { DesyncCheckFailedError } from '#core/errors.js';
import { GitState, type GitNameStatusEntry, type GitStatusEntry } from '#core/git-state.js';

export class StateDesyncDetector {
  constructor(private readonly gitState: GitState) {}

  async run(task: TaskRecord): Promise<DesyncCheckResult> {
    const lastKnownGitHead = task.stateSync?.lastKnownGitHead ?? null;
    if (!lastKnownGitHead && !task.rollback?.lastSafePoint) {
      return {
        taskId: task.id,
        severity: 'none',
        currentGitHead: null,
        lastKnownGitHead,
        changedFiles: [],
        deletedFiles: [],
        renamedFiles: [],
        untrackedFiles: [],
        reasons: ['No completion safe point exists yet.'],
        recommendedAction: 'No recovery action is needed.',
      };
    }

    try {
      const state = await this.gitState.getWorkspaceState();
      const userEntries = state.entries.filter((entry) => !isPlaySpecPath(entry.path));
      const committedEntries =
        lastKnownGitHead && state.head && state.head !== lastKnownGitHead
          ? (await this.gitState.listNameStatusSince(lastKnownGitHead))
              .filter((entry) => !isPlaySpecPath(entry.path))
          : [];
      const changedFiles = sortedUnique([
        ...collectChangedFiles(userEntries),
        ...collectChangedNameStatusFiles(committedEntries),
      ]);
      const deletedFiles = sortedUnique([
        ...collectDeletedFiles(userEntries),
        ...collectDeletedNameStatusFiles(committedEntries),
      ]);
      const renamedFiles = sortedUnique([
        ...collectRenamedFiles(userEntries),
        ...collectRenamedNameStatusFiles(committedEntries),
      ]);
      const untrackedFiles = collectUntrackedFiles(userEntries);
      const reasons: string[] = [];

      if (lastKnownGitHead && state.head && state.head !== lastKnownGitHead) {
        reasons.push('Git HEAD changed since the last safe point.');
      }
      if (deletedFiles.length > 0) {
        reasons.push('Tracked files were deleted since the last safe point.');
      }
      if (renamedFiles.length > 0) {
        reasons.push('Tracked files were renamed since the last safe point.');
      }
      if (hasHeavyProjectDocChange(task, [...changedFiles, ...deletedFiles, ...renamedFiles])) {
        reasons.push('Project document changes reached the heavy-change threshold.');
      }
      if (reasons.length === 0 && changedFiles.length > 0) {
        reasons.push('Tracked files changed since the last safe point.');
      }
      if (reasons.length === 0 && untrackedFiles.length > 0) {
        reasons.push('Untracked files are present.');
      }

      const severity = classifySeverity({
        task,
        headChanged: Boolean(lastKnownGitHead && state.head && state.head !== lastKnownGitHead),
        changedFiles,
        deletedFiles,
        renamedFiles,
        untrackedFiles,
      });

      return {
        taskId: task.id,
        severity,
        currentGitHead: state.head,
        lastKnownGitHead,
        changedFiles,
        deletedFiles,
        renamedFiles,
        untrackedFiles,
        reasons: reasons.length > 0 ? reasons : ['Workspace matches the last safe point.'],
        recommendedAction: recommendationFor(severity),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new DesyncCheckFailedError(error.message);
      }
      throw error;
    }
  }
}

function classifySeverity(input: {
  task: TaskRecord;
  headChanged: boolean;
  changedFiles: string[];
  deletedFiles: string[];
  renamedFiles: string[];
  untrackedFiles: string[];
}): DesyncSeverity {
  if (
    input.headChanged ||
    input.deletedFiles.length > 0 ||
    input.renamedFiles.length > 0 ||
    hasHeavyProjectDocChange(input.task, [
      ...input.changedFiles,
      ...input.deletedFiles,
      ...input.renamedFiles,
    ])
  ) {
    return 'high';
  }

  if (input.changedFiles.length === 0 && input.untrackedFiles.length === 0) {
    return 'none';
  }

  if (
    input.changedFiles.length > 0 &&
    input.changedFiles.every((file) => isDocLike(file))
  ) {
    return 'low';
  }

  return 'medium';
}

function collectChangedFiles(entries: GitStatusEntry[]): string[] {
  return sortedUnique(
    entries
      .filter((entry) => !isDeleted(entry) && !isRename(entry) && !isUntracked(entry))
      .map((entry) => entry.path)
  );
}

function collectDeletedFiles(entries: GitStatusEntry[]): string[] {
  return sortedUnique(entries.filter(isDeleted).map((entry) => entry.path));
}

function collectRenamedFiles(entries: GitStatusEntry[]): string[] {
  return sortedUnique(
    entries
      .filter(isRename)
      .flatMap((entry) => entry.originalPath ? [entry.originalPath, entry.path] : [entry.path])
  );
}

function collectUntrackedFiles(entries: GitStatusEntry[]): string[] {
  return sortedUnique(entries.filter(isUntracked).map((entry) => entry.path));
}

function collectChangedNameStatusFiles(entries: GitNameStatusEntry[]): string[] {
  return sortedUnique(
    entries
      .filter((entry) => !entry.code.startsWith('D') && !entry.code.startsWith('R'))
      .map((entry) => entry.path)
  );
}

function collectDeletedNameStatusFiles(entries: GitNameStatusEntry[]): string[] {
  return sortedUnique(
    entries
      .filter((entry) => entry.code.startsWith('D'))
      .map((entry) => entry.path)
  );
}

function collectRenamedNameStatusFiles(entries: GitNameStatusEntry[]): string[] {
  return sortedUnique(
    entries
      .filter((entry) => entry.code.startsWith('R'))
      .flatMap((entry) => entry.originalPath ? [entry.originalPath, entry.path] : [entry.path])
  );
}

function isDeleted(entry: GitStatusEntry): boolean {
  return entry.code.includes('D');
}

function isRename(entry: GitStatusEntry): boolean {
  return entry.code.includes('R');
}

function isUntracked(entry: GitStatusEntry): boolean {
  return entry.code === '??';
}

function hasHeavyProjectDocChange(task: TaskRecord, files: string[]): boolean {
  const projectDocRoot = normalizePath(task.paths.projectDocRoot);
  if (!projectDocRoot) {
    return false;
  }

  const docsChanged = files.filter((file) => normalizePath(file).startsWith(`${projectDocRoot}/`));
  return docsChanged.length >= 10 || docsChanged.some(isPhaseOutputDocument);
}

function isPhaseOutputDocument(file: string): boolean {
  return /_phase[^/]+_(implementation_spec|handoff|implementation_plan|implementation_result)\.md$/.test(file);
}

function isDocLike(file: string): boolean {
  const normalized = normalizePath(file);
  return normalized.startsWith('docs/') || normalized.endsWith('.md') || normalized.endsWith('.txt');
}

function isPlaySpecPath(file: string): boolean {
  return normalizePath(file).startsWith('.playspec/');
}

function normalizePath(file: string): string {
  return file.split(path.sep).join('/');
}

function sortedUnique(files: string[]): string[] {
  return [...new Set(files)].sort();
}

function recommendationFor(severity: DesyncSeverity): string {
  if (severity === 'high') {
    return 'Review desync details before continuing; consider `playspec rollback --state-only`.';
  }
  if (severity === 'medium') {
    return 'Review changed files before completing or rendering more work.';
  }
  if (severity === 'low') {
    return 'Continue if the listed document changes are expected.';
  }
  return 'No recovery action is needed.';
}
