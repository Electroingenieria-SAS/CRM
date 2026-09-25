import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGitHubPages ? '/CRM' : '';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), geolocation=(self), microphone=()',
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
