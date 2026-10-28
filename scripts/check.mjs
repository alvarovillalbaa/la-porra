import { readFile, readdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
let modules = 0, imports = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) { await inspect(file); continue; }
    if (!entry.name.endsWith('.mjs')) continue;
    execFileSync(process.execPath, ['--check', fileURLToPath(file)]);
    modules += 1;
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^;'"\n]+?\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
      await access(new URL(match[1], file)); imports += 1;
    }
  }
}
for (const directory of ['src/', 'tests/', 'scripts/', 'public/src/']) await inspect(new URL(directory, root));
JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
for (const name of ['README.md', 'AGENTS.md', 'docs/spec.md', 'docs/architecture.md', 'docs/proposals/core-checks.md',
  'docs/references/application-api.md', 'public/index.html', 'public/styles.css']) {
  if (!(await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).trim()) throw new Error(`Empty source document: ${name}`);
}
const html = await readFile(new URL('public/index.html', root), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)) await access(new URL(`public${match[1]}`, root));
console.log(`${modules} ES modules parsed; ${imports} relative imports and local HTML assets resolve. Package JSON and required documents passed. No product function or test was executed.`);
