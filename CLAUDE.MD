# CLAUDE.md — admin-portal

Internal admin SPA (React 18 + TypeScript + Vite, port 5200, backend admin-portal-service on 8090 via the `/managehouselease` dev proxy). No Tailwind — plain CSS in `src/index.css`.

## Design system ("Admin Portal Web" Claude Design canvas, `admin-portal/Admin Portal Web.dc.html`)

- Tokens are CSS variables on `:root` in `src/index.css`: `--bg #EEF3FB`, `--navy #132C5C`, `--ink #0E1A33`, `--body`, `--slate`, `--muted`, `--faint`, `--blue #1E6BFF` (+ `--blue-dark`), green/red/amber pairs (`--green` + `--green-bg` …), `--tint`, `--tint-2`, `--row`, `--line`; fonts `--font` (Archivo) and `--mono` (IBM Plex Mono). Same hexes as the rental / tenant-portal / contractor-ui apps.
- Shell (`src/components/AppLayout.tsx`): 236px navy sidebar (brand, nav with SVG icons from `src/components/Icons.tsx`, Onboarding badge = inactive accounts, "Monthly recurring" card, admin footer with sign-out), a top bar showing the page title / subtitle / back link / one primary CTA, a bell, and a toast. Below 1024px the sidebar becomes a drawer and a bottom nav appears; below 640px tables become the `.ob-card` stacks.
- Pages describe their header with `usePageHeader({ title, subtitle, backLabel, onBack, cta })` from `src/components/AppShell.tsx`; `useToast()` shows the canvas toast; `useAdminSummary()` exposes the dashboard summary (`GET /managehouselease/dashboard/summary`) that the sidebar card, the Onboarding badge and the Dashboard read — call `refreshSummary()` after a save that changes counts.
- Component classes: `.tile` (KPI tiles), `.card` / `.card-navy`, `.pill.on|off|pending|danger|info` (mono uppercase; `.badge` is an alias), `.table-wrap` + `.data-table` (mono uppercase headers, `.cell-strong` / `.cell-mono` / `.cell-sub` cells, `.table-empty` / `.table-loading` rows), `.search-bar`, `.pagination`, `.detail-card` / `.detail-grid`, `.bill-card` / `.plan-row` / `.invoice-row`, `.info-note`.
- Slide-ins (`.slide-overlay > .slide-panel`, 496px): `fieldset` = a section with a mono uppercase `legend` (floated so it joins the grid); a bare `label` child is full-width, and `.row-2` / `.row-3` wrappers put pairs/triples side by side (first + last name, start + end date, City / State / ZIP); `label` text is mono uppercase, inputs are the tinted `#EDF2FA` 46px fields; `label.checkbox > input[type=checkbox]` renders as the canvas toggle switch (pure CSS); `.addon-row` is the check-list row; `.slide-actions` is the sticky footer (Cancel flex 1, submit flex 2). Existing slide-in markup was kept — only the CSS changed.
- Auth pages (`.login-card`) share the tokens; there is no separate public theme.

## Conventions kept from before

- Every list page keeps its XS `.ob-card` fallback; new columns follow the canvas column set (e.g. Onboarding shows Customer ID · Business name/EIN · Contact/email · Phone · Package · Status · Actions).
- Validation rules and business-error codes: `../.claude/rules/validation.md`, `../.claude/rules/business-error-code.md`.
