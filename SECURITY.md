# Security Policy

## Supported versions

Only the `main` branch receives security fixes. There are no tagged release lines; if you deploy a fork, keep it current with `main`.

## Reporting a vulnerability

Please do not open a public GitHub issue for security problems. Report privately via one of:

- GitHub private security advisory (Security tab of this repository)
- Email: `security@example.com` *(replace with the maintainers' real address before publishing)*

Include a description, reproduction steps, affected endpoints/files, and any logs or proof-of-concept. You can expect an initial response within approximately 7 days; we will work with you on coordinated disclosure and credit reporters by default unless asked otherwise.

## In scope

- The Express API (`server/`), including auth, session handling, and all `/api/*` routes
- The SOA portal import pipeline (`server/services/soa-scraper.service.js`, `server/routes/soa.routes.js`, `server/services/soa-data.service.js`)
- Credential or secret leakage through logs, error messages, responses, or the repository
- Access-control gaps between roles (student / teacher / admin)
- Deployment configuration shipped with the repo (`vercel.json`, `render.yaml`, `docker-compose.yml`, `Dockerfile`, `ecosystem.config.js`)

Out of scope: vulnerabilities requiring physical access, attacks against `soaportals.com` itself (report those to SOA), and self-inflicted misconfigurations of your own deployment beyond what our defaults allow.

## Credential-handling model

What the SOA import pipeline stores: normalized academic data only — profile, attendance, marks, timetable, results, fees — persisted to Firestore and/or the SQL `portal_snapshots` table.

What it never stores:

- Portal registration numbers/passwords submitted during an import are proxied in-memory into the headless browser's login form and discarded. They are not written to the database, cache, disk, or logs.
- CAPTCHA browser sessions live in memory only, expire after 10 minutes (4 minutes idle), and are closed immediately after extraction succeeds or fails.
- Concurrent sessions are capped (`SOA_MAX_ACTIVE_SESSIONS`, default 2).

Firebase admin credentials are supplied exclusively through environment variables (`FIREBASE_SERVICE_ACCOUNT` or split vars). `.env`, `server/serviceAccountKey.json`, and uploaded content are gitignored; tracked files must contain no secrets.

## Self-deployment responsibility checklist

If you deploy ITERasn hub yourself, you own the security posture of that instance. Before going public:

1. Set strong, unique `JWT_SECRET` and `JWT_REFRESH_SECRET` values. Never ship the placeholder values from `.env.example`.
2. Restrict `CORS_WHITELIST` to the exact origins you serve from; production mode rejects unlisted origins, but do not use `*`.
3. Keep service-account keys out of the repository — pass them as environment variables only, and scope the Firebase service account minimally.
4. Serve everything over HTTPS and terminate TLS at your proxy/load balancer.
5. Change or remove the seeded demo accounts before exposing the instance.
6. Review rate limits (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`) and keep the global `/api` limiter enabled.
7. If you disable SOA imports for your users, set `PORTAL_FEATURES_ENABLED=false` rather than leaving half-configured scraping paths enabled.
8. Keep dependencies updated and re-run `npm audit` after upgrades.
