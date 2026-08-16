# HeliosQE

AI-powered Quality Engineering Operating System — frontend scaffold.

## Stack

- React 19 + TypeScript
- Vite 8
- React Router 7
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Recharts (charts)
- lucide-react (icons)

## Getting started

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually http://localhost:5173).

## Structure

- `src/nav/navConfig.ts` — single source of truth for the sidebar AND the router.
  Every sidebar item has a `path` and a `status` (`"live"` or `"planned"`). Add a new
  module here once and it shows up in both places automatically.
- `src/layout/AppLayout.tsx` — shared chrome (sidebar + header) rendered on every page,
  with an `<Outlet />` for the active page's content.
- `src/pages/DashboardPage.tsx` — the real Dashboard screen. All data in this file is
  still hardcoded sample data — not wired to a backend yet.
- `src/pages/PlaceholderPage.tsx` — generic "on the roadmap" page shown for every module
  that isn't built yet. Every sidebar link is clickable and goes somewhere real; most
  currently land here.

## What's actually built vs. planned

Only Dashboard is a real page today (with fake data). Every other sidebar item —
Requirements, Test Planning, Test Cases, Test Data, Automation Studio, API Studio,
SQL Validator, Test Execution, Reports, Failure Intelligence, Release Commander,
Analytics, Defect Prediction, Projects, Integrations, Settings — routes to the
placeholder page. This is intentional: the plan is to build one module fully (backend +
real AI integration) before moving to the next, rather than build every module halfway.

To flip a module from placeholder to real: build its page component under `src/pages/`,
change its `status` to `"live"` in `navConfig.ts`, and swap its route in `App.tsx` from
`<PlaceholderPage>` to the real component.


## Auth (placeholder)

There's now a login gate in front of the whole app. It's intentionally fake for now:

- `src/auth/AuthContext.tsx` — accepts any non-empty email + password, stores a fake
  session in `localStorage`, no real backend call yet
- `src/routes/ProtectedRoute.tsx` — redirects to `/login` if not "authenticated"
- `src/pages/LoginPage.tsx` — the login screen itself
- Logout is in the header's profile menu (top right, click your name)

To wire in real auth later: replace the body of `login()` in `AuthContext.tsx` with a
real `fetch` call to your auth API, and swap the localStorage session for a real JWT/
session cookie. Nothing else in the app needs to change since every page reads the
current user from `useAuth()`.

## Next steps (per product roadmap)

- Backend: Node.js + Express + Prisma + PostgreSQL (not included in this scaffold — this
  repo is frontend only)
- Real auth flow + project switcher
- Requirements module, built for real, including a working Anthropic API call for the
  Requirement Analyzer agent — this is the recommended next vertical slice
- Wire Dashboard's stat cards to real data once a backend exists

## Notes

- `DashboardPage.tsx` has `// @ts-nocheck` at the top since it was ported from a quick
  prototype. Worth removing that and adding real types once real API response shapes
  are known.
- Tailwind v4 needs no `tailwind.config.js` — utility classes work via the
  `@tailwindcss/vite` plugin and the `@import "tailwindcss";` line in `src/index.css`.
