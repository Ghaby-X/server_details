'use strict';

// Minimal zero-dependency Prometheus metrics collector.
//
// Exposes a counter (http_requests_total), a histogram
// (http_request_duration_seconds) and two process gauges, rendered in the
// Prometheus text exposition format at GET /metrics.

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// key `${method}|${route}|${status}` -> count
const requestCounts = new Map();

// key `${method}|${route}` -> { buckets: Map(le -> cumulative count), sum, count }
const durationHistograms = new Map();

function recordRequest(method, route, statusCode, durationSeconds) {
    const status = String(statusCode);

    const countKey = `${method}|${route}|${status}`;
    requestCounts.set(countKey, (requestCounts.get(countKey) || 0) + 1);

    const histKey = `${method}|${route}`;
    let hist = durationHistograms.get(histKey);
    if (!hist) {
        hist = { buckets: new Map(DURATION_BUCKETS.map((b) => [b, 0])), sum: 0, count: 0 };
        durationHistograms.set(histKey, hist);
    }
    hist.sum += durationSeconds;
    hist.count += 1;
    for (const bucket of DURATION_BUCKETS) {
        if (durationSeconds <= bucket) {
            hist.buckets.set(bucket, hist.buckets.get(bucket) + 1);
        }
    }
}

function renderMetrics() {
    const lines = [];

    lines.push('# HELP http_requests_total Total number of HTTP requests received.');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, count] of requestCounts) {
        const [method, route, status] = key.split('|');
        lines.push(`http_requests_total{method="${method}",route="${route}",status_code="${status}"} ${count}`);
    }

    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds.');
    lines.push('# TYPE http_request_duration_seconds histogram');
    for (const [key, hist] of durationHistograms) {
        const [method, route] = key.split('|');
        for (const bucket of DURATION_BUCKETS) {
            lines.push(
                `http_request_duration_seconds_bucket{method="${method}",route="${route}",le="${bucket}"} ${hist.buckets.get(bucket)}`
            );
        }
        lines.push(`http_request_duration_seconds_bucket{method="${method}",route="${route}",le="+Inf"} ${hist.count}`);
        lines.push(`http_request_duration_seconds_sum{method="${method}",route="${route}"} ${hist.sum.toFixed(6)}`);
        lines.push(`http_request_duration_seconds_count{method="${method}",route="${route}"} ${hist.count}`);
    }

    lines.push('# HELP process_uptime_seconds Time since the Node.js process started, in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${process.uptime().toFixed(3)}`);

    lines.push('# HELP process_resident_memory_bytes Resident memory size of the process, in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${process.memoryUsage().rss}`);

    return lines.join('\n') + '\n';
}

// Normalizes a request path to a low-cardinality route label so metrics
// don't explode per unique static asset path.
function normalizeRoute(pathname) {
    if (pathname === '/api/config' || pathname === '/api/server-info' || pathname === '/api/fail' || pathname === '/metrics') {
        return pathname;
    }
    if (pathname === '/') return '/';
    return 'static';
}

module.exports = { recordRequest, renderMetrics, normalizeRoute };
