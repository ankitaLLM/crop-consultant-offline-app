# TerraSync — Offline Field Consultant

Prototype workspace for crop consultants to review grower and field information, record scouting observations, and draft printable recommendations.

## Live demo

https://ankitallm.github.io/crop-consultant-offline-app/

## Prototype status

- Sample grower accounts, field boundaries, crop history and product catalog.
- Observations and single-product recommendation documents saved locally in IndexedDB.
- Printable worksheets through the browser's Print / Save PDF dialog.
- Service worker app-shell caching after an initial successful online load.
- **GPS, field-map downloads and cloud synchronization are simulations.** A “Synced” badge does not mean anything was uploaded or backed up.
- NDVI and soil charts are sample data, not live diagnostics. This is not agronomic application advice or an approved sales order.
- No sign-in, server, remote backup, real email sharing or multi-device sync is implemented. Do not enter confidential grower information in this public demo.
- Browser data clearing can remove local records. Offline map availability is not guaranteed. The manual offline toggle is a demo control, not an airplane-mode test.

## Use

Open the demo online first. Select a grower and field, add an observation, or create a recommendation. Saved recommendations can be opened and printed. Use a desktop-size browser for this version; the existing small-screen layout hides the field action panel below 1025px.

## Source

Plain HTML, CSS and JavaScript; Leaflet maps; IndexedDB; service worker. External Leaflet and font resources require initial connectivity. GitHub Pages serves the static app from the main branch root.

## Next priorities

Replace simulated sync with acknowledged server writes and conflict handling; implement verified map packages; add real geolocation; improve responsive layouts; remove duplicate action controls; add safe draft editing, data migrations, input escaping, access control and offline reliability tests.
