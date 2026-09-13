const test = require('node:test');
const assert = require('node:assert/strict');
const MapAdapter = require('../src/maps/map-adapter.js');
const MapController = require('../src/maps/map-controller.js');

class MockAdapter extends MapAdapter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.mounted = false;
    this.fields = [];
    this.selectedFieldId = null;
    this.observations = [];
    this.location = null;
    this.track = [];
    this.followLocation = false;
    this.visualizationLayer = null;

    this.fieldSelectedCb = null;
    this.clickCb = null;
    this.pannedCb = null;
  }

  async mount(container) {
    this.mounted = true;
    this.container = container;
  }

  setFields(fields) { this.fields = fields; }
  setSelectedField(id) { this.selectedFieldId = id; }
  setObservations(obs) { this.observations = obs; }
  setLocation(loc) { this.location = loc; }
  setTrack(tr) { this.track = tr; }
  fitToField(id) { this.fittedFieldId = id; }
  setFollowLocation(f) { this.followLocation = f; }
  setVisualizationLayer(layer) { this.visualizationLayer = layer; }
  onFieldSelected(cb) { this.fieldSelectedCb = cb; }
  onMapClick(cb) { this.clickCb = cb; }
  onMapPanned(cb) { this.pannedCb = cb; }
  destroy() { this.mounted = false; }
}

class MockGoogleAdapter extends MockAdapter {}
class MockOfflineAdapter extends MockAdapter {}

test('MapAdapter: cannot be instantiated directly', () => {
  assert.throws(() => new MapAdapter(), TypeError);
});

test('MapController: mounts offline adapter when no Google API key is configured', async () => {
  const container = { id: 'map' };
  const controller = new MapController({
    googleMapsApiKey: '',
    GoogleMapAdapterClass: MockGoogleAdapter,
    OfflineFieldAdapterClass: MockOfflineAdapter
  });

  const type = await controller.init(container);
  assert.equal(type, 'offline');
  assert.equal(controller.getActiveAdapterType(), 'offline');
  assert.ok(controller.activeAdapter instanceof MockOfflineAdapter);
  assert.equal(controller.activeAdapter.mounted, true);
  controller.destroy();
});

test('MapController: mounts google adapter when API key is provided and online', async () => {
  const container = { id: 'map' };
  const controller = new MapController({
    googleMapsApiKey: 'TEST_KEY_123',
    GoogleMapAdapterClass: MockGoogleAdapter,
    OfflineFieldAdapterClass: MockOfflineAdapter
  });

  const type = await controller.init(container);
  assert.equal(type, 'google');
  assert.equal(controller.getActiveAdapterType(), 'google');
  assert.ok(controller.activeAdapter instanceof MockGoogleAdapter);
  controller.destroy();
});

test('MapController: falls back to offline adapter if Google adapter fails to mount', async () => {
  class FailingGoogleAdapter extends MockAdapter {
    async mount() {
      throw new Error('Google Maps script blocked or network unavailable');
    }
  }

  const container = { id: 'map' };
  const controller = new MapController({
    googleMapsApiKey: 'TEST_KEY_123',
    GoogleMapAdapterClass: FailingGoogleAdapter,
    OfflineFieldAdapterClass: MockOfflineAdapter
  });

  const type = await controller.init(container);
  assert.equal(type, 'offline');
  assert.ok(controller.activeAdapter instanceof MockOfflineAdapter);
  assert.equal(controller.activeAdapter.mounted, true);
  controller.destroy();
});

test('MapController: state preservation when switching adapters', async () => {
  const container = { id: 'map' };
  const controller = new MapController({
    googleMapsApiKey: 'TEST_KEY_123',
    GoogleMapAdapterClass: MockGoogleAdapter,
    OfflineFieldAdapterClass: MockOfflineAdapter
  });

  await controller.init(container);
  assert.equal(controller.getActiveAdapterType(), 'google');

  // Populate state on Google adapter
  const mockFields = [{ id: 'f1', name: 'North Field' }];
  const mockObs = [{ id: 1, issue: 'Aphids' }];
  const mockLoc = { latitude: 42.02, longitude: -93.65, accuracyM: 10 };
  const mockTrack = [[42.02, -93.65], [42.03, -93.65]];

  controller.setFields(mockFields);
  controller.setSelectedField('f1');
  controller.setObservations(mockObs);
  controller.setLocation(mockLoc);
  controller.setTrack(mockTrack);
  controller.setFollowLocation(true);

  let adapterChangedCount = 0;
  controller.onAdapterChanged((type) => {
    adapterChangedCount++;
    assert.equal(type, 'offline');
  });

  // Switch to offline adapter
  await controller.switchAdapter('offline');

  assert.equal(controller.getActiveAdapterType(), 'offline');
  assert.ok(controller.activeAdapter instanceof MockOfflineAdapter);
  assert.equal(adapterChangedCount, 1);

  // Verify all state was restored onto the new offline adapter
  assert.deepEqual(controller.activeAdapter.fields, mockFields);
  assert.equal(controller.activeAdapter.selectedFieldId, 'f1');
  assert.deepEqual(controller.activeAdapter.observations, mockObs);
  assert.deepEqual(controller.activeAdapter.location, mockLoc);
  assert.deepEqual(controller.activeAdapter.track, mockTrack);
  assert.equal(controller.activeAdapter.followLocation, true);

  controller.destroy();
});

test('MapController: forwards events (fieldSelected, mapClick, mapPanned)', async () => {
  const container = { id: 'map' };
  const controller = new MapController({
    googleMapsApiKey: '',
    GoogleMapAdapterClass: MockGoogleAdapter,
    OfflineFieldAdapterClass: MockOfflineAdapter
  });

  await controller.init(container);

  let selectedField = null;
  let clickedCoords = null;
  let panned = false;

  controller.onFieldSelected((id) => { selectedField = id; });
  controller.onMapClick((coords) => { clickedCoords = coords; });
  controller.onMapPanned(() => { panned = true; });

  // Simulate events on active adapter
  controller.activeAdapter.fieldSelectedCb('field-123');
  assert.equal(selectedField, 'field-123');
  assert.equal(controller.selectedFieldId, 'field-123');

  controller.activeAdapter.clickCb({ lat: 42.5, lng: -93.5 });
  assert.deepEqual(clickedCoords, { lat: 42.5, lng: -93.5 });

  controller.activeAdapter.pannedCb();
  assert.equal(panned, true);

  controller.destroy();
});

test('MapController: connectivity override switches adapters and preserves layer state', async () => {
  const controller = new MapController({
    googleMapsApiKey: 'TEST_KEY_123',
    isOnline: true,
    GoogleMapAdapterClass: MockGoogleAdapter,
    OfflineFieldAdapterClass: MockOfflineAdapter
  });
  await controller.init({ id: 'map' });
  controller.setVisualizationLayer('ndvi');

  await controller.setConnectivityState(false);
  assert.equal(controller.getActiveAdapterType(), 'offline');
  assert.equal(controller.activeAdapter.visualizationLayer, 'ndvi');

  await controller.setConnectivityState(true);
  assert.equal(controller.getActiveAdapterType(), 'google');
  assert.equal(controller.activeAdapter.visualizationLayer, 'ndvi');
  controller.destroy();
});
