import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeResendSender } = require('../scripts/lib/resend-from.cjs');

const silent = () => {};

test('returns null for empty, null, undefined, or whitespace-only input', () => {
  assert.equal(normalizeResendSender(null, 'WorldMonitor', silent), null);
  assert.equal(normalizeResendSender(undefined, 'WorldMonitor', silent), null);
  assert.equal(normalizeResendSender('', 'WorldMonitor', silent), null);
  assert.equal(normalizeResendSender('   ', 'WorldMonitor', silent), null);
});

test('passes a properly wrapped sender through unchanged', () => {
  assert.equal(
    normalizeResendSender('WorldMonitor <alerts@meridian.app>', 'Default', silent),
    'WorldMonitor <alerts@meridian.app>',
  );
  assert.equal(
    normalizeResendSender('WorldMonitor Brief <brief@meridian.app>', 'Default', silent),
    'WorldMonitor Brief <brief@meridian.app>',
  );
});

test('trims surrounding whitespace before returning a wrapped sender', () => {
  assert.equal(
    normalizeResendSender('  WorldMonitor Brief <brief@meridian.app>  ', 'Default', silent),
    'WorldMonitor Brief <brief@meridian.app>',
  );
});

test('wraps a bare email address with the supplied default display name', () => {
  assert.equal(
    normalizeResendSender('brief@meridian.app', 'WorldMonitor Brief', silent),
    'WorldMonitor Brief <brief@meridian.app>',
  );
  assert.equal(
    normalizeResendSender('alerts@meridian.app', 'WorldMonitor Alerts', silent),
    'WorldMonitor Alerts <alerts@meridian.app>',
  );
});

test('emits exactly one warning when coercing a bare address', () => {
  const warnings = [];
  normalizeResendSender('brief@meridian.app', 'WorldMonitor Brief', (m) => warnings.push(m));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /lacks display name/);
  assert.match(warnings[0], /WorldMonitor Brief <brief@worldmonitor\.app>/);
});

test('does not warn when the value already has a display-name wrapper', () => {
  const warnings = [];
  normalizeResendSender(
    'WorldMonitor Brief <brief@meridian.app>',
    'Default',
    (m) => warnings.push(m),
  );
  assert.equal(warnings.length, 0);
});

test('defaults to console.warn when no warning sink is supplied', () => {
  const original = console.warn;
  const captured = [];
  console.warn = (m) => captured.push(m);
  try {
    normalizeResendSender('bare@example.com', 'Name');
    assert.equal(captured.length, 1);
    assert.match(captured[0], /lacks display name/);
  } finally {
    console.warn = original;
  }
});
