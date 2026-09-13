/**
 * TerraSync Location Service
 * Real permission-based browser geolocation with state machine, staleness tracking,
 * accuracy monitoring, follow-mode management, and injectable geolocation provider for unit testing.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LocationService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,          // 15-second acquisition timeout
    maximumAge: 10000,       // 10-second acceptable cached fix
    staleThresholdMs: 30000, // 30-second stale indicator
    lowAccuracyThresholdM: 50 // Low accuracy threshold: > 50m
  };

  /**
   * LocationService Status:
   * 'idle' | 'locating' | 'current' | 'stale' | 'permission-denied' | 'unavailable' | 'timeout'
   */
  class LocationService {
    /**
     * @param {object} [config]
     * @param {Geolocation} [config.geolocationProvider] - Injectable navigator.geolocation
     * @param {object} [config.options] - Timing & accuracy options
     */
    constructor(config = {}) {
      this.options = { ...DEFAULT_OPTIONS, ...(config.options || {}) };
      this.geolocation = config.geolocationProvider ||
        (typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null);

      this.watchId = null;
      this.status = 'idle';
      this.currentLocation = null;
      this.lastFixTime = null;
      this.errorMessage = null;

      this.following = false;
      this.suspendedFollow = false;

      this.listeners = new Set();
      this.staleCheckInterval = null;

      this._startStaleChecker();
    }

    /**
     * Subscribe to location & state updates.
     * @param {Function} callback - Called with currentState object
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
      if (typeof callback !== 'function') return () => {};
      this.listeners.add(callback);
      // Immediately emit current state
      callback(this.getState());
      return () => this.listeners.delete(callback);
    }

    _emit() {
      const state = this.getState();
      for (const listener of this.listeners) {
        try {
          listener(state);
        } catch (e) {
          console.error('[LocationService] Listener error:', e);
        }
      }
    }

    /**
     * Returns snapshot of current location state.
     */
    getState() {
      const now = Date.now();
      const isStale = Boolean(
        this.lastFixTime &&
        (now - this.lastFixTime > this.options.staleThresholdMs)
      );

      const isLowAccuracy = Boolean(
        this.currentLocation &&
        this.currentLocation.accuracyM !== null &&
        this.currentLocation.accuracyM > this.options.lowAccuracyThresholdM
      );

      let effectiveStatus = this.status;
      if (effectiveStatus === 'current' && isStale) {
        effectiveStatus = 'stale';
      }

      return {
        status: effectiveStatus,
        location: this.currentLocation ? { ...this.currentLocation } : null,
        lastFixTime: this.lastFixTime,
        accuracyM: this.currentLocation ? this.currentLocation.accuracyM : null,
        isStale,
        isLowAccuracy,
        isFollowing: this.following && !this.suspendedFollow,
        isSuspended: this.suspendedFollow,
        errorMessage: this.errorMessage
      };
    }

    /**
     * Request a one-time position fix ("Locate me").
     * @param {object} [customOptions]
     * @returns {Promise<object>}
     */
    async getCurrentPosition(customOptions = {}) {
      if (!this.geolocation) {
        this.status = 'unavailable';
        this.errorMessage = 'Geolocation is not supported by this browser';
        this._emit();
        throw new Error(this.errorMessage);
      }

      this.status = 'locating';
      this.errorMessage = null;
      this._emit();

      const options = {
        enableHighAccuracy: this.options.enableHighAccuracy,
        timeout: this.options.timeout,
        maximumAge: this.options.maximumAge,
        ...customOptions
      };

      return new Promise((resolve, reject) => {
        this.geolocation.getCurrentPosition(
          (position) => {
            const loc = this._handleSuccess(position);
            resolve(loc);
          },
          (error) => {
            const err = this._handleError(error);
            reject(err);
          },
          options
        );
      });
    }

    /**
     * Start continuous position tracking ("Follow location").
     * Idempotent: does not start a new watch if one is already active.
     */
    startWatch(customOptions = {}) {
      if (!this.geolocation) {
        this.status = 'unavailable';
        this.errorMessage = 'Geolocation is not supported by this browser';
        this._emit();
        return;
      }

      this.following = true;
      this.suspendedFollow = false;

      if (this.watchId !== null) {
        // Watch already running, just ensure following flag is true
        this._emit();
        return;
      }

      this.status = 'locating';
      this.errorMessage = null;
      this._emit();

      const options = {
        enableHighAccuracy: this.options.enableHighAccuracy,
        timeout: this.options.timeout,
        maximumAge: this.options.maximumAge,
        ...customOptions
      };

      this.watchId = this.geolocation.watchPosition(
        (position) => this._handleSuccess(position),
        (error) => this._handleError(error),
        options
      );
    }

    /**
     * Stop continuous position tracking ("Stop following").
     * Releases browser geolocation watch immediately.
     */
    stopWatch() {
      if (this.watchId !== null && this.geolocation) {
        this.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      this.following = false;
      this.suspendedFollow = false;
      if (this.status === 'locating') {
        this.status = 'idle';
      }
      this._emit();
    }

    /**
     * User manually panned map: suspend follow mode without clearing the watch.
     */
    suspendFollow() {
      if (this.following && !this.suspendedFollow) {
        this.suspendedFollow = true;
        this._emit();
      }
    }

    /**
     * User clicked follow location again or re-centered: resume follow mode.
     */
    resumeFollow() {
      if (this.following && this.suspendedFollow) {
        this.suspendedFollow = false;
        this._emit();
      } else if (!this.following) {
        this.startWatch();
      }
    }

    _handleSuccess(position) {
      const coords = position.coords;
      const capturedAt = new Date(position.timestamp || Date.now()).toISOString();

      this.currentLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyM: typeof coords.accuracy === 'number' ? Math.round(coords.accuracy) : null,
        altitude: typeof coords.altitude === 'number' ? coords.altitude : null,
        heading: typeof coords.heading === 'number' ? coords.heading : null,
        speed: typeof coords.speed === 'number' ? coords.speed : null,
        capturedAt,
        source: 'device'
      };

      this.lastFixTime = Date.now();
      this.status = 'current';
      this.errorMessage = null;
      this._emit();

      return this.currentLocation;
    }

    _handleError(error) {
      let code = 'unavailable';
      let message = 'Location unavailable';

      // Standard GeolocationPositionError codes:
      // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
      if (error) {
        if (error.code === 1 || error.code === 'PERMISSION_DENIED') {
          code = 'permission-denied';
          message = 'Location permission denied by user';
        } else if (error.code === 3 || error.code === 'TIMEOUT') {
          code = 'timeout';
          message = 'Location request timed out';
        } else {
          code = 'unavailable';
          message = error.message || 'Position unavailable';
        }
      }

      this.status = code;
      this.errorMessage = message;

      // A denied permission cannot recover within the active watch. Release it so
      // the UI is truthful and a later user-initiated retry can start cleanly.
      if (code === 'permission-denied' && this.watchId !== null && this.geolocation) {
        this.geolocation.clearWatch(this.watchId);
        this.watchId = null;
        this.following = false;
        this.suspendedFollow = false;
      }
      this._emit();

      const err = new Error(message);
      err.code = code;
      return err;
    }

    _startStaleChecker() {
      if (typeof setInterval !== 'undefined') {
        this.staleCheckInterval = setInterval(() => {
          if (this.status === 'current' && this.lastFixTime) {
            if (Date.now() - this.lastFixTime > this.options.staleThresholdMs) {
              this._emit(); // Re-emit state showing stale
            }
          }
        }, 5000);
        if (this.staleCheckInterval && typeof this.staleCheckInterval.unref === 'function') {
          this.staleCheckInterval.unref();
        }
      }
    }

    destroy() {
      this.stopWatch();
      if (this.staleCheckInterval) {
        clearInterval(this.staleCheckInterval);
        this.staleCheckInterval = null;
      }
      this.listeners.clear();
    }
  }

  return LocationService;
}));
