import { stdin as defaultStdin, stdout as defaultStdout } from 'node:process';
import { PlaySpecError } from '#core/errors.js';

const DEFAULT_FOOTER = 'Use Up/Down to move, Enter to select, Esc or Ctrl+C to cancel.';
const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;

export interface InteractiveSelectorItem<T> {
  value: T;
  label: string;
}

interface SelectorInput {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?: (mode: boolean) => void;
  resume: () => void;
  pause: () => void;
  on: (event: 'data', listener: (data: Buffer) => void) => unknown;
  off: (event: 'data', listener: (data: Buffer) => void) => unknown;
}

interface SelectorOutput {
  columns?: number;
  write: (text: string) => unknown;
}

export interface SelectInteractiveItemOptions {
  header: string;
  footer?: string;
  cancelMessage: string;
  initialIndex?: number;
  input?: SelectorInput;
  output?: SelectorOutput;
}

export interface SelectorFrame {
  lines: string[];
  visualRows: number;
}

export function terminalWidth(columns: number | undefined): number {
  return columns && columns > 0 ? columns : 80;
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

export function displayWidth(value: string): number {
  return Array.from(stripAnsi(value)).length;
}

export function visualRowsForLine(line: string, width: number): number {
  return Math.max(1, Math.ceil(displayWidth(line) / Math.max(1, width)));
}

export function truncateToWidth(value: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return '';
  }
  if (displayWidth(value) <= maxWidth) {
    return value;
  }
  if (maxWidth <= 3) {
    return Array.from(value).slice(0, maxWidth).join('');
  }
  return `${Array.from(value).slice(0, maxWidth - 3).join('')}...`;
}

export function buildSelectorFrame<T>(
  items: InteractiveSelectorItem<T>[],
  selectedIndex: number,
  opts: { header: string; footer?: string; width: number }
): SelectorFrame {
  const width = Math.max(1, opts.width);
  const footer = opts.footer ?? DEFAULT_FOOTER;
  const lines = [
    opts.header,
    ...items.map((item, index) => {
      const prefix = index === selectedIndex ? '> ' : '  ';
      return `${prefix}${truncateToWidth(item.label, width - displayWidth(prefix))}`;
    }),
    footer,
  ];
  return {
    lines,
    visualRows: lines.reduce((sum, line) => sum + visualRowsForLine(line, width), 0),
  };
}

export function nextSelectorIndex(
  selectedIndex: number,
  itemCount: number,
  direction: 'up' | 'down'
): number {
  if (itemCount === 0) {
    return 0;
  }
  if (direction === 'up') {
    return selectedIndex === 0 ? itemCount - 1 : selectedIndex - 1;
  }
  return selectedIndex === itemCount - 1 ? 0 : selectedIndex + 1;
}

export async function selectInteractiveItem<T>(
  items: InteractiveSelectorItem<T>[],
  opts: SelectInteractiveItemOptions
): Promise<T> {
  if (items.length === 0) {
    throw new PlaySpecError('No selectable items.');
  }

  let selectedIndex = Math.max(0, Math.min(opts.initialIndex ?? 0, items.length - 1));
  let renderedRows = 0;
  const input = opts.input ?? defaultStdin;
  const output = opts.output ?? defaultStdout;
  const wasRaw = input.isRaw === true;

  return new Promise<T>((resolve, reject) => {
    let isDone = false;

    const restore = () => {
      input.off('data', onData);
      if (input.isTTY && typeof input.setRawMode === 'function') {
        input.setRawMode(wasRaw);
      }
      output.write('\x1b[?25h');
      if (!wasRaw) {
        input.pause();
      }
    };

    const finish = (result: T) => {
      if (isDone) return;
      isDone = true;
      restore();
      output.write('\n');
      resolve(result);
    };

    const cancel = () => {
      if (isDone) return;
      isDone = true;
      restore();
      output.write('\n');
      reject(new PlaySpecError(opts.cancelMessage));
    };

    const fail = (error: unknown) => {
      if (isDone) return;
      isDone = true;
      restore();
      output.write('\n');
      reject(error);
    };

    const render = () => {
      if (renderedRows > 0) {
        output.write(`\x1b[${renderedRows}A`);
        output.write('\x1b[J');
      }

      const frame = buildSelectorFrame(items, selectedIndex, {
        header: opts.header,
        footer: opts.footer,
        width: terminalWidth(output.columns),
      });
      output.write(`${frame.lines.join('\n')}\n`);
      renderedRows = frame.visualRows;
    };

    const onData = (data: Buffer) => {
      try {
        const value = data.toString('utf8');
        let cursor = 0;
        while (cursor < value.length) {
          if (value.startsWith('\u001b[A', cursor)) {
            selectedIndex = nextSelectorIndex(selectedIndex, items.length, 'up');
            render();
            cursor += 3;
            continue;
          }
          if (value.startsWith('\u001b[B', cursor)) {
            selectedIndex = nextSelectorIndex(selectedIndex, items.length, 'down');
            render();
            cursor += 3;
            continue;
          }

          const char = value[cursor];
          if (char === '\u0003' || char === '\u001b') {
            cancel();
            return;
          }
          if (char === '\r' || char === '\n') {
            finish(items[selectedIndex]!.value);
            return;
          }
          cursor += 1;
        }
      } catch (error) {
        fail(error);
      }
    };

    try {
      output.write('\x1b[?25l');
      if (input.isTTY && typeof input.setRawMode === 'function') {
        input.setRawMode(true);
      }
      input.resume();
      input.on('data', onData);
      render();
    } catch (error) {
      fail(error);
    }
  });
}
