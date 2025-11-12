# Dark Mode Select/Option Visibility Fix

This project uses a dark theme by default. Native <select> dropdowns on some browsers rendered white option text on a light popup, making options hard to read. To fix this globally:

- We set `color-scheme: dark` on `body` and switch to `color-scheme: light` inside `body.light-theme` to align native control UI with the current theme.
- We added explicit styles for `select` and `option` elements in dark mode so their popups and text are readable across pages.
- Light theme keeps crisp white backgrounds with dark text.

Implementation lives in `client/css/style.css` under the section:

- "Global Select/Option Visibility (Dark Mode Fix)"

Override guidance:

- To customize a particular select, add more specific CSS after the global rules.
- If a component library replaces native selects with custom markup, ensure its dropdown panel also uses `var(--bg-secondary)` for background and `var(--text-primary)` for text when in dark mode.

Tested areas to check quickly:

- Student Analytics filters (branch, year, semester)
- Teacher dashboard filters
- Admin settings select inputs

If you still see a white popup with white text, confirm the page includes `client/css/style.css` and that `<body>` has either no class (dark by default) or `light-theme` when light mode is active.