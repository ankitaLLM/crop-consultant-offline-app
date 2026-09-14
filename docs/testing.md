# TerraSync Verification & Testing Guide

This document details automated unit testing and manual acceptance test procedures for **TerraSync (Release 1)**.

---

## 1. Automated Unit Tests

TerraSync includes automated test suites covering computational geometry, geolocation state transitions, and the map adapter lifecycle. All tests use Node.js built-in test runner without requiring external test dependencies.

### Running Unit Tests
```bash
node tests/run-tests.js
```
or run individual suites:
```bash
node --test tests/geometry.test.js
node --test tests/location-service.test.js
node --test tests/map-controller.test.js
```

### Test Suite Coverage

| Suite | File | Tests | Validations |
| :--- | :--- | :--- | :--- |
| **Geometry** | `tests/geometry.test.js` | 8 | Coordinate validity, order conversions (`[lat, lng]` vs GeoJSON `[lng, lat]`), Haversine distance, polygon centroid, ray-casting point-in-polygon containment, bounds calculation, straight-line distance formatting. |
| **Location Service** | `tests/location-service.test.js` | 6 | State machine transitions (`idle` -> `locating` -> `current` -> `stale`), permission rejection handling, continuous watch with auto-suspend on map pan, low-accuracy flag (>50m), unreferenced timers. |
| **Map Controller** | `tests/map-controller.test.js` | 6 | Adapter interface enforcement, auto-mount offline adapter when API key missing, auto-mount Google adapter when key present & online, graceful fallback on script block/network failure, state preservation during adapter switches, event forwarding. |

**Total: 20 passed unit tests.**

---

## 2. Manual Acceptance Test Matrix

### Scenario A: Zero-Network & Offline Field View (Default Out-of-the-Box)
1. Open TerraSync in your browser (`http://localhost:8080`).
2. Without a Google Maps API key configured in `src/config.js`, verify:
   - The map displays a neutral, high-contrast agronomic background (`#0d1520`).
   - A distinct banner appears across the map header: **"Offline field map · boundaries and observations"**.
   - Grower field polygons are drawn in distinct crop colors (Corn: Amber, Soybeans: Emerald, Wheat: Purple).
   - Clicking on any field highlights the polygon and loads the diagnostic dashboard in the right panel.
   - Inspect browser network tab: confirm **zero** tile requests to external tile servers.

### Scenario B: Real Device Geolocation & Proximity
1. Ensure your browser allows location access when prompted.
2. In the left panel under **Device Location**, click **"Locate Me"**:
   - The status badge changes from `Location: Idle` to `Location: Locating...` then `Location: Current`.
   - The accuracy display shows the reported GPS accuracy (e.g. `±12m`).
   - The map pans to center on your position with a blue pulsing dot and accuracy radius.
   - Under the location controls, verify the field proximity calculation:
     - If inside the boundary: displays `📍 Inside field boundary (X m to center)`.
     - If outside: displays `📍 X km to field center (straight-line)`.
3. Click **"Follow"**:
   - Status badge displays `Location: Following`.
   - Manually drag/pan the map surface: verify follow mode immediately suspends (`Location: Current`), preventing jarring snaps while inspecting fields.

### Scenario C: Observation Provenance (Device vs. Unlocated vs. Demo)
1. Select a field and click **"Add Scouting Observation"**.
2. When a real GPS fix is active:
   - The checkbox **"Attach device GPS location"** is checked.
   - The helper text displays: `Fix: [lat], [lng] (±[acc]m) [source: device GPS]`.
   - Complete the form and click **"Save Observation"**.
   - Verify the observation appears in the log with badge `📍 device`.
3. Uncheck the checkbox or deny location permission:
   - Save another observation.
   - Verify it is saved with `lat: null, lng: null` and badge `📍 unlocated`.
   - Verify it is **never** assigned an artificial polygon vertex coordinate.
4. Click **"Demo walk (Simulated)"**:
   - Status clearly shows `Simulation: Lat ..., Lng ...` and notification confirms sample animation.
   - Open observation modal: helper text displays `[source: sample demo]`.
   - Saving an observation while simulation is active records `source: sample`.

### Scenario D: Google Maps Online View (Optional Key)
1. Add a valid restricted key in `src/config.js`.
2. Reload with internet connection active:
   - Google Maps loads with satellite/hybrid imagery.
   - Official Google logo, attribution, and terms links are visible.
   - Switch back and forth between offline and online using the network toggle: confirm all field polygons and observation pins remain intact without reloading.

### Scenario E: Service Worker & PWA Cache
1. Open DevTools > Application > Service Workers:
   - Confirm Service Worker `v6` is registered and active.
2. Open DevTools > Application > Cache Storage:
   - Confirm `terrasync-core-v6` contains core HTML, CSS, JS, and Leaflet assets.
   - Confirm Google Maps endpoints (`maps.googleapis.com`, `maps.gstatic.com`) are **not** cached.
3. Toggle browser to "Offline" in DevTools Network tab:
   - Refresh page: the application loads reliably from cache with full offline field boundaries and drafting capabilities.
