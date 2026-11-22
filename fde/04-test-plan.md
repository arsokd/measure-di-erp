# Test Plan — K-30 ERP (Measure DI), TEST ONLY engagement
Date: 2026-11-22

## Scope
- Full existing automated regression suite (`scripts/regression-test.js`, 70+ scenario checks) re-run end to end.
- Firestore security rules re-tested directly against the real `firestore.rules` file, on the local Firebase Emulator, as 13 real role-vs-role scenarios (not just reading the rules file).
- Firebase Storage rules re-tested the same way, on the local Storage Emulator, as 3 scenarios.
- Indian-conditions spot checks: low-end phone screen width (360px), Tamil/Hindi text entry + search + round-trip.
- Accessibility (axe) scan on 3 key pages (Dashboard, Leads, Quotations).
- Manual code review: secrets, GST tax-type logic, data-validation gaps, PII handling.

## Explicitly NOT tested this round (out of scope for a TEST ONLY pass)
- No changes were made to the live Firebase project under any circumstances.
- No real production data was read or touched; the Firestore/Storage Emulators used fresh, fake sample data only, running entirely on this machine.
- Load/stress testing (50 concurrent users) was not run this round — can be added on request.
- WhatsApp/Tally/Google Sheets integrations were not re-tested (Google Sheets mirror sync IS covered by the existing regression suite).
- Live Firebase plan/usage/billing was not read this round (see note to the consultant on this in the final report — this environment cannot reach the live Firebase Console).
