# ITERasn hub UI standard

This is the shared standard every dashboard page (`client/dashboard/*.html`) follows.
Public pages (`index`, `login`, `register`, `creator`) use the `nothing-home` family in
`css/home-minimal.css` and keep their own layout, but share the same brand tokens.

## Page shell

- `<title>`: `<Page name> - ITERasn hub` (no "Admin Dashboard" / "Teacher Dashboard" suffix).
- Head: `charset`, `viewport`, `<meta name="theme-color" content="#ff5a4f">`,
  `<link rel="icon" href="/assets/soa-logo.png">`, then the inline auth guard.
- Stylesheets, in this order: `style.css`, `components.css`, `clean-dashboard.css`,
  `universal-sidebar.css`, then any of `universal-profile.css`, `table-responsive-global.css`,
  `chatbot.css` the page uses. Page-only CSS goes last.
- Chart.js is pinned: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`.
- Body: `.bg-animation` orbs, then `<main class="dashboard-main">`. The sidebar is injected by
  `js/universal-sidebar.js`; every dashboard page loads it so nobody lands on a page with no navigation.
- First child of `main`: `<section class="page-hero glass-card">` with `.page-title`
  (emoji in `.title-icon`) and `.page-subtitle`.
- Every page loads the AI chatbot (`chatbot.css` + `chatbot.js`) and the theme toggle.

## Colours

Use the tokens in `css/style.css :root`. Brand is coral, not indigo.

| Token | Use |
| --- | --- |
| `--primary` `#ff5a4f`, `--primary-dark`, `--primary-light`, `--accent` | brand, primary buttons, highlights |
| `--success` / `--warning` / `--danger` | status only |
| `--text-primary` / `--text-secondary` / `--text-muted` | text |
| `--glass-bg` / `--glass-border` | card surfaces and borders |

Do not hard-code the old indigo/purple palette (`#667eea`, `#764ba2`, `#6366f1`, `#8b5cf6`,
`rgba(99,102,241,…)`). Text colours must come from tokens so light and dark themes both work
(no `#fff` text on chart legends or cards).

## Components

- **Stat cards**: `.quick-stats > .stat-box` (`.stat-icon-large`, `.stat-number`, `.stat-text`).
  The grid sits flush with the hero and shows four cards per row on desktop.
- **Sections**: `.dashboard-section.glass-card` with `.section-header-formal` /
  `.section-title-formal` and an optional `.section-badge`.
- **Buttons**: `.btn` plus one colour (`.btn-primary`, `.btn-secondary`, `.btn-success`,
  `.btn-danger`, `.btn-warning`, `.btn-info`, `.btn-ghost`, `.btn-outline`) and optionally one size
  (`.btn-sm` 36px, default 46px, `.btn-lg` 52px). `.btn-small` / `.btn-large` are aliases.
  Destructive actions always use `.btn-danger`. Pages do not redefine `.btn*` locally.
- **Status badges**: `.badge` + `.status-good` / `.status-warning` / `.status-critical`
  (or `.badge-success` / `-warning` / `-danger` / `-info`).
- **Tables**: wrap in `.table-responsive`, table gets `.data-table`.
- **Empty states**: `.empty-state` with an icon, one line of text and, when useful, one action.

## Spacing and type

- Spacing tokens `--spacing-xs` … `--spacing-2xl`; radii `--radius-sm` … `--radius-full`.
- Font: Space Grotesk (loaded by `style.css`), IBM Plex Mono for code/IDs.
- Page title size comes from `.page-title`; pages do not override it inline.

## Responsive

- Sidebar collapses under 968px; stat grids drop to 2 columns, then 1 under 720px.
- No horizontal page scroll at 375px; wide tables scroll inside `.table-responsive`.
- From 1024px up, table cells wrap so the whole table (including the actions column) fits without sideways scrolling.
