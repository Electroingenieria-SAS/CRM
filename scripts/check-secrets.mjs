import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !file.endsWith('package-lock.json'));

const failures = [];
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['supabase-secret', new RegExp('sb_' + 'secret_[A-Za-z0-9_-]{16,}')],
  ['service-role-jwt', new RegExp('service_' + 'role\\s*[:=]\\s*["\'\`]?eyJ', 'i')],
  ['github-token', new RegExp('gh' + '[pousr]_[A-Za-z0-9]{30,}')],
  ['google-api-key', new RegExp('AI' + 'za[0-9A-Za-z_-]{35}')],
  ['aws-access-key', new RegExp('AK' + 'IA[0-9A-Z]{16}')],
];

for (const file of tracked) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) continue;
  const text = buffer.toString('utf8');

  for (const [name, pattern] of patterns) {
    if (pattern.test(text)) failures.push(`${file}: patrón ${name}`);
  }

  if (file.startsWith('src/') && /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE_KEY)/.test(text)) {
    failures.push(`${file}: variable privada expuesta con prefijo NEXT_PUBLIC_`);
  }
}

const forbiddenEnv = tracked.filter((file) => /^\.env(?:\.|$)/.test(file) && file !== '.env.example');
for (const file of forbiddenEnv) failures.push(`${file}: entorno real versionado`);

if (failures.length) {
  console.error('SECRET CHECK FALLÓ');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SECRET CHECK OK · ${tracked.length} archivos versionados revisados.`);
