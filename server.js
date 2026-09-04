const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { formatMemory, formatUptime } = require('./lib/format');
const { recordRequest, renderMetrics, normalizeRoute } = require('./lib/metrics');
const { log } = require('./lib/logger');
const { tracer } = require('./lib/tracer');

// Configurable Environment Variables with sensible fallbacks
const PORT = process.env.PORT || 3000;
const HOSTNAME = process.env.HOST_NAME || os.hostname();
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL_MS, 10) || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

// Gathers live OS/process stats into the /api/server-info response body.
function collectServerInfo(req) {
    return tracer.startActiveSpan('collect-server-info', (span) => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

        const cpus = os.cpus();
        const loadAvg = os.loadavg();

        const clientIp = req.headers['x-forwarded-for']
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.socket.remoteAddress || '127.0.0.1';

        const info = {
            hostname: HOSTNAME,
            platform: `${os.type()} ${os.release()} (${os.arch()})`,
            uptime: formatUptime(os.uptime()),
            uptimeSeconds: Math.floor(os.uptime()),
            cpuModel: cpus.length > 0 ? cpus[0].model.trim() : 'Generic CPU',
            cpuCores: cpus.length,
            cpuLoadAvg: `${loadAvg[0].toFixed(2)}, ${loadAvg[1].toFixed(2)}, ${loadAvg[2].toFixed(2)}`,
            totalMemory: formatMemory(totalMem),
            freeMemory: formatMemory(freeMem),
            usedMemory: formatMemory(usedMem),
            memoryUsagePercent: `${memUsagePercent}%`,
            nodeVersion: process.version,
            listeningPort: PORT,
            clientIp: clientIp,
            serverTime: new Date().toISOString()
        };

        span.end();
        return info;
    });
}

const server = http.createServer((req, res) => {
    const requestStart = process.hrtime.bigint();
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const route = normalizeRoute(pathname);

    res.on('finish', () => {
        const durationSeconds = Number(process.hrtime.bigint() - requestStart) / 1e9;
        recordRequest(req.method, route, res.statusCode, durationSeconds);

        // Access log to stdout
        log({
            method: req.method,
            path: pathname,
            route,
            status: res.statusCode,
            durationMs: Math.round(durationSeconds * 1000),
            clientIp: req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(',')[0].trim()
                : req.socket.remoteAddress || null
        });
    });

    // Observability: Prometheus scrape endpoint
    if (pathname === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
        return res.end(renderMetrics());
    }

    // Diagnostics: on-demand 500, for exercising error-rate dashboards/alerts
    if (pathname === '/api/fail') {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'Simulated failure for error-rate testing' }));
    }

    // Diagnostics: on-demand artificial latency, for exercising the latency alert
    if (pathname === '/api/slow') {
        const delayMs = 400;
        return setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                message: `Simulated slow response after ${delayMs}ms`,
                serverInfo: collectServerInfo(req)
            }));
        }, delayMs);
    }

    // API: Frontend Runtime Configuration
    if (pathname === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
            refreshIntervalMs: REFRESH_INTERVAL_MS
        }));
    }

    // API: Live Real-Time Server System Metrics
    if (pathname === '/api/server-info') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(collectServerInfo(req)));
    }

    // Serve Static Frontend Assets
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') safePath = '/index.html';

    const filePath = path.join(__dirname, 'public', safePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

module.exports = server;

// Only auto-listen when run directly (`node server.js`)
if (require.main === module) {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server details app listening on http://0.0.0.0:${PORT}`);
    });
}
