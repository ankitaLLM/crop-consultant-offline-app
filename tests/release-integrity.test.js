const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Release integrity: every local page asset exists', () => {
  const html = read('index.html');
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => match[1])
    .filter(value => !/^(?:https?:|#|mailto:|tel:)/.test(value))
    .map(value => value.split('?')[0]);
  for (const reference of references) {
    assert.equal(fs.existsSync(path.join(root, reference)), true, `Missing page asset: ${reference}`);
  }
});

test('Release integrity: service-worker core entries exist', () => {
  const worker = read('sw.js');
  const entries = [...worker.matchAll(/'\.\/([^']+)'/g)]
    .map(match => match[1].split('?')[0])
    .filter(Boolean);
  for (const entry of entries) {
    assert.equal(fs.existsSync(path.join(root, entry)), true, `Missing service-worker asset: ${entry}`);
  }
});

test('Release integrity: removed map-download controls are not referenced', () => {
  const app = read('src/app.js');
  for (const staleId of ['downloadMapBtn', 'downloadProgressBar', 'downloadProgressFill', 'downloadStatusText']) {
    assert.equal(app.includes(staleId), false, `Stale removed control referenced: ${staleId}`);
  }
});

test('Release integrity: privacy and terms links are public pages', () => {
  const html = read('index.html');
  assert.match(html, /href="terms\.html"/);
  assert.match(html, /href="privacy\.html"/);
});
