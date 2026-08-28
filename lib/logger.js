'use strict';

// Minimal structured (JSON) logger to stdout - what the Docker awslogs
// driver ships to CloudWatch Logs. Kept deliberately tiny, consistent with
// the app's zero-runtime-dependency constraint: one shape in, one line out,
// no buffering, no levels/transports to configure.

function log(fields) {
    console.log(JSON.stringify({ time: new Date().toISOString(), ...fields }));
}

module.exports = { log };
