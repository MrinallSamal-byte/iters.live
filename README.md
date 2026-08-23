# ITERasn hub

ITERasn hub is a college management system for ITER / SOA university students. It pairs a vanilla HTML/CSS/JavaScript frontend with a Node.js + Express backend, stores data primarily in Firebase Firestore (with optional SQL persistence), and can import a student's official SOA portal data through a headless Playwright scraper that the student authorizes by solving their own CAPTCHA. An AI assistant via OpenRouter/Gemini, PWA offline support, real-time updates over Socket.IO, and Electron/Android wrappers round out the platform.

## Features

### Student

- Dashboard overview with attendance, marks, timetable, and academic summary
- Study notes and previous-year questions (PYQs)
- Admit card view/download
- Events and clubs
- Hostel menu
- Forum (questions and answers)
- AI assistant and study plans
- Payment history and payment flow
- One-click import of official SOA portal data (profile, attendance, marks, timetable, results)

### Teacher

- Attendance management and marking
- Marks upload
- Assignment management
- Notes/material upload
- Question bank
- Rubric creator
- Student list workflows

### Admin

- User management
- Approval queue
- Announcements
- Departments
- Analytics
- Settings

### Platform

- PWA with service-worker caching for offline use (`client/service-worker.js`, `client/manifest.json`)
- AI tools backed by OpenRouter and/or Gemini
- SOA portal import pipeline (see [Security model](#security-model) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))
- Forum and real-time notifications via Socket.IO (REST polling fallback on serverless)
- Clubs, payments, analytics modules
- REST fallbacks for every real-time feature so serverless deployments stay functional
- Native Android client under `android-app/` and desktop wrapper under `electron/`

## Security model

> **SOA portal import — how credentials are handled**
>
> The SOA import never sees your password at rest. When you connect your portal:
>
> 1. The server opens a fresh headless Playwright session against `soaportals.com` and extracts the CAPTCHA image into an **in-memory** session slot.
> 2. You type your registration number, password, and the CAPTCHA solution yourself. The credentials are proxied straight into that browser session's login form.
> 3. Credentials are **never logged, cached, or persisted** — not in the database, not in logs. Only the scraped academic data is normalized and stored.
> 4. The browser session is closed as soon as extraction finishes (success or error). Idle sessions expire after 4 minutes; hard expiry is 10 minutes.
> 5. Concurrent sessions are capped (`SOA_MAX_ACTIVE_SESSIONS`, default `2`) so abandoned CAPTCHA slots cannot pile up.
>
> If you self-host this software, you are responsible for running it honestly and securely: keep secrets out of the repo, use HTTPS, and do not attempt to automate logins against portals you do not own.

Git-tracked files contain no secrets: `.env`, `server/serviceAccountKey.json`, and uploaded files are gitignored (`uploads/` contains only `.gitkeep`). Firebase configuration is env-var driven.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Vanilla HTML/CSS/JavaScript, service worker + manifest (PWA) |
| Backend | Node.js (>= 18), Express 4 |
| Primary datastore | Firebase Firestore via `firebase-admin`; optional Realtime Database mirroring via `FIREBASE_DATABASE_URL` |
| Optional SQL | PostgreSQL (`pg`, `@vercel/postgres`) for `portal_snapshots`; MySQL tooling exists for legacy seeding |
| Cache | Redis (`REDIS_URL`) in production, in-memory (`node-cache`) fallback |
| Real-time | Socket.IO 4 (degrades to REST polling on Vercel/serverless) |
| Portal import | Playwright (Chromium) headless scraper |
| AI | OpenRouter API and Google Gemini (`@google/generative-ai`) |
| Auth | App-session JWTs (`jsonwebtoken`) + Firebase ID token verification |
| Testing | Jest (jsdom), Playwright Test |
| Desktop/Mobile wrappers | Electron, native Android (Kotlin) |

## Architecture

```text
                       +---------------------------+
   Browser / PWA -----> |      Static client        |
   Electron / Android    |  client/*.html, css, js   |
                       +-------------+-------------+
                                     | fetch /api/*
                                     v
+-------------------+     +--------------------------+
| Socket.IO         |<--->|      Express API         |
| user:/role:/dept: |     |   server/index.js        |
+-------------------+     +----+---------+-----+-----+
                               |         |     |
             +-----------------+         |     +------------------+
             v                           v                        v
   +------------------+     +---------------------+    +----------------+
   | Firestore        |     | Postgres (optional) |    | Redis cache    |
   | users, forum, ...|     | portal_snapshots    |    | (in-memory fb) |
   +------------------+     +---------------------+    +----------------+
             ^
             | normalized snapshots
   +---------+----------------------+
   | Playwright worker              |
   | SOA captcha session pool       |
   | -> login -> section snapshots  |
   +--------------------------------+

   OpenRouter / Gemini <--- ai.routes.js
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for request lifecycle, the full SOA import pipeline, storage layers, and the design system.

## Quick start

### Prerequisites

- Node.js >= 18 and npm
- A Firebase project with a service account (for production-like auth/data); without one the app falls back to local demo mode
- Optional: PostgreSQL (portal snapshot persistence), Redis (production cache)
- For SOA imports: a runtime where Playwright can launch Chromium (see [Troubleshooting](#troubleshooting))

### Install and configure

```bash
npm install
cp .env.example .env
```

Edit `.env`. At minimum set:

- `JWT_SECRET` and `JWT_REFRESH_SECRET` (long random strings)
- `CORS_WHITELIST` with your origins

Firebase setup:

1. In the Firebase console, create a service account with Firestore access and download its JSON key.
2. Provide it either as the single JSON string `FIREBASE_SERVICE_ACCOUNT={...}`, or as the three split variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
3. Set `FIREBASE_DATABASE_URL` only if you want Realtime Database mirroring in addition to Firestore.
4. Never commit the key file; `server/serviceAccountKey.json` is gitignored but env vars are the supported path.

### Seed demo data and run

```bash
npm run seed
npm run dev
```

The frontend is served at `http://localhost:3000` (client dev server) and the API at `http://localhost:5000`.

### Demo accounts

`npm run seed` creates demo-only accounts (also available through the local demo-login fallback when Firebase Admin is not configured):

| Role | Registration number | Password |
| --- | --- | --- |
| Student | `STU20250001` | `Student@123` |
| Teacher | `TCH2025001` | `Teacher@123` |
| Admin | `ADM2025001` | `Admin@123456` |

These are for local development only. Change or remove them before exposing any deployment publicly.

## Environment variables

The most important variables (full list with comments in [.env.example](.env.example)):

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` enables permissive CORS; production rejects non-whitelisted origins |
| `PORT` | HTTP port (default `5000`) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for app-session and refresh tokens. Required in production |
| `FIREBASE_SERVICE_ACCOUNT` | Full service-account JSON string, or use the three split vars below |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Split Firebase admin credentials (useful on Render/Vercel) |
| `FIREBASE_DATABASE_URL` | Optional Realtime Database mirroring |
| `CORS_WHITELIST` | Comma-separated allowed origins; supports `*` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | Global `/api` rate limit (default 15 min / 100 req) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini-powered assistant |
| `OPENROUTER_API_KEY` (+ `OPENROUTER_CHAT_MODEL`, etc.) | OpenRouter chat/CAPTCHA models |
| `PORTAL_FEATURES_ENABLED` | Master switch for SOA portal import (`false` disables it cleanly) |
| `SOA_CRAWL_DEADLINE_MS` | Hard deadline for a full portal crawl (default `90000`; use `50000` on Vercel) |
| `SOA_CHALLENGE_WAIT_MS` | How long to wait out a Cloudflare challenge before returning `BLOCKED_BY_SITE` (default `20000`) |
| `SOA_MAX_ACTIVE_SESSIONS` | Max concurrent headless browser sessions (default `2`) |
| `SOA_PIN_DNS` | Opt-in DNS pinning for the portal host (`1` to enable; usually counterproductive behind Cloudflare) |
| `REDIS_URL` | Production cache; falls back to in-memory cache when unset |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DATABASE_URL` | SQL connectivity; `DATABASE_URL` (Postgres) drives `portal_snapshots` persistence |

## Deployment

Detailed step-by-step guides live in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Summary:

| Target | Files | Notes |
| --- | --- | --- |
| Vercel | `vercel.json`, `api/index.js` | Serverless function reuses the full Express app. Socket.IO degrades to REST polling (`/api/chat/*`); uploads land in ephemeral `/tmp`. Browser download is skipped at install time, so SOA import needs an externally supplied Chromium binary to work there |
| Render | `render.yaml` + `Dockerfile` | Docker runtime with Playwright Chromium preinstalled, persistent uploads disk, health check on `/health`, keepalive pinger enabled |
| Docker Compose | `docker-compose.yml`, `Dockerfile`, `nginx/nginx.conf` | MySQL + app + nginx reverse proxy serving the client statically |
| PM2 | `ecosystem.config.js` | Cluster mode, `max_memory_restart 1G`, logs in `./logs` |

## Testing

```bash
npm test                      # Jest unit/integration tests with coverage
npm run test:mobile-contracts # Mobile parity contract suites (demo auth, SOA data, persistence)
npm run test:e2e              # Playwright end-to-end tests (e2e/)
npm run test:scraper          # SOA scraper status-path checks
```

## Project structure

```text
.
├── api/                  # Vercel serverless entry; reuses the full Express app
├── client/               # Vanilla HTML/CSS/JS frontend (no build step)
│   ├── dashboard/        # Role dashboards (student-*, teacher-*, admin-*)
│   ├── css/              # style.css design system + refined-ui.css overlay
│   ├── js/               # Shared helpers; page scripts in js/pages/
│   ├── assets/
│   └── partials/
├── server/               # Express API
│   ├── routes/           # One router per feature area
│   ├── services/         # SOA scraper, normalization/persistence, AI, chat
│   ├── middleware/       # Auth (app-session/demo/Firebase), errors
│   ├── database/         # Firebase admin init, SQL helpers
│   ├── socket/           # Socket.IO auth and room wiring
│   ├── seed/             # Demo data seeders
│   └── scripts/          # Ops and maintenance utilities
├── e2e/                  # Playwright specs
├── android-app/          # Native Android client (Kotlin)
├── electron/             # Desktop wrapper
├── scripts/              # Setup, build, and test helper scripts
├── docs/                 # DEPLOYMENT.md, ARCHITECTURE.md
├── vercel.json           # Vercel config (static output + single function)
├── render.yaml           # Render blueprint
├── docker-compose.yml    # Local/self-host stack
└── ecosystem.config.js   # PM2 cluster config
```

## API overview

Main route mounts registered in `server/index.js`:

| Mount | Area |
| --- | --- |
| `GET /health`, `GET /api/health` | Health checks |
| `/api/auth` | Login, registration, app-session tokens |
| `/api/soa` | SOA portal import: status, CAPTCHA session, login/resync, disconnect |
| `/api` + `/api/users` | Profile (`/api/profile/*`, `/api/users/me`) and user management |
| `/api/attendance` | Attendance records |
| `/api/marks` | Marks and results |
| `/api/notes`, `/api/pyq`, `/api/question-bank`, `/api/rubrics` | Academic materials |
| `/api/timetable`, `/api/agenda`, `/api/calendar.ics` | Scheduling |
| `/api/assignments`, `/api/admitcard`, `/api/hostel`, `/api/events`, `/api/clubs` | Student services |
| `/api/forum` | Forum questions/answers |
| `/api/payments` | Payment flows and history |
| `/api/ai` | AI assistant endpoints (OpenRouter/Gemini) |
| `/api/chat` | REST chat endpoints used as polling fallback where Socket.IO is unavailable |
| `/api/admin`, `/api/teacher` | Role-scoped operations |
| `/api/analytics`, `/api/search`, `/api/notifications`, `/api/bulk` | Platform utilities |
| `/api/files` | File upload/download |
| `/api/portal` | Legacy portal routes |
| `/api/mobile` | Mobile-client contract endpoints |
| `/web/*`, `/r/*` | Obfuscated session URLs and encoded-link redirects |

## Troubleshooting

**Playwright browser missing** — if SOA import reports the scraper unavailable because Chromium is not installed:

```bash
npx playwright install chromium
```

On Debian-based images use `node ./node_modules/playwright/cli.js install --with-deps chromium` (as the Dockerfile does). Alternatively point `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (or `CHROMIUM_PATH`/`CHROME_BIN`) at an existing Chromium binary.

**Firebase permission errors** — verify the service account has Firestore access, the env vars match your project (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), and your Firestore security rules/APIs are enabled. Locally without Firebase configured, use the demo accounts above.

**SOA import returns `BLOCKED_BY_SITE`** — the portal's Cloudflare challenge did not clear within `SOA_CHALLENGE_WAIT_MS`. Raise it (e.g. `30000`), retry later, and avoid `SOA_PIN_DNS=1` unless you know it helps your network; DNS pinning usually backfires behind Cloudflare. Datacenter IPs are more likely to be challenged than residential ones.

**Port conflicts** — the API binds `PORT` (default `5000`) and the client dev server uses `3000`. Stop the conflicting process or change `PORT` in `.env`.

**Uploads on serverless (Vercel)** — runtime uploads are written under `/tmp` and are ephemeral per instance and invocation. Anything users upload will disappear between deploys/instances; use a durable volume or object storage for real deployments. The bundled repo `uploads/` (demo/seed assets) remains readable as a fallback.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branch/commit conventions, and the PR checklist. Security issues: see [SECURITY.md](SECURITY.md) — please report privately instead of opening a public issue.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 ITER Development Team.
