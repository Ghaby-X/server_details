const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { formatMemory, formatUptime } = require('./lib/format');

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

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // API: Frontend Runtime Configuration
    if (pathname === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
            refreshIntervalMs: REFRESH_INTERVAL_MS
        }));
    }

    // API: Live Real-Time Server System Metrics
    if (pathname === '/api/server-info') {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

        const cpus = os.cpus();
        const loadAvg = os.loadavg();

        const clientIp = req.headers['x-forwarded-for']
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.socket.remoteAddress || '127.0.0.1';

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
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
        }));
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
