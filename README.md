# TerraSync — Offline Field Consultant

TerraSync is a web prototype for crop consultants who need to review sample grower and field information, record scouting observations, and prepare field documents when connectivity is unreliable.

## Live demo

https://ankitallm.github.io/crop-consultant-offline-app/

## Current capabilities

- Sample grower accounts, field boundaries, crop history, diagnostics, and product catalog.
- Device-local scouting observations.
- Autosaved recommendation and sales drafts that can be closed, reopened, edited, and marked ready for review.
- Transaction-confirmed saves, conflicting-tab edit protection, and JSON backup downloads.
- Migration of recommendation records created by the previous demo version without claiming that they reached a server.
- Printable draft estimates with a prominent draft disclaimer.
- Cached application shell for reopening the workspace after an initial successful online visit.
- Responsive field actions and draft cards on smaller screens.

## Prototype limitations

- There is no backend, authentication, cloud backup, email sharing, or multi-device synchronization. All new work stays in this browser.
- The network switch is a demonstration control. It does not disconnect the browser from the internet.
- Device GPS and offline basemap downloads are not implemented. The perimeter walk is an animation.
- NDVI, soil readings, contacts, field coordinates, catalog prices, and agronomic content are fictional sample data.
- Clearing browser data can remove local records. Download backups regularly; automatic backup restore is not yet implemented.
- Product suitability, application rates, labels, prices, and legal requirements must be independently verified by a qualified consultant.

## Technology

Plain HTML, CSS, and JavaScript; IndexedDB; a scoped service worker; Leaflet and OpenStreetMap for online basemaps. GitHub Pages serves the static application from the `main` branch.

## Next production milestone

Add authenticated backend synchronization with stable client-generated IDs, idempotent writes, server acknowledgements, retries, conflict resolution, audit history, encryption controls, and automated offline-to-online tests.
