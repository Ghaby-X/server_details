document.addEventListener('DOMContentLoaded', async () => {
    fetchServerInfo();

    // Auto refresh live system metrics at the server-configured interval
    const refreshIntervalMs = await fetchRefreshInterval();
    setInterval(fetchServerInfo, refreshIntervalMs);

    // Footer year
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
});

async function fetchRefreshInterval() {
    const fallbackMs = 3000;
    try {
        const res = await fetch('/api/config');
        if (!res.ok) return fallbackMs;
        const data = await res.json();
        return Number(data.refreshIntervalMs) || fallbackMs;
    } catch (err) {
        console.error('Failed to fetch refresh interval, using default:', err);
        return fallbackMs;
    }
}

async function fetchServerInfo() {
    try {
        const res = await fetch('/api/server-info');
        if (!res.ok) return;
        const data = await res.json();

        // Host / Domain (from request header or host)
        const hostDomain = window.location.host || data.hostname;
        document.getElementById('val-domain').textContent = hostDomain;
        document.getElementById('val-hostname').textContent = data.hostname;
        document.getElementById('val-platform').textContent = data.platform;
        document.getElementById('val-cpu').textContent = `${data.cpuCores} Cores (${data.cpuModel})`;
        document.getElementById('val-cpuload').textContent = data.cpuLoadAvg;
        document.getElementById('val-memory').textContent = `${data.usedMemory} / ${data.totalMemory} (${data.memoryUsagePercent})`;
        document.getElementById('val-uptime').textContent = data.uptime;
        document.getElementById('val-node').textContent = data.nodeVersion;

        // Header Port Badge
        const portBadge = document.getElementById('port-badge');
        if (portBadge) portBadge.textContent = `Port: ${data.listeningPort}`;
    } catch (err) {
        console.error('Failed to fetch server info:', err);
    }
}
