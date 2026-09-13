/**
 * TerraSync Configuration Template
 * Public configuration for map providers, legal notices, and runtime settings.
 *
 * NOTE: Browser API keys are visible to client visitors. Secure keys using
 * Google Cloud Console HTTP referrer restrictions (e.g., your GitHub Pages domain
 * or local development origins). Never place backend secrets or service account
 * credentials in this file.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TERRASYNC_CONFIG = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    // Google Maps JavaScript API key.
    // Insert your restricted browser key here, configure in the UI, or override via window.TERRASYNC_CONFIG.
    googleMapsApiKey: (typeof localStorage !== 'undefined' && localStorage.getItem('terrasync_google_maps_api_key')) || '',

    // Optional vector map ID
    googleMapsMapId: '',

    // Default map coordinates (Ames, Iowa demonstration fields)
    defaultCenter: { lat: 42.0266, lng: -93.6465 },
    defaultZoom: 13,

    // Legal attribution & policy references (preserves required Google terms)
    googleTermsUrl: 'https://policies.google.com/terms',
    googlePrivacyUrl: 'https://policies.google.com/privacy',
    appTermsUrl: 'terms.html',
    appPrivacyUrl: 'privacy.html',

    // Offline & location settings
    staleLocationThresholdMs: 30000,
    lowAccuracyThresholdM: 50,
    locationTimeoutMs: 15000,

    // Testing flags
    forceOfflineFieldView: false
  };
}));
