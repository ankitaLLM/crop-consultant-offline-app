/*
 * Builds the small Ames-area offline street map bundled with TerraSync.
 * Source: U.S. Census Bureau TIGER/Line transportation vectors (public domain).
 * This intentionally downloads vector features—not Google Maps or OSM tiles.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const bounds = { south: 42.003, west: -93.674, north: 42.043, east: -93.623 };
const service = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer';
const layers = [
  { id: 2, kind: 'road', className: 'primary' },
  { id: 6, kind: 'road', className: 'secondary' },
  { id: 8, kind: 'road', className: 'local' },
  { id: 9, kind: 'railway', className: 'railway' }
];

async function getLayer({ id, kind, className }) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'NAME,MTFCC',
    outSR: '4326',
    returnGeometry: 'true',
    f: 'geojson'
  });
  const response = await fetch(`${service}/${id}/query?${params}`);
  if (!response.ok) throw new Error(`TIGERweb layer ${id} returned ${response.status}`);
  const collection = await response.json();
  if (collection.error) throw new Error(collection.error.message || `TIGERweb layer ${id} failed`);
  return (collection.features || []).map(feature => ({
    type: 'Feature',
    properties: {
      kind,
      class: className,
      ...(feature.properties?.NAME && feature.properties.NAME !== 'Null' ? { name: feature.properties.NAME } : {}),
      ...(feature.properties?.MTFCC ? { code: feature.properties.MTFCC } : {})
    },
    geometry: feature.geometry
  }));
}

async function main() {
  const features = (await Promise.all(layers.map(getLayer))).flat();
  if (!features.length) throw new Error('No transportation features were returned for the demo area.');
  const collection = {
    type: 'FeatureCollection',
    name: 'TerraSync Ames offline street map',
    attribution: 'Road data: U.S. Census Bureau TIGER/Line',
    bounds,
    generatedAt: new Date().toISOString(),
    features
  };
  const target = path.resolve(__dirname, '..', 'assets', 'ames-offline-basemap.geojson');
  fs.writeFileSync(target, JSON.stringify(collection));
  process.stdout.write(`Wrote ${features.length} vector features to ${target}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
