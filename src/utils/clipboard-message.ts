import type { ClipboardResult } from './clipboard.js';

export function formatPromptCopySuccess(result: Pick<ClipboardResult, 'method' | 'primaryOk'>): string[] {
  const lines = [`Prompt copied to clipboard${result.method ? ` via ${result.method}` : ''}.`];
  if (result.primaryOk === true) {
    lines.push('PRIMARY selection updated.');
  } else if (result.primaryOk === false) {
    lines.push('Warning: PRIMARY selection not available; CLIPBOARD copy succeeded.');
  }
  return lines;
}
