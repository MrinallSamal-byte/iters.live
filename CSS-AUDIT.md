# CSS/UI Consistency Audit — client/css/ (47 files, ~35k lines)

Scope: all `client/css/*.css` (+ `base/`, `components/`), cross-checked against every `*.html` in `client/`, `client/js/*`, and `service-worker.js`.

---

## 1. Unused CSS files (verified by grep across HTML + JS) — HIGH

**22 files are linked by ZERO HTML pages and zero JS.** Dead code (~9,600 lines):

| File | Lines | Note |
|---|---|---|
| dashboard-alignment-fix.css | 304 | 134 `!important`s — dead |
| responsive-fixes.css | 816 | classic orphaned fix-file |
| student-enhanced.css / student-improvements.css / student-analytics.css / student-navigation.css / student-sidebar.css | ~2,700 | superseded by universal-sidebar/universal-profile; student-sidebar referenced only in its own dir listing |
| ui-improvements.css | 377 | never linked |
| analytics.css, charts.css, question-bank.css, assignment-calendar.css, auto-grader.css, gpa-calculator.css, pomodoro-timer.css, resume-builder.css, share-link.css, notice-ticker.css, profile.css* | — | feature CSS not wired to any page (features may be broken/never shipped) |
| creator-legacy.css | 146 | name says it |
| base/notification-center.css, components/chat.css, components/global-search.css, components/study-file-components.css | — | only loaded via @import? No imports found → dead |

\* `profile.css` matched 20 greps but those hits are the string "profile" in other filenames (`universal-profile`, `student-profile.html`); `/css/profile.css` itself is never href'd.

## 2. Override wars between layered fix-files — CRITICAL

Load order on most pages: `style.css → responsive.css → responsive-enhanced.css → mobile.css → responsive-universal.css → [page css] → refined-ui.css (last)`.

Concrete conflicts:

- **`.btn` defined in ≥6 loaded files**: style.css, components.css, clean-dashboard.css, button-fixes.css, ui-improvements.css (dead), refined-ui.css. button-fixes.css forces `border-radius:8px; min-height:44px; padding .75/1.5rem` on **every** `<button>` element; refined-ui's Nothing theme wants `--r-radius:2px` sharp edges → radius war resolved only by later-file wins and scattered `!important var(--r-radius)` (7 occurrences). clean-dashboard.css then re-overrides `.btn:hover` transform (`scale(1.02)`) fighting button-fixes' `translateY(-2px)`.
- **`:root` token blocks in 5 *loaded* files** (style.css, home-minimal.css, refined-ui.css, responsive-universal.css@media, universal-sidebar.css). refined-ui deliberately "re-points legacy brand tokens" — meaning two parallel token systems (`--primary/--bg-*` legacy vs `--r-*` Nothing edition) coexist and fight.
- **`body` rules in ≥4 loaded files** (animations.css sets opacity-0 entry animations, mobile-touch-fixes.css, navbar-scroll-behavior.css, refined-ui.css). animations.css hides elements with `opacity:0` awaiting JS reveal; dashboard-fix.css (now unused!) existed solely to counteract that with `opacity:1 !important` — the counter-fix was deleted from pages but the cause remains.
- **`.gradient-orb { animation:none !important }`** in clean-dashboard.css vs orb animations in style.css/animations.css.
- **home-minimal.css AND home-nothing.css both load on index.html**, plus creator-page.css scoped to `body.nothing-home` — three generations of homepage styling active simultaneously.

Severity: **CRITICAL** — visual output depends entirely on link-tag order; any reorder silently breaks pages.

## 3. !important abuse — HIGH

~500 total. Top offenders:
- dashboard-alignment-fix.css: **134** (unused file!)
- responsive-universal.css: 62 · style.css: 60 · responsive-fixes.css: 38 (unused) · responsive.css: 23 · responsive-enhanced.css: 22 · dashboard-fix.css: 22 (unused)
- Pattern: visibility "fixes" (`display:block !important; visibility:visible !important; opacity:1 !important`) that patch JS-animation FOUC instead of fixing the root cause.

## 4. Token inconsistency — MEDIUM-HIGH

- **Border-radius**: 114× `0`, plus raw values 2/3/4/6/8/10/12/14/16/18/20/22/24/28/50px, `999px` vs `--radius-full:9999px`, and two token systems (`--radius-*` legacy vs `--r-radius:2px`). Same component classes get different radii depending on which page loads which fix-file.
- **Colors**: brand red hard-coded `#d71921` 207× instead of `var(--primary/--r-accent)`; near-duplicate neutrals coexist (#3d3d3d/#2d2d2d/#161616/#141414/#111827/#0a0a0a…), grays from two palettes (Tailwind slate #e2e8f0 family AND gray #e5e7eb family).
- **Spacing**: `--spacing-*` tokens exist but most files use ad-hoc px/rem.

## 5. z-index conflicts — MEDIUM

Values in use: -3…10020, no scale documented. Hot spots: 25 files use `z-index:1000`, 13 use 999, 8 use **10000** (chatbot/toasts), 2 use 10020, one 10001 — toast/chat layers can cover modals or vice-versa arbitrarily. Negative z-index (-1/-2/-3) used for particle canvases/backgrounds, fragile with stacking contexts.

## 6. Mobile responsiveness gaps — MEDIUM

- Breakpoint chaos: max-width breakpoints at 360/479/480/560/567/720/767/768/900/960/1024px — **767 vs 768 and 479 vs 480 straddle the same devices**, so a phone gets rules from two "generations" of media queries stacked in unpredictable cascade order.
- Dashboard pages (`dashboard/*.html`) mostly load **no dedicated mobile stylesheet beyond mobile.css/responsive-universal.css**, and admin.html/teacher pages don't even load responsive-enhanced/mobile — they rely on whatever table-responsive-global covers.
- 71 `max-width:768px` blocks vs only 11 `1024px` — tablet range is thin.

## 7. Dark/light inconsistencies — MEDIUM

Only 5 loaded files have any dark-mode handling (`prefers-color-scheme` / `.light-theme`). Theme is class-based (`body.light-theme`) with overrides in 15+ files, unevenly: chatbot.css has 11 light-theme blocks, style.css 127, while several feature files have zero → light-mode regressions per component. Two dark palettes coexist (style.css warm-dark #090909/#f6f3ee vs refined-ui pure-black #000/#f4f4f4).

## 8. FOUC / layout-shift risks — HIGH

1. index.html renders **12 render-blocking stylesheets** (~9k lines before first paint), each also preloaded into service-worker cache.
2. Google Fonts loaded via `@import` **inside** CSS (style.css, refined-ui.css, home-nothing.css) = serial round-trips → FOUT/layout shift; no `<link rel=preload>`/`font-display` strategy visible beyond default.
3. animations.css sets `opacity:0` entry states requiring JS to reveal; the old counter-fix (dashboard-fix.css) is no longer linked → content-hidden risk if JS fails.
4. Late-loading refined-ui.css ("loads LAST on every page") restyles body background/fonts/radius after first paint → guaranteed visible repaint flash.

---

## Recommended consolidation strategy

1. **Delete now (zero risk)**: the 22 unlinked files (~9.6k lines). Update service-worker.js precache list accordingly.
2. **Collapse responsive stack** (responsive.css + responsive-enhanced.css + mobile.css + responsive-universal.css + responsive-polish.css) into ONE file with a fixed scale: 640 / 768 / 1024 / 1280 only. Kill 767/480/479 variants.
3. **Single token source**: keep one `tokens.css` (:root) — merge legacy `--primary/--bg-*` with Nothing `--r-*`; forbid raw hex (#d71921→var) and ad-hoc radii (allowed: sm/md/lg/full via vars). Enforce with stylelint (`declaration-property-value-allowed-list`, `no-invalid-position-at-import-rule` to ban font @imports).
4. **Split by concern, not by era**: `base.css`, `layout/sidebar.css`, `components/buttons.css` (one .btn definition), `pages/<page>.css`, `themes/light.css`. Each HTML links exactly: tokens → base → layout → components → page. Delete button-fixes/clean-dashboard/dashboard-fix/ui-improvements entirely after absorbing their still-needed lines.
5. **!important amnesty**: allow only inside utility classes and `@media print`. Root-cause the scroll-reveal hiding (add `no-js` fallback / make animation opt-in via class added by JS) so the `opacity:1 !important` patches die.
6. **z-index ladder**: define `--z-bg:-1, --z-base:0, --z-sticky:100, --z-sidebar:200, --z-dropdown:300, --z-modal:400, --z-toast:500` and replace literals.
7. **Perf**: replace font @imports with `<link rel=preconnect>+preload` in head; bundle to ≤3 files (or one bundled+hashed file); inline critical tokens/base.
