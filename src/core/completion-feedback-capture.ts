import path from 'node:path';
import { readTextFile } from '#utils/fs.js';
import { getActiveTaskRoot } from '#utils/paths.js';
import { FeedbackThreadUpdater } from '#evolution/feedback-thread-updater.js';
import { ValidationFeedbackExtractor, ValidationFeedbackExtractionError } from '#evolution/validation-feedback-extractor.js';
import type { TaskRecord, ResolvedWorkflow, PhaseDefinition, CompletionFeedbackResult, CompletionFeedbackFailureStage, PhaseFeedbackFailurePolicy } from './types.js';

export interface CompletionFeedbackCaptureInput {
    observationId?: string;
    createdAt?: string;
    validationReportFile?: string;
    task: TaskRecord;
    workflow: ResolvedWorkflow;
    definition: PhaseDefinition;
    phaseId: string;
    result?: string;
    reviewFile?: string;
    snapshotFiles: string[];
  }

export class CompletionFeedbackCapture {
  private readonly validationFeedbackExtractor: ValidationFeedbackExtractor;
  private readonly feedbackThreadUpdater: FeedbackThreadUpdater;
  constructor(private readonly workspaceRoot: string) {
    this.validationFeedbackExtractor = new ValidationFeedbackExtractor(workspaceRoot);
    this.feedbackThreadUpdater = new FeedbackThreadUpdater(workspaceRoot);
  }
  private getAbsoluteTaskRoot(task: TaskRecord): string { return getActiveTaskRoot(this.workspaceRoot, task.id); }
  async capture(input: CompletionFeedbackCaptureInput, validateOnly = false): Promise<CompletionFeedbackResult | undefined> {
    const feedbackConfig = input.definition.feedback;
    if (!feedbackConfig?.enabled) {
      return undefined;
    }

    try {
      const artifact = this.resolveFeedbackArtifact(feedbackConfig.scoreSource.artifactRole, {
        validationReportFile: input.validationReportFile,
        reviewFile: input.reviewFile,
        snapshotFiles: input.snapshotFiles,
      });
      if (!artifact) {
        return this.handleFeedbackCaptureFailure(
          feedbackConfig.onFailure,
          'missing_artifact',
          `Feedback is enabled for phase "${input.phaseId}", but no ${feedbackConfig.scoreSource.artifactRole} artifact was produced.`
        );
      }

      let artifactContent: string;
      try {
        artifactContent = await readTextFile(path.join(this.getAbsoluteTaskRoot(input.task), artifact));
      } catch (error) {
        return this.handleFeedbackCaptureFailure(
          feedbackConfig.onFailure,
          'missing_artifact',
          `Could not read feedback artifact "${artifact}": ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const extraction = this.validationFeedbackExtractor.extract({
        task: input.task,
        workflow: input.workflow,
        feedbackConfig,
        phaseId: input.phaseId,
        artifactContent,
        artifactPath: path.join(input.task.paths.taskRoot, artifact),
        completionResult: this.normalizeFeedbackApprovalResult(input.result),
      });

      if (validateOnly) return undefined;
      try {
        const update = await this.feedbackThreadUpdater.update({
          observationId: input.observationId,
          createdAt: input.createdAt,
          task: input.task,
          workflow: input.workflow,
          feedbackConfig,
          evolutionTargetPhaseId: extraction.evolutionTargetPhaseId,
          phaseId: input.phaseId,
          approvalResult: extraction.approval.result,
          feedbackResult: extraction.feedback.result,
          causeClassification: extraction.causeClassification,
          summary: extraction.summary,
          ...(extraction.score !== undefined ? { score: extraction.score } : {}),
          ...(extraction.rawObservationRef !== undefined ? { rawObservationRef: extraction.rawObservationRef } : {}),
          ...(extraction.dedupeFieldValues !== undefined ? { dedupeFieldValues: extraction.dedupeFieldValues } : {}),
        });

        return {
          status: 'captured',
          threadId: update.thread.id,
          threadPath: this.toWorkspaceRelativePath(update.threadPath),
          created: update.created,
          approvalResult: extraction.approval.result,
          feedbackResult: extraction.feedback.result,
          dedupeKeyHash: update.thread.dedupeKeyHash,
          ...(extraction.score !== undefined ? { score: extraction.score } : {}),
        };
      } catch (error) {
        return this.handleFeedbackCaptureFailure(
          feedbackConfig.onFailure,
          'thread_update',
          error instanceof Error ? error.message : String(error)
        );
      }
    } catch (error) {
      if (error instanceof ValidationFeedbackExtractionError) {
        return this.handleFeedbackCaptureFailure(feedbackConfig.onFailure, 'extraction', error.message);
      }
      throw error;
    }
  }

  private resolveFeedbackArtifact(
    artifactRole: string,
    artifacts: { reviewFile?: string; snapshotFiles: string[]; validationReportFile?: string }
  ): string | undefined {
    const normalizedRole = artifactRole.toLowerCase().replace(/[\s-]+/g, '_');
    if (normalizedRole === 'validation_report') return artifacts.validationReportFile;
    if (normalizedRole.includes('review')) {
      return artifacts.reviewFile;
    }
    if (normalizedRole.includes('prompt') || normalizedRole.includes('snapshot')) {
      return artifacts.snapshotFiles.find((file) => file.endsWith('_prompt.md'));
    }
    if (normalizedRole === 'completion_markdown') {
      return undefined;
    }

    const byBasename = [...artifacts.snapshotFiles, ...(artifacts.reviewFile ? [artifacts.reviewFile] : [])].find(
      (file) => path.basename(file, path.extname(file)) === artifactRole
    );
    return byBasename;
  }

  private handleFeedbackCaptureFailure(
    policy: PhaseFeedbackFailurePolicy,
    stage: CompletionFeedbackFailureStage,
    message: string
  ): CompletionFeedbackResult {
    if (policy === 'fail_completion') {
      throw new ValidationFeedbackExtractionError(message);
    }
    return {
      status: 'failed',
      policy,
      stage,
      message,
      feedbackResult: 'parse_failed',
    };
  }

  private normalizeFeedbackApprovalResult(result: string | undefined) {
    if (
      result === 'approved' ||
      result === 'needs_revision' ||
      result === 'failed' ||
      result === 'skipped'
    ) {
      return result;
    }
    return undefined;
  }

  private toWorkspaceRelativePath(filePath: string): string {
    if (!path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.relative(this.workspaceRoot, filePath);
  }

}

export function renderCompletionFeedback(feedback: CompletionFeedbackResult): string {
    if (feedback.status === 'captured') {
      return [
        `- Status: captured`,
        `- Thread: ${feedback.threadId}`,
        `- Thread path: ${feedback.threadPath}`,
        `- Created: ${feedback.created}`,
        `- Approval result: ${feedback.approvalResult}`,
        `- Feedback result: ${feedback.feedbackResult}`,
        `- Dedupe key hash: ${feedback.dedupeKeyHash}`,
        ...(feedback.score !== undefined ? [`- Score: ${feedback.score}`] : []),
      ].join('\n');
    }

    return [
      `- Status: failed`,
      `- Policy: ${feedback.policy}`,
      `- Stage: ${feedback.stage}`,
      `- Feedback result: ${feedback.feedbackResult}`,
      `- Message: ${feedback.message}`,
    ].join('\n');
  }

