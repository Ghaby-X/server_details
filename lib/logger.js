'use strict';

// Minimal structured (JSON) logger to stdout - what the Docker awslogs
// driver ships to CloudWatch Logs. Every line carries a `level`
// (info/warn/error) so CloudWatch Logs Insights can filter/query by
// severity, e.g. `filter level = "error"`.

const { trace, context } = require('@opentelemetry/api');

function write(level, fields) {
    const span = trace.getSpan(context.active());
    const spanContext = span && span.spanContext();

    console.log(JSON.stringify({
        time: new Date().toISOString(),
        level,
        ...(spanContext ? { traceId: spanContext.traceId, spanId: spanContext.spanId } : {}),
        ...fields
    }));
}

module.exports = {
    info: (fields) => write('info', fields),
    warn: (fields) => write('warn', fields),
    error: (fields) => write('error', fields)
};
