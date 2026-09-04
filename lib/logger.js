'use strict';

// Minimal structured (JSON) logger to stdout - what the Docker awslogs
// driver ships to CloudWatch Logs.

const { trace, context } = require('@opentelemetry/api');

function log(fields) {
    const span = trace.getSpan(context.active());
    const spanContext = span && span.spanContext();

    console.log(JSON.stringify({
        time: new Date().toISOString(),
        ...(spanContext ? { traceId: spanContext.traceId, spanId: spanContext.spanId } : {}),
        ...fields
    }));
}

module.exports = { log };
