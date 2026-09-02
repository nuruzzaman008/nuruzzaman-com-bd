/**
 * Starts the frontend together with the mock API in one process, so the site
 * can be previewed without the PHP stack running.
 *
 * When the real backend is available, point INTERNAL_API_URL at Laravel and run
 * `next start` directly instead; this exists for frontend-only work and demos.
 *
 * Usage: node apps/web/tools/preview.mjs [webPort] [apiPort]
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const webPort = process.argv[2] ?? '3200';
const apiPort = process.argv[3] ?? '8001';

const children = [];

/**
 * Both children are plain Node processes. Nothing goes through a shell: on
 * Windows that would either split the path to node.exe or be refused outright
 * for a .cmd shim.
 */
function run(scriptPath, args, env = {}) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

  children.push(child);

  child.on('exit', (code) => {
    if (code) {
      shutdown(code);
    }
  });

  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    child.kill();
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run(resolve(appDir, 'tools/mock-api.mjs'), [apiPort]);

/**
 * The app is built with `output: standalone`, which is what the Docker image
 * runs. Previewing the same server keeps this honest; `next start` only warns
 * and takes a different code path. The standalone bundle does not include
 * static assets, so they are copied in the way the Dockerfile does.
 */
const standaloneServer = resolve(appDir, '.next/standalone/apps/web/server.js');
const standaloneRoot = dirname(standaloneServer);

const webEnv = {
  INTERNAL_API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${webPort}`,
  NEXT_REVALIDATE_SECRET: 'preview-secret',
  PORT: webPort,
  HOSTNAME: '127.0.0.1',
};

if (existsSync(standaloneServer)) {
  cpSync(resolve(appDir, '.next/static'), resolve(standaloneRoot, '.next/static'), {
    recursive: true,
  });
  cpSync(resolve(appDir, 'public'), resolve(standaloneRoot, 'public'), { recursive: true });

  run(standaloneServer, [], webEnv);
} else {
  console.error('No standalone build found. Run `next build` first.');
  process.exit(1);
}
