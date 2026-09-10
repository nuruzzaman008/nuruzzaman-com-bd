const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Passenger launcher rejects missing builds and preserves the host port', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-passenger-'));
  try {
    fs.copyFileSync(path.join(__dirname, 'server.cjs'), path.join(fixture, 'server.js'));
    const run = () => spawnSync(process.execPath, [path.join(fixture, 'server.js')], { encoding: 'utf8', env: { ...process.env, PORT: '41237' } });
    let result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release missing/);
    const app = path.join(fixture, 'current/apps/web');
    fs.mkdirSync(app, { recursive: true });
    fs.writeFileSync(path.join(app, 'server.js'), 'console.log(JSON.stringify({port:process.env.PORT,mode:process.env.NODE_ENV,cwd:process.cwd()}))');
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /BUILD_ID/);
    for (const dir of ['.next/static', 'public']) fs.mkdirSync(path.join(app, dir), { recursive: true });
    fs.writeFileSync(path.join(app, '.next/BUILD_ID'), 'test-build');
    result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { port: '41237', mode: 'production', cwd: fs.realpathSync(app) });
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
