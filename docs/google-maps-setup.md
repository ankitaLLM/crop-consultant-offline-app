# Google Maps Setup & Configuration Guide

This guide walks through configuring Google Maps JavaScript API for **TerraSync**.

---

## 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project**.
3. Name your project (e.g. `terrasync-crop-consultant`) and click **Create**.
4. Link an active billing account to the project (Google Cloud provides a recurring monthly credit for Maps usage).

---

## 2. Enable Maps JavaScript API

1. In the Google Cloud Console navigation menu, navigate to **APIs & Services > Library**.
2. Search for **Maps JavaScript API**.
3. Click **Enable**.

---

## 3. Generate and Restrict Your API Key

Never deploy an unrestricted Google Maps API key. Follow both Application and API restrictions:

### A. Application Restrictions (HTTP Referrers)
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > API key**.
3. In the key configuration screen, under **Application restrictions**, select **Websites (HTTP referrers)**.
4. Add your authorized domains:
   - For local development: `http://localhost:*/*` and `http://127.0.0.1:*/*`
   - For production GitHub Pages: `https://ankitallm.github.io/*` (or your custom domain)
5. Click **Done**.

### B. API Restrictions
1. Under **API restrictions**, select **Restrict key**.
2. In the dropdown, check **Maps JavaScript API** only.
3. Click **Save**.

---

## 4. Set Budget & Billing Alerts

To prevent unexpected billing from runaway traffic or misconfigured quotas:
1. Navigate to **Billing > Budgets & alerts**.
2. Create a budget with threshold alerts (e.g., at 50%, 80%, and 100% of your target limit).
3. Optional: Configure daily request quotas under **APIs & Services > Maps JavaScript API > Quotas**.

---

## 5. Configure TerraSync

Open `src/config.js` in the repository and add your restricted key:

```javascript
window.TERRASYNC_CONFIG = {
  // Replace with your restricted Google Maps API key
  googleMapsApiKey: 'AIzaSyYourRestrictedApiKeyHere',

  // Optional: customize default center as a Google LatLngLiteral
  defaultCenter: { lat: 41.5908, lng: -93.6208 }, // Central Iowa
  defaultZoom: 14,

  // Map type preferences
  preferredMapTypeId: 'hybrid', // 'hybrid' | 'satellite' | 'roadmap'
  
  // Geolocation thresholds
  locationTimeoutMs: 15000,
  staleLocationThresholdMs: 30000,
  lowAccuracyThresholdM: 50
};
```

---

## 6. Offline Field Pack and Fallback

If no API key is provided, or if the device is offline, or if Google servers cannot be reached:
- TerraSync **automatically falls back** to the built-in **Offline Field View**.
- Field polygons, crop identification, observation pins, GPS position, and tracks are rendered with high contrast against a built-in agronomic background.
- Select **Save field map offline** once while connected to explicitly save all demonstration field geometry and required local map assets on that device.
- **No Google or OpenStreetMap tiles are requested or cached for offline use**, ensuring provider-policy compliance and reliable operation in zero-coverage fields.

---

## 7. Attribution & Compliance

In accordance with Google Maps Platform Terms of Service:
- Google attribution, logo, and terms links are preserved and visible when Google Maps is active.
- Google Maps tiles and API scripts are never cached into the Service Worker or IndexedDB cache.
- Official Google Terms of Service and Privacy Policy links are provided in the application footer.
