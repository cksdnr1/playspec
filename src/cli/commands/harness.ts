import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { PlaySpecError } from '#core/errors.js';
import type { HarnessAttemptResult, HarnessRecord } from '#core/types.js';

export async function runHarnessStatus(
  workspaceRoot: string,
  taskId: string
): Promise<void> {
  const core = buildCore(workspaceRoot);
  printHarnessRecord(await core.getHarnessStatus(taskId));
}

export async function runHarnessAttempt(
  workspaceRoot: string,
  options: {
    task: string;
    phase: string;
    result: string;
    reason?: string;
  }
): Promise<void> {
  const result = parseAttemptResult(options.result);
  const core = buildCore(workspaceRoot);
  const record = await core.recordHarnessAttempt(
    options.task,
    options.phase,
    result,
    options.reason
  );

  console.log(`Harness attempt recorded: ${record.taskId}`);
  printHarnessRecord(record);
}

export async function runHarnessReset(
  workspaceRoot: string,
  taskId: string,
  reason?: string
): Promise<void> {
  const core = buildCore(workspaceRoot);
  const record = await core.resetHarness(taskId, reason);

  console.log(`Harness reset recorded: ${record.taskId}`);
  printHarnessRecord(record);
}

function buildCore(workspaceRoot: string): PlaySpecCore {
  const store = new YamlTaskStore(workspaceRoot);
  return new PlaySpecCore(workspaceRoot, store);
}

function parseAttemptResult(value: string): HarnessAttemptResult {
  if (value === 'success' || value === 'failure') {
    return value;
  }
  throw new PlaySpecError(
    `Invalid harness attempt result: ${value}`,
    'Use --result success or --result failure.'
  );
}

function printHarnessRecord(record: HarnessRecord): void {
  console.log(`Task: ${record.taskId}`);
  console.log(`Phase: ${record.phaseId}`);
  console.log(`Attempts: ${record.attemptCount}/${record.retryBudget}`);
  console.log(`Last result: ${record.lastResult ?? 'none'}`);
  console.log(`Last failure reason: ${record.lastFailureReason ?? 'none'}`);
  console.log(`Blocked: ${record.blocked ? 'yes' : 'no'}`);
  console.log(`Circuit breaker: ${record.circuitBreaker ? 'yes' : 'no'}`);
  console.log(`Updated: ${record.updatedAt}`);
  console.log(`Reset events: ${record.resetEvents.length}`);
}
