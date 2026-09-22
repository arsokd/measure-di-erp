/**
 * Smoke test - runs the real app in a headless browser against a local
 * static server and checks that a handful of critical pages/flows load
 * and behave without throwing an uncaught JS error. Not a full test
 * suite; it's a fast tripwire meant to catch the failure mode this app
 * has actually hit before ("a button silently does nothing" because of
 * a missing script tag or a dangling element id) before it reaches the
 * 200 live users, by running automatically in CI on every push.
 *
 * Usage: node scripts/smoke-test.js [baseUrl]
 * Defaults to http://localhost:8099 - the caller is responsible for
 * having a static file server already running there (see the CI
 * workflow, or run one yourself with e.g. `python3 -m http.server 8099`).
 */
import { chromium } from 'playwright';

const BASE_URL = process.argv[2] || 'http://localhost:8099';

// A harmless network noise allowlist - things we expect to fail in a
// sandboxed/offline test run (no real Firebase project reachable, no
// real signed-in Firebase Auth session) that must not fail the build.
const IGNORABLE_MESSAGE_PATTERNS = [
  /Missing or insufficient permissions/i,
  /FirebaseError/i,
  /net::ERR_/i,
  /Failed to fetch/i
];

function isIgnorable(message) {
  return IGNORABLE_MESSAGE_PATTERNS.some(function (re) { return re.test(message); });
}

const PAGES_TO_CHECK = [
  'login.html',
  'dashboard.html',
  'expenses.html',
  'employees.html',
  'approvals.html',
  'quotations.html',
  'invoices.html',
  'attendance.html'
];

async function checkPage(browser, path) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];

  page.on('pageerror', function (err) {
    if (!isIgnorable(err.message)) errors.push('pageerror: ' + err.message);
  });
  // Deliberately not treating console.error as a failure: a blocked/slow
  // CDN resource (Tailwind, Firebase SDK, jsdelivr) logs as console.error
  // in a browser too, and that's a network/environment concern, not an
  // app bug. An actual JS crash surfaces as a pageerror instead, which we
  // do fail on above.

  await page.addInitScript(function () {
    localStorage.setItem('userRole', 'super_admin');
    localStorage.setItem('userEmail', 'murugan@measuredi.com');
    localStorage.setItem('userName', 'Mr. Murugan V');
    localStorage.setItem('employeeId', 'E-002');
  });

  await page.goto(BASE_URL + '/' + path, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);

  await page.close();
  return errors;
}

async function checkTravelClaimFlow(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', function (err) {
    if (!isIgnorable(err.message)) errors.push('pageerror: ' + err.message);
  });

  await page.addInitScript(function () {
    localStorage.setItem('userRole', 'super_admin');
    localStorage.setItem('userEmail', 'murugan@measuredi.com');
    localStorage.setItem('userName', 'Mr. Murugan V');
    localStorage.setItem('employeeId', 'E-002');
  });

  await page.goto(BASE_URL + '/expenses.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);

  const result = await page.evaluate(function () {
    if (typeof window.openTravelClaimModal !== 'function') return { ok: false, reason: 'openTravelClaimModal not defined' };
    window.openTravelClaimModal();
    window.showClaimPage(2);

    const tbody = document.getElementById('trv-items-tbody');
    if (!tbody) return { ok: false, reason: 'trv-items-tbody not found' };
    const rows = tbody.querySelectorAll('tr');
    if (rows.length < 1) return { ok: false, reason: 'no claim item rows rendered' };

    const selects = rows[0].querySelectorAll('select');
    if (selects.length !== 2) return { ok: false, reason: 'expected 2 selects (group + category) in row, found ' + selects.length };

    var groupSelect = selects[0];
    groupSelect.value = 'tools';
    groupSelect.dispatchEvent(new Event('change'));

    var tbody2 = document.getElementById('trv-items-tbody');
    var catSelect2 = tbody2.querySelectorAll('tr')[0].querySelectorAll('select')[1];
    if (catSelect2.value.indexOf('Tools') === -1) {
      return { ok: false, reason: 'category select did not update after group change, got: ' + catSelect2.value };
    }

    return { ok: true };
  });

  await page.close();
  if (!result.ok) errors.push('travel claim flow: ' + result.reason);
  return errors;
}

(async () => {
  const browser = await chromium.launch();
  let allErrors = [];

  for (const p of PAGES_TO_CHECK) {
    process.stdout.write('Checking ' + p + ' ... ');
    const errs = await checkPage(browser, p);
    if (errs.length) {
      console.log('FAIL');
      errs.forEach(function (e) { console.log('    ' + e); });
      allErrors = allErrors.concat(errs.map(function (e) { return p + ': ' + e; }));
    } else {
      console.log('ok');
    }
  }

  process.stdout.write('Checking travel claim category dropdown flow ... ');
  const flowErrs = await checkTravelClaimFlow(browser);
  if (flowErrs.length) {
    console.log('FAIL');
    flowErrs.forEach(function (e) { console.log('    ' + e); });
    allErrors = allErrors.concat(flowErrs);
  } else {
    console.log('ok');
  }

  await browser.close();

  if (allErrors.length > 0) {
    console.error('\nSmoke test FAILED with ' + allErrors.length + ' issue(s).');
    process.exit(1);
  }
  console.log('\nSmoke test passed.');
  process.exit(0);
})().catch(function (err) {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
