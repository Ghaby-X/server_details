'use strict';

// Minimal structured (JSON) logger to stdout - what the Docker awslogs
// driver ships to CloudWatch Logs.

function log(fields) {
    console.log(JSON.stringify({ time: new Date().toISOString(), ...fields }));
}

module.exports = { log };
