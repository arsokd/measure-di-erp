# Security & Code Audit — K-30 ERP (Measure DI)
Date: 2026-11-22 | Mode: TEST ONLY (no live writes/edits/deletes performed)

## Secrets (Pass)
- No real API keys, passwords, or private keys found committed in git history.
- The Gmail sending credential is stored **encrypted** (AES-256-GCM) in the repo (`gmail-credentials.encrypted.json`) — this is safe, it is meaningless without the small decryption key, which lives only in Netlify's environment variables, never in GitHub.
- The unencrypted version of that file is in `.gitignore` and was never committed.
- The Firebase web `apiKey` visible in `js/firebase-init.js` is not a secret by design (Google's own docs confirm this) — real protection comes from the security rules, which were checked below.

## Firestore Security Rules (Pass, with one design note)
- Every collection used by the app has its own explicit rule; the catch-all at the bottom denies everything not explicitly listed (fail-closed), confirmed correct on the emulator.
- Tested directly on the Firebase Emulator (not the live project) with 13 real scenarios: owner-can-edit-own-record, stranger-cannot-edit-another's-record, assignee-can-edit, nobody-but-admin-can-delete, salary/payroll is private to its own owner, Master Data is admin-only, a staff member cannot impersonate another employee's ID when creating a record, and an unknown/mistyped collection is blocked for everyone including Admin. **All 13 passed.**
- **Design note (not a bug):** Leads, Quotations, Orders, Invoices, Payments and similar day-to-day records are readable by *any* signed-in employee, not just their owner/manager — this is clearly a deliberate, documented decision in the rules file ("Governs UPDATE only... by explicit decision"), not an accident. Worth re-confirming with the business that full visibility across the sales team is still wanted, since it means a junior telecaller can see every other salesperson's leads and quotation values.

## Firebase Storage Rules (Pass)
- Tested on the emulator: signed-in users can upload/download attachments; logged-out visitors are blocked from both. Matches the same "any signed-in employee" model as Firestore, consistently and intentionally.

## Authentication (Pass)
- No public self-sign-up exists anywhere in the app — only an Admin (via "My Team → Create Login") can create a new login. `login.html` only signs people in.
- Page-level role gates were spot-checked (e.g. `employees.html`) and confirmed to actually redirect unauthorized roles away (not just hide a menu button) — verified live in a browser, not just by reading the code.

## Data Privacy (DPDP Act, India) — 2 findings
1. **PAN number is shown in full, unmasked**, on the Employee "Digital File" view (`js/employees.js`, the `dos-pan` field), while the bank account number right next to it on the same screen IS correctly masked to its last 4 digits. This page is already restricted to Admin/Super Admin roles only, so the exposure is limited to trusted HR staff — but it's an inconsistency worth fixing, since PAN is sensitive personal data under India's DPDP Act. *(Severity: S4 — cosmetic/consistency, low real risk since only admins can see it.)*
2. **No privacy notice or consent page exists** anywhere in the app for the personal data it collects (PAN, bank details, salary, mobile numbers). Not a bug, but a compliance gap worth closing with the client's CA/lawyer before any new employee or customer data is loaded. *(Severity: S4 — compliance paperwork, not a functional defect.)*

## Code Health
- ~~`npm audit`: 19 known issues in open-source packages used by the project...~~ **FIXED (2026-11-22):** ran `npm audit fix` (the safe, non-breaking kind — it only tightens version ranges already allowed by the project's own `package.json`, nothing was force-upgraded). This cleared 17 of the 19 issues, including all the "high"/"critical" ones in Vite. Confirmed the site still builds correctly and the full 70-test suite still passes afterward. The remaining 2 (both "moderate", in the `express`/`qs` packages used only by the local developer tool, not the live site) need a bigger version jump that could change behavior — left alone deliberately rather than risk breaking something for a low-urgency, dev-only issue.
- No passwords, PAN numbers, or other personal data are printed to the browser console anywhere in the app.

## GST / Finance correctness — 2 findings, both FIXED (2026-11-22)
- ~~Invoices correctly split tax into CGST+SGST (same state) vs IGST (different state) — but which one applies is a manual tick-box the staff member sets by hand, not calculated automatically from the client's registered state.~~ **FIXED:** the Inter-State tick-box on Invoices now auto-sets itself from the Customer GSTIN's own state code (first 2 digits) vs. the billing company's GSTIN, the moment the GSTIN field is filled in (typed, or carried over from a Quotation/PO) or the billing company is changed. It still shows as an ordinary, editable tick-box — a person can override it by hand for a genuine edge case — but the forgetting-to-tick-it mistake is now closed for the normal case. Verified directly: same-state GSTIN leaves it unticked, different-state GSTIN auto-ticks it, and a manual override afterwards still sticks.
- ~~No format check exists on GSTIN numbers entered for a client.~~ **FIXED:** a shared GSTIN-format check (the standard 15-character pattern) now blocks saving, with a clear message, wherever a GSTIN is typed in — Master Data's Client and Company records, and the Invoice form's own Customer GSTIN field. A blank GSTIN (for an unregistered small customer) is still allowed, unchanged. Verified directly: a garbage GSTIN is rejected with the message shown to the user, a valid one saves normally, and a blank one still saves fine.
