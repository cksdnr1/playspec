import { describe, expect, it } from 'vitest';

import { RollbackManager } from '#core/rollback-manager.js';
import type { GitNameStatusEntry, GitWorkspaceState } from '#core/git-state.js';
import type { TaskRecord } from '#core/types.js';

describe('RollbackManager', () => {
  it('passes exact quoted-character target paths to git restore when eligible', async () => {
    const restoreCalls: string[][] = [];
    const gitState = {
      getWorkspaceState: async (): Promise<GitWorkspaceState> => ({
        head: 'new-head',
        branchStatus: '## main',
        entries: [],
      }),
      listCommitsAfter: async (): Promise<string[]> => [],
      listNameStatusSince: async (): Promise<GitNameStatusEntry[]> => [
        { code: 'M', path: 'src/quote"file.ts' },
      ],
      run: async (args: string[]): Promise<string> => {
        restoreCalls.push(args);
        return '';
      },
    };
    const manager = new RollbackManager('/tmp/playspec-test', {} as never, gitState as never);

    const result = await manager.executeGitRollback(makeTask());

    expect(result.mode).toBe('git-only');
    expect(restoreCalls).toEqual([
      ['restore', '--source', 'safe-head', '--', 'src/quote"file.ts'],
    ]);
  });
});

function makeTask(): TaskRecord {
  return {
    id: 'quoted_rollback',
    title: 'Quoted Rollback',
    workflow: 'mono-spec',
    status: 'active',
    workflowMode: 'linear',
    currentPhase: '1',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    paths: {
      taskRoot: '.playspec/tasks/active/quoted_rollback',
      projectDocRoot: 'docs/features/quoted_rollback',
    },
    variables: {},
    phaseHistory: [],
    rollback: {
      lastSafePoint: {
        id: 'safe-point',
        createdAt: '2026-05-26T00:00:00.000Z',
        phase: '1',
        gitHead: 'safe-head',
        taskSnapshotFile: 'snapshots/safe.yaml',
      },
    },
  };
}
