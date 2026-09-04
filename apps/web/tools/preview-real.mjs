// Serves the standalone production build against an already-running API.
// The mock API in tools/preview.mjs stays for offline work; this one points at
// the real Laravel server started by infra/scripts/dev-api.sh.
import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webPort = process.argv[2] ?? '3200';
const apiPort = process.argv[3] ?? '8001';

const standaloneRoot = resolve(appDir, '.next/standalone/apps/web');
const server = resolve(standaloneRoot, 'server.js');

if (!existsSync(server)) {
  console.error('No standalone build found. Run `next build` first.');
  process.exit(1);
}

cpSync(resolve(appDir, '.next/static'), resolve(standaloneRoot, '.next/static'), {
  recursive: true,
});
cpSync(resolve(appDir, 'public'), resolve(standaloneRoot, 'public'), { recursive: true });

// No shell: process.execPath contains a space on Windows and a shell would
// split it into two arguments.
const child = spawn(process.execPath, [server], {
  cwd: appDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: webPort,
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    INTERNAL_API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
    NEXT_PUBLIC_SITE_URL: `http://localhost:${webPort}`,
    // Stands in for Nginx: /api and /sanctum are proxied to Laravel so the
    // browser sees a single origin. Without it the session cookie is not sent
    // and every write fails the CSRF check with a 419.
    NB_API_PROXY: `http://127.0.0.1:${apiPort}`,
  },
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
