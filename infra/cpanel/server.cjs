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
// Leave PORT untouched. The generated Next.js server reads it, and Passenger
// manages its listener. No development port or second HTTP server is created.
process.chdir(app);
require(path.join(app, 'server.js'));
