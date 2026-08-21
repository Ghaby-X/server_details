'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { formatMemory, formatUptime } = require('../lib/format');

test('formatMemory converts bytes to GB with 2 decimal places', () => {
    assert.equal(formatMemory(1024 * 1024 * 1024), '1.00 GB');
    assert.equal(formatMemory(0), '0.00 GB');
    assert.equal(formatMemory(1.5 * 1024 * 1024 * 1024), '1.50 GB');
});

test('formatUptime formats seconds-only durations', () => {
    assert.equal(formatUptime(0), '0s');
    assert.equal(formatUptime(45), '45s');
});

test('formatUptime formats minutes and seconds', () => {
    assert.equal(formatUptime(125), '2m 5s');
});

test('formatUptime formats hours, minutes, and seconds', () => {
    assert.equal(formatUptime(3725), '1h 2m 5s');
});

test('formatUptime formats days, hours, minutes, and seconds', () => {
    assert.equal(formatUptime(90061), '1d 1h 1m 1s');
});

test('formatUptime omits zero-value larger units', () => {
    // exactly 2 days and 3 seconds - no hours or minutes component
    assert.equal(formatUptime(2 * 86400 + 3), '2d 3s');
});
