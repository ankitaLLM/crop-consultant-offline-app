/**
 * TerraSync Google Maps Platform Adapter
 * Implements the MapAdapter interface using the official Google Maps JavaScript API.
 * Supports Road, Satellite, and Hybrid basemaps, field polygons, observation pins,
 * location accuracy circle, active track polyline, and attribution preservation.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const MapAdapter = require('./map-adapter.js');
    module.exports = factory(MapAdapter);
  } else {
    root.GoogleMapAdapter = factory(root.MapAdapter);
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

  let googleLoadingPromise = null;

  /**
   * Helper to load the Google Maps JavaScript API once asynchronously.
   * @param {string} apiKey
   * @param {string} [mapId]
   * @param {number} [timeoutMs=10000]
   * @returns {Promise<typeof google.maps>}
   */
  function loadGoogleMapsScript(apiKey, mapId, timeoutMs = 10000) {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Google Maps can only be loaded in a browser environment.'));
    }

    if (window.google && window.google.maps) {
      return Promise.resolve(window.google.maps);
    }

    if (googleLoadingPromise) {
      return googleLoadingPromise;
    }

    if (!apiKey) {
      return Promise.reject(new Error('No Google Maps API key provided. Falling back to offline field view.'));
    }

    googleLoadingPromise = new Promise((resolve, reject) => {
      const callbackName = `__terrasync_google_maps_loaded_${Date.now()}`;
      let timeoutTimer = null;

      // Handle global auth failure callback from Google Maps API
      const prevAuthFailure = window.gm_authFailure;
      window.gm_authFailure = () => {
        if (typeof prevAuthFailure === 'function') prevAuthFailure();
        reject(new Error('Google Maps authentication failed (invalid key or unauthorized referrer).'));
      };

      window[callbackName] = () => {
        clearTimeout(timeoutTimer);
        delete window[callbackName];
        resolve(window.google.maps);
      };

      timeoutTimer = setTimeout(() => {
        delete window[callbackName];
        googleLoadingPromise = null;
        reject(new Error('Google Maps script loading timed out.'));
      }, timeoutMs);

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.defer = true;
      let src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&loading=async`;
      if (mapId) {
        src += `&map_ids=${encodeURIComponent(mapId)}`;
      }
      script.src = src;

      script.onerror = () => {
        clearTimeout(timeoutTimer);
        delete window[callbackName];
        googleLoadingPromise = null;
        reject(new Error('Failed to load Google Maps JavaScript API (network error or blocked script).'));
      };

      document.head.appendChild(script);
    });

    return googleLoadingPromise;
  }

  class GoogleMapAdapter extends MapAdapter {
    constructor(config = {}) {
      super();
      this.config = config;
      this.apiKey = config.googleMapsApiKey || '';
      this.mapId = config.googleMapsMapId || '';

      this.map = null;
      this.container = null;

      this.fields = [];
      this.selectedFieldId = null;
      this.polygons = new Map(); // fieldId -> google.maps.Polygon

      this.observations = [];
      this.observationMarkers = [];
      this.infoWindow = null;

      this.locationMarker = null;
      this.accuracyCircle = null;
      this.currentLocation = null;
      this.followingLocation = false;

      this.trackPolyline = null;

      this.fieldSelectedCallback = null;
      this.mapClickCallback = null;
      this.mapPannedCallback = null;

      this.listeners = [];
    }

    async mount(container) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) {
        throw new Error('GoogleMapAdapter: container element not found.');
      }

      const googleMaps = await loadGoogleMapsScript(this.apiKey, this.mapId);

      const center = this.config.defaultCenter || { lat: 42.0266, lng: -93.6465 };
      const zoom = this.config.defaultZoom || 13;

      this.map = new googleMaps.Map(this.container, {
        center,
        zoom,
        mapTypeId: googleMaps.MapTypeId.HYBRID, // Default to agricultural Hybrid (satellite + roads)
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: googleMaps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: googleMaps.ControlPosition.TOP_LEFT,
          mapTypeIds: [
            googleMaps.MapTypeId.ROADMAP,
            googleMaps.MapTypeId.SATELLITE,
            googleMaps.MapTypeId.HYBRID
          ]
        },
        scaleControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: googleMaps.ControlPosition.RIGHT_BOTTOM
        }
      });

      this.infoWindow = new googleMaps.InfoWindow();

      // Listen for user pan/drag to suspend follow mode
      const dragListener = this.map.addListener('dragstart', () => {
        if (this.mapPannedCallback) {
          this.mapPannedCallback();
        }
      });
      this.listeners.push(dragListener);

      // Listen for map clicks
      const clickListener = this.map.addListener('click', (e) => {
        if (this.mapClickCallback && e.latLng) {
          this.mapClickCallback({
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
          });
        }
      });
      this.listeners.push(clickListener);
    }

    setFields(fields) {
      this.fields = fields || [];
      if (!this.map || !window.google) return;

      // Clear existing polygons
      for (const polygon of this.polygons.values()) {
        polygon.setMap(null);
      }
      this.polygons.clear();

      for (const field of this.fields) {
        if (!Array.isArray(field.polygon) || field.polygon.length < 3) continue;

        const path = field.polygon.map(([lat, lng]) => ({ lat, lng }));
        const color = CROP_COLORS[field.crop] || '#3b82f6';
        const isSelected = field.id === this.selectedFieldId;

        const polygon = new window.google.maps.Polygon({
          paths: path,
          strokeColor: isSelected ? '#10b981' : '#4b5563',
          strokeOpacity: 0.9,
          strokeWeight: isSelected ? 3.5 : 2,
          fillColor: isSelected ? '#10b981' : color,
          fillOpacity: isSelected ? 0.35 : 0.15,
          map: this.map,
          zIndex: isSelected ? 10 : 1
        });

        polygon.addListener('click', (e) => {
          if (e && e.stop) e.stop();
          if (this.fieldSelectedCallback) {
            this.fieldSelectedCallback(field.id);
          }
        });

        this.polygons.set(field.id, polygon);
      }
    }

    setSelectedField(fieldId) {
      this.selectedFieldId = fieldId;
      if (!this.map || !window.google) return;

      for (const [id, polygon] of this.polygons.entries()) {
        const field = this.fields.find(f => f.id === id);
        const color = field ? (CROP_COLORS[field.crop] || '#3b82f6') : '#3b82f6';
        const isSelected = id === fieldId;

        polygon.setOptions({
          strokeColor: isSelected ? '#10b981' : '#4b5563',
          strokeWeight: isSelected ? 3.5 : 2,
          fillColor: isSelected ? '#10b981' : color,
          fillOpacity: isSelected ? 0.35 : 0.15,
          zIndex: isSelected ? 10 : 1
        });
      }
    }

    fitToField(fieldId) {
      if (!this.map || !window.google) return;
      const field = this.fields.find(f => f.id === fieldId);
      if (!field || !Array.isArray(field.polygon) || field.polygon.length === 0) return;

      const bounds = new window.google.maps.LatLngBounds();
      for (const [lat, lng] of field.polygon) {
        bounds.extend({ lat, lng });
      }
      this.map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }

    panTo(lat, lng) {
      if (!this.map || !window.google) return;
      this.map.panTo({ lat, lng });
    }

    setObservations(observations) {
      this.observations = observations || [];
      if (!this.map || !window.google) return;

      // Clear existing markers
      for (const marker of this.observationMarkers) {
        marker.setMap(null);
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

        // High quality SVG pin symbol
        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: this.map,
          title: obs.issue || 'Observation',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 0.95,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 7
          },
          zIndex: 50
        });

        marker.addListener('click', () => {
          const actionHtml = obs.actionTaken
            ? `<div style="font-size:12px; margin-top:4px;"><strong>Action:</strong> ${this._escape(obs.actionTaken)}</div>`
            : '';
          const sourceBadge = obs.location && obs.location.source
            ? `<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px;">Location: ${this._escape(obs.location.source)}</span>`
            : '';

          const content = `
            <div style="font-family: system-ui, -apple-system, sans-serif; font-size:13px; max-width:240px; color:#1e293b;">
              <h4 style="margin:0 0 4px; font-size:14px; font-weight:700;">${this._escape(obs.issue)}</h4>
              <div style="margin-bottom:6px; display:flex; gap:6px; align-items:center;">
                <span style="font-weight:600; font-size:11px; padding:2px 6px; border-radius:4px; background:${color}22; color:${color}; border:1px solid ${color}44;">${this._escape(obs.severity)} Priority</span>
                ${sourceBadge}
              </div>
              <p style="margin:4px 0; color:#475569; line-height:1.4;">${this._escape(obs.note || '')}</p>
              ${actionHtml}
              <div style="margin-top:6px; font-size:11px; color:#94a3b8;">📅 ${this._escape(obs.date || '')} | ${this._escape(obs.category || '')}</div>
            </div>
          `;

          this.infoWindow.setContent(content);
          this.infoWindow.open(this.map, marker);
        });

        this.observationMarkers.push(marker);
      }
    }

    setLocation(locationOrNull) {
      this.currentLocation = locationOrNull;
      if (!this.map || !window.google) return;

      if (!locationOrNull || typeof locationOrNull.latitude !== 'number') {
        if (this.locationMarker) {
          this.locationMarker.setMap(null);
          this.locationMarker = null;
        }
        if (this.accuracyCircle) {
          this.accuracyCircle.setMap(null);
          this.accuracyCircle = null;
        }
        return;
      }

      const position = {
        lat: locationOrNull.latitude,
        lng: locationOrNull.longitude
      };

      // Accuracy circle
      if (typeof locationOrNull.accuracyM === 'number' && locationOrNull.accuracyM > 0) {
        if (!this.accuracyCircle) {
          this.accuracyCircle = new window.google.maps.Circle({
            map: this.map,
            center: position,
            radius: locationOrNull.accuracyM,
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.4,
            strokeWeight: 1,
            zIndex: 90
          });
        } else {
          this.accuracyCircle.setCenter(position);
          this.accuracyCircle.setRadius(locationOrNull.accuracyM);
        }
      } else if (this.accuracyCircle) {
        this.accuracyCircle.setMap(null);
        this.accuracyCircle = null;
      }

      // Blue dot marker
      if (!this.locationMarker) {
        this.locationMarker = new window.google.maps.Marker({
          position,
          map: this.map,
          title: 'Your Location',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#2563eb',
            fillOpacity: 1.0,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 8
          },
          zIndex: 100
        });
      } else {
        this.locationMarker.setPosition(position);
      }

      // Pan if follow location active
      if (this.followingLocation) {
        this.map.panTo(position);
      }
    }

    setTrack(trackPoints) {
      if (!this.map || !window.google) return;

      if (!trackPoints || trackPoints.length < 2) {
        if (this.trackPolyline) {
          this.trackPolyline.setMap(null);
          this.trackPolyline = null;
        }
        return;
      }

      const path = trackPoints.map(([lat, lng]) => ({ lat, lng }));

      if (!this.trackPolyline) {
        this.trackPolyline = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.85,
          strokeWeight: 3,
          map: this.map,
          zIndex: 80
        });
      } else {
        this.trackPolyline.setPath(path);
      }
    }

    setFollowLocation(enabled) {
      this.followingLocation = Boolean(enabled);
      if (this.followingLocation && this.currentLocation && this.map) {
        this.map.panTo({
          lat: this.currentLocation.latitude,
          lng: this.currentLocation.longitude
        });
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
      for (const listener of this.listeners) {
        if (window.google && window.google.maps && window.google.maps.event) {
          window.google.maps.event.removeListener(listener);
        }
      }
      this.listeners = [];

      for (const polygon of this.polygons.values()) {
        polygon.setMap(null);
      }
      this.polygons.clear();

      for (const marker of this.observationMarkers) {
        marker.setMap(null);
      }
      this.observationMarkers = [];

      if (this.locationMarker) {
        this.locationMarker.setMap(null);
        this.locationMarker = null;
      }
      if (this.accuracyCircle) {
        this.accuracyCircle.setMap(null);
        this.accuracyCircle = null;
      }
      if (this.trackPolyline) {
        this.trackPolyline.setMap(null);
        this.trackPolyline = null;
      }
      if (this.infoWindow) {
        this.infoWindow.close();
        this.infoWindow = null;
      }

      if (this.container) {
        this.container.innerHTML = '';
      }
      this.map = null;
    }

    _escape(text) {
      return String(text ?? '').replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  }

  return GoogleMapAdapter;
}));
