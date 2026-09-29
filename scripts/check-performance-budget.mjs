import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve('.next/static/chunks');
const totalBudgetKb = Number(process.env.PERF_JS_TOTAL_GZIP_KB ?? 2500);
const chunkBudgetKb = Number(process.env.PERF_JS_CHUNK_GZIP_KB ?? 650);

if (!fs.existsSync(root)) {
  console.error('PERFORMANCE BUDGET FALLÓ · .next/static/chunks no existe; ejecuta next build primero.');
  process.exit(1);
}

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
}
walk(root);

const sizes = files.map((file) => {
  const bytes = gzipSync(fs.readFileSync(file)).byteLength;
  return { file: path.relative(process.cwd(), file).replaceAll('\\', '/'), kb: bytes / 1024 };
});
const totalKb = sizes.reduce((sum, item) => sum + item.kb, 0);
const largest = [...sizes].sort((left, right) => right.kb - left.kb)[0];
const failures = sizes.filter((item) => item.kb > chunkBudgetKb);

if (totalKb > totalBudgetKb) {
  console.error(
    `PERFORMANCE BUDGET FALLÓ · JS gzip total ${totalKb.toFixed(1)} KB > ${totalBudgetKb} KB`,
  );
}
for (const failure of failures) {
  console.error(
    `PERFORMANCE BUDGET FALLÓ · ${failure.file}: ${failure.kb.toFixed(1)} KB > ${chunkBudgetKb} KB`,
  );
}

if (totalKb > totalBudgetKb || failures.length) process.exit(1);

console.log(
  `PERFORMANCE BUDGET OK · ${sizes.length} chunks · total gzip ${totalKb.toFixed(1)} KB · mayor ${largest?.kb.toFixed(1) ?? 0} KB`,
);
