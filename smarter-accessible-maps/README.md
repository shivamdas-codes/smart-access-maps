# Wayfinder — Smarter & More Accessible Navigation

An independent, interactive product-management prototype inspired by Google Maps. It explores how a mapping product could help people compare journeys by travel time, transfers, walking distance and accessibility confidence.

> **Important:** This is a portfolio concept, not a Google product and not an official Google Maps integration. It displays online driving-route estimates, but does not provide live transit, pedestrian directions, location tracking or verified accessibility information.

## Run locally

The app runs as a React/Vite frontend, a FastAPI REST backend, and PostgreSQL with PostGIS. Directly opening `index.html` does not start the API or database.

1. Install Docker Desktop and Docker Compose.
2. Copy `.env.example` to `.env` and set a local PostgreSQL password.
3. From this folder, run `docker compose up --build`.
4. Open `http://localhost:5173`. FastAPI's interactive API documentation is at `http://localhost:8000/docs`.

The API creates the PostGIS extension and application tables on startup. For a local frontend-only workflow, run `npm install` and `npm run dev`, and start the FastAPI service separately from `backend` after installing `backend/requirements.txt` and configuring `DATABASE_URL`.

## What works

- Preference controls for step-free access, fewer transfers, covered walking and clearer wayfinding, saved through the REST API (not applied to driving routes).
- Online place lookup and road-route alternatives for entered origins and destinations (requires an internet connection).
- Route option selection with route distance, an illustrative ETA planning range, route explanations and road instructions.
- Matching locally submitted road/access reports to route road names, with warnings explicitly labeled unverified.
- Local reports for construction, unsafe/closed roads, accessibility barriers and business details.
- Landmark-based spoken road instructions in browser-supported regional voices; no continuous turn-by-turn guidance.
- A route-change review that explains the alternative and requires the user to confirm before applying it.
- Origin/destination editing, automatic lookup on field change, swapping, quick destinations and empty-input validation.
- Interactive OpenStreetMap view with route lines, start/end markers, zoom and layer-style controls.
- Journey preview modal and save-to-browser flow, including offline text directions for saved journeys.
- A service worker that caches the app shell when served from localhost or HTTPS. Previously synced saved journeys and preferences are cached in browser storage for reference; map tiles, reports and new searches are not guaranteed offline.
- Saved journeys page with remove action (journeys persist in PostgreSQL and are cached locally after sync).
- Issue reports persist in PostgreSQL as unverified community submissions.
- About page explaining problem, hypothesis, MVP and product principles.
- Keyboard-operable native buttons, labels, dialog elements and reduced-motion support.

## Product scope and known limitations

The React client communicates with FastAPI over HTTP. The API stores reports, journeys and preferences in PostgreSQL; PostGIS is enabled and reports include an optional geography point for future coordinate-based reporting. Place lookup and road routing are proxied by the API to Photon and the public OSRM demo service. The public services may be unavailable, rate-limited or changed, so this is not a production integration. Results are driving routes only—not transit or pedestrian directions. No live or historical traffic, verified construction/closure feed, business verification, or accessibility dataset is connected. The displayed ETA range is illustrative, and community reports are unverified and only match routes when a report's place text matches a routed road name. Browser-generated client IDs are for prototype data scoping, not authentication or authorization. Do not use this prototype or its reports to make travel, safety or accessibility decisions.

## Suggested production architecture

- React.js + JavaScript
  - Frontend / User interface
- REST API / HTTP
- Python + FastAPI
  - Backend / Business logic
- PostgreSQL + PostGIS
  - Database / Geographic data
- Implemented in this prototype: Vite/React frontend, FastAPI JSON endpoints, SQLAlchemy persistence, and PostGIS-enabled PostgreSQL.
- Maps: Google Maps Platform Maps JavaScript API or another licensed mapping provider.
- Routing: provider routing API plus transit feeds where available.
- Accessibility data: verified station/stop/entrance/elevator attributes with provenance, timestamps and confidence levels.
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
- `src/main.jsx` — React entry point
- `legacy-app.js` — existing UI interactions, now backed by REST requests
- `backend/app/` — FastAPI endpoints, Pydantic schemas, and PostgreSQL/PostGIS models
- `docker-compose.yml` — local web/API/PostGIS development stack
- `docs/PRODUCT_CASE_STUDY.md` — PM case study, research framing, PRD, prioritization, metrics and roadmap
