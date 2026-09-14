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

test('Release integrity: manual offline map and data restore controls are wired', () => {
  const html = read('index.html');
  const app = read('src/app.js');
  const drafts = read('src/drafts.js');
  assert.match(html, /id="downloadOfflineMapBtn"/);
  assert.match(html, /id="importBackupInput"/);
  assert.match(app, /downloadOfflineMapPack/);
  assert.match(drafts, /importBackupFile/);
  assert.doesNotMatch(html, /id="googleApiKeyInput"/);
});

test('Release integrity: privacy and terms links are public pages', () => {
  const html = read('index.html');
  assert.match(html, /href="terms\.html"/);
  assert.match(html, /href="privacy\.html"/);
});

test('Release integrity: cloud sync assets and secure schema are present', () => {
  const html = read('index.html');
  const schema = read('supabase/schema.sql');
  assert.match(html, /src="src\/sync\.js\?v=11"/);
  assert.match(html, /id="cloudAuthBtn"/);
  assert.match(html, /id="cloudGoogleSignInBtn"/);
  assert.doesNotMatch(html, /id="cloudPasswordInput"/);
  assert.doesNotMatch(html, /id="supabaseKeyInput"/);
  assert.doesNotMatch(html, /id="supabaseUrlInput"/);
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /auth\.uid\(\)/);
  assert.doesNotMatch(read('src/config.js'), /service_role/i);
});
