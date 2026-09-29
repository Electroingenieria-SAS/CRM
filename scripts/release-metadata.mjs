import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const metadata = {
  version: pkg.version,
  commit: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'staging',
  generatedAt: new Date().toISOString(),
};
process.stdout.write(JSON.stringify(metadata, null, 2) + '\n');
