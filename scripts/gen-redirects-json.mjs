/**
 * Generates redirects.json from redirects.ts for the sitemap.
 * Run during build: npx tsx scripts/gen-redirects-json.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(process.cwd(), 'src', 'data', 'redirects.ts'), 'utf-8');
const entries = {};
const regex = /"([^"]+)"\s*:\s*"([^"]+)"/g;
let m;
while ((m = regex.exec(src)) !== null) {
  entries[m[1]] = m[2];
}

const outPath = join(process.cwd(), 'dist', 'redirects.json');
writeFileSync(outPath, JSON.stringify(entries, null, 0));
console.log(`Generated ${Object.keys(entries).length} redirect entries -> ${outPath}`);
