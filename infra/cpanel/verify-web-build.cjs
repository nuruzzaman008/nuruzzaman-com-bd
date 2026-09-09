const fs = require('node:fs');
const path = require('node:path');
const [root, proxy, commit] = process.argv.slice(2);
try {
  const origin = new URL(proxy);
  if (origin.protocol !== 'https:' || origin.origin !== proxy) throw new Error('NB_API_PROXY must be an HTTPS origin without a trailing slash.');
  const next = path.join(root, 'apps/web/.next');
  for (const file of ['standalone/apps/web/server.js', 'BUILD_ID', 'routes-manifest.json', 'nb-commit']) {
    if (!fs.statSync(path.join(next, file)).isFile()) throw new Error(`Missing ${file}`);
  }
  for (const dir of ['static', 'standalone/node_modules']) {
    if (!fs.statSync(path.join(next, dir)).isDirectory()) throw new Error(`Missing ${dir}`);
  }
  if (fs.readFileSync(path.join(next, 'nb-commit'), 'utf8').trim() !== commit) throw new Error('Build commit differs from deployment commit.');
  const manifest = JSON.parse(fs.readFileSync(path.join(next, 'routes-manifest.json'), 'utf8'));
  const rewrites = Array.isArray(manifest.rewrites) ? manifest.rewrites : Object.values(manifest.rewrites || {}).flat();
  for (const prefix of ['/api', '/sanctum']) {
    if (!rewrites.some(r => r.source === `${prefix}/:path*` && r.destination === `${proxy}${prefix}/:path*`)) throw new Error(`Missing or incorrect ${prefix} proxy`);
  }
  console.log('Standalone artifact, commit and both proxy targets verified.');
} catch (error) { console.error(`Build verification failed: ${error.message}`); process.exit(1); }
