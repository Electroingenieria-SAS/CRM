import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CRM Electroingeniería',
    short_name: 'CRM EI',
    description: 'CRM operativo de Electroingeniería S.A.S.',
    start_url: '/orders',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b5ed7',
    lang: 'es-CO',
    scope: '/',
    icons: [
      { src: '/icons/crm-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/crm-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
