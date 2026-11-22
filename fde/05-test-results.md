# Test Results — K-30 ERP (Measure DI), TEST ONLY engagement
Date: 2026-11-22

## 1. Full automated regression suite
`node scripts/regression-test.js` — 70+ scenario checks, run against a local copy of the app (not the live site).
**Result: ALL PASSED.** No failures. Full log kept with this session.

## 2. Firestore security rules — tested on the local Firebase Emulator (no live data touched)
13/13 scenarios passed, including:
- Owner can edit own record; a stranger cannot edit someone else's lead; an assignee handed a lead by its owner CAN edit it.
- Nobody but Admin/Super Admin can DELETE a lead — not even its own creator.
- A staff member can read their own payroll, never a colleague's.
- Only Admin/Super Admin can edit Master Data (Products, Clients, etc.) — a Manager cannot.
- A staff member cannot create a record while pretending to be a different employee (impersonation blocked).
- A completely unknown/mistyped collection name is blocked for everyone, including Admin (fail-closed works).
- A logged-out visitor cannot read anything.

## 3. Firebase Storage security rules — tested on the local Storage Emulator
3/3 scenarios passed: signed-in users can upload/download attachments; logged-out visitors are blocked from both.

## 4. Indian-conditions spot checks
- 360px-wide phone screen on the Leads page: no sideways scrolling. Pass.
- Tamil and Hindi text entered as a customer/contact name: saved correctly, displayed correctly, and found correctly by a partial-text search. Pass.

## 5. Accessibility scan (axe) — Dashboard, Leads, Quotations pages
- A handful of filter dropdowns have no label a screen reader can announce (Dashboard: 5, Leads: 4, Quotations: 3).
- Some light gray text on light backgrounds falls short of the recommended contrast ratio (Leads: 6 places, Quotations: 24 places) — may be harder to read for older users or in bright sunlight on a phone.

## 6. Manual checks (see 01-security-audit.md for full detail)
- Secrets handling: Pass.
- Employee page access: Pass (verified live in a browser — a "staff" account is actually redirected away, confirmed with a real test, not just by reading the code).
- GST tax type (CGST+SGST vs IGST) is a manual tick-box, not auto-set from the client's stored state — flagged as the one tax-accuracy risk worth fixing.
- No format check on GSTIN entry.
- PAN shown unmasked on the (Admin-only) Employee Digital File screen, while the bank account number right next to it is masked.
- No privacy notice/consent text in the app (DPDP Act compliance paperwork gap, not a functional bug).

## Not tested this round
Live Firebase plan/usage/rules were not read (this sandbox cannot reach Firebase's servers at all; the consultant chose to skip this for now rather than widen network access or share screenshots). Load/stress testing was not run this round.
