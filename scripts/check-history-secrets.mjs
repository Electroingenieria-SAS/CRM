import { execFileSync } from 'node:child_process';

let history = '';
try {
  history = execFileSync(
    'git',
    [
      'log',
      '-p',
      '--all',
      '--full-history',
      '--no-ext-diff',
      '--no-textconv',
      '--format=commit:%H',
    ],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  );
} catch (error) {
  console.error('HISTORY SECRET CHECK FALLÓ · no fue posible leer el historial Git.');
  console.error(String(error));
  process.exit(1);
}

const findings = [];
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['supabase-secret', new RegExp('sb_' + 'secret_[A-Za-z0-9_-]{20,}', 'g')],
  [
    'service-role-jwt',
    new RegExp('service_' + 'role\\s*[:=]\\s*["\'\`]?(eyJ[A-Za-z0-9_.-]+)', 'gi'),
  ],
  ['github-token', new RegExp('gh' + '[pousr]_[A-Za-z0-9]{30,}', 'g')],
  ['google-api-key', new RegExp('AI' + 'za[0-9A-Za-z_-]{35}', 'g')],
  ['aws-access-key', new RegExp('AK' + 'IA[0-9A-Z]{16}', 'g')],
];

for (const [name, pattern] of patterns) {
  pattern.lastIndex = 0;
  if (pattern.test(history)) findings.push(name);
}

if (findings.length) {
  console.error(`HISTORY SECRET CHECK FALLÓ · patrones detectados: ${findings.join(', ')}`);
  console.error(
    'Los valores no se imprimen. Si fueran reales, deben rotarse antes de reescribir historia.',
  );
  process.exit(1);
}

console.log('HISTORY SECRET CHECK OK · historial completo sin patrones privados conocidos.');
