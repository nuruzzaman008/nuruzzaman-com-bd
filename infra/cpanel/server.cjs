// Deployed as ~/nuruzzaman-web/server.js. Next.js owns the HTTP listener.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const current = path.join(__dirname, 'current');
if (!fs.existsSync(current)) {
  throw new Error('Next.js release missing: deploy the standalone build before restarting Passenger.');
}
const root = fs.realpathSync(current);
const app = path.join(root, 'apps/web');
for (const entry of ['server.js', '.next/BUILD_ID', '.next/static', 'public']) {
  if (!fs.existsSync(path.join(app, entry))) {
    throw new Error(`Incomplete Next.js release: missing ${entry}. Run the repository deployment script.`);
  }
}
process.env.NODE_ENV = 'production';

/*
 * Passenger starts the app with a bare environment, so anything the server
 * components read at runtime has to be supplied here. INTERNAL_API_URL is the
 * one that matters: without it the API client falls back to localhost:8000 and
 * every server-rendered page that talks to Laravel fails with ECONNREFUSED.
 *
 * The symptom is deceptive. Statically prerendered pages keep working, because
 * their data was fetched at build time, so the site looks healthy while every
 * dynamic route - /en among them - returns 500.
 *
 * Values come from runtime.env.json, which the deployment writes from
 * ~/.nb-deploy.conf. They are host settings, not repository settings, which is
 * why they are read rather than hard-coded. A value already present in the
 * environment always wins, so the cPanel UI's own variables still override.
 */
const runtimeEnv = path.join(__dirname, 'runtime.env.json');
if (fs.existsSync(runtimeEnv)) {
  const values = JSON.parse(fs.readFileSync(runtimeEnv, 'utf8'));

  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined && typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

if (!process.env.INTERNAL_API_URL) {
  throw new Error(
    'INTERNAL_API_URL is not set. Add it to runtime.env.json (the deployment '
      + 'writes it from ~/.nb-deploy.conf) or to the cPanel app environment; '
      + 'without it every server-rendered page that calls the API will fail.',
  );
}

// Leave PORT untouched. The generated Next.js server reads it, and Passenger
// manages its listener. No development port or second HTTP server is created.
process.chdir(app);
require(path.join(app, 'server.js'));
