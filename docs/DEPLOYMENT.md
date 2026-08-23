# Deployment Guide

ITERasn hub ships with four supported deployment paths. Pick one; they all run the same Express app from `server/index.js`.

| Path | Config files | Best for |
| --- | --- | --- |
| Vercel | `vercel.json`, `api/index.js` | Zero-ops hosting; real-time push and durable uploads are not available |
| Render | `render.yaml`, `Dockerfile` | Full feature set including SOA import, persistent uploads disk |
| Docker Compose | `docker-compose.yml`, `Dockerfile`, `nginx/nginx.conf` | Self-hosting on your own server |
| PM2 | `ecosystem.config.js` | Bare-metal/VPS process management |

---

## 1. Vercel

`api/index.js` reuses the **full Express app** from `server/index.js`, so every route and middleware behaves like a self-hosted deployment. When the `VERCEL` env var is present, the app skips port binding, Socket.IO initialization, and Redis initialization automatically.

### Steps

1. Import the repository into Vercel. `vercel.json` is picked up automatically:
   - static output directory: `client/`
   - install command: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`
   - single function `api/index.js` with `maxDuration: 60`, bundling `client/**` and `uploads/**`
   - catch-all route rewriting everything to `/api/index`
2. Configure environment variables in the Vercel dashboard (Production **and** Preview environments):

   Required:

   - `FIREBASE_SERVICE_ACCOUNT` (full JSON string) — or split `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_DATABASE_URL`
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - `CORS_WHITELIST=https://<your-app>.vercel.app,https://<your-custom-domain>` (include the exact Vercel domain)
   - `NODE_ENV=production`

   Recommended overrides:

   - `SOA_CRAWL_DEADLINE_MS=50000` — Vercel functions cap at 60 seconds, so a full portal crawl needs a deadline safely below that.

3. Deploy.

### Serverless limitations (be aware)

- **Socket.IO does not run** on serverless functions. Real-time push degrades to REST polling; chat uses the `/api/chat/*` REST fallback and dashboards refresh on page load.
- **Uploads are ephemeral.** Runtime uploads are written under `/tmp`, which is per-instance and wiped between invocations/deploys. The bundled repo `uploads/` remains readable as a fallback for demo assets. Use object storage for anything durable.
- **SOA import needs a Chromium binary.** The install command skips Playwright's browser download (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`). Without a browser available in the runtime, imports report a scraper-unavailable status. You can point `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (or `CHROMIUM_PATH` / `CHROME_BIN`) at a Chromium binary you provide; otherwise treat SOA import as disabled on Vercel and set `PORTAL_FEATURES_ENABLED=false`.

---

## 2. Render

`render.yaml` defines a blueprint for service `iter-aio`:

- type `web`, runtime `docker`, plan `starter`, built from `./Dockerfile`
- health check path `/health`
- persistent disk named `uploads` mounted at `/usr/src/app/uploads` (1 GB)
- env vars baked into the blueprint:
  - `NODE_ENV=production`, `PORT=10000`
  - `CORS_WHITELIST=https://updated-iters-live.onrender.com,https://iters.live`
  - OpenRouter/Gemini model configuration
  - `PORTAL_FEATURES_ENABLED=true` (Chromium is installed through the Docker build)
  - `SOA_MAX_ACTIVE_SESSIONS=2` to keep concurrent Chromium sessions from exhausting the instance
  - keepalive: `KEEPALIVE_ENABLED=true`, `KEEPALIVE_INTERVAL_MS=600000` (10 min, below Render's 15-min idle sleep)
  - `NODE_OPTIONS=--max-old-space-size=256` to leave room for the Playwright browser alongside Node

### Required secrets (mark as "sync: false" / fill in the dashboard)

- `DATABASE_URL` — an existing Render PostgreSQL instance (the blueprint intentionally does not auto-provision a database)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (`JWT_REFRESH_SECRET` is generated if left blank)
- `OPENROUTER_API_KEY`, `GEMINI_API_KEY`
- Firebase admin credentials: `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

### Steps

1. Push the repository to GitHub and create a Render "Blueprint" from it.
2. Fill in the `sync: false` values in the Render dashboard.
3. Create/connect your PostgreSQL instance and paste its `DATABASE_URL`.
4. Optionally seed it (`npm run render:schema` then `npm run render:seed` locally against the DB).
5. Deploy. A `.github/workflows/render-keepalive.yml` workflow pings `/health` every 10 minutes to reduce free-tier cold starts; set the `RENDER_HEALTHCHECK_URL` repository variable if your URL differs from the default. Only a paid plan guarantees no cold starts.

The Dockerfile installs Chromium with system dependencies during the image build, so SOA import works out of the box here.

---

## 3. Docker Compose

`docker-compose.yml` starts three services:

| Service | Image | Notes |
| --- | --- | --- |
| `mysql` | `mysql:8.0` | Root password/database from `DB_PASSWORD`/`DB_NAME`; runs `server/database/init.sql` on first start; data in the `mysql_data` volume |
| `app` | built from `Dockerfile` | Node 20 image with Chromium installed via Playwright; exposes `${PORT:-5000}`; mounts `./uploads`, `./backups`, `./logs`; waits for MySQL health check |
| `nginx` | `nginx:alpine` | Serves ports 80/443 using `nginx/nginx.conf`; serves `client/` statically and `uploads/` directly |

### Steps

1. Provide required env vars (compose reads them from your shell or an `.env` file): `JWT_SECRET`, `JWT_REFRESH_SECRET`, plus any Firebase/AI/SOA variables you need. Compose passes only `DB_*` and JWT vars into the app container by default — extend the `environment:` block if you need more.
2. Start:

   ```bash
   docker-compose up --build
   ```

3. App: `http://localhost:5000`. Nginx front door: `http://localhost`. Mount TLS certificates per `nginx/nginx.conf` for HTTPS.

The image healthchecks `GET /health` inside the container every 30 seconds.

---

## 4. PM2

`ecosystem.config.js` runs `server/index.js` as `iter-college-api` in cluster mode with `instances: max`, `max_memory_restart: 1G`, and logs in `./logs/pm2-out.log` / `pm2-error.log`.

```bash
npm run pm2:start     # pm2 start ecosystem.config.js
npm run pm2:stop      # pm2 stop ecosystem.config.js
```

Set the remaining environment variables in your shell or a process manager of choice before starting; PM2 passes `NODE_ENV=production` and `PORT=5000` from the config file.

---

## Post-deploy checklist

Work through this after any deployment:

1. **Health endpoints respond**: `GET https://<your-host>/health` returns `{ status: "ok", ... }`; `GET /api/health` also responds.
2. **Firebase rules and connectivity**: log in with a real account; confirm Firestore reads/writes work and security rules are not wide open. Verify admin credentials loaded correctly (server logs should show Firebase Admin initialized).
3. **CORS**: call the API from your deployed frontend origin. In production mode, non-whitelisted origins are rejected — make sure `CORS_WHITELIST` lists every origin you serve from (including the platform-assigned domain).
4. **Secrets rotated**: `JWT_SECRET`/`JWT_REFRESH_SECRET` differ from `.env.example` placeholders; demo accounts changed or removed.
5. **Rate limiting active**: hammering an endpoint returns HTTP 429 after `RATE_LIMIT_MAX_REQUESTS` within `RATE_LIMIT_WINDOW_MS`.
6. **SOA import behavior matches your intent**: either fully working (Chromium present) or cleanly disabled with `PORTAL_FEATURES_ENABLED=false`.
7. **Real-time expectations match the target**: Socket.IO push on long-running hosts; REST polling fallback on Vercel.
8. **HTTPS enforced** end-to-end, uploads strategy decided (volume vs. ephemeral vs. object storage).
