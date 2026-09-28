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
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/).length;

  if (lines > 800) failures.push(`${normalized}: ${lines} líneas (>800)`);
  else if (lines > 300) warnings.push(`${normalized}: ${lines} líneas; revisar responsabilidad`);

  if (
    normalized.startsWith('src/modules/') &&
    (/from ['"]@supabase\//.test(source) ||
      /from ['"]@\/infrastructure\//.test(source) ||
      /from ['"]@\/composition\//.test(source))
  ) {
    failures.push(
      `${normalized}: un módulo de dominio/aplicación no puede depender de Supabase, infraestructura ni composición`,
    );
  }

  if (normalized.startsWith('src/app/') && /from ['"]@\/infrastructure\//.test(source)) {
    failures.push(`${normalized}: la capa app no debe depender directamente de infraestructura`);
  }

  if (
    normalized.startsWith('src/infrastructure/') &&
    (/from ['"]@\/app\//.test(source) || /from ['"]@\/composition\//.test(source))
  ) {
    failures.push(
      `${normalized}: infraestructura no puede depender de app ni del composition root`,
    );
  }

  if (normalized.startsWith('src/composition/') && /from ['"]@\/app\//.test(source)) {
    failures.push(`${normalized}: el composition root no puede depender de la UI/app`);
  }
}

for (const warning of warnings) console.warn(`ARCH WARNING · ${warning}`);
if (failures.length) {
  console.error('ARCHITECTURE CHECK FALLÓ');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ARCHITECTURE CHECK OK · ${files.length} archivos revisados.`);
