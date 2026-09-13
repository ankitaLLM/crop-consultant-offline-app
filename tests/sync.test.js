const test = require('node:test');
const assert = require('node:assert/strict');
const { TerraSyncSyncHelpers } = require('../src/sync.js');

test('newer remote records replace older local records', () => {
  const local = { id: 'one', updatedAt: '2026-09-13T10:00:00.000Z' };
  assert.equal(TerraSyncSyncHelpers.chooseNewest(local, {}, '2026-09-13T10:01:00.000Z'), 'remote');
});

test('newer local records are uploaded instead of overwritten', () => {
  const local = { id: 'one', updatedAt: '2026-09-13T10:02:00.000Z' };
  assert.equal(TerraSyncSyncHelpers.chooseNewest(local, {}, '2026-09-13T10:01:00.000Z'), 'local');
});

test('cloud rows are owned by the signed-in user and preserve stable IDs', () => {
  const row = TerraSyncSyncHelpers.cloudRow('user-123', 'draft', {
    id: 'draft-456', updatedAt: '2026-09-13T10:00:00.000Z', notes: 'Scout again'
  });
  assert.equal(row.user_id, 'user-123');
  assert.equal(row.entity_id, 'draft-456');
  assert.equal(row.payload.cloudOwnerId, 'user-123');
  assert.equal(row.payload.syncStatus, 'synced');
});
