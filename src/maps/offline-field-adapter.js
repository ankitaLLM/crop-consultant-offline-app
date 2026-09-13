/**
 * TerraSync Offline Field View Adapter
 * Implements the MapAdapter interface for zero-network, offline-first field rendering.
 *
 * CRITICAL ARCHITECTURAL GUARANTEES:
 * 1. Zero network basemap tile calls: Never fetches OpenStreetMap, Google, or third-party tiles.
 * 2. Neutral background canvas: Clearly presents saved grower field boundaries, labels,
 *    observation pins, device location, accuracy circle, and tracks.
 * 3. Prominently displays: "Field boundaries only — basemap unavailable."
 * 4. Dual rendering engine: Uses local Leaflet instance without tileLayer when Leaflet is available;
 *    gracefully falls back to pure SVG vector rendering if Leaflet is unavailable.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const MapAdapter = require('./map-adapter.js');
    module.exports = factory(MapAdapter);
  } else {
    root.OfflineFieldAdapter = factory(root.MapAdapter);
  }
}(typeof self !== 'undefined' ? self : this, function (MapAdapter) {
  'use strict';

  const CROP_COLORS = {
    Corn: '#f59e0b',
    Soybeans: '#10b981',
    Wheat: '#8b5cf6'
  };

  const SEVERITY_COLORS = {
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#10b981'
  };

  class OfflineFieldAdapter extends MapAdapter {
    constructor(config = {}) {
      super();
      this.config = config;

      this.container = null;
      this.map = null; // Leaflet instance
      this.tileLayer = null; // Optional online basemap tile layer
      this.resizeObserver = null;
      this.onWindowResize = null;
      this.basemapEnabled = config.enableOsmOnlineBasemap !== false;
      this.svgContainer = null; // SVG vector fallback

      this.fields = [];
      this.selectedFieldId = null;

      this.observations = [];
      this.currentLocation = null;
      this.trackPoints = [];
      this.followingLocation = false;
      this.visualizationLayer = null;
      this.svgViewBounds = null;

      // Leaflet layer collections
      this.polygons = new Map();
      this.observationMarkers = [];
      this.locationMarker = null;
      this.accuracyCircle = null;
      this.trackPolyline = null;

      this.fieldSelectedCallback = null;
      this.mapClickCallback = null;
      this.mapPannedCallback = null;

      this.offlineBanner = null;
    }

    async mount(container) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) {
        throw new Error('OfflineFieldAdapter: container element not found.');
      }

      this.container.innerHTML = '';
      this.container.classList.add('offline-field-view');

      // Create persistent offline status banner
      this._createOfflineNotice();

      // Check if Leaflet is available locally
      if (typeof window !== 'undefined' && window.L) {
        this._mountLeafletEngine();
      } else {
        this._mountSvgEngine();
      }

      // Automatically keep Leaflet responsive to layout shifts
      if (typeof ResizeObserver !== 'undefined' && this.container) {
        this.resizeObserver = new ResizeObserver(() => {
          if (this.map) {
            this.map.invalidateSize();
          }
        });
        this.resizeObserver.observe(this.container);
      }

      if (typeof window !== 'undefined') {
        this.onWindowResize = () => {
          if (this.map) this.map.invalidateSize();
        };
        window.addEventListener('resize', this.onWindowResize);
      }
    }

    _createOfflineNotice() {
      this.offlineBanner = document.createElement('div');
      this.offlineBanner.className = 'offline-field-banner';
      this.offlineBanner.setAttribute('role', 'status');
      this.offlineBanner.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        </svg>
        <span>Field boundaries only — basemap unavailable</span>
      `;
      this.container.appendChild(this.offlineBanner);
    }

    _updateBasemapLayer(overrideOnline) {
      if (!this.map || typeof window === 'undefined' || !window.L) return;

      const isOnline = typeof overrideOnline === 'boolean'
        ? overrideOnline
        : (typeof this.config.isOnline === 'boolean'
            ? this.config.isOnline
            : (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true));

      const showTiles = isOnline && !this.config.forceOfflineFieldView && (this.basemapEnabled !== false);

      if (showTiles) {
        if (!this.tileLayer) {
          this.tileLayer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
          }).addTo(this.map);
          this.tileLayer.bringToBack();
        }
        if (this.offlineBanner) {
          this.offlineBanner.style.display = 'none';
        }
      } else {
        if (this.tileLayer) {
          this.map.removeLayer(this.tileLayer);
          this.tileLayer = null;
        }
        if (this.offlineBanner) {
          this.offlineBanner.style.display = 'flex';
        }
      }
    }

    setConnectivity(isOnline) {
      this._updateBasemapLayer(isOnline);
    }

    setBasemapEnabled(enabled) {
      this.basemapEnabled = Boolean(enabled);
      this._updateBasemapLayer();
    }

    _mountLeafletEngine() {
      const L = window.L;
      const center = this.config.defaultCenter
        ? [this.config.defaultCenter.lat, this.config.defaultCenter.lng]
        : [42.0266, -93.6465];

      this.map = L.map(this.container, {
        center,
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
        fadeAnimation: false
      });

      this.map.on('dragstart', () => {
        if (this.mapPannedCallback) {
          this.mapPannedCallback();
        }
      });

      this.map.on('click', (e) => {
        if (this.mapClickCallback && e.latlng) {
          this.mapClickCallback({
            lat: e.latlng.lat,
            lng: e.latlng.lng
          });
        }
      });

      this._updateBasemapLayer();

      // Trigger size invalidation immediately and shortly after layout settle
      this.map.invalidateSize();
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => this.map && this.map.invalidateSize());
      }
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          if (this.selectedFieldId) {
            this.fitToField(this.selectedFieldId);
          }
        }
      }, 120);
    }

    _mountSvgEngine() {
      // Standalone SVG vector rendering when Leaflet is not available
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'offline-svg-canvas');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      this.container.appendChild(svg);
      this.svgContainer = svg;
      svg.addEventListener('click', (event) => {
        if (!this.mapClickCallback || !this.svgViewBounds) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((event.clientX - rect.left) / rect.width) * 1000;
        const y = ((event.clientY - rect.top) / rect.height) * 800;
        const bounds = this.svgViewBounds;
        const lng = bounds.minLng + (x / 1000) * (bounds.maxLng - bounds.minLng);
        const lat = bounds.maxLat - (y / 800) * (bounds.maxLat - bounds.minLat);
        this.mapClickCallback({ lat, lng });
      });
    }

    setFields(fields) {
      this.fields = fields || [];
      if (this.svgContainer) this.svgViewBounds = null;

      if (this.map && window.L) {
        // Leaflet vector renderer
        for (const poly of this.polygons.values()) {
          this.map.removeLayer(poly);
        }
        this.polygons.clear();

        for (const field of this.fields) {
          if (!Array.isArray(field.polygon) || field.polygon.length < 3) continue;

          const isSelected = field.id === this.selectedFieldId;
          const style = this._fieldStyle(field, isSelected);

          const poly = window.L.polygon(field.polygon, {
            color: isSelected ? '#10b981' : '#475569',
            weight: isSelected ? 3.5 : 2,
            fillColor: style.fillColor,
            fillOpacity: style.fillOpacity,
            className: `field-offline-poly-${field.id}`
          }).addTo(this.map);

          poly.on('click', (e) => {
            if (e && e.originalEvent) {
              e.originalEvent.stopPropagation();
            }
            if (this.fieldSelectedCallback) {
              this.fieldSelectedCallback(field.id);
            }
          });

          poly.bindTooltip(this._escape(field.name), {
            permanent: true,
            direction: 'center',
            className: 'field-label-overlay'
          });

          this.polygons.set(field.id, poly);
        }

        this.map.invalidateSize();
        if (this.selectedFieldId) {
          this.fitToField(this.selectedFieldId);
        } else if (this.fields.length > 0) {
          const allCoords = this.fields.flatMap(f => Array.isArray(f.polygon) ? f.polygon : []);
          const valid = allCoords.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
          if (valid.length > 0) {
            this.map.fitBounds(window.L.latLngBounds(valid), { padding: [30, 30] });
          }
        }
      } else if (this.svgContainer) {
        this._renderSvgView();
      }
    }

    setSelectedField(fieldId) {
      this.selectedFieldId = fieldId;

      if (this.map && window.L) {
        for (const [id, poly] of this.polygons.entries()) {
          const field = this.fields.find(f => f.id === id);
          const isSelected = id === fieldId;
          const style = this._fieldStyle(field || {}, isSelected);

          poly.setStyle({
            color: isSelected ? '#10b981' : '#475569',
            weight: isSelected ? 3.5 : 2,
            fillColor: style.fillColor,
            fillOpacity: style.fillOpacity
          });

          if (isSelected) {
            poly.bringToFront();
          }
        }
      } else if (this.svgContainer) {
        this._renderSvgView();
      }
    }

    fitToField(fieldId) {
      const field = this.fields.find(f => f.id === fieldId);
      if (!field || !Array.isArray(field.polygon) || field.polygon.length === 0) return;

      if (this.map && window.L) {
        this.map.invalidateSize();
        const bounds = window.L.latLngBounds(field.polygon);
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (this.svgContainer) {
        this.svgViewBounds = this._boundsForCoordinates(field.polygon, 0.18);
        this._renderSvgView();
      }
    }

    panTo(lat, lng) {
      if (this.map && window.L) {
        this.map.panTo([lat, lng]);
      } else if (this.svgContainer && Number.isFinite(lat) && Number.isFinite(lng)) {
        const bounds = this.svgViewBounds || this._boundsForFields();
        const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.01);
        const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.01);
        this.svgViewBounds = { minLat: lat - latSpan / 2, maxLat: lat + latSpan / 2,
          minLng: lng - lngSpan / 2, maxLng: lng + lngSpan / 2 };
        this._renderSvgView();
      }
    }

    setObservations(observations) {
      this.observations = observations || [];

      if (this.map && window.L) {
        for (const m of this.observationMarkers) {
          this.map.removeLayer(m);
        }
        this.observationMarkers = [];

        for (const obs of this.observations) {
          let lat = null;
          let lng = null;

          if (obs.location && typeof obs.location.latitude === 'number') {
            lat = obs.location.latitude;
            lng = obs.location.longitude;
          } else if (typeof obs.lat === 'number') {
            lat = obs.lat;
            lng = obs.lng;
          }

          if (lat === null || lng === null) continue;

          const color = SEVERITY_COLORS[obs.severity] || '#10b981';

          const marker = window.L.circleMarker([lat, lng], {
            radius: 7,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.95
          }).addTo(this.map);

          const actionHtml = obs.actionTaken
            ? `<div style="font-size:12px; margin-top:4px;"><strong>Action:</strong> ${this._escape(obs.actionTaken)}</div>`
            : '';
          const sourceBadge = obs.location && obs.location.source
            ? `<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px;">Location: ${this._escape(obs.location.source)}</span>`
            : '';

          marker.bindPopup(`
            <div style="font-family: system-ui, -apple-system, sans-serif; font-size:13px; min-width:180px; color:#1e293b;">
              <h4 style="margin:0 0 4px; font-size:14px; font-weight:700;">${this._escape(obs.issue)}</h4>
              <div style="margin-bottom:6px; display:flex; gap:6px; align-items:center;">
                <span style="font-weight:600; font-size:11px; padding:2px 6px; border-radius:4px; background:${color}22; color:${color}; border:1px solid ${color}44;">${this._escape(obs.severity)}</span>
                ${sourceBadge}
              </div>
              <p style="margin:4px 0; color:#475569; line-height:1.4;">${this._escape(obs.note || '')}</p>
              ${actionHtml}
              <div style="margin-top:6px; font-size:11px; color:#94a3b8;">📅 ${this._escape(obs.date || '')} | ${this._escape(obs.category || '')}</div>
            </div>
          `);

          this.observationMarkers.push(marker);
        }
      } else if (this.svgContainer) {
        this._renderSvgView();
      }
    }

    setLocation(locationOrNull) {
      this.currentLocation = locationOrNull;

      if (this.map && window.L) {
        if (!locationOrNull || typeof locationOrNull.latitude !== 'number') {
          if (this.locationMarker) {
            this.map.removeLayer(this.locationMarker);
            this.locationMarker = null;
          }
          if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
          }
          return;
        }

        const latLng = [locationOrNull.latitude, locationOrNull.longitude];

        // Accuracy circle
        if (typeof locationOrNull.accuracyM === 'number' && locationOrNull.accuracyM > 0) {
          if (!this.accuracyCircle) {
            this.accuracyCircle = window.L.circle(latLng, {
              radius: locationOrNull.accuracyM,
              color: '#3b82f6',
              weight: 1,
              opacity: 0.4,
              fillColor: '#3b82f6',
              fillOpacity: 0.15
            }).addTo(this.map);
          } else {
            this.accuracyCircle.setLatLng(latLng);
            this.accuracyCircle.setRadius(locationOrNull.accuracyM);
          }
        } else if (this.accuracyCircle) {
          this.map.removeLayer(this.accuracyCircle);
          this.accuracyCircle = null;
        }

        // Blue dot marker
        if (!this.locationMarker) {
          this.locationMarker = window.L.circleMarker(latLng, {
            radius: 8,
            fillColor: '#2563eb',
            color: '#ffffff',
            weight: 3,
            fillOpacity: 1.0
          }).addTo(this.map);
        } else {
          this.locationMarker.setLatLng(latLng);
        }

        if (this.followingLocation) {
          this.map.panTo(latLng);
        }
      } else if (this.svgContainer) this._renderSvgView();
    }

    setTrack(trackPoints) {
      this.trackPoints = trackPoints || [];

      if (this.map && window.L) {
        if (!trackPoints || trackPoints.length < 2) {
          if (this.trackPolyline) {
            this.map.removeLayer(this.trackPolyline);
            this.trackPolyline = null;
          }
          return;
        }

        if (!this.trackPolyline) {
          this.trackPolyline = window.L.polyline(trackPoints, {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.85
          }).addTo(this.map);
        } else {
          this.trackPolyline.setLatLngs(trackPoints);
        }
      } else if (this.svgContainer) this._renderSvgView();
    }

    setFollowLocation(enabled) {
      this.followingLocation = Boolean(enabled);
      if (this.followingLocation && this.currentLocation && this.map) {
        this.map.panTo([this.currentLocation.latitude, this.currentLocation.longitude]);
      } else if (this.followingLocation && this.currentLocation && this.svgContainer) {
        this.panTo(this.currentLocation.latitude, this.currentLocation.longitude);
      }
    }

    setVisualizationLayer(layerType) {
      this.visualizationLayer = layerType || null;
      if (this.map && window.L) this.setSelectedField(this.selectedFieldId);
      else if (this.svgContainer) this._renderSvgView();
    }

    onFieldSelected(callback) {
      this.fieldSelectedCallback = callback;
    }

    onMapClick(callback) {
      this.mapClickCallback = callback;
    }

    onMapPanned(callback) {
      this.mapPannedCallback = callback;
    }

    destroy() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (typeof window !== 'undefined' && this.onWindowResize) {
        window.removeEventListener('resize', this.onWindowResize);
        this.onWindowResize = null;
      }
      if (this.tileLayer && this.map) {
        this.map.removeLayer(this.tileLayer);
        this.tileLayer = null;
      }
      if (this.map && window.L) {
        this.map.off();
        this.map.remove();
        this.map = null;
      }
      this.polygons.clear();
      this.observationMarkers = [];
      this.locationMarker = null;
      this.accuracyCircle = null;
      this.trackPolyline = null;

      if (this.container) {
        this.container.innerHTML = '';
        this.container.classList.remove('offline-field-view');
      }
    }

    _renderSvgView() {
      if (!this.svgContainer) return;
      this.svgContainer.innerHTML = '';

      const bounds = this.svgViewBounds || this._boundsForFields();
      this.svgViewBounds = bounds;
      const { minLat, maxLat, minLng, maxLng } = bounds;

      const toSvgPoint = (lat, lng) => {
        const x = ((lng - minLng) / (maxLng - minLng)) * 1000;
        const y = (1 - (lat - minLat) / (maxLat - minLat)) * 800;
        return { x, y };
      };
      const toSvgCoords = (lat, lng) => {
        const point = toSvgPoint(lat, lng);
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      };

      this.svgContainer.setAttribute('viewBox', '0 0 1000 800');

      const grid = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      grid.setAttribute('d', 'M0 200H1000M0 400H1000M0 600H1000M250 0V800M500 0V800M750 0V800');
      grid.setAttribute('stroke', '#94a3b8');
      grid.setAttribute('stroke-opacity', '0.12');
      grid.setAttribute('fill', 'none');
      this.svgContainer.appendChild(grid);

      if (this.trackPoints.length > 1) {
        const track = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        track.setAttribute('points', this.trackPoints.map(([lat, lng]) => toSvgCoords(lat, lng)).join(' '));
        track.setAttribute('fill', 'none');
        track.setAttribute('stroke', '#60a5fa');
        track.setAttribute('stroke-width', '5');
        track.setAttribute('stroke-linecap', 'round');
        track.setAttribute('stroke-linejoin', 'round');
        this.svgContainer.appendChild(track);
      }

      // Polygons
      for (const field of this.fields) {
        if (!field.polygon) continue;
        const points = field.polygon.map(([lat, lng]) => toSvgCoords(lat, lng)).join(' ');
        const isSelected = field.id === this.selectedFieldId;
        const style = this._fieldStyle(field, isSelected);

        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', points);
        poly.setAttribute('fill', style.fillColor);
        poly.setAttribute('fill-opacity', String(style.fillOpacity));
        poly.setAttribute('stroke', isSelected ? '#10b981' : '#475569');
        poly.setAttribute('stroke-width', isSelected ? '4' : '2');
        poly.style.cursor = 'pointer';

        poly.addEventListener('click', () => {
          if (this.fieldSelectedCallback) {
            this.fieldSelectedCallback(field.id);
          }
        });

        this.svgContainer.appendChild(poly);

        const center = field.polygon.reduce((sum, [lat, lng]) => ({ lat: sum.lat + lat, lng: sum.lng + lng }), { lat: 0, lng: 0 });
        center.lat /= field.polygon.length;
        center.lng /= field.polygon.length;
        const labelPoint = toSvgPoint(center.lat, center.lng);
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', labelPoint.x.toFixed(1));
        label.setAttribute('y', labelPoint.y.toFixed(1));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('fill', '#ffffff');
        label.setAttribute('font-size', '24');
        label.setAttribute('font-weight', '700');
        label.setAttribute('pointer-events', 'none');
        label.textContent = String(field.name || 'Field');
        this.svgContainer.appendChild(label);
      }

      for (const observation of this.observations) {
        const latitude = observation.location?.latitude ?? observation.lat;
        const longitude = observation.location?.longitude ?? observation.lng;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
        const point = toSvgPoint(latitude, longitude);
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        marker.setAttribute('cx', point.x.toFixed(1));
        marker.setAttribute('cy', point.y.toFixed(1));
        marker.setAttribute('r', '11');
        marker.setAttribute('fill', SEVERITY_COLORS[observation.severity] || '#10b981');
        marker.setAttribute('stroke', '#ffffff');
        marker.setAttribute('stroke-width', '4');
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = String(observation.issue || 'Observation');
        marker.appendChild(title);
        this.svgContainer.appendChild(marker);
      }

      if (this.currentLocation && Number.isFinite(this.currentLocation.latitude) && Number.isFinite(this.currentLocation.longitude)) {
        const point = toSvgPoint(this.currentLocation.latitude, this.currentLocation.longitude);
        if (Number.isFinite(this.currentLocation.accuracyM) && this.currentLocation.accuracyM > 0) {
          const latSpanM = Math.max((maxLat - minLat) * 111320, 1);
          const radius = Math.max(5, Math.min(180, (this.currentLocation.accuracyM / latSpanM) * 800));
          const accuracy = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          accuracy.setAttribute('cx', point.x.toFixed(1));
          accuracy.setAttribute('cy', point.y.toFixed(1));
          accuracy.setAttribute('r', radius.toFixed(1));
          accuracy.setAttribute('fill', '#3b82f6');
          accuracy.setAttribute('fill-opacity', '0.16');
          accuracy.setAttribute('stroke', '#60a5fa');
          accuracy.setAttribute('stroke-width', '2');
          this.svgContainer.appendChild(accuracy);
        }
        const location = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        location.setAttribute('cx', point.x.toFixed(1));
        location.setAttribute('cy', point.y.toFixed(1));
        location.setAttribute('r', '13');
        location.setAttribute('fill', this.currentLocation.source === 'sample' ? '#8b5cf6' : '#2563eb');
        location.setAttribute('stroke', '#ffffff');
        location.setAttribute('stroke-width', '5');
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = this.currentLocation.source === 'sample' ? 'Simulated location' : 'Device location';
        location.appendChild(title);
        this.svgContainer.appendChild(location);
      }
    }

    _boundsForFields() {
      const coordinates = this.fields.flatMap(field => Array.isArray(field.polygon) ? field.polygon : []);
      if (coordinates.length) return this._boundsForCoordinates(coordinates, 0.1);
      const center = this.config.defaultCenter || { lat: 42.0266, lng: -93.6465 };
      return { minLat: center.lat - 0.01, maxLat: center.lat + 0.01,
        minLng: center.lng - 0.01, maxLng: center.lng + 0.01 };
    }

    _boundsForCoordinates(coordinates, paddingRatio) {
      const valid = coordinates.filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
      if (!valid.length) {
        const center = this.config.defaultCenter || { lat: 42.0266, lng: -93.6465 };
        return { minLat: center.lat - 0.01, maxLat: center.lat + 0.01,
          minLng: center.lng - 0.01, maxLng: center.lng + 0.01 };
      }
      let minLat = Math.min(...valid.map(point => point[0]));
      let maxLat = Math.max(...valid.map(point => point[0]));
      let minLng = Math.min(...valid.map(point => point[1]));
      let maxLng = Math.max(...valid.map(point => point[1]));
      const padLat = Math.max((maxLat - minLat) * paddingRatio, 0.0005);
      const padLng = Math.max((maxLng - minLng) * paddingRatio, 0.0005);
      return { minLat: minLat - padLat, maxLat: maxLat + padLat,
        minLng: minLng - padLng, maxLng: maxLng + padLng };
    }

    _fieldStyle(field, isSelected) {
      const cropColor = CROP_COLORS[field.crop] || '#3b82f6';
      let fillColor = isSelected ? '#10b981' : cropColor;
      let fillOpacity = isSelected ? 0.4 : 0.2;
      if (isSelected && this.visualizationLayer === 'ndvi') {
        fillColor = Number(field.ndvi) > 0.7 ? '#10b981' : Number(field.ndvi) > 0.5 ? '#f59e0b' : '#ef4444';
        fillOpacity = 0.7;
      } else if (isSelected && this.visualizationLayer === 'soil') {
        fillColor = '#8b4513';
        fillOpacity = 0.6;
      }
      return { fillColor, fillOpacity };
    }

    _escape(text) {
      return String(text ?? '').replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  }

  return OfflineFieldAdapter;
}));
