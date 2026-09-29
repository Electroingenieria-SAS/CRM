import fs from 'node:fs';

const nextConfig = fs.readFileSync('next.config.ts', 'utf8');
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const requiredHeaders = [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'X-Frame-Options',
  'X-Robots-Tag',
];
const failures = requiredHeaders.filter((header) => !nextConfig.includes(header));

if (!/noindex/i.test(nextConfig)) failures.push('private CRM must emit noindex');
if (!serviceWorker.includes("request.mode === 'navigate'")) {
  failures.push('service worker must handle navigation separately');
}
if (!serviceWorker.includes("url.pathname.startsWith('/_next/static/')")) {
  failures.push('service worker static cache allowlist missing');
}
if (/cache\.put\([^)]*(?:orders|finance|inventory|auth|rest|functions)/i.test(serviceWorker)) {
  failures.push('service worker appears to cache a sensitive application path');
}

if (failures.length) {
  for (const failure of failures) console.error(`RELEASE SECURITY FALLÓ · ${failure}`);
  process.exit(1);
}
console.log('RELEASE SECURITY OK · headers, noindex and static-only PWA policy validated.');
