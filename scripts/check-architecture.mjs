import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'tests'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css']);
const failures = [];
const warnings = [];
const files = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(full);
  }
}

for (const root of roots) walk(root);

for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).length;

  if (lines > 800) failures.push(`${normalized}: ${lines} líneas (>800)`);
  else if (lines > 300) warnings.push(`${normalized}: ${lines} líneas; revisar responsabilidad`);

  if (normalized.startsWith('src/modules/') && /from ['"]@supabase\//.test(text)) {
    failures.push(`${normalized}: un módulo no puede importar Supabase directamente`);
  }

  if (normalized.startsWith('src/app/') && /from ['"]@\/infrastructure\//.test(text)) {
    failures.push(`${normalized}: la capa app no debe depender directamente de infraestructura`);
  }
}

for (const warning of warnings) console.warn(`ARCH WARNING · ${warning}`);
if (failures.length) {
  console.error('ARCHITECTURE CHECK FALLÓ');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ARCHITECTURE CHECK OK · ${files.length} archivos revisados.`);
