import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

import shared from '@nuruzzaman/eslint-config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...shared,
  {
    // The browser API client is the one place that must read a cookie, and the
    // download button builds an object URL, so the shared restrictions there
    // would only produce noise.
    files: ['src/lib/api/browser.ts', 'src/features/account/download-button.tsx'],
    rules: { 'no-restricted-globals': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'tools/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
