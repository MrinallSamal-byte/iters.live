# ITERasn hub

ITERasn hub is an all-in-one college management system for ITER / SOA university students, teachers, and admins. It pairs a vanilla HTML/CSS/JavaScript frontend (no build step) with a Node.js + Express + MySQL backend, and features a Nothing OS-inspired UI. Students can import their official SOA portal data through a headless Playwright scraper that they authorize by solving their own CAPTCHA. An AI assistant via OpenRouter/Gemini, PWA offline support, real-time updates over Socket.IO, and Electron/Android wrappers round out the platform.

## Features

- **Role dashboards** for students, teachers, and admins
- **SOA portal import** (`connect-portal`): one-click import of profile, attendance, marks, timetable, and results from the official portal
- Attendance, marks, timetables, and assignment management
- Study notes and previous-year questions (PYQs) sharing
- Forum (questions and answers)
- Clubs and events
- Payments (flows and history)
- AI assistant (OpenRouter / Gemini) and study plans
- Live notifications via Socket.IO (REST polling fallback on serverless)
- PWA with service-worker caching for offline use
- Question bank and rubric creator (teacher tools)
- Admin analytics, user management, approval queue, announcements

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Vanilla HTML/CSS/JavaScript — no build step; Nothing OS-inspired UI design system |
| Backend | Node.js (>= 18), Express 4 |
| Database | MySQL |
| Real-time | Socket.IO 4 (degrades to REST polling on Vercel/serverless) |
| Portal import | Playwright (Chromium) headless scraper |
| AI | OpenRouter API and Google Gemini |
| PWA | Service worker + web manifest |
| Testing | Jest (jsdom), Playwright Test |
| Desktop/Mobile wrappers | Electron, native Android (Kotlin) |

## Quick start

### Prerequisites

- Node.js >= 18 and npm
- A MySQL database

### Install and run

```bash
npm install
npm run setup        # or: npm run init:db  (initialize the database schema)
npm run seed         # load demo data
npm start            # serve at http://localhost:5000
```

For development with auto-reload:

```bash
npm run dev          # nodemon server + client dev server on :3000
```

### Demo accounts

`npm run seed` creates demo-only accounts:

| Role | Registration number | Password |
| --- | --- | --- |
| Student | `STU20250001` | `Student@123` |
| Teacher | `TCH2025001` | `Teacher@123` |
| Admin | `ADM2025001` | `Admin@123456` |

These are for local development only. Change or remove them before exposing any deployment publicly.

## Environment variables

Copy `.env.example` to `.env` and fill in the values — the example file documents every variable with comments.

At minimum you need your **MySQL connection** (`DATABASE_URL`, or the individual `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` variables). The AI assistant works without any keys but is richer with optional `OPENROUTER_API_KEY` and/or `GEMINI_API_KEY`.

See [.env.example](.env.example) for the full list.

## Deployment

Detailed step-by-step guides live in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Summary:

| Target | Files | Notes |
| --- | --- | --- |
| Render | `render.yaml` + `Dockerfile` | One-click blueprint: Docker runtime with Playwright Chromium preinstalled, persistent uploads disk, health check on `/health` |
| Docker Compose | `docker-compose.yml`, `Dockerfile`, `nginx/nginx.conf` | Self-hosting: MySQL + app + nginx reverse proxy serving the client statically (`npm run docker:up`) |
| Vercel | `vercel.json`, `api/index.js` | Serverless function reuses the full Express app. Socket.IO degrades to REST polling; uploads are ephemeral on `/tmp` |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run setup` | Interactive project setup |
| `npm run init:db` | Initialize the database schema |
| `npm run seed` | Seed demo data (`seed:comprehensive` for a fuller dataset) |
| `npm start` | Start the production server (port 5000) |
| `npm run dev` | Dev mode: nodemon server + client dev server |
| `npm test` | Jest unit/integration tests with coverage |
| `npm run test:e2e` | Playwright end-to-end tests (`e2e/`) |
| `npm run docker:up` / `docker:down` | Docker Compose stack up/down |
| `npm run build:electron` | Build the Electron desktop app |
| `npm run build:android` | Build the Android client |

## Security model

> **SOA portal import — how credentials are handled**
>
> The SOA import never sees your password at rest. When you connect your portal:
>
> 1. The server opens a fresh headless Playwright session against `soaportals.com` and extracts the CAPTCHA image into an **in-memory** session slot.
> 2. You type your registration number, password, and the CAPTCHA solution yourself. The credentials are proxied straight into that browser session's login form.
> 3. Credentials are **never logged, cached, or persisted** — not in the database, not in logs. Only the scraped academic data is normalized and stored.
> 4. The browser session is closed as soon as extraction finishes (success or error).
> 5. Concurrent sessions are capped (`SOA_MAX_ACTIVE_SESSIONS`) so abandoned CAPTCHA slots cannot pile up.
>
> If you self-host this software, you are responsible for running it honestly and securely: keep secrets out of the repo, use HTTPS, and do not attempt to automate logins against portals you do not own.

Git-tracked files contain no secrets: `.env` and uploaded files are gitignored.

## Project structure

```text
.
├── api/                  # Vercel serverless entry; reuses the full Express app
├── client/               # Vanilla HTML/CSS/JS frontend (no build step)
│   ├── dashboard/        # Role dashboards (student-*, teacher-*, admin-*)
│   ├── css/              # Nothing OS-inspired design system
│   ├── js/               # Shared helpers; page scripts
│   └── assets/
├── server/               # Express API
│   ├── routes/           # One router per feature area
│   ├── services/         # SOA scraper, normalization/persistence, AI, chat
│   ├── middleware/       # Auth, errors
│   ├── database/         # MySQL connection, migrations
│   ├── socket/           # Socket.IO auth and room wiring
│   └── seed/             # Demo data seeders
├── e2e/                  # Playwright specs
├── android-app/          # Native Android client (Kotlin)
├── electron/             # Desktop wrapper
├── scripts/              # Setup, build, and test helper scripts
└── docs/                 # ARCHITECTURE.md, DEPLOYMENT.md
```

## Troubleshooting

**Playwright browser missing** — if SOA import reports the scraper unavailable because Chromium is not installed:

```bash
npx playwright install chromium
```

On Debian-based images use `node ./node_modules/playwright/cli.js install --with-deps chromium` (as the Dockerfile does).

**Database connection errors** — verify your MySQL credentials in `.env` match `DATABASE_URL` / the `DB_*` variables, and that the schema was initialized (`npm run init:db`).

**Port conflicts** — the API binds `PORT` (default `5000`) and the client dev server uses `3000`. Stop the conflicting process or change `PORT` in `.env`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branch/commit conventions, and the PR checklist. Security issues: see [SECURITY.md](SECURITY.md) — please report privately instead of opening a public issue.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 ITER Development Team.
