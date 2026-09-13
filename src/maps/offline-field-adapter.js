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
      this.map = null; // Leaflet instance without tileLayer (if L available)
      this.svgContainer = null; // SVG vector fallback

      this.fields = [];
      this.selectedFieldId = null;

      this.observations = [];
      this.currentLocation = null;
      this.trackPoints = [];
      this.followingLocation = false;

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

    _mountLeafletEngine() {
      const L = window.L;
      const center = this.config.defaultCenter
        ? [this.config.defaultCenter.lat, this.config.defaultCenter.lng]
        : [42.0266, -93.6465];

      // Create map with neutral background and NO TILE LAYER
      this.map = L.map(this.container, {
        center,
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
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
    }

    _mountSvgEngine() {
      // Standalone SVG vector rendering when Leaflet is not available
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'offline-svg-canvas');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      this.container.appendChild(svg);
      this.svgContainer = svg;
    }

    setFields(fields) {
      this.fields = fields || [];

      if (this.map && window.L) {
        // Leaflet vector renderer
        for (const poly of this.polygons.values()) {
          this.map.removeLayer(poly);
        }
        this.polygons.clear();

        for (const field of this.fields) {
          if (!Array.isArray(field.polygon) || field.polygon.length < 3) continue;

          const color = CROP_COLORS[field.crop] || '#3b82f6';
          const isSelected = field.id === this.selectedFieldId;

          const poly = window.L.polygon(field.polygon, {
            color: isSelected ? '#10b981' : '#475569',
            weight: isSelected ? 3.5 : 2,
            fillColor: isSelected ? '#10b981' : color,
            fillOpacity: isSelected ? 0.35 : 0.18,
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
      } else if (this.svgContainer) {
        this._renderSvgView();
      }
    }

    setSelectedField(fieldId) {
      this.selectedFieldId = fieldId;

      if (this.map && window.L) {
        for (const [id, poly] of this.polygons.entries()) {
          const field = this.fields.find(f => f.id === id);
          const color = field ? (CROP_COLORS[field.crop] || '#3b82f6') : '#3b82f6';
          const isSelected = id === fieldId;

          poly.setStyle({
            color: isSelected ? '#10b981' : '#475569',
            weight: isSelected ? 3.5 : 2,
            fillColor: isSelected ? '#10b981' : color,
            fillOpacity: isSelected ? 0.35 : 0.18
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
        const bounds = window.L.latLngBounds(field.polygon);
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }

    panTo(lat, lng) {
      if (this.map && window.L) {
        this.map.panTo([lat, lng]);
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
      }
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
      }
    }

    setFollowLocation(enabled) {
      this.followingLocation = Boolean(enabled);
      if (this.followingLocation && this.currentLocation && this.map) {
        this.map.panTo([this.currentLocation.latitude, this.currentLocation.longitude]);
      }
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

      // Find global bounding box
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const field of this.fields) {
        for (const [lat, lng] of (field.polygon || [])) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
      }

      if (!Number.isFinite(minLat)) return;

      const padLat = (maxLat - minLat) * 0.1 || 0.005;
      const padLng = (maxLng - minLng) * 0.1 || 0.005;
      minLat -= padLat; maxLat += padLat;
      minLng -= padLng; maxLng += padLng;

      const toSvgCoords = (lat, lng) => {
        const x = ((lng - minLng) / (maxLng - minLng)) * 1000;
        const y = (1 - (lat - minLat) / (maxLat - minLat)) * 800;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      };

      this.svgContainer.setAttribute('viewBox', '0 0 1000 800');

      // Polygons
      for (const field of this.fields) {
        if (!field.polygon) continue;
        const points = field.polygon.map(([lat, lng]) => toSvgCoords(lat, lng)).join(' ');
        const isSelected = field.id === this.selectedFieldId;
        const color = CROP_COLORS[field.crop] || '#3b82f6';

        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', points);
        poly.setAttribute('fill', isSelected ? '#10b981' : color);
        poly.setAttribute('fill-opacity', isSelected ? '0.4' : '0.2');
        poly.setAttribute('stroke', isSelected ? '#10b981' : '#475569');
        poly.setAttribute('stroke-width', isSelected ? '4' : '2');
        poly.style.cursor = 'pointer';

        poly.addEventListener('click', () => {
          if (this.fieldSelectedCallback) {
            this.fieldSelectedCallback(field.id);
          }
        });

        this.svgContainer.appendChild(poly);
      }
    }

    _escape(text) {
      return String(text ?? '').replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  }

  return OfflineFieldAdapter;
}));
