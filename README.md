# lab-dom07-server-details

A zero-dependency Node.js server reporting real-time host system metrics (hostname, CPU, memory, uptime), built, tested, containerized, and deployed to an EC2 host by a Jenkins pipeline

## Features

- **Real server system information** - hostname, OS platform, CPU model & core count, load average, RAM utilization, uptime.
- **REST APIs**:
  - `GET /api/server-info` - live host telemetry.
  - `GET /api/config` - runtime config the frontend dashboard polls for.
  - `GET /api/fail` - always returns `500`; exists to generate error traffic for the error-rate dashboard/alert (see [lab-dom08-monitoring](../lab-dom08-monitoring)).
  - `GET /metrics` - Prometheus text-format exposition (`http_requests_total` counter, `http_request_duration_seconds` histogram, process gauges).
  - `GET /` - the dashboard itself (static HTML/CSS/JS).

## Structure

```
lab-dom07-server-details/
├── server.js              HTTP server + routes (http, os, fs - no npm dependencies)
├── lib/
│   ├── format.js          Pure formatting helpers (formatMemory, formatUptime) - unit tested in isolation
│   └── metrics.js         Zero-dependency Prometheus collector backing GET /metrics
├── test/
│   ├── format.test.js     Unit tests for lib/format.js
│   └── server.test.js     Integration tests - boots the real server on an ephemeral port, hits every route
├── public/                 Static dashboard (index.html, css, js)
├── Dockerfile               node:22-alpine, non-root user, HEALTHCHECK
├── .env.example
├── Jenkinsfile               Checkout → Install/Build → Test → Docker Build → Push → Deploy → Verify → Cleanup
└── package.json
```

## Running locally

```bash
npm install          # no-op today - the app has zero runtime dependencies
npm test              # node --test - runs test/format.test.js and test/server.test.js
node server.js        # http://localhost:3000
```

Or with Docker:

```bash
docker build -t server-details-site:latest .
docker run -d --name server-details-app -p 3000:3000 server-details-site:latest
curl http://localhost:3000/api/server-info
```

## Tests

`test/format.test.js` unit-tests the pure formatting helpers directly (memory/uptime formatting, including edge cases like exact-day durations and zero-value units).

`test/server.test.js` boots the actual `server.js` HTTP server on an ephemeral port, then exercises every route with real HTTP requests (`fetch`) - status codes, JSON shape, and the 404 path for unknown static files. Both suites run on Node's built-in test runner (`node --test`) - no Jest/Mocha in devDependencies.

```bash
npm test
```

## CI/CD pipeline (Jenkins)

The `Jenkinsfile` at the repo root defines the pipeline. Point a Jenkins Pipeline job's "Pipeline script from SCM" at this repo and it runs as-is.

### Stages

| Stage | What it does |
|---|---|
| Checkout | Clones this repo at the built commit |
| Install & Build | `npm install` directly on the Jenkins host |
| Test | `node --test`, JUnit results published via the `junit` step |
| Docker Build | `docker build`, tagged `:$BUILD_NUMBER` and `:latest` |
| Push Image | Logs in with the `registry_creds` credential, pushes both tags to Docker Hub |
| Deploy | SSHes to the EC2 deploy target with the `ec2_ssh` credential, pulls the new image, replaces the running container |
| Verify | Curls `/api/server-info` on the deploy target to confirm the app came up |
| Cleanup | Prunes images/containers older than 24h on the deploy target, and dangling images on the Jenkins host |

### How deploy works

The Deploy stage SSHes into the EC2 deploy target as `ec2-user` (via the `ec2_ssh` credential and the `sshagent` step) and runs, on the remote host:

```bash
docker pull $IMAGE_NAME:$IMAGE_TAG
docker stop server-details-app || true
docker rm server-details-app || true
docker run -d --name server-details-app --restart unless-stopped -p 3000:3000 $IMAGE_NAME:$IMAGE_TAG
```

The deploy target only needs Docker installed and reachable over SSH from the Jenkins host. `--restart unless-stopped` keeps the container running across a host reboot.

### Jenkins setup

**Plugins** (Manage Jenkins → Plugins): Pipeline, Git, Credentials Binding, Docker Pipeline, SSH Agent.

**Credentials** (Manage Jenkins → Credentials):

| ID | Type | Contents |
|---|---|---|
| `git_credentials` | Username with password / SSH key | Only needed if this repo is private |
| `registry_creds` | Username with password | Docker Hub username + access token |
| `ec2_ssh` | SSH Username with private key | The private key for the deploy target's `ec2-user` |

**Global properties** (Manage Jenkins → System → Environment variables) - set once, applied to every build:

- `DEPLOY_HOST` - public IP/DNS of the EC2 deploy target.
- `IMAGE_NAME` - your Docker Hub repo, e.g. `ghaby/lab-dom07-server-details`.

These aren't build parameters - the Jenkinsfile has no `parameters` block. Jenkins injects Global properties as real environment variables into every build automatically, so they're just used directly as `$DEPLOY_HOST` / `$IMAGE_NAME`. Change either one by updating it here; no need to touch the Jenkinsfile or re-enter values per build.

**Requirements on each host:**
- Jenkins host: Node.js and Docker installed, `jenkins` user in the `docker` group (build/test run directly; push/deploy shell out to `docker`).
- Deploy target: Docker installed, reachable over SSH from the Jenkins host as `ec2-user` on port 22, and the app port (3000) reachable from wherever you're verifying it from.

### Verifying a run

After a successful build: `http://<deploy_public_ip>:3000/` should show the dashboard, and `/api/server-info` should return live JSON.
