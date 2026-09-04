'use strict';

// OpenTelemetry SDK bootstrap. Loaded via `node --require ./tracing.js
// server.js` so that auto-instrumentation can patch Node's `http` module
// before server.js ever touches it.

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');

const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'server_details-app';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development'
    }),
    traceExporter: new OTLPTraceExporter({
        url: `${OTLP_ENDPOINT}/v1/traces`
    }),
    instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

// Flush pending spans on shutdown so short-lived runs (e.g. tests, or a
// container being stopped) don't lose whatever hasn't been exported yet.
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        sdk.shutdown().finally(() => process.exit(0));
    });
}

module.exports = sdk;
