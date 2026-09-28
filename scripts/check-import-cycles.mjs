import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const extensions = ['.ts', '.tsx', '.js', '.mjs'];
const graph = new Map();

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (extensions.includes(path.extname(entry.name))) result.push(full);
  }
  return result;
}

function resolveImport(fromFile, specifier) {
  let candidate;
  if (specifier.startsWith('@/')) candidate = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const attempts = [
    candidate,
    ...extensions.map((extension) => candidate + extension),
    ...extensions.map((extension) => path.join(candidate, 'index' + extension)),
  ];

  return attempts.find((attempt) => fs.existsSync(attempt) && fs.statSync(attempt).isFile()) ?? null;
}

for (const file of walk(sourceRoot)) {
  const text = fs.readFileSync(file, 'utf8');
  const imports = [...text.matchAll(/(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map((match) => resolveImport(file, match[1]))
    .filter(Boolean);
  graph.set(file, imports);
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const cycles = [];

function visit(node) {
  if (visiting.has(node)) {
    const start = stack.indexOf(node);
    cycles.push([...stack.slice(start), node]);
    return;
  }
  if (visited.has(node)) return;

  visiting.add(node);
  stack.push(node);
  for (const next of graph.get(node) ?? []) visit(next);
  stack.pop();
  visiting.delete(node);
  visited.add(node);
}

for (const node of graph.keys()) visit(node);

if (cycles.length) {
  console.error('IMPORT CYCLE CHECK FALLÓ');
  for (const cycle of cycles) {
    console.error(
      '- ' +
        cycle
          .map((file) => path.relative(process.cwd(), file).replaceAll('\\', '/'))
          .join(' -> '),
    );
  }
  process.exit(1);
}

console.log(`IMPORT CYCLE CHECK OK · ${graph.size} archivos revisados.`);
