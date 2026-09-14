const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../src/drafts.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const { parseBackupPayload } = sandbox.window.TerraSyncDrafts;

test('Backup: accepts a version 1 TerraSync export', () => {
  const payload = parseBackupPayload(JSON.stringify({
    format: 'terrasync-local-backup', version: 1, drafts: [], observations: []
  }));
  assert.equal(payload.version, 1);
});

test('Backup: rejects unrelated or incomplete JSON files', () => {
  assert.throws(() => parseBackupPayload('{"format":"other"}'), /Choose a TerraSync backup/);
  assert.throws(() => parseBackupPayload('{oops'), /not a valid TerraSync JSON backup/);
});

