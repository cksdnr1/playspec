import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import path from 'node:path';

const CLI_PATH = path.resolve('/volume2/PJ/playspec/src/cli/index.ts');

describe('CLI placeholder', () => {
  it('prints help output when invoked with --help', async () => {
    const result = await execa('npx', ['tsx', CLI_PATH, '--help'], {
      reject: false,
    });
    // --help exits with 0, output goes to stdout
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/playspec/i);
  });
});
