import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGitHubPages ? '/CRM' : '';

function configuredSupabaseConnectSources(): string[] {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return [];

  try {
    const url = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return [];

    const sources = [url.origin];
    const realtimeProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    sources.push(`${realtimeProtocol}//${url.host}`);
    return sources;
  } catch {
    return [];
  }
}

const connectSources = [
  "'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  ...configuredSupabaseConnectSources(),
];

function configuredSupabaseConnectSources(): string[] {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) return [];

  try {
    const url = new URL(rawUrl);
    const sources = [url.origin];

    if (url.protocol === 'http:') sources.push(`ws://${url.host}`);
    if (url.protocol === 'https:') sources.push(`wss://${url.host}`);

    return sources;
  } catch {
    return [];
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src ${connectSources.join(' ')}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(self)',
  },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: isGitHubPages ? 'export' : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: isGitHubPages,
  images: { unoptimized: isGitHubPages },
  async headers() {
    if (isGitHubPages) return [];
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default config;
