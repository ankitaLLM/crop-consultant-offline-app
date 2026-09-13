/**
 * TerraSync Geometry Utilities
 * Pure geometry algorithms with zero external dependencies.
 * Supports both browser globals and CommonJS/Node environments.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TerraSyncGeo = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EARTH_RADIUS_METERS = 6371000;

  /**
   * Validate a latitude/longitude pair.
   * Handles 0 as valid. Rejects null, undefined, NaN, infinity, and out-of-range values.
   * @param {number} lat - Latitude in degrees [-90, 90]
   * @param {number} lng - Longitude in degrees [-180, 180]
   * @returns {boolean}
   */
  function isValidCoordinate(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
  }

  /**
   * Convert internal [latitude, longitude] array to GeoJSON [longitude, latitude] pair.
   * @param {[number, number]} latLng - [latitude, longitude]
   * @returns {[number, number]} [longitude, latitude]
   */
  function latLngToGeoJSON(latLng) {
    if (!Array.isArray(latLng) || latLng.length < 2) {
      throw new Error('Invalid coordinate: expected array with at least 2 elements [lat, lng]');
    }
    const [lat, lng] = latLng;
    if (!isValidCoordinate(lat, lng)) {
      throw new Error(`Invalid coordinate values: lat=${lat}, lng=${lng}`);
    }
    return [lng, lat];
  }

  /**
   * Convert GeoJSON [longitude, latitude] pair to internal [latitude, longitude] array.
   * @param {[number, number]} geoJsonCoord - [longitude, latitude]
   * @returns {[number, number]} [latitude, longitude]
   */
  function geoJSONToLatLng(geoJsonCoord) {
    if (!Array.isArray(geoJsonCoord) || geoJsonCoord.length < 2) {
      throw new Error('Invalid GeoJSON coordinate: expected array [lng, lat]');
    }
    const [lng, lat] = geoJsonCoord;
    if (!isValidCoordinate(lat, lng)) {
      throw new Error(`Invalid coordinate values: lat=${lat}, lng=${lng}`);
    }
    return [lat, lng];
  }

  /**
   * Convert internal polygon ring [[lat, lng], ...] to GeoJSON Polygon geometry.
   * GeoJSON polygon coordinates are an array of linear rings (first ring is exterior),
   * where each coordinate is [lng, lat] and the ring must be closed (first == last).
   * @param {Array<[number, number]>} ring - Array of [lat, lng]
   * @returns {object} GeoJSON Polygon geometry object
   */
  function polygonToGeoJSON(ring) {
    if (!Array.isArray(ring) || ring.length < 3) {
      throw new Error('Polygon must contain at least 3 vertices');
    }
    const geoJsonRing = ring.map(latLngToGeoJSON);
    // Ensure ring is closed
    const first = geoJsonRing[0];
    const last = geoJsonRing[geoJsonRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      geoJsonRing.push([first[0], first[1]]);
    }
    return {
      type: 'Polygon',
      coordinates: [geoJsonRing]
    };
  }

  /**
   * Convert GeoJSON Polygon geometry to internal polygon ring [[lat, lng], ...].
   * Strips the closing duplicate vertex if present.
   * @param {object} geoJsonPolygon - GeoJSON Polygon geometry
   * @returns {Array<[number, number]>} Array of [lat, lng]
   */
  function geoJSONToPolygon(geoJsonPolygon) {
    if (!geoJsonPolygon || geoJsonPolygon.type !== 'Polygon' || !Array.isArray(geoJsonPolygon.coordinates)) {
      throw new Error('Invalid GeoJSON Polygon object');
    }
    const exteriorRing = geoJsonPolygon.coordinates[0];
    if (!Array.isArray(exteriorRing) || exteriorRing.length < 4) {
      throw new Error('GeoJSON Polygon exterior ring must contain at least 4 positions (closed)');
    }
    const ring = exteriorRing.map(geoJSONToLatLng);
    // Remove closing coordinate if identical to first
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      ring.pop();
    }
    return ring;
  }

  /**
   * Calculate straight-line distance between two coordinates in meters using the Haversine formula.
   * @param {number} lat1 - Point 1 latitude
   * @param {number} lon1 - Point 1 longitude
   * @param {number} lat2 - Point 2 latitude
   * @param {number} lon2 - Point 2 longitude
   * @returns {number} Distance in meters
   */
  function haversineDistance(lat1, lon1, lat2, lon2) {
    if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
      throw new Error('Invalid coordinates supplied to haversineDistance');
    }

    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  /**
   * Calculate geographic centroid (arithmetic mean of vertices) of a polygon ring.
   * @param {Array<[number, number]>} polygon - Array of [lat, lng]
   * @returns {[number, number]} [centroidLat, centroidLng]
   */
  function calculateCentroid(polygon) {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      throw new Error('Cannot calculate centroid of empty polygon');
    }

    let sumLat = 0;
    let sumLng = 0;
    let count = 0;

    for (let i = 0; i < polygon.length; i++) {
      const [lat, lng] = polygon[i];
      if (isValidCoordinate(lat, lng)) {
        sumLat += lat;
        sumLng += lng;
        count++;
      }
    }

    if (count === 0) {
      throw new Error('Polygon has no valid coordinates');
    }

    return [sumLat / count, sumLng / count];
  }

  /**
   * Test if a point [lat, lng] is inside a polygon ring using the ray-casting algorithm.
   * @param {[number, number]} point - [lat, lng]
   * @param {Array<[number, number]>} polygon - Array of [lat, lng] vertices
   * @returns {boolean} True if point is strictly inside or on boundary
   */
  function isPointInPolygon(point, polygon) {
    if (!Array.isArray(point) || point.length < 2) return false;
    const [pLat, pLng] = point;
    if (!isValidCoordinate(pLat, pLng)) return false;
    if (!Array.isArray(polygon) || polygon.length < 3) return false;

    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [latI, lngI] = polygon[i];
      const [latJ, lngJ] = polygon[j];

      // Ray-casting along longitude axis
      const intersect =
        ((latI > pLat) !== (latJ > pLat)) &&
        (pLng < ((lngJ - lngI) * (pLat - latI)) / (latJ - latI) + lngI);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Format straight-line distance in a human-friendly format.
   * Clearly specifies straight-line measurement, never driving distance.
   * @param {number} meters - Distance in meters
   * @returns {string} Formatted distance string
   */
  function formatStraightLineDistance(meters) {
    if (!Number.isFinite(meters) || meters < 0) return 'Distance unknown';
    if (meters < 1000) {
      return `${Math.round(meters)} m straight-line`;
    }
    const km = (meters / 1000).toFixed(1);
    const miles = (meters / 1609.344).toFixed(1);
    return `${km} km (${miles} mi) straight-line`;
  }

  /**
   * Compute bounding box for an array of [lat, lng] coordinates.
   * @param {Array<[number, number]>} coords - Coordinates
   * @returns {{ south: number, west: number, north: number, east: number }}
   */
  function getBoundingBox(coords) {
    if (!Array.isArray(coords) || coords.length === 0) {
      throw new Error('Cannot calculate bounding box of empty coordinates');
    }

    let south = Infinity;
    let west = Infinity;
    let north = -Infinity;
    let east = -Infinity;

    for (const [lat, lng] of coords) {
      if (!isValidCoordinate(lat, lng)) continue;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
    }

    return { south, west, north, east };
  }

  return {
    isValidCoordinate,
    latLngToGeoJSON,
    geoJSONToLatLng,
    polygonToGeoJSON,
    geoJSONToPolygon,
    haversineDistance,
    calculateCentroid,
    isPointInPolygon,
    formatStraightLineDistance,
    getBoundingBox
  };
}));
