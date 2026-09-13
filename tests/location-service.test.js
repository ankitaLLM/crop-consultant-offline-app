const test = require('node:test');
const assert = require('node:assert/strict');
const LocationService = require('../src/location/location-service.js');

class MockGeolocation {
  constructor() {
    this.currentPositionResult = null;
    this.currentPositionError = null;
    this.watchCallbacks = new Map();
    this.watchCounter = 1;
    this.clearedWatches = [];
  }

  getCurrentPosition(success, error, options) {
    if (this.currentPositionError) {
      error(this.currentPositionError);
    } else if (this.currentPositionResult) {
      success(this.currentPositionResult);
    }
  }

  watchPosition(success, error, options) {
    const id = this.watchCounter++;
    this.watchCallbacks.set(id, { success, error });
    return id;
  }

  clearWatch(id) {
    this.clearedWatches.push(id);
    this.watchCallbacks.delete(id);
  }

  emitWatch(position) {
    for (const { success } of this.watchCallbacks.values()) {
      success(position);
    }
  }

  emitWatchError(err) {
    for (const { error } of this.watchCallbacks.values()) {
      error(err);
    }
  }
}

test('LocationService: initial state is idle', () => {
  const service = new LocationService({ geolocationProvider: new MockGeolocation() });
  const state = service.getState();
  assert.equal(state.status, 'idle');
  assert.equal(state.location, null);
  assert.equal(state.isFollowing, false);
  service.destroy();
});

test('LocationService: getCurrentPosition success updates state to current', async () => {
  const mockGeo = new MockGeolocation();
  mockGeo.currentPositionResult = {
    coords: {
      latitude: 42.025,
      longitude: -93.658,
      accuracy: 12
    },
    timestamp: Date.now()
  };

  const service = new LocationService({ geolocationProvider: mockGeo });
  const loc = await service.getCurrentPosition();

  assert.equal(loc.latitude, 42.025);
  assert.equal(loc.longitude, -93.658);
  assert.equal(loc.accuracyM, 12);
  assert.equal(loc.source, 'device');

  const state = service.getState();
  assert.equal(state.status, 'current');
  assert.equal(state.isLowAccuracy, false);
  assert.equal(state.isStale, false);
  service.destroy();
});

test('LocationService: handles permission denied and timeouts', async () => {
  const mockGeo = new MockGeolocation();
  mockGeo.currentPositionError = { code: 1, message: 'User denied geolocation' };

  const service = new LocationService({ geolocationProvider: mockGeo });

  await assert.rejects(
    async () => service.getCurrentPosition(),
    (err) => {
      assert.equal(err.code, 'permission-denied');
      return true;
    }
  );

  assert.equal(service.getState().status, 'permission-denied');

  // Test timeout code
  mockGeo.currentPositionError = { code: 3, message: 'Timeout' };
  await assert.rejects(
    async () => service.getCurrentPosition(),
    (err) => {
      assert.equal(err.code, 'timeout');
      return true;
    }
  );
  assert.equal(service.getState().status, 'timeout');
  service.destroy();
});

test('LocationService: watchPosition, follow mode, pan suspension, and stopWatch', () => {
  const mockGeo = new MockGeolocation();
  const service = new LocationService({ geolocationProvider: mockGeo });

  service.startWatch();
  assert.equal(service.getState().isFollowing, true);
  assert.notEqual(service.watchId, null);

  // Emit position
  mockGeo.emitWatch({
    coords: { latitude: 42.1, longitude: -93.5, accuracy: 15 },
    timestamp: Date.now()
  });

  let state = service.getState();
  assert.equal(state.status, 'current');
  assert.equal(state.location.latitude, 42.1);
  assert.equal(state.isFollowing, true);

  // User manually pans map: suspends follow
  service.suspendFollow();
  state = service.getState();
  assert.equal(state.isFollowing, false);
  assert.equal(state.isSuspended, true);

  // Resume follow
  service.resumeFollow();
  state = service.getState();
  assert.equal(state.isFollowing, true);
  assert.equal(state.isSuspended, false);

  // Stop following releases watch
  service.stopWatch();
  assert.equal(mockGeo.clearedWatches.length, 1);
  assert.equal(service.getState().isFollowing, false);
  assert.equal(service.watchId, null);

  service.destroy();
});

test('LocationService: low accuracy indicator for fixes above threshold (>50m)', async () => {
  const mockGeo = new MockGeolocation();
  mockGeo.currentPositionResult = {
    coords: {
      latitude: 42.0,
      longitude: -93.0,
      accuracy: 85 // > 50m
    },
    timestamp: Date.now()
  };

  const service = new LocationService({ geolocationProvider: mockGeo });
  await service.getCurrentPosition();

  const state = service.getState();
  assert.equal(state.isLowAccuracy, true);
  assert.equal(state.accuracyM, 85);
  service.destroy();
});

test('LocationService: stale fix detection after threshold', () => {
  const mockGeo = new MockGeolocation();
  const service = new LocationService({
    geolocationProvider: mockGeo,
    options: { staleThresholdMs: 50 } // 50ms for test
  });

  service._handleSuccess({
    coords: { latitude: 42.0, longitude: -93.0, accuracy: 10 },
    timestamp: Date.now()
  });

  // Manually age the fix past the threshold
  service.lastFixTime = Date.now() - 100;

  const state = service.getState();
  assert.equal(state.isStale, true);
  assert.equal(state.status, 'stale');
  service.destroy();
});

test('LocationService: permission denial releases an active follow watch', () => {
  const mockGeo = new MockGeolocation();
  const service = new LocationService({ geolocationProvider: mockGeo });
  service.startWatch();
  mockGeo.emitWatchError({ code: 1, message: 'Denied' });

  const state = service.getState();
  assert.equal(state.status, 'permission-denied');
  assert.equal(state.isFollowing, false);
  assert.equal(service.watchId, null);
  assert.equal(mockGeo.clearedWatches.length, 1);
  service.destroy();
});
