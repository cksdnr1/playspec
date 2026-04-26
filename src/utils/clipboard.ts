import clipboard from 'clipboardy';
import { execa } from 'execa';

export interface ClipboardResult {
  ok: boolean;
  attempted?: boolean; // true when OSC52 was written but cannot be verified
  method?: string;
  error?: string;
}

export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  if (process.env.PLAY_SPEC_DISABLE_CLIPBOARD === '1') {
    return { ok: false, error: 'Clipboard disabled by PLAY_SPEC_DISABLE_CLIPBOARD.' };
  }

  try {
    await clipboard.write(text);
    return { ok: true, method: 'native clipboard' };
  } catch (error) {
    const firstError = error instanceof Error ? error.message : String(error);
    const commandResult = await copyWithPlatformCommand(text);
    if (commandResult.ok) return commandResult;

    const osc52Result = copyWithOsc52(text);
    if (osc52Result.attempted) return osc52Result;

    return {
      ok: false,
      error: commandResult.error ?? firstError,
    };
  }
}

async function copyWithPlatformCommand(text: string): Promise<ClipboardResult> {
  const candidates = platformClipboardCommands();
  let lastError: string | undefined;

  for (const candidate of candidates) {
    try {
      await execa(candidate.command, candidate.args, {
        input: text,
        timeout: 1500,
      });
      return { ok: true, method: candidate.command };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { ok: false, error: lastError };
}

function platformClipboardCommands(): Array<{ command: string; args: string[] }> {
  if (process.platform === 'darwin') {
    return [{ command: 'pbcopy', args: [] }];
  }
  if (process.platform === 'win32') {
    return [{ command: 'clip', args: [] }];
  }
  return [
    { command: 'wl-copy', args: [] },
    { command: 'xclip', args: ['-selection', 'clipboard'] },
    { command: 'xsel', args: ['--clipboard', '--input'] },
  ];
}

function copyWithOsc52(text: string): ClipboardResult {
  if (process.stdout.isTTY !== true) {
    return { ok: false };
  }
  try {
    const encoded = Buffer.from(text, 'utf8').toString('base64');
    process.stdout.write(`\u001b]52;c;${encoded}\u0007`);
    return { ok: false, attempted: true, method: 'osc52' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
