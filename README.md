# Waypoint

A static travel atlas for the awkward journeys between a city, its nearby stations, and its airports. Built by Stunity Tech — by Prateek.

## Run locally

Double-click `start.cmd`, or run `npm start` and open **http://localhost:8816/**. Node.js 22 or later is required for the local server and build, but visitors need only a modern browser. No npm dependencies, API keys or accounts are needed. Viewing the exported site needs only static hosting; full manual source refresh runs through the included local server. Opening the HTML directly as a file cannot load the JSON datasets.

## Features

- **Plan a journey:** local city/station/airport search, explicit online place search, map endpoints, geolocation, travel date and group size. Compare direct trains, one-change train journeys, nearby-airport flights, one-stop air concepts, train-to-airport self-transfer concepts, and private cab estimates.
- **Whole-trip comparisons:** ground access, check-in/exit buffers, train waiting and transfers. Filter transport, budget, time, connections, rail class and airport reach. Change the value of an hour of your time to adjust the balance between money and speed.
- **Nearby:** all bundled stations and airports within a selected radius, sorted by straight-line distance, with directions and paginated results. Outside India, rail stations can be requested from OpenStreetMap Overpass within 50 km. Airports are global.
- **Airport network:** every reported destination in the source for an airport, passenger totals, filtering, map links, and searches in either direction. Indian airport data is bundled; other covered airports load on demand.
- **Useful corridor hubs**, three-way comparison, local saved trips, deep-link sharing, selected-itinerary printing, keyboard navigation and reduced-motion support.

## Accuracy and scope

This is a connection-discovery tool, not a booking engine. It does not claim the cheapest bookable fare or live availability. All ₹ ranges are explicitly modelled per-person planning estimates. A budget filter includes ranges whose lower bound fits; a range may extend above the chosen budget. No buses are invented where route evidence is unavailable; compare actual operators separately. Taxi distances and road lines are schematic and must be checked in Maps.

Train timetables come from a community dataset with **unknown effective timetable date**. A recent download is not a current timetable. Train running days and connection waits filter the snapshot only. Check NTES/IRCTC for the current train, service date, seat class and availability. Origins/destinations consider eight nearby stations within 75 km. Up to one main-leg change is considered. Connections need at least 90 minutes; origin departure can roll into the next day and is shown as such in the details. Flight schedules are not available, so airline times and compatibility are not asserted. Air+rail plans are explicitly self-transfer concepts.

Air connections use AirportMiles reported traffic pairs. DGCA counts combine both directions. They **do not establish distinct inbound/outbound service, a current nonstop flight, or service on the selected date**. All reported pairs are shown in the explorer, including low-traffic pairs. Route planning excludes pairs with fewer than 1,000 reported passengers. This threshold is a planning heuristic, not proof of a current service. The UI links to actual flight searches.

Best balance ranks the middle of the fare range + total hours × the chosen time value + ₹600 per change, with a small air-mode inconvenience allowance. Lowest estimate compares fare-range midpoints. Carbon uses illustrative mode factors and is not a flight-specific emissions calculation. The engine shows a bounded selection of candidates rather than promising an exhaustive optimal routing search.

## Sources and licences

`public/data/current.json` points to the active snapshot and its manifest. The manifest records dataset counts, source download timestamps, source-generated dates and available reporting periods separately. Legacy bundles retain their original bundle date without inventing missing download timestamps.

| Source | Use | Licence / limitations |
|---|---|---|
| [Indian Railway Data](https://github.com/prasenjit-27/Indian-Railway-Data) | Station coordinates, ordered train stops, snapshot running days/times | MIT; licence retained in `public/data/rail-license.txt`. Invalid coordinates and placeholder junction nodes excluded. |
| [OurAirports](https://ourairports.com/data/) | Airport locations, scheduled-service flags | Public domain. Service flags are not date-specific schedules. |
| [AirportMiles](https://airportmiles.com/api) | Reported airport connections | Airport/coordinate fields CC0. Source-specific traffic terms apply and remain embedded in `flights.json`. **DGCA India** is acknowledged for Indian city-pair counts; other sources include US DOT and Eurostat, named in each airport record. Traffic periods are recorded in the source entries. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Interactive tiles, Nominatim search, Overpass stations outside India | ODbL attribution; usage policies apply. |
| [Leaflet](https://leafletjs.com/) | Map UI, self-hosted version 1.9.4 | BSD-2-Clause. |

Nominatim searches happen only after an explicit **Search online** action, never for autocomplete. Local suggestions are bundled. Requests are queued at least 1.2 seconds apart and cached seven days. The public service has an application-wide limit of one request per second; this client-only personal tool cannot coordinate between multiple visitors. For broad public traffic, replace it with a suitable provider or shared rate-limited service. Do not bulk-fetch map tiles or put them in an offline service-worker cache. Map attribution stays visible. Provider availability and CORS can change; failures are shown, and bundled planning still works. Coordinates are requested only on explicit user action. Saved journeys remain in localStorage. Shared URLs include the selected locations.

## Checks and deployment

`npm run check`, `npm test`, `npm run build`. The build exports public app assets and **only the active dataset** into `dist/`, with a portable flat dataset pointer. Previous snapshots, refresh locks/status, raw caches and server code are excluded. Deploy `dist/` to any static host. No secrets or private guest data are used. Refresh and build commands do not commit, push or deploy anything; publishing is a separate step. The live site is **https://hedaprateek.github.io/waypoint/**. Pushing to `main` runs the checks and publishes the build through GitHub Actions.

The tracked `.openai/hosting.json` retains the registered private Sites identity. The current corporate network blocks the Sites helper download; the same build is portable to GitHub Pages. The registered Site must be reused if Sites hosting is completed later.

## Refreshing data

Use **Refresh data** above the planner at **http://localhost:8816/**. Alternatively run **`npm run refresh`**. No timer or scheduled job downloads new source data. A 90-day age indicator is informational; it never starts a download.

A manual refresh downloads the station directory, approximate train timetable, railway licence, airport directory, airport connection index and every covered Indian airport record. Airport requests run with at most three concurrent connections. Old on-disk airport records are never reused as newly downloaded data. Map tiles and the pinned Leaflet library are not downloaded by this process.

The refresh checks source formats, coordinates, licence, airport identities, counts, train station references and reporting dates. An unexpected coverage loss of more than 20%, or a failed/invalid source, aborts the entire refresh and keeps the last valid snapshot. After all files are ready, an atomic `current.json` pointer switches to a new immutable generation in `public/data/snapshots/`. Existing tabs keep reading their original generation until reloaded. Previous snapshots remain available locally; exports include only the active generation.

Progress and the last success/failure are recorded in ignored `.cache/refresh-status.json`. A cross-process lock prevents overlapping server/CLI refreshes. An interrupted refresh is identified after restart without replacing active data. The browser resumes polling if a refresh is already running, and preserves the current journey and saved trips if a refresh or reload fails.

**Data status** shows when each source was downloaded and, separately, its supplied snapshot/reporting period. A recently downloaded old report remains visibly old. A missing timetable effective date stays unknown. Approximate fares and durations are model calculations and are recalculated with the journey; they are not relabelled as downloaded prices.

On static hosting the button reads **Reload published data**. It reloads the latest published snapshot and clears lookup caches; it cannot write new source files to GitHub or start a server job. To publish newer data later, refresh locally, validate, build, and publish when approved.

Foreign airport lookups expire after 30 days. If an expired lookup cannot be updated, its last saved data remains usable and is explicitly marked stale. Manual reload clears only travel lookup caches, never saved trips. Geocoding and overseas railway lookup caches retain their seven-day lifetime.

The old `scripts/fetch-data.mjs` and `scripts/prepare-data.mjs` entry points now each perform the full validated refresh for compatibility. Use `npm run refresh` once rather than running both. The local refresh API accepts only same-origin JSON POST requests on loopback, checks the Host header and does not expose arbitrary file or source URLs.
