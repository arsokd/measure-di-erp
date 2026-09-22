# Handoff & Continuity Notes

This file exists so that whoever inherits this codebase next — a human
developer, or a fresh AI coding session with no memory of how this app
was built — can get oriented quickly instead of starting cold. It is
kept separate from `README.md` (which describes the product) because
this is about *how the project actually runs day to day*, including
the rough edges.

## What this app actually is

Despite the `package.json`/`vite`/`dist` scaffolding in this repo
(left over from how the project was originally generated), **the live
app is plain static HTML + vanilla JS — there is no build step.**
Every page (`expenses.html`, `dashboard.html`, `employees.html`, etc.)
is a standalone HTML file at the repo root that pulls in shared
`<script>` files from `js/`. Netlify serves the repo root directly.
If you're looking for where a page's logic lives, look for
`js/<feature>.js` or `js/<feature>-*.js`, or an inline `<script>` at
the bottom of the HTML file itself for smaller pages.

## Architecture map

- **Data layer**: `js/store.js` (`window.RevOpsStore`) — every page
  reads/writes through `getCollection`, `addItem`, `updateItem`,
  `saveCollection`. It mirrors to `localStorage` immediately and
  Firestore in the background, so the app still works (locally) if
  Firestore is briefly unreachable.
- **Auth**: `auth-guard.js` (98KB, single bundled file) — real
  authentication is Firebase Auth (`signInWithEmailAndPassword` in
  `login.html`); `checkAuth(allowedRoles)` at the top of every
  protected page reads `employeeId`/`userRole`/`userEmail` from
  `localStorage` (set at login) and redirects to `login.html` if
  missing. It also renders the top navbar (`renderRevOpsNavbar`) and
  the `salesItems`/`financeItems`/etc. arrays define the nav menu.
- **Firestore security**: `firestore.rules` — role/ownership-based,
  not just "signed in = allowed". Read it before assuming a new
  collection is safe; there's a catch-all fallback at the bottom for
  anything not explicitly matched (`allow read, write: if signedIn()`)
  — treat that as a placeholder to tighten, not a safe default, for
  any new sensitive collection.
- **Email**: `js/email-service.js` + `netlify/functions/send-email.js`
  (Brevo-based, one-way outbound). Gmail-thread-sync work (native
  two-way threading via Google Workspace domain-wide delegation) is a
  separate, partially-built track — see git log / prior conversation
  context if resuming that.
- **Error visibility**: `js/error-monitor.js` — loaded first on every
  page, catches uncaught JS errors and unhandled promise rejections,
  shows a dismissible on-screen banner (instead of the app failing
  completely silently), and best-effort logs to the `errorLogs`
  Firestore collection.
- **User-reported issues**: `js/report-problem.js` (floating "Report
  Issue" button on every page) → `supportTickets` Firestore collection
  → admin view at `support-tickets.html`.
- **CI**: `.github/workflows/ci.yml` runs on every push — `node
  --check` across all JS files, then `scripts/smoke-test.js` (a
  Playwright script) loads the core pages and exercises a couple of
  interactive flows headlessly, failing the build on any uncaught JS
  error. Check the Actions tab on GitHub after pushing.

## The recurring bug pattern to know about

The most common real bug in this app's history has been: a JS
function references `document.getElementById('some-id')` for an
element that doesn't exist (typo, or the element got removed/renamed
elsewhere), or a `<script>` tag needed by a page was missing. Both
fail **silently** — the specific button/action just does nothing, with
no visible error — which is exactly why `error-monitor.js` and the
CI smoke test exist now. If a feature "does nothing" when used, check
the browser console first; it will very likely be a `TypeError:
Cannot read properties of null` pointing at the missing id.

## Deployment

There is no staging environment as of this writing (see the open items
below). Every push to `main` deploys straight to production via
Netlify's git integration — `git push origin main` is a production
deploy. There is no PR/review workflow; commits go straight to `main`
by design (the site owner's explicit preference), so be deliberate
about what you push, and lean on the CI smoke test and manual
Playwright checks before pushing anything touching shared/critical
code (expense claims, approvals, invoicing, auth).

### Rolling back a bad deploy

```bash
git log --oneline -10        # find the last good commit
git revert <bad-commit-sha>  # makes a new commit undoing it - preferred
git push origin main
```

Avoid `git reset --hard` + force-push on `main` unless you're certain
nothing else has been committed since — it can silently discard other
work. `git revert` is almost always the safer choice here.

## Security notes / lessons already learned

- **Never store a real credential (password, API key, private key) in
  a Firestore document a wide set of users can read.** This bit us
  once already — employee login passwords were being written in plain
  text to the `employees` collection (readable by every signed-in
  user) alongside the real Firebase Auth reset. Fixed, but check any
  new "store this for convenience" instinct against this before
  shipping it.
- Netlify environment variables (`FIREBASE_SERVICE_ACCOUNT_KEY`,
  `BREVO_API_KEY`, etc.) are the only place secrets belong. Never
  commit them, never write them to Firestore, never echo them back to
  chat/logs.
- `firestore.rules` is intentionally strict per-collection where the
  data is sensitive (payroll, employees write, master data) and looser
  where it needs to be (most operational records are readable by any
  signed-in employee — that's a deliberate tradeoff for an internal
  200-person tool, not an oversight).

## Still open (as of this handoff)

- **No staging environment yet.** Recommended: enable Netlify branch
  deploys and push risky changes to a `staging` branch first for a
  preview link before merging to `main`.
- **No automated Firestore backups yet.** Recommended: enable
  scheduled exports via Firebase Console → Firestore Database →
  Backups.
- **Existing production Firestore data may still have plaintext
  password fields** on `employees` documents from before the fix
  above — needs a one-time manual cleanup pass via Firebase Console.

## Resuming this project with a new AI coding session

Give it: this file, the repo, and the standing instructions — work
happens directly on `main` (no PR workflow, explicit owner
preference), the owner is non-technical (explain plainly, don't assume
they'll catch a subtle regression themselves), and this is a live
production app used by ~200 people, so treat every change to shared
code (`js/store.js`, `auth-guard.js`, anything under `expenses-*`,
approval routing) as higher-stakes than an isolated new page.
