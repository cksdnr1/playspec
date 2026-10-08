import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCase, gradeResponses, loadCases } from '#eval/harness.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [mode, input] = process.argv.slice(2);
if (!input || !['export', 'grade'].includes(mode)) {
  process.stderr.write('Usage: npm run eval:workflow-prompts -- export <output-directory> | grade <responses.json>\n'); process.exitCode = 2;
} else if (mode === 'export') {
  await mkdir(input, { recursive: true });
  const cases = await loadCases(repoRoot);
  for (const item of cases) await writeFile(path.join(input, `${item.id}.json`), JSON.stringify(await exportCase(repoRoot, item), null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(`Exported ${cases.length} review inputs without expected answers. No model inference was run.\n`);
} else {
  const report = await gradeResponses(repoRoot, JSON.parse(await readFile(input, 'utf8')));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
}
