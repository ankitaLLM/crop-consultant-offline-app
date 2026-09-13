const test = require('node:test');
const assert = require('node:assert/strict');
const Geo = require('../src/geo/geometry.js');

test('Geometry: isValidCoordinate handles valid and invalid coordinates', () => {
  assert.equal(Geo.isValidCoordinate(0, 0), true);
  assert.equal(Geo.isValidCoordinate(42.025, -93.658), true);
  assert.equal(Geo.isValidCoordinate(-90, -180), true);
  assert.equal(Geo.isValidCoordinate(90, 180), true);

  assert.equal(Geo.isValidCoordinate(90.1, 0), false);
  assert.equal(Geo.isValidCoordinate(-90.1, 0), false);
  assert.equal(Geo.isValidCoordinate(0, 180.1), false);
  assert.equal(Geo.isValidCoordinate(0, -180.1), false);
  assert.equal(Geo.isValidCoordinate(NaN, 0), false);
  assert.equal(Geo.isValidCoordinate(0, Infinity), false);
  assert.equal(Geo.isValidCoordinate(null, 0), false);
  assert.equal(Geo.isValidCoordinate(undefined, 0), false);
  assert.equal(Geo.isValidCoordinate('42', '-93'), false);
});

test('Geometry: coordinate order conversion between [lat, lng] and GeoJSON [lng, lat]', () => {
  const latLng = [42.025, -93.658];
  const geoJsonCoord = Geo.latLngToGeoJSON(latLng);
  assert.deepEqual(geoJsonCoord, [-93.658, 42.025]);

  const convertedBack = Geo.geoJSONToLatLng(geoJsonCoord);
  assert.deepEqual(convertedBack, latLng);

  // Throws on invalid
  assert.throws(() => Geo.latLngToGeoJSON([100, 200]));
  assert.throws(() => Geo.geoJSONToLatLng([200, 100]));
});

test('Geometry: polygonToGeoJSON and geoJSONToPolygon', () => {
  const ring = [
    [42.0250, -93.6580],
    [42.0290, -93.6580],
    [42.0290, -93.6520],
    [42.0250, -93.6520]
  ];

  const geoJson = Geo.polygonToGeoJSON(ring);
  assert.equal(geoJson.type, 'Polygon');
  assert.equal(geoJson.coordinates.length, 1);
  // Must be closed ring (length 5)
  assert.equal(geoJson.coordinates[0].length, 5);
  assert.deepEqual(geoJson.coordinates[0][0], [-93.6580, 42.0250]);
  assert.deepEqual(geoJson.coordinates[0][4], [-93.6580, 42.0250]);

  const restored = Geo.geoJSONToPolygon(geoJson);
  assert.deepEqual(restored, ring);
});

test('Geometry: haversineDistance calculates accurate distance', () => {
  // Ames IA coords: ~445 meters between two nearby points
  const p1 = [42.0250, -93.6580];
  const p2 = [42.0290, -93.6580]; // ~0.004 degrees latitude difference = ~444.8m
  const dist = Geo.haversineDistance(p1[0], p1[1], p2[0], p2[1]);
  assert.ok(Math.abs(dist - 444.8) < 2);

  // Same point is 0
  assert.equal(Geo.haversineDistance(42, -93, 42, -93), 0);
});

test('Geometry: calculateCentroid returns arithmetic mean of polygon vertices', () => {
  const ring = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0]
  ];
  const centroid = Geo.calculateCentroid(ring);
  assert.deepEqual(centroid, [5, 5]);
});

test('Geometry: isPointInPolygon ray-casting works accurately', () => {
  const ring = [
    [42.0250, -93.6580],
    [42.0290, -93.6580],
    [42.0290, -93.6520],
    [42.0250, -93.6520]
  ];

  // Inside point
  assert.equal(Geo.isPointInPolygon([42.0270, -93.6550], ring), true);

  // Outside points
  assert.equal(Geo.isPointInPolygon([42.0300, -93.6550], ring), false); // north
  assert.equal(Geo.isPointInPolygon([42.0200, -93.6550], ring), false); // south
  assert.equal(Geo.isPointInPolygon([42.0270, -93.6600], ring), false); // west
  assert.equal(Geo.isPointInPolygon([42.0270, -93.6500], ring), false); // east

  // Invalid point
  assert.equal(Geo.isPointInPolygon([NaN, 0], ring), false);
});

test('Geometry: formatStraightLineDistance labels clearly as straight-line', () => {
  assert.equal(Geo.formatStraightLineDistance(250), '250 m straight-line');
  assert.equal(Geo.formatStraightLineDistance(1500), '1.5 km (0.9 mi) straight-line');
  assert.equal(Geo.formatStraightLineDistance(-5), 'Distance unknown');
});

test('Geometry: getBoundingBox returns correct bounds', () => {
  const ring = [
    [42.0250, -93.6580],
    [42.0290, -93.6520]
  ];
  const bbox = Geo.getBoundingBox(ring);
  assert.deepEqual(bbox, {
    south: 42.0250,
    west: -93.6580,
    north: 42.0290,
    east: -93.6520
  });
});
