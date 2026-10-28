import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

for (const directory of ['src', 'tests', 'scripts']) {
  for (const name of await readdir(new URL(`../${directory}/`, import.meta.url))) {
    if (name.endsWith('.mjs')) execFileSync(process.execPath, ['--check', new URL(`../${directory}/${name}`, import.meta.url).pathname]);
  }
}
JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
for (const name of ['README.md', 'AGENTS.md', 'docs/spec.md', 'docs/architecture.md', 'docs/proposals/core-checks.md']) {
  if (!(await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).trim()) throw new Error(`Empty source document: ${name}`);
}
console.log('ES module syntax, package JSON and required documents passed. No domain test or function was executed.');
