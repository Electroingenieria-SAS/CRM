import fs from 'node:fs';
import path from 'node:path';

const root = '.next/static';
const budgetPath = 'config/performance-budget.json';

if (!fs.existsSync(root)) {
  console.error('PERFORMANCE BUDGET FALLÓ · no existe .next/static; ejecuta build primero.');
  process.exit(1);
}

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
const assets = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
      assets.push({ path: full.replaceAll('\\', '/'), bytes: fs.statSync(full).size });
    }
  }
}

walk(root);

const js = assets.filter((asset) => asset.path.endsWith('.js'));
const css = assets.filter((asset) => asset.path.endsWith('.css'));
const totalJs = js.reduce((sum, asset) => sum + asset.bytes, 0);
const totalCss = css.reduce((sum, asset) => sum + asset.bytes, 0);
const largestJs = js.reduce((largest, asset) => Math.max(largest, asset.bytes), 0);
const failures = [];

if (totalJs > budget.maxTotalJsBytes) {
  failures.push(`JS total: ${totalJs} > ${budget.maxTotalJsBytes} bytes`);
}
if (totalCss > budget.maxTotalCssBytes) {
  failures.push(`CSS total: ${totalCss} > ${budget.maxTotalCssBytes} bytes`);
}
if (largestJs > budget.maxSingleJsBytes) {
  failures.push(`JS individual: ${largestJs} > ${budget.maxSingleJsBytes} bytes`);
}

console.log(
  `PERFORMANCE · JS ${totalJs} B · CSS ${totalCss} B · JS máximo ${largestJs} B · ${assets.length} assets`,
);

if (failures.length) {
  console.error('PERFORMANCE BUDGET FALLÓ');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PERFORMANCE BUDGET OK');
