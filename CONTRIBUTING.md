# Contributing to ITERasn hub

Thank you for considering a contribution. This document covers the minimum you need to know to get a change merged.

## Development setup

1. Install Node.js >= 18 and npm.
2. `npm install`
3. `cp .env.example .env` and fill in the values you need (at minimum `JWT_SECRET`, `JWT_REFRESH_SECRET`; add Firebase vars for production-like auth).
4. `npm run seed` — creates the local schema plus demo data.
5. `npm run dev` — API on `http://localhost:5000`, client on `http://localhost:3000`.

Demo accounts created by seeding: `STU20250001 / Student@123`, `TCH2025001 / Teacher@123`, `ADM2025001 / Admin@123456`. Local development only.

## Branches

Name branches by intent:

- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `docs/<short-description>` — documentation only

## Commits

History follows conventional-style prefixes. Use one of:

- `feat:` new capability
- `fix:` bug fix
- `chore:` maintenance, deps, config
- `docs:` documentation

Example: `fix: reduce SOA session latency and soften import persistence failures`

## Pull request checklist

Before opening a PR, confirm all of the following:

- [ ] `npm test` passes.
- [ ] `node --check <file>` passes for every server file you touched (syntax gate; there is no lint step configured).
- [ ] No secrets, keys, tokens, or real credentials in the diff. `.env` and `server/serviceAccountKey.json` must never be committed.
- [ ] If you added an environment variable, update `.env.example` with a comment describing it.
- [ ] If you changed behavior that affects deployment, update `README.md` or `docs/DEPLOYMENT.md`.
- [ ] The PR description states what changed and why, and links any related issue.

For UI changes, include before/after screenshots where practical.

## Coding conventions

- Server code is **CommonJS** (`require`/`module.exports`). Keep it that way for consistency with the existing tree.
- Client code is **vanilla JavaScript** — no frameworks or build steps. Shared helpers live in `client/js/main.js` (`window.APP.API`, `Storage`, `Socket`); page-specific scripts go in `client/js/pages/`.
- Do not add comments unless a piece of code genuinely warrants explanation. Prefer clear names over commentary.
- Match the formatting and quoting style of the surrounding file rather than imposing your own.
- Security-sensitive code (auth, scraper, persistence) must not log secrets. The SOA scraper's contract is simple: portal credentials are proxied in memory and discarded; do not add persistence, caching, or logging of them.

## Testing expectations

- Unit/integration changes need a test under `server/__tests__/` when practical (`jest.config.js` covers `server/**/*.js`).
- Mobile-facing behavior should keep `npm run test:mobile-contracts` green.
- User-visible flows should be verifiable through `e2e/` Playwright specs or documented manual steps.
