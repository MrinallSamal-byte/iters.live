# Architecture

ITERasn hub is a vanilla-JS single-page-style frontend served by an Express backend. Firebase Firestore is the primary store, with optional SQL persistence for portal snapshots and Redis (or in-memory) caching. A Playwright worker performs SOA portal imports, Socket.IO provides real-time push where the runtime allows it, and OpenRouter/Gemini power the AI features.

## System diagram

```text
+--------------------------------------------------------------+
| Clients: Browser/PWA, Electron wrapper, Android app          |
| client/*.html + css/ + js/  (service worker offline cache)   |
+---------------------------+----------------------------------+
                            | HTTPS fetch /api/*, WebSocket
                            v
+--------------------------------------------------------------+
| server/index.js — Express app                                |
| helmet, CORS whitelist, rate limits (/api), compression      |
| static serving: /css /js /assets /uploads, dashboards        |
| URL obfuscation layer: /web/:sessionId, /r/:encoded          |
+------+------------------+---------------+------------+------+
       |                  |               |            |
       v                  v               v            v
+-------------+   +-------------+   +-----------+   +----------+
| Auth        |   | Feature     |   | AI        |   | Socket.IO|
| app-session |   | routes ->   |   | OpenRouter|   | rooms:   |
| JWT + demo  |   | services    |   | Gemini    |   | user:/   |
| + Firebase  |   +------+------+   +-----------+   | role:/   |
+-------------+          |                          | dept:    |
                         v                          +----------+
        +------------------------+
        | Storage layers         |
        | 1. Postgres portal_    |
        |    snapshots (opt.)    |
        | 2. Firestore users +   |
        |    feature collections |
        | 3. In-memory fallbacks |
        +-----------+------------+
                    ^
                    | normalized snapshots
        +-----------+------------------+
        | SOA import pipeline          |
        | soa.routes.js                |
        |   -> soa-scraper.service.js  |
        |   captcha session pool       |
        |   -> login -> section scrape |
        +------------------------------+

Redis cache when REDIS_URL is set; node-cache in-memory otherwise.
On Vercel: no HTTP listener, Socket.IO replaced by a no-op shim,
chat falls back to REST polling via /api/chat/*.
```

## Request lifecycle

1. The browser loads `client/index.html` (or a dashboard route such as `/dashboard/student`). Static assets are served by Express (`/css`, `/js`, `/assets`) or nginx/Vercel's CDN, with 1-hour cache headers on assets.
2. Client scripts call the API through the shared helper `window.APP.API.request()` in `client/js/main.js`, which attaches the stored `accessToken` as a Bearer header.
3. Express middleware runs in order: helmet, CORS origin check against `CORS_WHITELIST` (requests without an Origin always pass; production rejects unlisted origins), global `/api` rate limit, JSON body parsing (2 MB cap), compression, morgan logging.
4. Route handlers delegate to services; protected routes pass through `server/middleware/auth.js`.
5. Responses are JSON; a central error handler normalizes failures to `{ success, message }`.

## Auth flow

Three token types are accepted, tried in order by `authMiddleware` (and by the identical Socket.IO handshake middleware in `server/socket/socket.js`):

1. **App-session token** — a JWT signed with `JWT_SECRET` (`server/utils/app-session.js`) carrying the user payload. Issued at login by `auth.routes.js`; this is the primary mechanism.
2. **Local demo token** — valid only when Firebase Admin is not configured, enabling demo-mode logins without Firebase.
3. **Firebase ID token** — verified via `auth.verifyIdToken`; the user document is then fetched from the Firestore `users` collection by UID (with an email fallback).

Role data (`student` / `teacher` / `admin`) rides along in all three paths, and route guards enforce role requirements (for example, SOA import endpoints require the student role).

## SOA import pipeline

Implemented across `server/routes/soa.routes.js`, `server/services/soa-scraper.service.js`, and `server/services/soa-data.service.js`. Gated by `PORTAL_FEATURES_ENABLED`.

1. **Session pool entry** — `GET /api/soa/captcha` launches a fresh headless Chromium context, navigates to `soaportals.com`, waits out any Cloudflare challenge (`SOA_CHALLENGE_WAIT_MS`), locates the CAPTCHA image using heuristic scoring (hint text, inline data URI, dimensions, proximity to the input), and stores `{browser, context, page, captchaImage}` in an in-memory Map. Capacity is capped at `SOA_MAX_ACTIVE_SESSIONS` (default 2; forced to 1 under the memory-constrained feature flag) including pending launches. Idle sessions are evicted after 4 minutes, hard expiry is 10 minutes.
2. **User solves the CAPTCHA** — the CAPTCHA image is shown to the student, who submits their own registration number, password, and CAPTCHA text.
3. **Login** — `POST /api/soa/login` fills the form inside that session and submits. Credentials exist only as function arguments feeding the page's input fields; they are never logged, cached, or persisted.
4. **Section snapshots** — after login, the scraper visits each section of the portal (hash routes such as `#/student/studentsPersonalInfo`, `#/student/myclassattendance`, `#/student/studentresult`, `#/student/myclasstimetable`, plus click-path fallbacks) and captures tables/fields per section. The whole crawl must finish before `SOA_CRAWL_DEADLINE_MS` (default 90 s).
5. **Normalization** — raw sections are converted by `normalizeSoaPortalData` into a stable contract: profile summary, attendance records, marks/internal assessments, semester results, timetable, courses, fees, notifications, backlogs. Imports without meaningful data fail rather than persisting junk, and storage payloads are compacted (`compactPortalDataForStorage`) before persistence.
6. **Persistence** — the browser session is closed immediately, then `persistPortalDataForUser` writes:
   - SQL: delete-and-insert upsert into the `portal_snapshots` table (Postgres JSONB columns) when `DATABASE_URL`-backed SQL is configured;
   - Firestore: `set(..., { merge: true })` into the user's `users/{id}` document;
   - Memory: merged into `localPortalStore` as the last-resort fallback.
   If every configured durable store fails, the request errors with `PORTAL_PERSIST_FAILED` instead of silently dropping data.

Status codes surfaced to clients include `SUCCESS`, `AUTH_FAILED`, `CAPTCHA_REQUIRED`, `SESSION_EXPIRED`, `SCRAPER_BUSY`, `PORTAL_UNREACHABLE`, `BLOCKED_BY_SITE` (Cloudflare challenge did not clear), and `SCRAPER_UNAVAILABLE` (no usable Chromium in the runtime). Subsequent imports go through `POST /api/soa/resync`; `POST /api/soa/disconnect` clears connection state.

## Storage layers

Reads prefer the most durable source and fall back downward; writes mirror upward.

| Layer | Contents | Notes |
| --- | --- | --- |
| PostgreSQL (`portal_snapshots` table) | Normalized portal data per user: profile, attendance, marks, timetable, courses, results, notifications, backlogs, internal assessments, fees (JSONB columns), sync status | Created lazily via `CREATE TABLE IF NOT EXISTS`; keyed by `user_id`, unique index on `registration_number`. Enabled when SQL from `DATABASE_URL` is available |
| Firestore | `users` documents (identity, roles, portal snapshot fields), forum questions/answers, file metadata, payments, AI chat logs/study plans | Primary store; requires Firebase Admin env vars |
| MySQL tooling | Legacy schema/seeding (`server/database/init.sql`, seeders) | Used locally and by Docker Compose; not part of the portal snapshot path |
| Redis (`REDIS_URL`) | Cache | Production only; falls back to `node-cache` in-memory |
| In-memory process state | CAPTCHA session pool (`activeSessions`), `localPortalStore` snapshot fallback, rate-limit counters | Volatile; resets on restart. On serverless this makes memory-backed state per-instance only |

## Real-time layer

Socket.IO authenticates each handshake with the same token chain as HTTP (app-session JWT, then demo token, then Firebase ID token). On connect the socket joins:

- `user:{id}` (and legacy `user-{id}`)
- `role:{role}`
- `dept:{department}` / class rooms like `class:{department}-{year}{section}` via the `join:department` event

A `ChatService` wires chat events over sockets. When `VERCEL` is set, `server/index.js` substitutes a no-op `io` shim (all emits become safe no-ops) and clients use the REST chat endpoints mounted at `/api/chat` as a polling fallback.

## Frontend architecture

- No framework, no build step. Public pages (`index.html`, `login.html`, `register.html`, `creator.html`, `connect-portal.html`, `soa-scraper.html`) and role dashboards live directly in `client/`.
- Shared helpers in `client/js/main.js` export `window.APP`: `API.request` (fetch wrapper adding the Bearer token), `Storage`, `Socket`, `showToast`, and friends. Page logic lives in `client/js/pages/*.js` (e.g. `student-attendance.js`, `teacher-marks.js`, `admin-users.js`).
- Shared shells: `universal-sidebar.js`/`universal-sidebar.css` render the dashboard sidebar; `universal-profile.js` handles the profile dropdown; `offline-cache.js` coordinates PWA caching.
- Service worker (`client/service-worker.js`) precaches core URLs into `iter-core-v5` plus a runtime cache, serving an offline fallback page for uncached navigations; `manifest.json` enables installability.
- Login stores `accessToken` (+ legacy `token`) and redirects to the role dashboard (`/dashboard/<role>.html`), where page scripts gate rendering on session validity.

## Design system

Defined primarily in `client/css/style.css` with a modern overlay in `client/css/refined-ui.css`:

- Typography: **Space Grotesk** for display/body, **IBM Plex Mono** for figures and micro-labels
- Accent: coral `#ff5a4f` exposed as `--primary`, used sparingly over dark/off-white minimalist surfaces
- `refined-ui.css` adds hairline borders, mono labels, and refined spacing via its own `--r-*` custom properties layered on top of the base system
- Responsive behavior is centralized in `responsive-universal.css`; theme toggle persists light/dark preference
