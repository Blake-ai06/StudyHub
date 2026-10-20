# StudyHub

A study platform for students, teachers, and administrators. It combines social features (posts, comments, connections, messages) with classroom features (classes, join codes, materials, assignments, quizzes, grades) and works offline as an installable app.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS, React Router 7, Supabase (Auth, Postgres with Row Level Security, Storage, Realtime), Dexie (IndexedDB), vite-plugin-pwa, React Hook Form + Zod, Vitest.

## Quick start (local)
Requires Node 20 or newer and a Supabase project.

```
npm install
copy .env.example .env.local        (macOS/Linux: cp .env.example .env.local)
```
Edit `.env.local` and paste your Supabase **Project URL** and **publishable key**. Then create the database by pasting `supabase/all_migrations.sql` into the Supabase SQL Editor (it is safe to run more than once).

```
npm run dev          # http://localhost:5173
```
Offline mode, installation, and the production headers only work on a production build:
```
npm run build
npm run preview      # http://localhost:4173
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run test` | Unit and component tests (Vitest) |
| `npm run test:db` | Security-rule and re-run tests: runs the real SQL migrations in an in-memory Postgres (needs `npm install` inside `supabase/tests`) |
| `npm run test:e2e` | Real-browser tests against a fake Supabase server (needs `npm install` inside `e2e`) |
| `npm run db:bundle` | Rebuild `supabase/all_migrations.sql` |
| `npm run db:docs` | Rebuild `docs/SCHEMA.md` |

## Project layout
```
src/pages            Landing, login, register, static pages, and app/ (feed, classes, messages, ...)
src/components       Shared UI (app shell, post card, composer, sync status, PWA prompts)
src/lib              Supabase client, auth, social + classroom data access, validation schemas
src/offline          Offline engine: IndexedDB, outbox/sync, cache, drafts, downloads, connectivity
supabase/migrations  Database schema and security rules (numbered, run in order)
supabase/tests       Database security tests
e2e                  Real-browser tests and screenshots
docs                 DEPLOYMENT.md, TESTING.md, SCHEMA.md, design references
vercel.json          Hosting config: rewrites, caching, security headers (netlify.toml is the Netlify equivalent)
```

## Documentation
- **Deploy it:** `docs/DEPLOYMENT.md`
- **Test it (including offline on a phone):** `docs/TESTING.md`
- **Database tables, rules, and functions:** `docs/SCHEMA.md` (generated from the migrations)

## How security works
- The browser only ever holds the **publishable** key. Real protection is Row Level Security in the database: students cannot read other students' work or the quiz answer key, cannot change grades or roles, and teachers can only manage their own classes.
- Roles live in the database, are set to "student" at sign-up, and can only be changed by an administrator. The app never trusts a role flag from the browser.
- Quizzes are scored on the server. Join codes are throttled against guessing. Files are in private buckets and opened through short-lived links.
- Hosting adds a strict Content-Security-Policy and other security headers (`vercel.json`).

## Offline mode, in short
- After the first online visit the app shell is cached and opens offline.
- Posts, comments, messages, assignment saves/submissions, and offline-allowed quiz attempts made offline are kept in a persistent queue and sent when the server is reachable again. Each has a unique id so a retry can never duplicate it, and items leave the queue only after the server confirms.
- Drafts survive refreshes. Pages you viewed are readable offline. Materials can be saved for offline use.
- Private data lives only on the device (per user) and is wiped on log out. The service worker never caches API responses.
- Limits: no background sync while the app is closed; new data cannot arrive without a connection; iOS may clear stored data after weeks of inactivity.

## Known gaps
Study groups, dark mode, global search, an onboarding tour, toast notifications, and an admin moderation screen are not built yet. Google/Facebook sign-in needs real provider credentials (see `docs/DEPLOYMENT.md`). The app has not been verified against a live Supabase project or on a physical phone by the author of these tests; follow the checklists to do that.
