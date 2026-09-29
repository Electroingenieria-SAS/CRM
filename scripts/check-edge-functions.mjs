import fs from 'node:fs';
import path from 'node:path';

const functionsRoot = path.resolve('supabase/functions');
const config = fs.readFileSync('supabase/config.toml', 'utf8');
const failures = [];

if (fs.existsSync(functionsRoot)) {
  for (const entry of fs.readdirSync(functionsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const sourcePath = path.join(functionsRoot, entry.name, 'index.ts');
    if (!fs.existsSync(sourcePath)) continue;
    const source = fs.readFileSync(sourcePath, 'utf8');

    if (/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/.test(source)) {
      failures.push(`${entry.name}: wildcard CORS is forbidden`);
    }
    if (/npm:@supabase\/supabase-js@(latest|\^|~)/.test(source)) {
      failures.push(`${entry.name}: Supabase client must use an exact pinned version`);
    }
    const section = new RegExp(
      `\\[functions\\.${entry.name.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')}\\][\\s\\S]*?(?=\\n\\[|$)`,
    ).exec(config)?.[0];
    if (!section || !/verify_jwt\s*=\s*true/.test(section)) {
      failures.push(`${entry.name}: config.toml must require verify_jwt=true`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`EDGE SECURITY FALLÓ · ${failure}`);
  process.exit(1);
}
console.log('EDGE SECURITY OK · JWT, CORS and dependency pinning validated.');
