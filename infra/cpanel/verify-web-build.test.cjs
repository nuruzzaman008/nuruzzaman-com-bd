const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const proxy = 'https://api.nuruzzaman.com.bd';
test('artifact validation rejects broken proxies, mismatched commits and incomplete builds', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-deploy-test-'));
  const next = path.join(root, 'apps/web/.next');
  try {
    for (const dir of ['standalone/apps/web', 'standalone/node_modules', 'static']) fs.mkdirSync(path.join(next, dir), {recursive:true});
    for (const file of ['standalone/apps/web/server.js', 'BUILD_ID', 'nb-commit']) fs.writeFileSync(path.join(next, file), 'commit123');
    const routes = ['/api','/sanctum'].map(p => ({source:`${p}/:path*`,destination:`${proxy}${p}/:path*`}));
    const manifest = path.join(next, 'routes-manifest.json');
    const run = (origin=proxy, commit='commit123') => spawnSync(process.execPath, [path.join(__dirname,'verify-web-build.cjs'), root, origin, commit], {encoding:'utf8'});
    fs.writeFileSync(manifest, JSON.stringify({rewrites:routes}));
    assert.equal(run().status, 0);
    fs.writeFileSync(manifest, JSON.stringify({rewrites:{beforeFiles:[],afterFiles:routes,fallback:[]}}));
    assert.equal(run().status, 0);
    assert.equal(run(proxy, 'different').status, 1);
    assert.equal(run(proxy+'/').status, 1);
    fs.writeFileSync(manifest, JSON.stringify({rewrites:[routes[1]]}));
    assert.equal(run().status, 1);
    fs.writeFileSync(manifest, JSON.stringify({rewrites:routes.map(r=>({...r,destination:'https://wrong.example/api/:path*'}))}));
    assert.equal(run().status, 1);
    fs.unlinkSync(manifest);
    assert.equal(run().status, 1);
  } finally {
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'nb-deploy-test-')));
    fs.rmSync(root,{recursive:true});
  }
});
