# TerraSync — Field Consultant Web Application

TerraSync is a field agronomy web application designed for crop consultants who review grower accounts, inspect field boundaries, record scouting observations, and prepare recommendation and sales documents directly on grower premises, even when cellular connectivity drops.

## Live Application

Production deployment on GitHub Pages:
https://ankitallm.github.io/crop-consultant-offline-app/

---

## Core Capabilities (Release 1)

### 1. Hybrid Map Architecture: Online Google Maps + Offline Field View
- **Google Maps Integration**: When online and configured with an API key, renders Google Maps with hybrid satellite/road views, custom severity pins, and official Google terms and attribution.
- **Zero-Network Offline Field View**: When offline or if no API key is supplied, automatically falls back to an offline field view. Field boundaries and observation markers are rendered against a neutral, high-contrast canvas with a clear *"Field boundaries only — basemap unavailable"* banner. **Zero external map tiles are downloaded or cached**, ensuring 100% compliance with provider terms and reliable operation with no network.
- **Graceful Error Recovery**: Automatically switches to the offline field view if Google Maps scripts fail to load or are blocked, preserving all field selections and observation state.

### 2. Real Device Geolocation & Proximity
- **Real Browser Geolocation**: Clean `LocationService` state machine (`idle`, `locating`, `current`, `stale`, `permission-denied`, `unavailable`).
- **Locate Me & Continuous Follow**: "Locate Me" acquires single-shot GPS fix with accuracy reporting; "Follow" continuously updates camera position.
- **Pan-to-Suspend**: Dragging or panning the map instantly suspends follow mode, preventing unwanted camera jumps while inspecting a field.
- **Field Proximity & Boundary Containment**: Computes ray-casting point-in-polygon containment (`Inside field boundary`) and Haversine straight-line distance to the field centroid.

### 3. Rigorous Observation Location Provenance
- Observations clearly record coordinate provenance (`device`, `sample`, `manual`, or `null`).
- **No Artificial Fallbacks**: If GPS is disabled or unavailable, observations are explicitly saved as unlocated (`location: null, lat: null, lng: null`), never assigning field polygon vertices as fake coordinates.
- **Demo Walk Simulation**: Clearly labeled simulated perimeter walk for demonstrations without misrepresenting device position.

### 4. Resilient Offline Drafting & Document Generation
- Autosaved recommendation and sales drafts with transaction confirmation and conflicting-tab protection.
- Printable draft estimates with agronomic and pricing disclaimers.
- JSON backup export of device records.
- Service Worker `v9` caching the application core while explicitly excluding map tiles and API responses.

### 5. Authenticated Cross-Browser Cloud Sync
- Optional Supabase email/password authentication and user-scoped PostgreSQL storage.
- Observations and recommendation/sales documents save locally first, then synchronize automatically when online.
- The same signed-in user can retrieve records in Chrome, Edge, Safari, private browsing, or another device.
- Newest-change-wins conflict protection runs both in the client and database; cloud status is shown only after a server acknowledgement.
- Row-level security prevents authenticated users from reading or writing another user's records.

Setup is required before cloud sync becomes active. See [docs/cloud-sync-setup.md](docs/cloud-sync-setup.md) and run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor.

---

## Configuration & Google Maps Setup

TerraSync works immediately out-of-the-box in the Offline Field View without any configuration. To enable online Google Maps imagery:

1. Follow the instructions in [docs/google-maps-setup.md](docs/google-maps-setup.md) to obtain and restrict a Google Maps API key.
2. Open `src/config.js` and set your key:
   ```javascript
   window.TERRASYNC_CONFIG = {
     googleMapsApiKey: 'AIzaSyYourRestrictedKeyHere'
   };
   ```

---

## Testing & Verification

Run the automated test suite (20 unit tests across geometry, location, and map controller):

```bash
node tests/run-tests.js
```

Detailed manual acceptance procedures are provided in [docs/testing.md](docs/testing.md).

---

## Current Architecture & Limitations

- **Local-First Storage**: Data is stored immediately in IndexedDB (version 5). When Supabase is configured and the consultant signs in, user-created observations and documents synchronize across browsers and devices. Without configuration or authentication, work remains on the current browser/device.
- **Demonstration Controls**: The network toggle is a demonstration switch simulating offline state; it does not sever the physical operating system connection.
- **Sample Agronomic Data**: Grower contacts, fields, soil readings, NDVI scores, and product catalog pricing are demonstration data.
- **Consultant Responsibility**: Product suitability, application rates, chemical compatibility, and label restrictions must be verified by a certified crop advisor.
