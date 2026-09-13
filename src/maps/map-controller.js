/**
 * TerraSync Map Controller
 * Lifecycle manager and unified interface for map rendering.
 * Automatically selects GoogleMapAdapter or OfflineFieldAdapter based on network,
 * API key presence, and script availability, preserving all state during transitions.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const GoogleMapAdapter = require('./google-map-adapter.js');
    const OfflineFieldAdapter = require('./offline-field-adapter.js');
    module.exports = factory(GoogleMapAdapter, OfflineFieldAdapter);
  } else {
    root.MapController = factory(root.GoogleMapAdapter, root.OfflineFieldAdapter);
  }
}(typeof self !== 'undefined' ? self : this, function (GoogleMapAdapter, OfflineFieldAdapter) {
  'use strict';

  class MapController {
    /**
     * @param {object} [config]
     * @param {Function} [config.GoogleMapAdapterClass]
     * @param {Function} [config.OfflineFieldAdapterClass]
     */
    constructor(config = {}) {
      this.config = config;
      this.GoogleMapAdapterClass = config.GoogleMapAdapterClass || GoogleMapAdapter;
      this.OfflineFieldAdapterClass = config.OfflineFieldAdapterClass || OfflineFieldAdapter;

      this.container = null;
      this.activeAdapter = null;
      this.activeType = null; // 'google' | 'offline'

      // Preserved application state
      this.fields = [];
      this.selectedFieldId = null;
      this.observations = [];
      this.currentLocation = null;
      this.trackPoints = [];
      this.followingLocation = false;

      // Event listeners
      this.fieldSelectedListeners = new Set();
      this.mapClickListeners = new Set();
      this.mapPannedListeners = new Set();
      this.adapterChangedListeners = new Set();

      this.onlineHandler = () => this._handleConnectivityChange(true);
      this.offlineHandler = () => this._handleConnectivityChange(false);
    }

    /**
     * Initialize map controller and mount appropriate adapter.
     * @param {HTMLElement|string} container
     * @returns {Promise<string>} 'google' or 'offline'
     */
    async init(container) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) {
        throw new Error('MapController: Container element not found.');
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('online', this.onlineHandler);
        window.addEventListener('offline', this.offlineHandler);
      }

      return this._selectAndMountInitialAdapter();
    }

    async _selectAndMountInitialAdapter() {
      const hasKey = Boolean(this.config.googleMapsApiKey && this.config.googleMapsApiKey.trim());
      const isOnline = typeof this.config.isOnline === 'boolean'
        ? this.config.isOnline
        : (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true);
      const forceOffline = Boolean(this.config.forceOfflineFieldView);

      if (hasKey && isOnline && !forceOffline) {
        try {
          await this._mountAdapter('google');
          return 'google';
        } catch (err) {
          console.warn('[MapController] Google Maps failed to load. Falling back to offline field view:', err.message);
          await this._mountAdapter('offline');
          return 'offline';
        }
      } else {
        await this._mountAdapter('offline');
        return 'offline';
      }
    }

    async _mountAdapter(type) {
      if (this.activeAdapter) {
        this.activeAdapter.destroy();
        this.activeAdapter = null;
      }

      if (type === 'google') {
        this.activeAdapter = new this.GoogleMapAdapterClass(this.config);
      } else {
        this.activeAdapter = new this.OfflineFieldAdapterClass(this.config);
      }

      this.activeType = type;

      // Wire up event listeners to forward through controller
      this.activeAdapter.onFieldSelected((fieldId) => {
        this.selectedFieldId = fieldId;
        for (const cb of this.fieldSelectedListeners) cb(fieldId);
      });

      this.activeAdapter.onMapClick((coords) => {
        for (const cb of this.mapClickListeners) cb(coords);
      });

      this.activeAdapter.onMapPanned(() => {
        for (const cb of this.mapPannedListeners) cb();
      });

      // Mount into container
      await this.activeAdapter.mount(this.container);

      // Replay all preserved state
      if (this.fields.length > 0) {
        this.activeAdapter.setFields(this.fields);
      }
      if (this.selectedFieldId) {
        this.activeAdapter.setSelectedField(this.selectedFieldId);
      }
      if (this.observations.length > 0) {
        this.activeAdapter.setObservations(this.observations);
      }
      if (this.currentLocation) {
        this.activeAdapter.setLocation(this.currentLocation);
      }
      if (this.trackPoints.length > 0) {
        this.activeAdapter.setTrack(this.trackPoints);
      }
      this.activeAdapter.setFollowLocation(this.followingLocation);

      // Notify adapter change
      for (const cb of this.adapterChangedListeners) {
        try {
          cb(this.activeType);
        } catch (e) {
          console.error('[MapController] adapterChanged listener error:', e);
        }
      }
    }

    /**
     * Switch between adapters manually or dynamically.
     * @param {'google' | 'offline'} targetType
     */
    async switchAdapter(targetType) {
      if (targetType === this.activeType) return;
      try {
        await this._mountAdapter(targetType);
      } catch (err) {
        console.warn(`[MapController] Failed to switch to ${targetType} adapter:`, err.message);
        if (targetType === 'google') {
          await this._mountAdapter('offline');
        }
      }
    }

    getActiveAdapterType() {
      return this.activeType;
    }

    setFields(fields) {
      this.fields = fields || [];
      if (this.activeAdapter) {
        this.activeAdapter.setFields(this.fields);
      }
    }

    setSelectedField(fieldId) {
      this.selectedFieldId = fieldId;
      if (this.activeAdapter) {
        this.activeAdapter.setSelectedField(fieldId);
      }
    }

    fitToField(fieldId) {
      if (this.activeAdapter) {
        this.activeAdapter.fitToField(fieldId);
      }
    }

    panTo(lat, lng) {
      if (this.activeAdapter && typeof this.activeAdapter.panTo === 'function') {
        this.activeAdapter.panTo(lat, lng);
      }
    }

    setObservations(observations) {
      this.observations = observations || [];
      if (this.activeAdapter) {
        this.activeAdapter.setObservations(this.observations);
      }
    }

    setLocation(locationOrNull) {
      this.currentLocation = locationOrNull;
      if (this.activeAdapter) {
        this.activeAdapter.setLocation(this.currentLocation);
      }
    }

    setTrack(trackPoints) {
      this.trackPoints = trackPoints || [];
      if (this.activeAdapter) {
        this.activeAdapter.setTrack(this.trackPoints);
      }
    }

    setFollowLocation(enabled) {
      this.followingLocation = Boolean(enabled);
      if (this.activeAdapter) {
        this.activeAdapter.setFollowLocation(this.followingLocation);
      }
    }

    onFieldSelected(callback) {
      if (typeof callback === 'function') {
        this.fieldSelectedListeners.add(callback);
      }
    }

    onMapClick(callback) {
      if (typeof callback === 'function') {
        this.mapClickListeners.add(callback);
      }
    }

    onMapPanned(callback) {
      if (typeof callback === 'function') {
        this.mapPannedListeners.add(callback);
      }
    }

    onAdapterChanged(callback) {
      if (typeof callback === 'function') {
        this.adapterChangedListeners.add(callback);
      }
    }

    _handleConnectivityChange(isOnline) {
      if (!isOnline && this.activeType === 'google') {
        this.switchAdapter('offline');
      } else if (isOnline && this.activeType === 'offline' && this.config.googleMapsApiKey) {
        // Can optionally attempt upgrade to Google when back online
        this.switchAdapter('google');
      }
    }

    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', this.onlineHandler);
        window.removeEventListener('offline', this.offlineHandler);
      }

      if (this.activeAdapter) {
        this.activeAdapter.destroy();
        this.activeAdapter = null;
      }

      this.fieldSelectedListeners.clear();
      this.mapClickListeners.clear();
      this.mapPannedListeners.clear();
      this.adapterChangedListeners.clear();
    }
  }

  return MapController;
}));
