import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);
