'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const server = require('../server');

let baseUrl;

test.before(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

test('GET /api/server-info returns host telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/server-info`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.hostname, 'string');
    assert.equal(typeof body.cpuCores, 'number');
    assert.ok(body.memoryUsagePercent.endsWith('%'));
});

test('GET /api/config returns the configured refresh interval', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    const body = await res.json();
    assert.equal(typeof body.refreshIntervalMs, 'number');
});

test('GET / serves the static index page', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
});

test('GET /nope returns 404 for unknown static paths', async () => {
    const res = await fetch(`${baseUrl}/nope`);
    assert.equal(res.status, 404);
});
