# Wayfinder — Smarter & More Accessible Navigation

An independent, interactive product-management prototype inspired by Google Maps. It explores how a mapping product could help people compare journeys by travel time, transfers, walking distance and accessibility confidence.

> **Important:** This is a portfolio concept, not a Google product and not an official Google Maps integration. It displays online driving-route estimates, but does not provide live transit, pedestrian directions, location tracking or verified accessibility information.

## Run locally

No build step or package installation is required.

1. Download and extract the project ZIP.
2. Open `index.html` in a modern browser.
3. For a local web server, run `python -m http.server 8000` from this folder and open `http://localhost:8000`.

## What works

- Preference controls for step-free access, fewer transfers, covered walking and clearer wayfinding (the road-routing service does not apply them).
- Online place lookup and road-route alternatives for entered origins and destinations (requires an internet connection).
- Route option selection with route distance, estimated driving time and road instructions.
- Origin/destination editing, automatic lookup on field change, swapping, quick destinations and empty-input validation.
- Interactive OpenStreetMap view with route lines, start/end markers, zoom and layer-style controls.
- Journey preview modal and save-to-browser flow.
- Saved journeys page with remove action (uses browser `localStorage`).
- Accessibility issue report form (stores reports locally in the browser).
- About page explaining problem, hypothesis, MVP and product principles.
- Keyboard-operable native buttons, labels, dialog elements and reduced-motion support.

## Product scope and known limitations

The map uses Leaflet and OpenStreetMap tiles; place lookup uses Photon and road routing uses the public OSRM demo service. Search terms are sent to Photon and resolved coordinates are sent to OSRM. The public services may be unavailable, rate-limited or changed, so this is not a production integration. Results are driving routes only—not transit or pedestrian directions—and accessibility preferences cannot be applied or verified. Do not use these estimates to make travel or accessibility decisions.

## Suggested production architecture

- Frontend: React / Next.js with accessible component primitives.
- Maps: Google Maps Platform Maps JavaScript API or another licensed mapping provider.
- Routing: provider routing API plus transit feeds where available.
- Accessibility data: verified station/stop/entrance/elevator attributes with provenance, timestamps and confidence levels.
- Backend: API layer for route preferences, saved journeys and issue reports.
- Data operations: moderation and validation pipeline for user-submitted accessibility reports.
- Analytics: event instrumentation, privacy review, experiment assignment and dashboards.

## Suggested validation plan

1. Interview 8–12 people across wheelchair users, people with temporary mobility constraints, older adults, caregivers and regular transit commuters.
2. Conduct task-based usability tests with the clickable prototype.
3. Validate route attribute language with accessibility specialists and transit operators.
4. Run a small pilot in one city only after data quality and safety reviews.
5. Compare task completion, confidence, route selection and reported accessibility mismatches against a baseline.

## Project files

- `index.html` — app structure
- `styles.css` — responsive interface and design system
- `app.js` — interactions and local persistence
- `docs/PRODUCT_CASE_STUDY.md` — PM case study, research framing, PRD, prioritization, metrics and roadmap
