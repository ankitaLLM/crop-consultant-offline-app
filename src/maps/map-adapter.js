/**
 * TerraSync Base Map Adapter Interface
 * Defines the contract implemented by GoogleMapAdapter and OfflineFieldAdapter.
 * Guarantees that business logic never directly references vendor-specific map objects.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MapAdapter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class MapAdapter {
    constructor() {
      if (new.target === MapAdapter) {
        throw new TypeError('Cannot construct MapAdapter instances directly; use a concrete subclass.');
      }
    }

    /**
     * Mounts the map view into the given HTML container element.
     * @param {HTMLElement|string} container
     * @returns {Promise<void>}
     */
    async mount(container) {
      throw new Error('mount() must be implemented by subclass');
    }

    /**
     * Updates the collection of grower fields rendered on the map.
     * @param {Array<object>} fields
     */
    setFields(fields) {
      throw new Error('setFields() must be implemented by subclass');
    }

    /**
     * Highlights the selected field and centers/fits view if appropriate.
     * @param {string|null} fieldId
     */
    setSelectedField(fieldId) {
      throw new Error('setSelectedField() must be implemented by subclass');
    }

    /**
     * Renders observation pins on the map.
     * @param {Array<object>} observations
     */
    setObservations(observations) {
      throw new Error('setObservations() must be implemented by subclass');
    }

    /**
     * Updates real device location marker and accuracy circle.
     * @param {object|null} location - { latitude, longitude, accuracyM, source }
     */
    setLocation(locationOrNull) {
      throw new Error('setLocation() must be implemented by subclass');
    }

    /**
     * Updates track polyline (e.g. perimeter walk or scouting track).
     * @param {Array<[number, number]>} trackPoints - Array of [lat, lng]
     */
    setTrack(trackPoints) {
      throw new Error('setTrack() must be implemented by subclass');
    }

    /**
     * Smoothly pans/fits view to bounds of the given field.
     * @param {string} fieldId
     */
    fitToField(fieldId) {
      throw new Error('fitToField() must be implemented by subclass');
    }

    /**
     * Smoothly pans view to given latitude and longitude coordinates.
     * @param {number} lat
     * @param {number} lng
     */
    panTo(lat, lng) {
      throw new Error('panTo() must be implemented by subclass');
    }

    /**
     * Enables or disables automatic camera following of device location.
     * @param {boolean} enabled
     */
    setFollowLocation(enabled) {
      throw new Error('setFollowLocation() must be implemented by subclass');
    }

    /**
     * Registers a callback triggered when user clicks a field polygon.
     * @param {Function} callback - (fieldId) => void
     */
    onFieldSelected(callback) {
      throw new Error('onFieldSelected() must be implemented by subclass');
    }

    /**
     * Registers a callback triggered when user clicks anywhere on the map surface.
     * @param {Function} callback - ({ lat, lng }) => void
     */
    onMapClick(callback) {
      throw new Error('onMapClick() must be implemented by subclass');
    }

    /**
     * Registers a callback triggered when user manually pans/drags map (suspends follow mode).
     * @param {Function} callback - () => void
     */
    onMapPanned(callback) {
      throw new Error('onMapPanned() must be implemented by subclass');
    }

    /**
     * Destroys map instance, listeners, and DOM elements cleanly.
     */
    destroy() {
      throw new Error('destroy() must be implemented by subclass');
    }
  }

  return MapAdapter;
}));
