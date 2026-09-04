'use strict';

// Shared tracer for manual spans around specific pieces of work, nested
// under whatever span auto-instrumentation already started for the
// incoming HTTP request.

const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('server_details-app');

module.exports = { tracer };
