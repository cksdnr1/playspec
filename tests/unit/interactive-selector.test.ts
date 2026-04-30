import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { PlaySpecError } from '../../src/core/errors.js';
import {
  buildSelectorFrame,
  nextSelectorIndex,
  selectInteractiveItem,
  truncateToWidth,
  visualRowsForLine,
} from '../../src/cli/interactive-selector.js';

class FakeInput extends EventEmitter {
  isTTY = true;
  isRaw = false;
  paused = false;

  setRawMode(mode: boolean): void {
    this.isRaw = mode;
  }

  resume(): void {
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  send(input: string): void {
    this.emit('data', Buffer.from(input, 'utf8'));
  }
}

class FakeOutput {
  writes: string[] = [];

  constructor(public columns: number) {}

  write(text: string): void {
    this.writes.push(text);
  }

  get text(): string {
    return this.writes.join('');
  }
}

describe('interactive selector rendering', () => {
  it('truncates long labels to the available row width', () => {
    expect(truncateToWidth('docs/features/very/long/path/spec.md', 12)).toBe('docs/feat...');

    const frame = buildSelectorFrame(
      [{ value: 'full-path', label: 'docs/features/very/long/path/spec.md  [path-variable] SPEC_FILE' }],
      0,
      { header: 'Select a relevant file:', footer: 'Footer', width: 20 }
    );

    expect(frame.lines[1]).toHaveLength(20);
    expect(frame.lines[1]).toBe('> docs/features/v...');
  });

  it('counts visual rows for wrapped fixed text', () => {
    expect(visualRowsForLine('Select a relevant file:', 10)).toBe(3);
    expect(
      buildSelectorFrame([{ value: 'a', label: 'short' }], 0, {
        header: 'Select a relevant file:',
        footer: 'Footer',
        width: 10,
      }).visualRows
    ).toBe(5);
  });

  it('wraps selection index on up and down', () => {
    expect(nextSelectorIndex(0, 3, 'up')).toBe(2);
    expect(nextSelectorIndex(2, 3, 'down')).toBe(0);
    expect(nextSelectorIndex(1, 3, 'up')).toBe(0);
    expect(nextSelectorIndex(1, 3, 'down')).toBe(2);
  });
});

describe('interactive selector key handling', () => {
  it('clears the exact previous visual row count before redraw', async () => {
    const input = new FakeInput();
    const output = new FakeOutput(20);
    const selected = selectInteractiveItem(
      [
        { value: 'first', label: 'docs/features/very/long/path/spec.md' },
        { value: 'second', label: 'docs/features/very/long/path/plan.md' },
      ],
      {
        header: 'Select a relevant file:',
        footer: 'Footer',
        cancelMessage: 'Cancelled.',
        input,
        output,
      }
    );

    input.send('\u001b[B');
    input.send('\r');

    await expect(selected).resolves.toBe('second');
    expect(output.text).toContain('\u001b[5A\u001b[J');
    expect(output.text).not.toContain('docs/features/very/long/path/spec.md');
  });

  it('returns the full original payload even when the label is truncated', async () => {
    const input = new FakeInput();
    const output = new FakeOutput(16);
    const fullPath = 'docs/features/very/long/path/spec.md';
    const selected = selectInteractiveItem(
      [{ value: { path: fullPath }, label: `${fullPath}  [path-variable] SPEC_FILE` }],
      {
        header: 'Select a relevant file:',
        footer: 'Footer',
        cancelMessage: 'Cancelled.',
        input,
        output,
      }
    );

    input.send('\r');

    await expect(selected).resolves.toEqual({ path: fullPath });
    expect(output.text).not.toContain(`${fullPath}  [path-variable]`);
  });

  it('cancels on Esc', async () => {
    const input = new FakeInput();
    const output = new FakeOutput(80);
    const selected = selectInteractiveItem([{ value: 'first', label: 'first' }], {
      header: 'Select a relevant file:',
      cancelMessage: 'Cancelled. No file selected.',
      input,
      output,
    });

    input.send('\u001b');

    await expect(selected).rejects.toThrow(new PlaySpecError('Cancelled. No file selected.'));
  });

  it('cancels on Ctrl+C', async () => {
    const input = new FakeInput();
    const output = new FakeOutput(80);
    const selected = selectInteractiveItem([{ value: 'first', label: 'first' }], {
      header: 'Select a relevant file:',
      cancelMessage: 'Cancelled. No file selected.',
      input,
      output,
    });

    input.send('\u0003');

    await expect(selected).rejects.toThrow(new PlaySpecError('Cancelled. No file selected.'));
  });
});
