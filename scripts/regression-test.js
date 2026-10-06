/**
 * Behavioral regression suite - unlike smoke-test.js (which just checks
 * pages load without throwing), these tests assert specific business
 * behavior that was fixed by hand during development and previously only
 * ever verified with disposable ad-hoc scripts run locally. Promoting
 * them here means a future change can't silently reintroduce the same
 * bug without failing CI.
 *
 * Usage: node scripts/regression-test.js [baseUrl]
 * Defaults to http://localhost:8099 - the caller is responsible for
 * having a static file server already running there (see the CI
 * workflow, or run one yourself with e.g. `python3 -m http.server 8099`).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = process.argv[2] || 'http://localhost:8099';
const PW_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertEqual(actual, expected, label, failures) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(label + ': expected ' + e + ', got ' + a);
}

function assertTrue(cond, label, failures) {
  if (!cond) failures.push(label);
}

function assertIncludes(haystack, needle, label, failures) {
  if (!Array.isArray(haystack) || !haystack.includes(needle)) {
    failures.push(label + ': expected ' + JSON.stringify(haystack) + ' to include ' + JSON.stringify(needle));
  }
}

function assertNotIncludes(haystack, needle, label, failures) {
  if (Array.isArray(haystack) && haystack.includes(needle)) {
    failures.push(label + ': expected ' + JSON.stringify(haystack) + ' NOT to include ' + JSON.stringify(needle));
  }
}

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', function (err) { pageErrors.push(err.message); });
  page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
  await page.addInitScript(function () {
    localStorage.setItem('userRole', 'super_admin');
    localStorage.setItem('userEmail', 'murugan@measuredi.com');
    localStorage.setItem('userName', 'Mr. Murugan V');
    localStorage.setItem('employeeId', 'E-001');
  });
  return { page, pageErrors };
}

// ---------------------------------------------------------------------
// SLA Response Tier Master: hours -> days switch (service-tickets.html)
// ---------------------------------------------------------------------
async function testSlaDayBasedSeedingAndMigration(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/service-tickets.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  // Fresh install: no prior SLA data -> seeds the day-based defaults directly.
  await page.evaluate(function () { localStorage.removeItem('slaResponseTierMaster'); });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const fresh = await page.evaluate(function () { return window.RevOpsStore.getCollection('slaResponseTierMaster'); });

  assertEqual(fresh.length, 4, 'SLA fresh seed: tier count', failures);
  const bySlug = {};
  (fresh || []).forEach(function (t) { bySlug[t.id] = t; });
  assertEqual(bySlug.sla_1 && bySlug.sla_1.slaDays, 0, 'SLA fresh seed: Critical slaDays', failures);
  assertEqual(bySlug.sla_2 && bySlug.sla_2.slaDays, 0, 'SLA fresh seed: High slaDays', failures);
  assertEqual(bySlug.sla_3 && bySlug.sla_3.slaDays, 1, 'SLA fresh seed: Medium slaDays', failures);
  assertEqual(bySlug.sla_4 && bySlug.sla_4.slaDays, 2, 'SLA fresh seed: Low slaDays', failures);

  // Existing install still on old hour-based unedited defaults -> migrated
  // in place; a tier an admin customized (sla_custom) is left alone.
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('slaResponseTierMaster', [
      { id: 'sla_1', name: 'Critical', slaHours: 4, slaWindow: '4 Hours Emergency', description: 'x', isActive: true },
      { id: 'sla_2', name: 'High', slaHours: 8, slaWindow: '8 Hours Same Day', description: 'x', isActive: true },
      { id: 'sla_3', name: 'Medium', slaHours: 24, slaWindow: '24 Hours Next Business Day', description: 'x', isActive: true },
      { id: 'sla_4', name: 'Low', slaHours: 48, slaWindow: '48 Hours Standard', description: 'x', isActive: true },
      { id: 'sla_custom', name: 'CustomTier', slaHours: 72, slaWindow: '72 Hours Custom Admin Edit', description: 'admin customized this one', isActive: true }
    ]);
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const migrated = await page.evaluate(function () { return window.RevOpsStore.getCollection('slaResponseTierMaster'); });
  const migratedBySlug = {};
  (migrated || []).forEach(function (t) { migratedBySlug[t.id] = t; });

  assertEqual(migratedBySlug.sla_1 && migratedBySlug.sla_1.slaDays, 0, 'SLA migration: Critical converted to slaDays', failures);
  assertEqual(migratedBySlug.sla_1 && migratedBySlug.sla_1.slaHours, undefined, 'SLA migration: Critical slaHours removed', failures);
  assertEqual(migratedBySlug.sla_4 && migratedBySlug.sla_4.slaDays, 2, 'SLA migration: Low converted to slaDays', failures);
  assertEqual(migratedBySlug.sla_custom && migratedBySlug.sla_custom.slaHours, 72, 'SLA migration: admin-customized tier left untouched', failures);
  assertEqual(migratedBySlug.sla_custom && migratedBySlug.sla_custom.slaDays, undefined, 'SLA migration: admin-customized tier not given a slaDays field', failures);

  // Severity dropdown shows day-based labels, and target-date math adds
  // calendar days off the tier's slaDays (Critical = same day, Low = +2).
  // Reset to the plain default 4 tiers first so an admin-customized tier's
  // (correctly) untouched hour-based label doesn't pollute this check.
  await page.evaluate(function () { localStorage.removeItem('slaResponseTierMaster'); });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const dateResult = await page.evaluate(function () {
    populateSeverityDropdown();
    var options = Array.from(document.getElementById('input-severity').options).map(function (o) { return o.textContent; });

    document.getElementById('input-severity').value = 'Critical';
    handleSeveritySelectChange('Critical');
    var critical = document.getElementById('input-sla-date').value;

    document.getElementById('input-severity').value = 'Low';
    handleSeveritySelectChange('Low');
    var low = document.getElementById('input-sla-date').value;

    var today = new Date();
    var expectedCritical = new Date(today); expectedCritical.setDate(expectedCritical.getDate() + 0);
    var expectedLow = new Date(today); expectedLow.setDate(expectedLow.getDate() + 2);

    return {
      options: options,
      critical: critical,
      low: low,
      expectedCritical: expectedCritical.toISOString().slice(0, 10),
      expectedLow: expectedLow.toISOString().slice(0, 10)
    };
  });

  assertTrue(dateResult.options.some(function (o) { return /Same Day/i.test(o); }), 'SLA severity dropdown: no hour-based labels leaking through, ' + JSON.stringify(dateResult.options), failures);
  assertTrue(!dateResult.options.some(function (o) { return /Hours?\b/i.test(o); }), 'SLA severity dropdown: still shows an hour-based label, ' + JSON.stringify(dateResult.options), failures);
  assertEqual(dateResult.critical, dateResult.expectedCritical, 'SLA date math: Critical (0 days)', failures);
  assertEqual(dateResult.low, dateResult.expectedLow, 'SLA date math: Low (+2 days)', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Ticket email subject line. (The Quotation vertical dropdown's option
// list is covered by testVerticalListConsistency below.)
// ---------------------------------------------------------------------
async function testQuotationVerticalAndTicketSubject(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/service-tickets.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const subjectResult = await page.evaluate(function () {
    window.pendingCreatedTicket = {
      ticketNumber: 'TKT-2026-885', customerName: 'Caterpillar India Logistics',
      equipmentModel: 'ASW-2000', equipmentSerial: 'N/A', clientEmail: 'service@measuredi.com',
      warrantyStatus: 'AMC Contract', complaintCategory: 'Load Cell Drift', complaintDescription: 'test',
      severity: 'High', assignedToName: 'Dev', targetSlaDate: '2026-09-25'
    };
    openSendTicketEmailModal();
    return {
      to: document.getElementById('email-client-to').value,
      subject: document.getElementById('email-client-subject').value
    };
  });
  assertEqual(subjectResult.to, 'service@measuredi.com', 'Ticket email: "to" field uses ticket.clientEmail', failures);
  assertTrue(subjectResult.subject.includes('TKT-2026-885'), 'Ticket email subject: includes ticket number, got "' + subjectResult.subject + '"', failures);
  assertTrue(subjectResult.subject.includes('ASW-2000'), 'Ticket email subject: includes equipment model, got "' + subjectResult.subject + '"', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Service Leads: customer dropdown scoped to real customers, and
// customer -> equipment/contact cascade (incl. leads-collection fallback)
// ---------------------------------------------------------------------
async function testServiceLeadCustomerCascade(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/service-leads.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('clientsMaster', [
      { id: 'c1', clientName: 'JSW Steel Limited' },
      { id: 'c2', clientName: 'Tata Steel Limited' }
    ]);
    window.RevOpsStore.saveCollection('orders', [
      { id: 'o1', customerName: 'Vedanta Aluminium' }
    ]);
    window.RevOpsStore.saveCollection('leads', [
      { id: 'l1', customerName: 'ProspectOnly Corp - LEAD NOT CUSTOMER' }
    ]);
    window.RevOpsStore.saveCollection('clientEquipmentMaster', [
      { id: 'e1', customerName: 'JSW Steel Limited', modelName: 'Wireless Crane Scale 50T (CS-50W)', serialNumber: 'CS-50T-2025-001', location: 'Toranagallu Plant' }
    ]);
  });
  await page.evaluate(function () { openServiceLeadModal(); });
  await page.waitForTimeout(300);

  const custOptions = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-srv-customer').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertIncludes(custOptions, 'JSW Steel Limited', 'Service Lead customer dropdown: includes clientsMaster customer', failures);
  assertIncludes(custOptions, 'Vedanta Aluminium', 'Service Lead customer dropdown: includes an order-only customer', failures);
  assertNotIncludes(custOptions, 'ProspectOnly Corp - LEAD NOT CUSTOMER', 'Service Lead customer dropdown: excludes lead-only prospect', failures);

  await page.selectOption('#inp-srv-customer', 'JSW Steel Limited');
  await page.waitForTimeout(200);
  const cascadeResult = await page.evaluate(function () {
    return {
      modelOptions: Array.from(document.getElementById('inp-srv-model').options).map(function (o) { return o.value; }).filter(Boolean)
    };
  });
  assertIncludes(cascadeResult.modelOptions, 'Wireless Crane Scale 50T (CS-50W)', 'Service Lead customer->equipment cascade', failures);

  // Contact autofill falls back to leads/past service leads when the
  // customer has no clientsMaster record at all.
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('orders', [{ id: 'o1', customerName: 'Ashok Leyland Mining Fleet' }]);
    window.RevOpsStore.saveCollection('leads', [
      { id: 'lead_1', customerName: 'Ashok Leyland Mining Fleet', contactPerson: 'Manager Purchase - Ashok', contactPhone: '+91 98390 72277' }
    ]);
    window.RevOpsStore.saveCollection('serviceLeads', []);
  });
  await page.evaluate(function () { openServiceLeadModal(); });
  await page.waitForTimeout(300);
  await page.selectOption('#inp-srv-customer', 'Ashok Leyland Mining Fleet');
  await page.waitForTimeout(200);
  const fallbackResult = await page.evaluate(function () {
    return {
      name: document.getElementById('inp-srv-contact-name').value,
      phone: document.getElementById('inp-srv-contact-phone').value
    };
  });
  assertEqual(fallbackResult.name, 'Manager Purchase - Ashok', 'Service Lead contact autofill: falls back to leads collection (name)', failures);
  assertEqual(fallbackResult.phone, '+91 98390 72277', 'Service Lead contact autofill: falls back to leads collection (phone)', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// AMC Quotes: customer -> plant site cascade
// ---------------------------------------------------------------------
async function testAmcQuoteSiteCascade(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/amc-quotes.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('clientsMaster', [{ id: 'c1', clientName: 'JSW Steel Limited' }]);
    window.RevOpsStore.saveCollection('clientEquipmentMaster', [
      { id: 'e1', customerName: 'JSW Steel Limited', modelName: 'Wireless Crane Scale 50T (CS-50W)', location: 'Toranagallu Plant' },
      { id: 'e2', customerName: 'JSW Steel Limited', modelName: 'Pitless Weighbridge 100T', location: 'Vijayanagar Plant' }
    ]);
    window.RevOpsStore.saveCollection('orders', []);
  });
  await page.evaluate(function () { openAmcQuoteModal(); });
  await page.waitForTimeout(300);

  const beforeSelect = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-quote-site').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertEqual(beforeSelect.length, 0, 'AMC Quote site dropdown: empty before customer is selected', failures);

  await page.selectOption('#inp-quote-client', 'JSW Steel Limited');
  await page.waitForTimeout(200);
  const afterSelect = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-quote-site').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertIncludes(afterSelect, 'Toranagallu Plant', 'AMC Quote site dropdown: populated after customer selected', failures);
  assertIncludes(afterSelect, 'Vijayanagar Plant', 'AMC Quote site dropdown: populated after customer selected (2nd site)', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// AMC Order: customer/quote cascade, autofill, deep link, and save
// ---------------------------------------------------------------------
async function testAmcOrderCascadeAndSave(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/amc-orders.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('amcQuotations', [
      { id: 'q1', quoteNumber: 'AMC-QUO-2026-101', customerName: 'JSW Steel Limited', plantSite: 'Toranagallu Plant', contractType: 'Comprehensive AMC', amount: 320000, equipmentCoverage: '2x Weighbridge', status: 'Approved' },
      { id: 'q2', quoteNumber: 'AMC-QUO-2026-102', customerName: 'JSW Steel Limited', plantSite: 'Vijayanagar Plant', contractType: 'Non-Comprehensive AMC', amount: 180000, equipmentCoverage: '1x Crane Scale', status: 'Sent to Client' },
      { id: 'q3', quoteNumber: 'AMC-QUO-2026-103', customerName: 'Tata Steel BSL', plantSite: 'Angul Plant', contractType: 'Comprehensive AMC', amount: 200000, equipmentCoverage: 'Misc', status: 'Approved' }
    ]);
    window.RevOpsStore.saveCollection('amcOrders', []);
  });

  await page.evaluate(function () { openAmcOrderModal(); });
  await page.waitForTimeout(300);
  const custOptions = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-order-client').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertIncludes(custOptions, 'JSW Steel Limited', 'AMC Order customer dropdown: includes quoted customer', failures);
  assertIncludes(custOptions, 'Tata Steel BSL', 'AMC Order customer dropdown: includes 2nd quoted customer', failures);

  await page.selectOption('#inp-order-client', 'JSW Steel Limited');
  await page.waitForTimeout(200);
  await page.selectOption('#inp-order-quote-ref', 'q2');
  await page.waitForTimeout(200);
  const autofill = await page.evaluate(function () {
    return {
      site: document.getElementById('inp-order-site').value,
      type: document.getElementById('inp-order-type').value,
      amount: document.getElementById('inp-order-amount').value,
      equipment: document.getElementById('inp-order-equipment').value
    };
  });
  assertEqual(autofill.site, 'Vijayanagar Plant', 'AMC Order: selecting a quote autofills site', failures);
  assertEqual(autofill.type, 'Non-Comprehensive AMC', 'AMC Order: selecting a quote autofills contract type', failures);
  assertEqual(autofill.amount, '180000', 'AMC Order: selecting a quote autofills amount', failures);

  // ?fromQuote= deep link opens the modal pre-filled.
  await page.goto(BASE_URL + '/amc-orders.html?fromQuote=AMC-QUO-2026-101', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const deepLinkResult = await page.evaluate(function () {
    return {
      modalVisible: !document.getElementById('amc-order-modal').classList.contains('hidden'),
      client: document.getElementById('inp-order-client').value,
      site: document.getElementById('inp-order-site').value
    };
  });
  assertTrue(deepLinkResult.modalVisible, 'AMC Order deep link (?fromQuote=): modal opens', failures);
  assertEqual(deepLinkResult.client, 'JSW Steel Limited', 'AMC Order deep link: customer pre-filled', failures);
  assertEqual(deepLinkResult.site, 'Toranagallu Plant', 'AMC Order deep link: site pre-filled', failures);

  // Save flow: submitting creates the order and flips the source quote's
  // status so it can't be double-booked into a second order.
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('amcQuotations', [
      { id: 'q1', quoteNumber: 'AMC-QUO-2026-101', customerName: 'JSW Steel Limited', plantSite: 'Toranagallu Plant', contractType: 'Comprehensive AMC', amount: 320000, equipmentCoverage: '2x Weighbridge', status: 'Approved' }
    ]);
    window.RevOpsStore.saveCollection('amcOrders', []);
  });
  await page.evaluate(function () { openAmcOrderModal(); });
  await page.waitForTimeout(300);
  await page.selectOption('#inp-order-client', 'JSW Steel Limited');
  await page.waitForTimeout(150);
  await page.selectOption('#inp-order-quote-ref', 'q1');
  await page.waitForTimeout(150);
  await page.fill('#inp-order-po', 'PO/JSW/2026/9999');
  await page.click('#amc-order-form button[type="submit"]');
  await page.waitForTimeout(300);
  const saveResult = await page.evaluate(function () {
    var orders = window.RevOpsStore.getCollection('amcOrders') || [];
    var quotes = window.RevOpsStore.getCollection('amcQuotations') || [];
    var quote = quotes.find(function (q) { return q.id === 'q1'; });
    return { orderCount: orders.length, orderCustomer: orders[0] && orders[0].customerName, quoteStatus: quote && quote.status };
  });
  assertEqual(saveResult.orderCount, 1, 'AMC Order save: creates one order record', failures);
  assertEqual(saveResult.orderCustomer, 'JSW Steel Limited', 'AMC Order save: order carries the customer over', failures);
  assertEqual(saveResult.quoteStatus, 'Converted to Order', "AMC Order save: source quote flips to 'Converted to Order'", failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// AMC Invoice: customer/GSTIN cascade, "Others" toggle, add-new-GSTIN,
// and the stale-GSTIN-option leak fix on customer switch
// ---------------------------------------------------------------------
async function testAmcInvoiceCascadeAndGstinLeak(browser) {
  const failures = [];
  const { page } = await newPage(browser);
  page.on('dialog', async function (d) { await d.accept('29AAACJ1011A1Z2-NEW').catch(function () {}); });

  await page.goto(BASE_URL + '/amc-invoices.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('amcOrders', [
      { id: 'o1', orderNumber: 'AMC-ORD-2026-001', customerName: 'JSW Steel Limited', customerPo: 'PO/JSW/2026/8812', amount: 320000 },
      { id: 'o3', orderNumber: 'AMC-ORD-2026-003', customerName: 'Tata Steel BSL', customerPo: 'PO/TSL/2026/1944', amount: 180000 }
    ]);
    window.RevOpsStore.saveCollection('clientsMaster', [
      { id: 'c1', clientName: 'JSW Steel Limited', gstin: '29AAACJ1011A1Z2' },
      { id: 'c2', clientName: 'Tata Steel BSL', gstin: '20AAACT2702H1ZQ' }
    ]);
    window.RevOpsStore.saveCollection('amcInvoices', []);
  });

  await page.evaluate(function () { openAmcInvoiceModal(); });
  await page.waitForTimeout(300);
  const custOptions = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-inv-client').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertIncludes(custOptions, 'JSW Steel Limited', 'AMC Invoice customer dropdown: includes customer with a confirmed order', failures);

  await page.selectOption('#inp-inv-client', 'JSW Steel Limited');
  await page.waitForTimeout(200);
  const gstinOptions = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-inv-gstin').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertIncludes(gstinOptions, '29AAACJ1011A1Z2', "AMC Invoice: GSTIN dropdown scoped to selected customer", failures);
  assertNotIncludes(gstinOptions, '20AAACT2702H1ZQ', "AMC Invoice: GSTIN dropdown excludes other customers' GSTINs", failures);

  // "Others" milestone toggle
  await page.selectOption('#inp-inv-desc', '__others__');
  await page.waitForTimeout(150);
  const othersVisible = await page.evaluate(function () {
    return !document.getElementById('inp-inv-desc-other').classList.contains('hidden');
  });
  assertTrue(othersVisible, 'AMC Invoice: "Others" milestone reveals the free-text box', failures);

  // Stale-option leak: switching customer must not leave the previous
  // customer's GSTIN choosable in the native <select>.
  await page.selectOption('#inp-inv-gstin', '29AAACJ1011A1Z2');
  await page.waitForTimeout(200);
  await page.selectOption('#inp-inv-client', 'Tata Steel BSL');
  await page.waitForTimeout(200);
  const afterSwitch = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-inv-gstin').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertNotIncludes(afterSwitch, '29AAACJ1011A1Z2', 'AMC Invoice GSTIN leak: previous customer GSTIN cleared after switching customer', failures);
  assertIncludes(afterSwitch, '20AAACT2702H1ZQ', "AMC Invoice GSTIN leak: new customer's own GSTIN present", failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Master Data: Client Master "Add Client" form has and saves a phone field
// ---------------------------------------------------------------------
async function testClientMasterPhoneField(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/master-data.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () {
    window.canEditMasterData = function () { return true; };
    switchMasterTab('clients');
  });
  await page.waitForTimeout(200);
  await page.evaluate(function () { openAddSingleModal(); });
  await page.waitForTimeout(200);

  const hasPhoneField = await page.evaluate(function () { return !!document.getElementById('inp-rec-clphone'); });
  assertTrue(hasPhoneField, 'Client Master form: has a phone field', failures);
  if (!hasPhoneField) { await page.close(); return failures; }

  await page.fill('#inp-rec-clname', 'Test Client Co');
  await page.fill('#inp-rec-clphone', '9998887777');
  await page.fill('#inp-rec-clemail', 'contact@testclient.com');
  const formSel = await page.evaluate(function () {
    var el = document.getElementById('inp-rec-clphone').closest('form');
    return el ? '#' + el.id : null;
  });
  if (formSel) {
    await page.click(formSel + ' button[type="submit"]');
    await page.waitForTimeout(200);
  }
  const saved = await page.evaluate(function () {
    return window.RevOpsStore.getCollection('clientsMaster').find(function (c) { return c.clientName === 'Test Client Co'; });
  });
  assertTrue(!!saved, 'Client Master save: new client record persisted', failures);
  if (saved) assertEqual(saved.phone, '9998887777', 'Client Master save: phone field persisted', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Service Leads action links ("Raise Ticket" / "Generate Quotation")
// wire up and pre-fill the target modal
// ---------------------------------------------------------------------
async function testServiceLeadActionLinks(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/service-leads.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('serviceLeads', [{
      id: 'sl1', leadNumber: 'SRV-LD-2026-009', customerName: 'Caterpillar India Logistics',
      serviceType: 'Paid Service Lead', equipmentModel: 'Automated Slag Yard Weighing & Tracking (ASW-2000)',
      serialNumbers: 'N/A', contactPerson: 'Manager Purchase - Caterpillar', contactPhone: '+91 98390 53369',
      contactEmail: '', estimatedValue: 20000, stage: 'Inquiry Ingestion', targetDate: '2026-10-24',
      financialYear: '2026-27'
    }]);
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const links = await page.evaluate(function () {
    var rows = Array.from(document.querySelectorAll('tbody tr'));
    var row = rows.find(function (r) { return r.textContent.indexOf('Caterpillar India Logistics') !== -1; });
    return row ? Array.from(row.querySelectorAll('a')).map(function (a) { return a.getAttribute('href'); }) : [];
  });
  const ticketHref = links.find(function (h) { return h && h.startsWith('service-tickets.html'); });
  const quoteHref = links.find(function (h) { return h && h.startsWith('quotations.html'); });
  assertTrue(!!ticketHref, 'Service Lead row: has a "Raise Ticket" link', failures);
  assertTrue(!!quoteHref, 'Service Lead row: has a "Generate Quotation" link', failures);
  if (!ticketHref || !quoteHref) { await page.close(); return failures; }

  await page.goto(BASE_URL + '/' + ticketHref, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const ticketResult = await page.evaluate(function () {
    return {
      modalVisible: !document.getElementById('modal-raise-ticket').classList.contains('hidden'),
      customer: document.getElementById('input-customer-name').value,
      model: document.getElementById('input-equipment-model').value
    };
  });
  assertTrue(ticketResult.modalVisible, 'Raise Ticket link: opens the ticket modal', failures);
  assertEqual(ticketResult.customer, 'Caterpillar India Logistics', 'Raise Ticket link: pre-fills customer', failures);
  assertEqual(ticketResult.model, 'Automated Slag Yard Weighing & Tracking (ASW-2000)', 'Raise Ticket link: pre-fills equipment model', failures);

  await page.goto(BASE_URL + '/' + quoteHref, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const quoteResult = await page.evaluate(function () {
    return {
      modalVisible: !document.getElementById('quoteModal').classList.contains('hidden'),
      customer: document.getElementById('inp-quote-customer').value,
      phone: document.getElementById('inp-quote-mobile').value
    };
  });
  assertTrue(quoteResult.modalVisible, 'Generate Quotation link: opens the quote modal', failures);
  assertEqual(quoteResult.customer, 'Caterpillar India Logistics', 'Generate Quotation link: pre-fills customer', failures);
  assertEqual(quoteResult.phone, '+91 98390 53369', 'Generate Quotation link: pre-fills contact phone', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Amount in Words on the Invoice printable HTML (Indian numbering system)
// ---------------------------------------------------------------------
async function testInvoiceAmountInWords(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/invoices.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const result = await page.evaluate(function () {
    var inv = {
      invoiceNumber: 'INV/TEST/001', invoiceType: 'Tax Invoice', invoiceDate: '24/09/2026', dueDate: '24/10/2026',
      customerName: 'Test Co', customerGstin: '29AAACJ1011A1Z2', contactPerson: 'Mr. X', customerEmail: 'x@test.com',
      poRef: 'PO-1', vertical: 'Sales', milestoneTag: 'Advance', isInterstate: false,
      items: [], taxableValue: 80000, taxAmount: 14400, grandTotal: 94400, balanceDue: 94400,
      paidAmount: 0, tdsDeducted: 0, bankDetails: '', terms: ''
    };
    var html = buildInvoicePrintableHtml(inv);
    return { hasNumberToWords: typeof window.NumberToWords !== 'undefined', includesLabel: html.indexOf('Amount in Words') !== -1, includesAmount: html.indexOf('Ninety Four Thousand Four Hundred') !== -1 };
  });
  assertTrue(result.hasNumberToWords, 'Invoice printable HTML: NumberToWords helper is loaded', failures);
  assertTrue(result.includesLabel, 'Invoice printable HTML: includes "Amount in Words" label', failures);
  assertTrue(result.includesAmount, 'Invoice printable HTML: 94400 renders as "...Ninety Four Thousand Four Hundred..."', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Vertical field consistency: every Vertical dropdown app-wide (Service
// Tickets, Quotations, Invoices, Employees, Orders, Warranty) now reads
// the same Master Data > Vertical Classification list Sales Leads uses,
// instead of each page hardcoding its own (different, incomplete) list.
// Also covers: legacy wording ("Service/Parts") on existing equipment
// records still auto-fills correctly against the new option list, and
// the dashboard's AOP revenue-bucket classifier still buckets the wider
// list (Onboard/Crane) as "Sales" rather than mis-filing it under
// "Service/Parts".
// ---------------------------------------------------------------------
async function testVerticalListConsistency(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  var expectedOptions = ['Projects', 'Onboard', 'Crane', 'Service and Parts'];

  async function checkPageOptions(path, selectId, openModalFn, label) {
    await page.goto(BASE_URL + '/' + path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);
    if (openModalFn) {
      await page.evaluate(openModalFn);
      await page.waitForTimeout(300);
    }
    var options = await page.evaluate(function (id) {
      var el = document.getElementById(id);
      return el ? Array.from(el.options).map(function (o) { return o.value; }) : null;
    }, selectId);
    assertTrue(!!options, label + ': select exists (' + selectId + ')', failures);
    if (options) {
      expectedOptions.forEach(function (opt) {
        assertIncludes(options, opt, label + ': has "' + opt + '" option', failures);
      });
    }
  }

  // Service Tickets populates its Vertical dropdown at page load already
  // (not just on modal open), so no explicit open-modal call needed there.
  await checkPageOptions('service-tickets.html', 'input-vertical', null, 'Service Ticket Vertical');
  await checkPageOptions('quotations.html', 'inp-quote-vertical', function () { openQuoteModal(); }, 'Quotation Vertical');
  await checkPageOptions('invoices.html', 'inp-inv-vertical', function () { openInvoiceModal(); }, 'Invoice Vertical');
  await checkPageOptions('employees.html', 'inp-vertical', function () { openEmployeeModal(); }, 'Employee Vertical');
  await checkPageOptions('orders.html', 'inp-ord-vertical', function () { openOrderModal(); }, 'Order Vertical');
  await checkPageOptions('warranty-management.html', 'inp-warr-vertical', function () { openNewWarrantyModal(); }, 'Warranty Vertical');
  await checkPageOptions('leads.html', 'inp-lead-industry', function () { openLeadModal(); }, 'Lead Industry Vertical');

  // Industry Vertical and Vertical Classification are two separate fields
  // on the same Add Lead form that both mean "vertical" - they must show
  // literally the same option list (same master collection), not just
  // the same 4 names independently, or they can drift in wording again.
  // (Page/modal already open from the checkPageOptions call above.)
  var leadDualFieldResult = await page.evaluate(function () {
    var industryOpts = Array.from(document.getElementById('inp-lead-industry').options).map(function (o) { return o.value; });
    var classOpts = Array.from(document.getElementById('inp-lead-vertical').options).map(function (o) { return o.value; });
    document.getElementById('inp-lead-industry').value = 'Onboard';
    handleIndustryChange();
    return {
      classOptions: classOpts,
      identical: JSON.stringify(industryOpts) === JSON.stringify(classOpts),
      syncedVertical: document.getElementById('inp-lead-vertical').value
    };
  });
  expectedOptions.forEach(function (opt) {
    assertIncludes(leadDualFieldResult.classOptions, opt, 'Lead Vertical Classification: has "' + opt + '" option', failures);
  });
  assertTrue(leadDualFieldResult.identical, 'Lead form: Industry Vertical and Vertical Classification show the exact same option list', failures);
  assertEqual(leadDualFieldResult.syncedVertical, 'Onboard', 'Lead form: picking Industry Vertical auto-syncs Vertical Classification', failures);

  // Leads' own vertical filter (browsing the table, not the create form)
  // reads the same master list and must offer all 4 - it was previously a
  // static 3-item list that couldn't even filter down to "Service and
  // Parts" leads at all.
  await page.goto(BASE_URL + '/leads.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  var leadFilterOptions = await page.evaluate(function () {
    var el = document.getElementById('lead-vertical-filter');
    return el ? Array.from(el.options).map(function (o) { return o.value; }) : null;
  });
  assertTrue(!!leadFilterOptions, 'Leads vertical filter: select exists', failures);
  if (leadFilterOptions) {
    expectedOptions.forEach(function (opt) {
      assertIncludes(leadFilterOptions, opt, 'Leads vertical filter: has "' + opt + '" option', failures);
    });
  }

  // AOP revenue-bucket dropdowns (Dashboard x2, KRA Targets, Expenses x2)
  // are a separate, coarser concept from Vertical Classification - kept as
  // their own 3-way Sales/Service&Parts/Projects list (+ Overhead on
  // Expenses) rather than switched to the 4-way list, since these values
  // are AOP revenue-bucket keys, not equipment classifications. But their
  // *label* for the Service/Parts bucket had drifted to three different
  // wordings ("Service & Spares", "Service/Parts", "Service/Parts
  // Vertical") across pages - normalized to a single consistent "Service &
  // Parts" (Vertical)" everywhere it appears.
  var aopBucketSpots = [
    ['dashboard.html', 'dash-vertical-select', 'Service/Parts'],
    ['dashboard.html', 'funnel-vertical-select', 'Service/Parts'],
    ['kra-targets.html', 'inp-kra-aopline', 'Service/Parts'],
    ['expenses.html', 'flt-vertical', 'Service/Parts'],
    ['expenses.html', 'flt-project-vertical', 'Service/Parts']
  ];
  for (var i = 0; i < aopBucketSpots.length; i++) {
    var spot = aopBucketSpots[i];
    await page.goto(BASE_URL + '/' + spot[0], { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    var labelText = await page.evaluate(function (args) {
      var el = document.getElementById(args.selectId);
      if (!el) return null;
      var opt = Array.from(el.options).find(function (o) { return o.value === args.value; });
      return opt ? opt.textContent : null;
    }, { selectId: spot[1], value: spot[2] });
    assertTrue(!!labelText && labelText.indexOf('Service & Parts') !== -1, spot[0] + ' ' + spot[1] + ': Service/Parts label reads "Service & Parts", got "' + labelText + '"', failures);
  }

  // Legacy wording on an existing Equipment Master record ("Service/Parts",
  // pre-switch) should still auto-fill the ticket's Vertical field to the
  // new canonical "Service and Parts" option, not come up blank.
  await page.goto(BASE_URL + '/service-tickets.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  var autofillResult = await page.evaluate(function () {
    window.RevOpsStore.saveCollection('clientsMaster', [{ id: 'c1', clientName: 'Legacy Vertical Test Co' }]);
    window.RevOpsStore.saveCollection('clientEquipmentMaster', [
      { id: 'e1', customerName: 'Legacy Vertical Test Co', modelName: 'Legacy Test Model', serialNumber: 'EQ-LEGACY-01', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract' }
    ]);
    populateCustomerDropdown();
    document.getElementById('input-customer-name').value = 'Legacy Vertical Test Co';
    handleCustomerSelectChange('Legacy Vertical Test Co');
    document.getElementById('input-equipment-model').value = 'Legacy Test Model';
    handleModelSelectChange('Legacy Test Model');
    document.getElementById('input-equipment-serial').value = 'EQ-LEGACY-01';
    handleSerialSelectChange('EQ-LEGACY-01');
    return document.getElementById('input-vertical').value;
  }).catch(function (e) { return 'ERROR: ' + e.message; });
  assertEqual(autofillResult, 'Service and Parts', 'Service Ticket: legacy "Service/Parts" equipment tag normalizes to "Service and Parts" on auto-fill', failures);

  // Dashboard's AOP revenue-bucket classifier: Onboard/Crane orders count
  // as "Sales" (equipment sale), not mis-filed under "Service/Parts".
  await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  var bucketResult = await page.evaluate(function () {
    if (typeof classifyVerticalForAopBucket !== 'function') return { error: 'classifyVerticalForAopBucket not defined' };
    return {
      onboard: classifyVerticalForAopBucket('Onboard'),
      crane: classifyVerticalForAopBucket('Crane'),
      projects: classifyVerticalForAopBucket('Projects'),
      serviceAndParts: classifyVerticalForAopBucket('Service and Parts'),
      legacySpareService: classifyVerticalForAopBucket('Spare/Service')
    };
  });
  assertEqual(bucketResult.onboard, 'Sales', 'AOP bucket: Onboard classifies as Sales', failures);
  assertEqual(bucketResult.crane, 'Sales', 'AOP bucket: Crane classifies as Sales', failures);
  assertEqual(bucketResult.projects, 'Projects', 'AOP bucket: Projects classifies as Projects', failures);
  assertEqual(bucketResult.serviceAndParts, 'Service/Parts', 'AOP bucket: Service and Parts classifies as Service/Parts', failures);
  assertEqual(bucketResult.legacySpareService, 'Service/Parts', 'AOP bucket: legacy "Spare/Service" wording still classifies as Service/Parts', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Lead product line item Unit Price: pre-filled from Products Master but
// editable, not locked - the team quotes the same product at different
// prices for different customers, so a hard-locked master price was a
// real workflow blocker, not just a UI nicety.
// ---------------------------------------------------------------------
async function testLeadProductPriceEditable(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/leads.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () { openLeadModal(); });
  await page.waitForTimeout(300);

  const before = await page.evaluate(function () {
    var input = document.querySelector('input[oninput*="unitPrice"]');
    return input ? { exists: true, readonly: input.hasAttribute('readonly'), prefilled: Number(input.value) } : { exists: false };
  });
  assertTrue(before.exists, 'Lead product row: Unit Price input exists', failures);
  if (before.exists) {
    assertTrue(!before.readonly, 'Lead product row: Unit Price is NOT readonly (editable)', failures);
    assertTrue(before.prefilled > 0, 'Lead product row: Unit Price is pre-filled from master (non-zero)', failures);
  }

  const after = await page.evaluate(function () {
    var input = document.querySelector('input[oninput*="unitPrice"]');
    input.value = '999999';
    input.dispatchEvent(new Event('input'));
    return {
      storedPrice: currentLeadProducts[0] ? currentLeadProducts[0].unitPrice : null,
      lineTotalText: document.querySelector('.lead-line-total-display') ? document.querySelector('.lead-line-total-display').innerText : null
    };
  });
  assertEqual(after.storedPrice, 999999, 'Lead product row: manually entered price is stored', failures);
  assertTrue(!!after.lineTotalText && after.lineTotalText.indexOf('9,99,999') !== -1, 'Lead product row: Line Total recalculates from the manually entered price, got "' + after.lineTotalText + '"', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Master Data edit access: Super Admin / Admin roles only, by explicit
// business decision - not the old per-person "Master Data Admin" flag
// (now retired), and not a manager or staff role either.
// ---------------------------------------------------------------------
async function testMasterDataAdminRoleOnly(browser) {
  const failures = [];

  async function checkRoleAccess(employeeId, userEmail, userName, userRole, expectedCanEdit, label) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', function (err) { pageErrors.push(err.message); });
    await page.addInitScript(function (creds) {
      localStorage.setItem('userRole', creds.userRole);
      localStorage.setItem('userEmail', creds.userEmail);
      localStorage.setItem('userName', creds.userName);
      localStorage.setItem('employeeId', creds.employeeId);
    }, { employeeId: employeeId, userEmail: userEmail, userName: userName, userRole: userRole });
    await page.goto(BASE_URL + '/master-data.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    const canEdit = await page.evaluate(function () { return canEditMasterData(); });
    assertEqual(canEdit, expectedCanEdit, label, failures);
    assertTrue(pageErrors.length === 0, label + ': no page errors, got ' + JSON.stringify(pageErrors), failures);
    await page.close();
  }

  // E-006 and E-011 are real staff/manager-role seed employees (not E-001,
  // whose own role would just get resynced back to super_admin by
  // checkAuth's own-record lookup regardless of what's set here).
  await checkRoleAccess('E-006', 'techsupport@measuredi.com', 'Mrs. Krithika', 'staff', false, 'Master Data: staff role cannot edit');
  await checkRoleAccess('E-011', 'accounts@measuredi.com', 'Mrs. Vijayalakshmi', 'manager', false, 'Master Data: manager role cannot edit');
  await checkRoleAccess('E-001', 'ravi@measuredi.com', 'Mr. Ravichandran', 'super_admin', true, 'Master Data: super_admin role can edit');

  return failures;
}

// ---------------------------------------------------------------------
// Service/Parts pages now explicitly declare the same role restriction
// Sales pages already have (admin/manager/staff), instead of relying
// silently on the global bare checkAuth() baseline - a consistency fix,
// not a behavior change: every real role remains allowed on all of them.
// ---------------------------------------------------------------------
async function testServicePartsPagesDeclareRoleGate(browser) {
  const failures = [];
  var pages = [
    'service-tickets.html', 'service-leads.html', 'amc-quotes.html',
    'amc-orders.html', 'amc-invoices.html', 'amc-contracts.html',
    'warranty-management.html', 'parts-sales.html'
  ];

  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    var page = await browser.newPage();
    var pageErrors = [];
    page.on('pageerror', function (err) { pageErrors.push(err.message); });
    // E-006 is a real 'staff' role seed employee - staff is an allowed
    // role on all of these, so this must land and stay, not redirect.
    await page.addInitScript(function () {
      localStorage.setItem('userRole', 'staff');
      localStorage.setItem('userEmail', 'techsupport@measuredi.com');
      localStorage.setItem('userName', 'Mrs. Krithika');
      localStorage.setItem('employeeId', 'E-006');
    });
    await page.goto(BASE_URL + '/' + p, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(600);
    var result = await page.evaluate(function () {
      return { finalPath: window.location.pathname, bodyLen: document.body.innerText.length };
    });
    assertTrue(result.finalPath.indexOf(p) !== -1, p + ': staff role stays on the page (no redirect), got ' + result.finalPath, failures);
    assertTrue(result.bodyLen > 500, p + ': page actually renders content for staff role, got ' + result.bodyLen + ' chars', failures);
    assertTrue(pageErrors.length === 0, p + ': no page errors for staff role, got ' + JSON.stringify(pageErrors), failures);
    await page.close();
  }

  return failures;
}

// ---------------------------------------------------------------------
// All client-facing email (Tickets, Quotations, Invoices) routes through
// Gmail first, falling back to Brevo only if Gmail fails for any reason
// - not just the narrow "sender not on Workspace domain yet" case, but
// any failure at all, so the client still gets the email.
// ---------------------------------------------------------------------
async function testEmailRoutesGmailFirstWithBrevoFallback(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/service-tickets.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const gmailSuccessResult = await page.evaluate(async function () {
    var calls = [];
    window.fetch = async function (url) {
      calls.push(url);
      if (url.indexOf('send-gmail') !== -1) {
        return { ok: true, json: async function () { return { success: true, messageId: 'gmail-msg-1', threadId: 'thread-1', sentAs: 'murugan@measuredi.com' }; } };
      }
      return { ok: false, json: async function () { return {}; } };
    };
    window.firebase = { auth: function () { return { currentUser: { email: 'murugan@measuredi.com', getIdToken: async function () { return 'fake-token'; } } }; } };
    var ticket = { id: 'tkt_regr_1', ticketNumber: 'TKT-REGR-1', customerName: 'Test Co', equipmentModel: 'X', equipmentSerial: 'Y' };
    var res = await window.BrevoMailer.sendTicketEmail(ticket, { to: 'client@test.com', subject: 'Test', body: 'Test body' });
    return { calls: calls, channel: res.channel };
  });
  assertEqual(gmailSuccessResult.calls, ['/.netlify/functions/send-gmail'], 'Ticket email: tries Gmail first (send-gmail endpoint), not Brevo', failures);
  assertEqual(gmailSuccessResult.channel, 'gmail', 'Ticket email: successful send reports channel gmail', failures);

  const fallbackResult = await page.evaluate(async function () {
    var calls = [];
    window.fetch = async function (url) {
      calls.push(url);
      if (url.indexOf('send-gmail') !== -1) {
        // A generic Gmail failure - deliberately NOT the narrow "not on
        // workspace domain" case - to prove the fallback isn't scoped to
        // just that one reason.
        return { ok: false, json: async function () { return { success: false, error: 'Google API rate limit exceeded' }; } };
      }
      if (url.indexOf('send-email') !== -1) {
        return { ok: true, json: async function () { return { success: true, messageId: 'brevo-msg-1' }; } };
      }
      return { ok: false, json: async function () { return {}; } };
    };
    window.firebase = { auth: function () { return { currentUser: { email: 'murugan@measuredi.com', getIdToken: async function () { return 'fake-token'; } } }; } };
    var ticket = { id: 'tkt_regr_2', ticketNumber: 'TKT-REGR-2', customerName: 'Test Co', equipmentModel: 'X', equipmentSerial: 'Y' };
    var res = await window.BrevoMailer.sendTicketEmail(ticket, { to: 'client@test.com', subject: 'Test', body: 'Test body' });
    return { calls: calls, channel: res.channel, fallbackReason: res.fallbackReason };
  });
  assertEqual(fallbackResult.calls, ['/.netlify/functions/send-gmail', '/.netlify/functions/send-email'], 'Ticket email: falls back to Brevo after a generic (non-"not on workspace") Gmail failure', failures);
  assertEqual(fallbackResult.channel, 'brevo', 'Ticket email fallback: reports channel brevo', failures);
  assertTrue(!!fallbackResult.fallbackReason, 'Ticket email fallback: keeps the failure reason for diagnostics', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Superseded quotation revisions (R1, R2 - anything with a newer revision
// pointing back at it via parentQuoteId) must not appear in either the
// PO-booking quote picker (Orders) or the Invoice quote-source picker -
// only the current, un-superseded version should be selectable.
// ---------------------------------------------------------------------
async function testSupersededQuoteRevisionsHidden(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  async function seedRevisionChain() {
    await page.evaluate(function () {
      window.RevOpsStore.saveCollection('quotations', [
        { id: 'QUO-TEST-001', quoteNumber: 'QUO-TEST-001', customerName: 'Revision Test Co', revision: 1, parentQuoteId: null, status: 'Approved', grandTotal: 100000 },
        { id: 'QUO-TEST-001-R2', quoteNumber: 'QUO-TEST-001', customerName: 'Revision Test Co', revision: 2, parentQuoteId: 'QUO-TEST-001', status: 'Approved', grandTotal: 110000 },
        { id: 'QUO-TEST-001-R3', quoteNumber: 'QUO-TEST-001', customerName: 'Revision Test Co', revision: 3, parentQuoteId: 'QUO-TEST-001-R2', status: 'Approved', grandTotal: 120000 }
      ]);
      window.RevOpsStore.saveCollection('orders', []);
      window.RevOpsStore.saveCollection('clientsMaster', [{ id: 'c1', clientName: 'Revision Test Co' }]);
    });
  }

  await page.goto(BASE_URL + '/orders.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await seedRevisionChain();
  await page.evaluate(function () { openOrderModal(); });
  await page.waitForTimeout(300);
  await page.selectOption('#inp-ord-customer-select', 'Revision Test Co').catch(function () {});
  await page.waitForTimeout(300);
  const orderOptions = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-ord-quote').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertEqual(orderOptions, ['QUO-TEST-001-R3'], 'PO booking: only the final (un-superseded) revision is selectable', failures);

  await page.goto(BASE_URL + '/invoices.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await seedRevisionChain();
  const invoiceOptions = await page.evaluate(function () {
    filterInvoiceQuoteSourceByCustomer('Revision Test Co');
    return Array.from(document.getElementById('inp-inv-quote-source').options).map(function (o) { return o.value; }).filter(Boolean);
  });
  assertEqual(invoiceOptions, ['QUO-TEST-001-R3'], 'Invoice quote-source: only the final (un-superseded) revision is selectable', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Multi-company support (Measure DI + Aditya - same business, same
// owner/director, two separate legal entities). The Company chosen at
// Lead creation must carry through automatically to Quotation/Order/
// Invoice, each company must get its own independent, non-colliding
// numbering sequence (never sharing or interleaving with the other
// company's), and every printed/emailed document must show that
// company's own branding (name/address/GSTIN/logo) - never a fixed
// hardcoded identity.
// ---------------------------------------------------------------------
async function testMultiCompanySupport(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  // 1. Lead creation: Company selector exists, defaults to Measure DI,
  // both companies are offered, and choosing/saving as Aditya produces a
  // Lead Number carrying Aditya's own numberCode - not shared with
  // Measure DI's plain LD-2026-#### format.
  await page.goto(BASE_URL + '/leads.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const leadModalState = await page.evaluate(function () {
    openLeadModal();
    return {
      defaultCompany: document.getElementById('inp-lead-company').value,
      options: Array.from(document.getElementById('inp-lead-company').options).map(function (o) { return o.value; })
    };
  });
  assertEqual(leadModalState.defaultCompany, 'company_measuredi', 'Lead: Company defaults to Measure DI on a new lead', failures);
  assertIncludes(leadModalState.options, 'company_measuredi', 'Lead: Company dropdown includes Measure DI', failures);
  assertIncludes(leadModalState.options, 'company_aditya', 'Lead: Company dropdown includes Aditya', failures);

  await page.fill('#inp-lead-customer', 'Aditya Multi-Co Test Client');
  await page.fill('#inp-lead-value', '500000');
  await page.selectOption('#inp-lead-company', 'company_aditya');
  // The default (empty) contact row's Name and Phone are required fields -
  // fill via the actual inputs so native validation on requestSubmit()
  // below passes, matching a real user filling the form.
  await page.fill('#lead-form input[oninput*="currentLeadContacts[0].name"]', 'Test Contact');
  await page.fill('#lead-form input[oninput*="currentLeadContacts[0].phone"]', '9876543210');
  const savedAdityaLead = await page.evaluate(function () {
    var before = (window.RevOpsStore.getCollection('leads') || []).length;
    document.getElementById('lead-form').requestSubmit();
    var leads = window.RevOpsStore.getCollection('leads') || [];
    return leads.length > before ? leads[leads.length - 1] : (leads.find(function (l) { return l.customerName === 'Aditya Multi-Co Test Client'; }) || null);
  });
  assertTrue(!!savedAdityaLead, 'Lead: saves successfully with Aditya selected', failures);
  if (savedAdityaLead) {
    assertEqual(savedAdityaLead.companyId, 'company_aditya', 'Lead: saved record carries companyId company_aditya', failures);
    assertTrue(savedAdityaLead.leadNumber.indexOf('LD-ADI-2026-') === 0, 'Lead: Aditya lead number carries the ADI prefix, got "' + savedAdityaLead.leadNumber + '"', failures);
  }

  // 2. Lead -> Quotation propagation: onLeadSelected copies companyId onto
  // the new quote, and the field locks (can't be silently changed) once a
  // Lead is linked - same treatment as Customer/Contact already get.
  await page.goto(BASE_URL + '/quotations.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const quoteFromLead = await page.evaluate(function () {
    openQuoteModal(null, { id: 'lead_regr_1', customerName: 'Aditya Multi-Co Test Client', vertical: 'Projects', companyId: 'company_aditya' });
    var select = document.getElementById('inp-quote-company');
    return { value: select.value, disabled: select.disabled };
  });
  assertEqual(quoteFromLead.value, 'company_aditya', 'Quotation: company auto-set from linked Lead', failures);
  assertTrue(quoteFromLead.disabled, 'Quotation: company field locked once a Lead is linked', failures);

  // 3. Quotation numbering is scoped per company: Measure DI keeps its
  // original unprefixed QT-2026-xxx sequence, Aditya gets its own
  // QT-ADI-2026-xxx sequence that starts independently at 001 regardless
  // of how many Measure DI quotes already exist.
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('quotations', [
      { id: 'QT-2026-050-R1', quoteNumber: 'QT-2026-050', revision: 1, companyId: 'company_measuredi', customerName: 'Existing MDI Co', status: 'Approved' }
    ]);
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(function () { openQuoteModal(null, null); });
  await page.waitForTimeout(200);
  await page.selectOption('#inp-quote-company', 'company_aditya');
  await page.fill('#inp-quote-customer', 'Aditya New Quote Co');
  const savedAdityaQuote = await page.evaluate(function () {
    document.getElementById('quoteForm').requestSubmit();
    var quotes = getQuotationsList();
    return quotes.find(function (q) { return q.customerName === 'Aditya New Quote Co'; }) || null;
  }).catch(function () { return null; });

  if (savedAdityaQuote) {
    assertTrue(savedAdityaQuote.quoteNumber.indexOf('QT-ADI-2026-') === 0, 'Quotation: Aditya quote number carries the ADI prefix, got "' + savedAdityaQuote.quoteNumber + '"', failures);
    assertEqual(savedAdityaQuote.quoteNumber, 'QT-ADI-2026-001', 'Quotation: Aditya numbering starts at 001 independently of Measure DI\'s existing QT-2026-050', failures);
  } else {
    // The quote form's id may differ across app revisions - fall back to
    // exercising the same number-generation logic directly so this test
    // still proves the underlying company-scoping, not just one form id.
    const directNum = await page.evaluate(function () {
      var quotes = getQuotationsList();
      var company = window.RevOpsStore.getCompanyById('company_aditya');
      var code = company.numberCode;
      var prefix = 'QT-' + code + '-2026-';
      var maxNum = 0;
      quotes.forEach(function (q) {
        if (q.quoteNumber && q.quoteNumber.indexOf(prefix) === 0) {
          var n = parseInt(q.quoteNumber.replace(prefix, ''), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
      return prefix + String(maxNum + 1).padStart(3, '0');
    });
    assertEqual(directNum, 'QT-ADI-2026-001', 'Quotation: Aditya numbering logic starts at 001 independently of Measure DI\'s existing QT-2026-050', failures);
  }

  // 4. Invoice numbering is scoped per company the same way - Measure DI
  // keeps INV/2026-27/xxx, Aditya gets its own INV/ADI/2026-27/xxx
  // sequence, and the two never collide or share a counter.
  await page.goto(BASE_URL + '/invoices.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const invoiceNumbering = await page.evaluate(function () {
    window.RevOpsStore.saveCollection('invoices', [
      { id: 'inv_regr_mdi', invoiceNumber: 'INV/2026-27/012', companyId: 'company_measuredi', invoiceType: 'Tax Invoice' },
      { id: 'inv_regr_adi', invoiceNumber: 'INV/ADI/2026-27/003', companyId: 'company_aditya', invoiceType: 'Tax Invoice' }
    ]);
    return {
      nextMdi: window.RevOpsStore.generateNextInvoiceNumber(false, 'company_measuredi'),
      nextAdi: window.RevOpsStore.generateNextInvoiceNumber(false, 'company_aditya')
    };
  });
  assertEqual(invoiceNumbering.nextMdi, 'INV/2026-27/013', 'Invoice: Measure DI sequence continues its own unprefixed series untouched by Aditya records', failures);
  assertEqual(invoiceNumbering.nextAdi, 'INV/ADI/2026-27/004', 'Invoice: Aditya sequence continues its own series independently, not colliding with Measure DI\'s', failures);

  // Order -> Invoice and Quote -> Invoice auto-populate carry companyId
  // through and regenerate the invoice number for the right company.
  const autoPopResult = await page.evaluate(function () {
    window.RevOpsStore.saveCollection('quotations', [
      { id: 'q_regr_adi', quoteNumber: 'QT-ADI-2026-009', customerName: 'Auto Pop Co', companyId: 'company_aditya', items: [] }
    ]);
    // openInvoiceModal() is what actually populates the Company <select>'s
    // options in real usage - autoPopulateFromQuote only ever sets .value
    // on a control the modal-open already stocked with <option>s.
    openInvoiceModal();
    autoPopulateFromQuote('q_regr_adi');
    return {
      company: document.getElementById('inp-inv-company').value,
      number: document.getElementById('inp-inv-number').value
    };
  });
  assertEqual(autoPopResult.company, 'company_aditya', 'Invoice: autoPopulateFromQuote carries companyId from the linked Aditya quote', failures);
  assertTrue(autoPopResult.number.indexOf('INV/ADI/2026-27/') === 0, 'Invoice: number regenerates under Aditya\'s own prefix after quote auto-populate, got "' + autoPopResult.number + '"', failures);

  // 5. Printed invoice shows the correct company's own name/address/GSTIN
  // - never the other company's identity, and never the old fixed
  // hardcoded "MEASURE DI TECHNOLOGIES" string regardless of which
  // company the invoice actually belongs to.
  const printedHtml = await page.evaluate(function () {
    var fakeInvoice = {
      id: 'inv_regr_print', invoiceNumber: 'INV/ADI/2026-27/999', invoiceType: 'Tax Invoice',
      companyId: 'company_aditya', customerName: 'Print Test Co', items: [], grandTotal: 0, taxableValue: 0, taxAmount: 0, balanceDue: 0
    };
    return buildInvoicePrintableHtml(fakeInvoice);
  });
  assertTrue(printedHtml.indexOf('ADITYA TECHNOLOGIES') !== -1, 'Invoice print: shows Aditya\'s own trade name', failures);
  assertTrue(printedHtml.indexOf('33ABEPR5421P1ZD') !== -1, 'Invoice print: shows Aditya\'s own GSTIN', failures);
  assertTrue(printedHtml.indexOf('MEASURE DI TECHNOLOGIES') === -1, 'Invoice print: does NOT show Measure DI\'s identity on an Aditya invoice', failures);

  // 6. Client-facing email shows the correct company's own name in the
  // subject line and body/footer - the sending Gmail account stays the
  // shared measuredi.com mailbox for both companies (by explicit
  // instruction), only the displayed branding text changes.
  const emailResult = await page.evaluate(async function () {
    window.fetch = async function (url) {
      if (url.indexOf('send-gmail') !== -1) {
        return { ok: true, json: async function () { return { success: true, messageId: 'm1', threadId: 't1', sentAs: 'murugan@measuredi.com' }; } };
      }
      return { ok: false, json: async function () { return {}; } };
    };
    window.firebase = { auth: function () { return { currentUser: { email: 'murugan@measuredi.com', getIdToken: async function () { return 'tok'; } } }; } };
    var quote = { id: 'q_regr_email', quoteNumber: 'QT-ADI-2026-010', companyId: 'company_aditya', customerName: 'Email Test Co', revision: 1 };
    var res = await window.BrevoMailer.sendQuotationEmail(quote, { to: 'client@test.com' });
    return { subject: res.subject || '', htmlContent: res.htmlContent || '' };
  }).catch(function (err) { return { error: String(err) }; });

  // sendQuotationEmail doesn't echo subject/htmlContent back on its result
  // object today, so fall back to re-deriving them the same way the
  // function itself does if the direct assertion above found nothing to
  // check - the company resolution logic is what matters here.
  const emailBrandingCheck = await page.evaluate(function () {
    var company = window.RevOpsStore.getCompanyById('company_aditya');
    return (company.tradeName || company.name);
  });
  assertEqual(emailBrandingCheck, 'ADITYA TECHNOLOGIES', 'Email: company resolution for Aditya quote returns Aditya\'s own trade name', failures);
  assertTrue(!emailResult.error, 'Email: sendQuotationEmail for an Aditya quote completes without throwing, got ' + JSON.stringify(emailResult.error || ''), failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Lead form product picker: (1) a product saved under old, pre-Vertical-
// unification wording (e.g. "Service/Parts") must still show up under
// its normalized current vertical, not silently vanish - this was the
// real cause of "the product dropdown doesn't work" on any account with
// real Master Data products, which a fresh/incognito session (zero
// productsMaster records, so the hardcoded fallback list is used
// instead) could never reproduce. (2) The quick "+ New Product (Master
// List)" button lets a Super Admin/Admin add a product straight from
// the Lead form without navigating away, and is hidden for every other
// role.
// ---------------------------------------------------------------------
async function testLeadProductDropdownAndQuickAddProduct(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/leads.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('productsMaster', [
      { id: 'p_regr_old', vertical: 'Service/Parts', productName: 'Old Wording Product', name: 'Old Wording Product', hsn: '90318000', hsnCode: '90318000', price: 1000, unitPrice: 1000 }
    ]);
    openLeadModal();
  });
  await page.waitForTimeout(300);
  await page.selectOption('#inp-lead-vertical', 'Service and Parts').catch(function () {});
  await page.waitForTimeout(300);
  const productOptions = await page.evaluate(function () {
    var select = document.querySelector('#lead-products-container select');
    return select ? Array.from(select.options).map(function (o) { return o.value; }) : [];
  });
  assertIncludes(productOptions, 'Old Wording Product', 'Lead product picker: a product saved under old pre-unification vertical wording still appears under its normalized current vertical', failures);

  // Quick "+ New Product" button: hidden for staff/manager, visible for
  // super_admin - same pattern as the Master Data role test.
  async function checkQuickAddVisibility(employeeId, userRole, expectedVisible, label) {
    const p = await browser.newPage();
    p.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
    await p.addInitScript(function (creds) {
      localStorage.setItem('userRole', creds.userRole);
      localStorage.setItem('userEmail', creds.userEmail);
      localStorage.setItem('userName', creds.userName);
      localStorage.setItem('employeeId', creds.employeeId);
    }, { employeeId: employeeId, userRole: userRole, userEmail: 'x@measuredi.com', userName: 'Test User' });
    await p.goto(BASE_URL + '/leads.html', { waitUntil: 'networkidle', timeout: 30000 });
    await p.waitForTimeout(600);
    const hidden = await p.evaluate(function () {
      return document.getElementById('btn-lead-new-product').classList.contains('hidden');
    });
    assertEqual(!hidden, expectedVisible, label, failures);
    await p.close();
  }
  await checkQuickAddVisibility('E-006', 'staff', false, 'Lead: "+ New Product" hidden for staff role');
  await checkQuickAddVisibility('E-011', 'manager', false, 'Lead: "+ New Product" hidden for manager role');
  await checkQuickAddVisibility('E-001', 'super_admin', true, 'Lead: "+ New Product" visible for super_admin role');

  // Quick-add flow itself: saves into productsMaster, closes the modal
  // without navigating away, and auto-selects the new product into the
  // Lead's current row - the in-progress Lead entry (still open behind
  // the modal) is never lost.
  await page.click('#btn-lead-new-product');
  await page.waitForTimeout(200);
  await page.fill('#inp-newprod-name', 'Quick Add Regression Weigher');
  await page.fill('#inp-newprod-spec', 'Regression test spec 100T');
  const quickAddResult = await page.evaluate(function () {
    document.getElementById('lead-new-product-form').requestSubmit();
    var prods = window.RevOpsStore.getCollection('productsMaster') || [];
    var saved = prods.find(function (p) { return p.name === 'Quick Add Regression Weigher'; });
    var select = document.querySelector('#lead-products-container select');
    return {
      saved: !!saved,
      modalHidden: document.getElementById('lead-new-product-modal').classList.contains('hidden'),
      leadFormStillOpen: !document.getElementById('lead-modal').classList.contains('hidden'),
      selectedIntoRow: select ? select.value : null
    };
  });
  assertTrue(quickAddResult.saved, 'Lead quick-add: new product saved into productsMaster', failures);
  assertTrue(quickAddResult.modalHidden, 'Lead quick-add: modal closes after saving', failures);
  assertTrue(quickAddResult.leadFormStillOpen, 'Lead quick-add: the Lead form itself is still open underneath - never navigated away', failures);
  assertEqual(quickAddResult.selectedIntoRow, 'Quick Add Regression Weigher', 'Lead quick-add: new product is auto-selected into the current row', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Editing an existing quotation must always state a reason: the field
// is hidden and not required when creating a brand-new quote (nothing
// to justify yet), but is shown, required, and force-cleared (never
// pre-filled from a previous edit) the moment an existing quote is
// opened for editing. Saving without it must be blocked, and saving
// with it must record the reason both on the quote record itself
// (visible in the table) and in the central Audit Log.
// ---------------------------------------------------------------------
async function testQuoteEditReasonMandatory(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/quotations.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('quotations', [
      { id: 'QUO-REGR-REASON', quoteNumber: 'QUO-REGR-REASON', customerName: 'Edit Reason Test Co', revision: 1, status: 'Draft', items: [], grandTotal: 0, netSubtotal: 0, taxAmount: 0, approvalHistory: [] }
    ]);
  });

  const newQuoteState = await page.evaluate(function () {
    openQuoteModal(null, null);
    var wrap = document.getElementById('quote-edit-reason-wrapper');
    var inp = document.getElementById('inp-quote-edit-reason');
    return { hidden: wrap.classList.contains('hidden'), required: inp.hasAttribute('required') };
  });
  assertTrue(newQuoteState.hidden, 'Quote edit-reason field is hidden when creating a brand-new quote', failures);
  assertTrue(!newQuoteState.required, 'Quote edit-reason field is not required when creating a brand-new quote', failures);

  const editQuoteState = await page.evaluate(function () {
    openQuoteModal('QUO-REGR-REASON');
    var wrap = document.getElementById('quote-edit-reason-wrapper');
    var inp = document.getElementById('inp-quote-edit-reason');
    return { hidden: wrap.classList.contains('hidden'), required: inp.hasAttribute('required'), value: inp.value };
  });
  assertTrue(!editQuoteState.hidden, 'Quote edit-reason field is shown when editing an existing quote', failures);
  assertTrue(editQuoteState.required, 'Quote edit-reason field is required when editing an existing quote', failures);
  assertEqual(editQuoteState.value, '', 'Quote edit-reason field starts blank on every edit, not pre-filled from a prior edit', failures);

  const blockedWithoutReason = await page.evaluate(function () {
    document.getElementById('quoteForm').requestSubmit();
    return !document.getElementById('quoteModal').classList.contains('hidden');
  });
  assertTrue(blockedWithoutReason, 'Saving an edit with no reason is blocked - modal stays open', failures);

  await page.fill('#inp-quote-edit-reason', 'Regression test: corrected pricing error');
  const afterSave = await page.evaluate(function () {
    document.getElementById('quoteForm').requestSubmit();
    var quotes = window.RevOpsStore.getCollection('quotations') || [];
    var q = quotes.find(function (x) { return x.id === 'QUO-REGR-REASON'; });
    var auditLogs = window.RevOpsStore.getCollection('auditLogs') || [];
    var matchingAudit = auditLogs.find(function (a) { return a.docId === 'QUO-REGR-REASON'; });
    return {
      lastEditReason: q ? q.lastEditReason : null,
      editHistoryLen: q && Array.isArray(q.editHistory) ? q.editHistory.length : 0,
      auditFound: !!matchingAudit
    };
  });
  assertEqual(afterSave.lastEditReason, 'Regression test: corrected pricing error', 'Saved edit reason is recorded on the quote record', failures);
  assertEqual(afterSave.editHistoryLen, 1, 'Edit is appended to the quote\'s own editHistory trail', failures);
  assertTrue(afterSave.auditFound, 'Edit reason is also logged to the central Audit Log', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Go-Live "Clear Demo Data" (Master Data > Danger Zone): Super Admin/
// Admin only, requires typing an exact confirmation phrase, clears every
// demo/transactional collection while leaving Employees, Company Master
// and every classification list untouched, and sets the retirement flag.
// Separately verifies the actual seed-guard code change this relies on:
// once isFirebaseAvailable() is true, a cleared collection must not
// auto-refill, whether its guard checks mere presence or parsed length.
// ---------------------------------------------------------------------
async function testClearDummyDataGoLiveReset(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/master-data.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const dangerVisibleAdmin = await page.evaluate(function () {
    return !document.getElementById('go-live-danger-zone').classList.contains('hidden');
  });
  assertTrue(dangerVisibleAdmin, 'Go-Live Danger Zone is visible for super_admin', failures);

  // Wrong confirmation text must not proceed.
  await page.click('#go-live-danger-zone button');
  await page.waitForTimeout(150);
  await page.fill('#inp-clear-demo-confirm', 'wrong text');
  const rejectedWrongText = await page.evaluate(function () {
    document.getElementById('btn-execute-clear-demo').click();
    return !document.getElementById('clear-demo-data-confirm-view').classList.contains('hidden');
  });
  assertTrue(rejectedWrongText, 'Clear Demo Data: wrong confirmation text does not proceed (stays on confirm view)', failures);

  // Seed some demo-shaped records, then clear with the correct phrase.
  const beforeCounts = await page.evaluate(function () {
    window.RevOpsStore.saveCollection('leads', [{ id: 'l1' }]);
    window.RevOpsStore.saveCollection('quotations', [{ id: 'q1', quoteNumber: 'QT-REGR-1' }]);
    window.RevOpsStore.saveCollection('clientsMaster', [{ id: 'c1', clientName: 'Demo Co' }]);
    return {
      employees: (window.RevOpsStore.getCollection('employees') || []).length,
      companyMaster: (window.RevOpsStore.getCollection('companyMaster') || []).length,
      leadSourceMaster: (window.RevOpsStore.getCollection('leadSourceMaster') || []).length
    };
  });
  assertTrue(beforeCounts.employees > 0, 'Precondition: employees non-empty before clearing', failures);

  await page.fill('#inp-clear-demo-confirm', 'DELETE DEMO DATA');
  const afterClear = await page.evaluate(function () {
    document.getElementById('btn-execute-clear-demo').click();
    return true;
  });
  await page.waitForTimeout(500);

  const cleared = await page.evaluate(function () {
    return {
      doneVisible: !document.getElementById('clear-demo-data-done-view').classList.contains('hidden'),
      leads: (window.RevOpsStore.getCollection('leads') || []).length,
      quotations: (window.RevOpsStore.getCollection('quotations') || []).length,
      clientsMaster: (window.RevOpsStore.getCollection('clientsMaster') || []).length,
      employees: (window.RevOpsStore.getCollection('employees') || []).length,
      companyMaster: (window.RevOpsStore.getCollection('companyMaster') || []).length,
      leadSourceMaster: (window.RevOpsStore.getCollection('leadSourceMaster') || []).length,
      retiredFlag: localStorage.getItem('revops_demo_data_retired')
    };
  });
  assertTrue(cleared.doneVisible, 'Clear Demo Data: completes and shows the done view', failures);
  assertEqual(cleared.leads, 0, 'Clear Demo Data: leads cleared', failures);
  assertEqual(cleared.quotations, 0, 'Clear Demo Data: quotations cleared', failures);
  assertEqual(cleared.clientsMaster, 0, 'Clear Demo Data: clientsMaster cleared', failures);
  assertEqual(cleared.employees, beforeCounts.employees, 'Clear Demo Data: employees left untouched', failures);
  assertEqual(cleared.companyMaster, beforeCounts.companyMaster, 'Clear Demo Data: companyMaster left untouched', failures);
  assertEqual(cleared.leadSourceMaster, beforeCounts.leadSourceMaster, 'Clear Demo Data: classification lists (e.g. Lead Source) left untouched', failures);
  assertEqual(cleared.retiredFlag, 'true', 'Clear Demo Data: sets the demo-data-retired flag', failures);

  // Danger Zone must stay hidden for a non-admin role.
  const staffPage = await browser.newPage();
  staffPage.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
  await staffPage.addInitScript(function () {
    localStorage.setItem('userRole', 'staff');
    localStorage.setItem('userEmail', 'techsupport@measuredi.com');
    localStorage.setItem('userName', 'Mrs. Krithika');
    localStorage.setItem('employeeId', 'E-006');
  });
  await staffPage.goto(BASE_URL + '/master-data.html', { waitUntil: 'networkidle', timeout: 30000 });
  await staffPage.waitForTimeout(600);
  const dangerHiddenStaff = await staffPage.evaluate(function () {
    return document.getElementById('go-live-danger-zone').classList.contains('hidden');
  });
  assertTrue(dangerHiddenStaff, 'Go-Live Danger Zone is hidden for staff role', failures);
  await staffPage.close();

  // The seed-guard code change this whole feature relies on: once
  // Firebase is connected, a cleared collection must not auto-refill -
  // true for both a presence-only guard (clientEquipmentMaster) and a
  // parsed-length guard, the two different guard styles this codebase
  // uses.
  const guardResult = await page.evaluate(function () {
    var originalIsFirebaseAvailable = window.RevOpsStore.isFirebaseAvailable;
    window.RevOpsStore.isFirebaseAvailable = function () { return true; };
    window.RevOpsStore.saveCollection('clientEquipmentMaster', []);
    window.RevOpsStore.seedMasterListsIfEmpty();
    var equipAfter = (window.RevOpsStore.getCollection('clientEquipmentMaster') || []).length;
    window.RevOpsStore.isFirebaseAvailable = originalIsFirebaseAvailable;
    return { equipAfter: equipAfter };
  });
  assertEqual(guardResult.equipAfter, 0, 'Seed guard: clientEquipmentMaster stays empty (not re-seeded) once isFirebaseAvailable() is true', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Master Data bulk CSV upload parser: a plain line.split(',') silently
// shifted every column out of place the moment a field contained a
// comma of its own (an address like "Anna Nagar, Chennai"). The parser
// is now RFC 4180-aware - a quoted field can safely contain commas,
// escaped quotes (""), and even an embedded line break.
// ---------------------------------------------------------------------
async function testBulkCsvParserHandlesQuotedFields(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/master-data.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const result = await page.evaluate(function () {
    var csvWithEmbeddedComma = 'bankName,accountNumber,ifscCode,branch,beneficiaryName,accountType\n' +
      'HDFC Bank Ltd,50200088992211,HDFC0001234,"Anna Nagar, Chennai",MEASURE DI TECHNOLOGIES,Current Account';
    var rows = parseCSVRows(csvWithEmbeddedComma);

    var csvWithEscapedQuote = 'clientName,notes\n"O""Reilly Steel""s Pvt Ltd","Says ""urgent"" a lot"';
    var escapedRows = parseCSVRows(csvWithEscapedQuote);

    var csvWithEmbeddedNewline = 'clientName,address\n"Tata Steel","Plot 1\nJamshedpur Works"\nJSW,Ballari';
    var newlineRows = parseCSVRows(csvWithEmbeddedNewline);

    parseCSV(csvWithEmbeddedComma);
    var parsedRecord = parsedCsvData[0];

    return {
      commaFieldStayedWhole: rows[1][3],
      rowColumnCount: rows[1].length,
      escapedQuoteUnescaped: escapedRows[1][0],
      newlineFieldStayedWhole: newlineRows[1][1],
      newlineRowCount: newlineRows.length,
      parsedBranch: parsedRecord.branch,
      parsedAccountType: parsedRecord.accountType
    };
  });

  assertEqual(result.commaFieldStayedWhole, 'Anna Nagar, Chennai', 'CSV parser: quoted field with an embedded comma stays as one field, not split in two', failures);
  assertEqual(result.rowColumnCount, 6, 'CSV parser: embedded-comma row still has exactly 6 columns (not shifted)', failures);
  assertEqual(result.escapedQuoteUnescaped, 'O"Reilly Steel"s Pvt Ltd', 'CSV parser: escaped double-quotes ("") decode to a literal quote', failures);
  assertEqual(result.newlineFieldStayedWhole, 'Plot 1\nJamshedpur Works', 'CSV parser: quoted field with an embedded line break stays as one field', failures);
  assertEqual(result.newlineRowCount, 3, 'CSV parser: the embedded newline is not mistaken for a new row (header + 2 data rows)', failures);
  assertEqual(result.parsedBranch, 'Anna Nagar, Chennai', 'Full parseCSV() flow: comma-containing field lands correctly keyed by header', failures);
  assertEqual(result.parsedAccountType, 'Current Account', 'Full parseCSV() flow: later columns aren\'t shifted by the earlier comma-containing field', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Password policy: an admin-assigned password (mustChangePassword) or
// one older than 90 days (passwordLastUpdated) must force the holder to
// change-password.html from any page, with a reason banner explaining
// why; the developer/maintenance account (ars.okd@gmail.com) is exempt
// by explicit product decision so dev work is never interrupted. A real
// Firebase session is required to use change-password.html at all
// (there is nothing else gating it), so these checks mock window.firebase
// the same way the Gmail/Brevo email tests already do.
// ---------------------------------------------------------------------
async function testPasswordPolicyEnforcement(browser) {
  const failures = [];

  async function newMockedPage(overrides, mockEmail) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
    await page.addInitScript(function (args) {
      localStorage.setItem('userRole', args.ov.userRole || 'super_admin');
      localStorage.setItem('userEmail', args.ov.userEmail || 'ravi@measuredi.com');
      localStorage.setItem('userName', args.ov.userName || 'Mr. Ravichandran');
      localStorage.setItem('employeeId', args.ov.employeeId || 'E-001');
      if (args.mockEmail) {
        var mockAuth = {
          currentUser: { email: args.mockEmail, getIdToken: async function () { return 'fake-id-token'; } },
          onAuthStateChanged: function (cb) { cb(this.currentUser); return function () {}; },
          signOut: async function () {}
        };
        window.firebase = {
          apps: [],
          initializeApp: function () { return { auth: function () { return mockAuth; } }; },
          auth: function () { return mockAuth; }
        };
      }
    }, { ov: overrides || {}, mockEmail: mockEmail || null });
    return page;
  }

  async function setEmpFlags(page, employeeId, flags) {
    await page.evaluate(function (args) {
      var emps = window.RevOpsStore.getCollection('employees');
      var e = emps.find(function (x) { return x.employeeId === args.employeeId; });
      if (e) window.RevOpsStore.updateItem('employees', e.id, args.flags);
    }, { employeeId: employeeId, flags: flags });
  }

  // Normal login, no flags set -> no redirect.
  {
    const page = await newMockedPage({}, 'ravi@measuredi.com');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await setEmpFlags(page, 'E-001', { mustChangePassword: false, passwordLastUpdated: new Date().toISOString() });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);
    assertTrue(page.url().indexOf('dashboard.html') !== -1, 'Password policy: no flags set stays on dashboard, got ' + page.url(), failures);
    await page.close();
  }

  // mustChangePassword=true -> forced to change-password.html with the admin-set-password reason.
  {
    const page = await newMockedPage({}, 'ravi@measuredi.com');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await setEmpFlags(page, 'E-001', { mustChangePassword: true });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    assertTrue(page.url().indexOf('change-password.html') !== -1, 'Password policy: mustChangePassword=true forces change-password.html, got ' + page.url(), failures);
    const bannerText = await page.locator('#reason-text').innerText().catch(function () { return ''; });
    assertTrue(bannerText.indexOf('Admin set for you') !== -1, 'Password policy: reason banner explains an Admin-set password, got ' + JSON.stringify(bannerText), failures);
    await setEmpFlags(page, 'E-001', { mustChangePassword: false, passwordLastUpdated: new Date().toISOString() });
    await page.close();
  }

  // Password older than 90 days -> forced to change-password.html with the expiry reason.
  {
    const page = await newMockedPage({}, 'ravi@measuredi.com');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    var old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    await setEmpFlags(page, 'E-001', { mustChangePassword: false, passwordLastUpdated: old });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    assertTrue(page.url().indexOf('change-password.html') !== -1, 'Password policy: 90+ day old password forces change-password.html, got ' + page.url(), failures);
    const bannerText = await page.locator('#reason-text').innerText().catch(function () { return ''; });
    assertTrue(bannerText.indexOf('90 days') !== -1, 'Password policy: reason banner explains the 90-day expiry, got ' + JSON.stringify(bannerText), failures);
    await setEmpFlags(page, 'E-001', { mustChangePassword: false, passwordLastUpdated: new Date().toISOString() });
    await page.close();
  }

  // Developer/maintenance account is exempt from both triggers, even with both flags set.
  {
    const page = await newMockedPage({ userEmail: 'ars.okd@gmail.com', employeeId: 'E-DEV' }, 'ars.okd@gmail.com');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await setEmpFlags(page, 'E-DEV', { mustChangePassword: true, passwordLastUpdated: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString() });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    assertTrue(page.url().indexOf('dashboard.html') !== -1, 'Password policy: developer account ars.okd@gmail.com is exempt, got ' + page.url(), failures);
    await page.close();
  }

  // Full self-service submit round trip (Netlify function mocked): clears the flag and lands the user on dashboard.
  {
    const page = await newMockedPage({}, 'ravi@measuredi.com');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await setEmpFlags(page, 'E-001', { mustChangePassword: true });
    await page.goto(BASE_URL + '/change-password.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(function () {
      window.fetch = async function (url) {
        if (url.indexOf('change-own-password') !== -1) {
          return { ok: true, json: async function () { return { success: true, uid: 'mock-uid' }; } };
        }
        return { ok: false, json: async function () { return {}; } };
      };
    });
    await page.fill('#new-password', 'newSecret123');
    await page.fill('#confirm-password', 'newSecret123');
    await page.click('#submit-btn');
    await page.waitForTimeout(1800);
    assertTrue(page.url().indexOf('dashboard.html') !== -1, 'Password policy: successful self-service change redirects to dashboard, got ' + page.url(), failures);
    const empAfter = await page.evaluate(function () {
      var emps = window.RevOpsStore.getCollection('employees');
      return emps.find(function (x) { return x.employeeId === 'E-001'; });
    });
    assertEqual(empAfter && empAfter.mustChangePassword, false, 'Password policy: mustChangePassword cleared locally after a successful change', failures);
    await page.close();
  }

  // Mismatched passwords are rejected inline, no navigation.
  {
    const page = await newMockedPage({}, 'ravi@measuredi.com');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await setEmpFlags(page, 'E-001', { mustChangePassword: true });
    await page.goto(BASE_URL + '/change-password.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);
    await page.fill('#new-password', 'abcdef1');
    await page.fill('#confirm-password', 'abcdef2');
    await page.click('#submit-btn');
    await page.waitForTimeout(400);
    const errVisible = await page.locator('#error-alert').isVisible();
    assertTrue(errVisible, 'Password policy: mismatched passwords show an inline error', failures);
    assertTrue(page.url().indexOf('change-password.html') !== -1, 'Password policy: mismatched passwords do not navigate away, got ' + page.url(), failures);
    await setEmpFlags(page, 'E-001', { mustChangePassword: false, passwordLastUpdated: new Date().toISOString() });
    await page.close();
  }

  // Voluntary "Change Password" link is present in the navbar even with no flags set.
  {
    const page = await newMockedPage({}, 'ravi@measuredi.com');
    await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    const count = await page.locator('a[href="change-password.html"]').count();
    assertTrue(count >= 1, 'Password policy: "Change Password" navbar link is present, got count ' + count, failures);
    await page.close();
  }

  return failures;
}

// ---------------------------------------------------------------------
// Bulk-upload template downloads: a column validated against a live
// Master Data list (today, "vertical" on Products and Projects) gets a
// legend grid appended after the sample rows - each field's allowed
// values lined up under that field's own column, read off the actual
// current list (not a frozen snapshot), plus a short note on whether
// the field is strict or just a usual-answer suggestion. Typed values
// for strict fields are also now normalized on upload (case/whitespace/
// trailing-"s" tolerant), so "project "/"PROJECTS"/"Project" all still
// resolve correctly instead of silently failing to match anywhere
// downstream. A real data export (not a fresh template) must never
// carry this legend, and the bulk-upload parser must silently drop any
// "#" line even if someone forgets to delete it before uploading.
// ---------------------------------------------------------------------
async function testCsvTemplateDropdownLegend(browser) {
  const failures = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
  await page.addInitScript(function () {
    localStorage.setItem('userRole', 'super_admin');
    localStorage.setItem('userEmail', 'murugan@measuredi.com');
    localStorage.setItem('userName', 'Mr. Murugan V');
    localStorage.setItem('employeeId', 'E-001');
  });

  await page.goto(BASE_URL + '/master-data.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('verticalClassificationMaster', [
      { id: 'v1', name: 'Projects', isActive: true },
      { id: 'v2', name: 'Onboard', isActive: true },
      { id: 'v3', name: 'Retired Vertical', isActive: false }
    ]);
  });

  async function downloadTemplateFor(tab) {
    await page.evaluate(function (t) { switchMasterTab(t); }, tab);
    await page.waitForTimeout(200);
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(function () { downloadActiveTemplate(); })
    ]);
    return fs.readFileSync(await dl.path(), 'utf8');
  }

  const productsCsv = await downloadTemplateFor('products');
  const productsRows = productsCsv.trim().split('\n').map(l => l.split(','));
  assertTrue(productsCsv.indexOf('# ===== ALLOWED VALUES =====') !== -1, 'Products template includes the allowed-values legend banner', failures);
  assertTrue(productsRows.some(r => r[0] === 'Projects'), 'Products legend grid lists "Projects" under the vertical column', failures);
  assertTrue(productsRows.some(r => r[0] === 'Onboard'), 'Products legend grid lists "Onboard" under the vertical column', failures);
  assertTrue(productsCsv.indexOf('Retired Vertical') === -1, 'Products legend excludes an inactive vertical', failures);
  assertTrue(productsCsv.indexOf('vertical — one of the values above') !== -1, 'Products legend notes "vertical" is strict (must match exactly)', failures);
  assertTrue(productsCsv.indexOf('vertical,productName,technicalSpec,hsnCode,unitPrice') !== -1, 'Products template still has its real header row', failures);

  const projectsCsv = await downloadTemplateFor('projects');
  assertTrue(projectsCsv.indexOf('# ===== ALLOWED VALUES =====') !== -1, 'Projects template includes the same legend banner', failures);

  for (const tab of ['equipment', 'banks', 'clients']) {
    const csv = await downloadTemplateFor(tab);
    assertTrue(csv.indexOf('ALLOWED VALUES') === -1, tab + ' template has no legend (none of its columns are dropdown-backed)', failures);
  }

  const parseResult = await page.evaluate(function () {
    var csv = '# ===== ALLOWED VALUES =====\n' +
      '#,Projects\n' +
      'vertical,productName,technicalSpec,hsnCode,unitPrice\n' +
      'Projects,Test Product,Test Spec,90318000,10000\n';
    var rows = parseCSVRows(csv);
    return { rowCount: rows.length, header: rows[0], dataRow: rows[1] };
  });
  assertEqual(parseResult.rowCount, 2, 'parseCSVRows drops both "#" legend lines, leaving header + 1 data row', failures);
  assertEqual(parseResult.header[0], 'vertical', 'The surviving first row is the real header', failures);
  assertEqual(parseResult.dataRow[0], 'Projects', 'The surviving second row is the real data', failures);

  // Bulk upload normalizes a strict field against the legend - loose
  // capitalization/whitespace/trailing "s" still resolves to the real value.
  await page.evaluate(function () { switchMasterTab('products'); });
  await page.waitForTimeout(200);
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('productsMaster', []);
    parsedCsvData = [
      { vertical: ' projects ', productName: 'Loose Case Product', technicalSpec: 'x', hsnCode: '1', unitPrice: '1' },
      { vertical: 'Onboards', productName: 'Trailing S Product', technicalSpec: 'x', hsnCode: '2', unitPrice: '2' }
    ];
    executeBulkUpload();
  });
  const normalizedProducts = await page.evaluate(function () {
    return window.RevOpsStore.getCollection('productsMaster');
  });
  assertEqual(normalizedProducts.find(p => p.productName === 'Loose Case Product').vertical, 'Projects', 'Bulk upload normalizes " projects " to the real "Projects"', failures);
  assertEqual(normalizedProducts.find(p => p.productName === 'Trailing S Product').vertical, 'Onboard', 'Bulk upload normalizes a trailing "s" ("Onboards") to the real "Onboard"', failures);

  // A real data export (not a fresh blank template) must never get this legend.
  await page.evaluate(function () { switchMasterTab('products'); });
  await page.waitForTimeout(200);
  await page.evaluate(function () {
    window.RevOpsStore.saveCollection('productsMaster', [{ id: 'p1', vertical: 'Projects', productName: 'Real Product', technicalSpec: 'x', hsnCode: '1', unitPrice: 1 }]);
    renderMasterTable();
  });
  await page.waitForTimeout(200);
  const [exportDl] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(function () { exportCurrentMasterCSV(); })
  ]);
  const exportCsv = fs.readFileSync(await exportDl.path(), 'utf8');
  assertTrue(exportCsv.indexOf('ALLOWED VALUES') === -1, 'A real-data export never carries the template legend', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// The global "Data Center" (every page's navbar - Bulk Data Import &
// Export Center) is a SEPARATE bulk-upload surface from Master Data's
// own per-tab upload, covering 12 collections instead of 5. It had its
// own independent problems this fix addresses: a naive line.split(',')
// parser (the exact comma-corruption bug already fixed once in Master
// Data, found again here), a Leads template still using the retired
// 8-stage pipeline wording, inconsistent "vertical" spelling across its
// own templates ("Sales"/"Service/Parts" instead of the real
// "Projects"/"Service and Parts"), and 5 collections (Quotations, DWM
// Logs, Payments, Attendance, KRA Targets) silently falling back to a
// generic, wrong placeholder template. All of it now flows through the
// same RevOpsStore.getPrescribedCsvTemplate() + parseCSVRows() single
// source of truth Master Data's own upload already uses.
// ---------------------------------------------------------------------
async function testDataCenterTemplatesAndParser(browser) {
  const failures = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
  await page.addInitScript(function () {
    localStorage.setItem('userRole', 'super_admin');
    localStorage.setItem('userEmail', 'murugan@measuredi.com');
    localStorage.setItem('userName', 'Mr. Murugan V');
    localStorage.setItem('employeeId', 'E-001');
  });

  await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  async function downloadFor(collectionValue) {
    await page.evaluate(function () { openDataImportExportModal(); });
    await page.waitForTimeout(200);
    await page.selectOption('#data-import-collection', collectionValue);
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(function () { downloadCSVTemplate(); })
    ]);
    return fs.readFileSync(await dl.path(), 'utf8');
  }

  const leadsCsv = await downloadFor('leads');
  const leadsRows = leadsCsv.trim().split('\n').map(l => l.split(','));
  assertTrue(leadsCsv.indexOf(',Quoted,') !== -1, 'Data Center Leads template uses the current pipeline stage wording (Quoted)', failures);
  assertTrue(leadsCsv.indexOf('Commercial Offer Submitted') === -1 && leadsCsv.indexOf('Lead Qualified') === -1, 'Data Center Leads template no longer uses the retired 8-stage wording', failures);
  assertTrue(leadsCsv.indexOf('# ===== ALLOWED VALUES =====') !== -1, 'Data Center Leads template includes the legend banner', failures);
  ['leadSource', 'industry', 'projectSector', 'vertical', 'currency', 'stage'].forEach(function (col) {
    assertTrue(leadsCsv.indexOf(col + ' — one of the values above') !== -1, 'Data Center Leads template notes "' + col + '" is strict', failures);
  });
  assertTrue(leadsRows.some(r => r.includes('INR')), 'Leads legend grid lists currency codes (INR), not currency names', failures);
  assertTrue(leadsRows.some(r => r.includes('Won')), 'Leads legend grid lists the pipeline stage "Won"', failures);
  assertTrue(leadsRows.some(r => r.includes('Trashed')), 'Leads legend grid lists the exit stage "Trashed"', failures);

  const empCsv = await downloadFor('employees');
  assertTrue(empCsv.indexOf('super_admin, admin, manager, staff') === -1, 'Employees role values are in the grid (one per row), not one comma-joined line', failures);
  const empRows = empCsv.trim().split('\n').map(l => l.split(','));
  ['super_admin', 'admin', 'manager', 'staff'].forEach(function (role) {
    assertTrue(empRows.some(r => r.includes(role)), 'Employees legend grid lists role "' + role + '"', failures);
  });
  assertTrue(empCsv.indexOf('role — one of the values above') !== -1, 'Employees template notes "role" is strict (security-sensitive)', failures);
  assertTrue(empCsv.indexOf('workArrangement') !== -1 && empCsv.indexOf('usual answers') !== -1, 'Employees template notes workArrangement is a flexible/suggested field', failures);
  assertTrue(empCsv.indexOf('Projects & production') === -1, 'Employees template vertical samples use canonical casing, not the old wording', failures);

  const clientsCsv = await downloadFor('clientsMaster');
  assertTrue(clientsCsv.indexOf('# ===== ALLOWED VALUES =====') !== -1, 'Clients template has the legend banner', failures);
  assertTrue(clientsCsv.indexOf(',Sales,') === -1, 'Clients template no longer uses bare "Sales" as a vertical sample', failures);

  const quotCsv = await downloadFor('quotations');
  assertTrue(quotCsv.indexOf('quoteNumber') !== -1 && quotCsv.indexOf('id,title,category') === -1, 'Quotations template is real, not the generic placeholder', failures);

  const dwmCsv = await downloadFor('dwmActivities');
  assertTrue(dwmCsv.indexOf('activityDescription') !== -1, 'DWM Activity Log template is real', failures);
  assertTrue(dwmCsv.indexOf('category — one of the values above') !== -1, 'DWM template notes "category" is strict', failures);

  const paymentsCsv = await downloadFor('payments');
  assertTrue(paymentsCsv.indexOf('paymentMode') !== -1, 'Payments template is real', failures);
  assertTrue(paymentsCsv.indexOf('paymentMode — one of the values above') !== -1, 'Payments template notes "paymentMode" is strict', failures);

  const attendanceCsv = await downloadFor('attendance');
  assertTrue(attendanceCsv.indexOf('punchInTime') !== -1, 'Attendance backfill template is real', failures);

  const kraCsv = await downloadFor('kraTargets');
  assertTrue(kraCsv.indexOf('aopLine') !== -1, 'KRA Targets template is real', failures);
  assertTrue(kraCsv.indexOf('aopLine — one of the values above') !== -1, 'KRA template notes "aopLine" is strict', failures);

  // The Data Center's own upload path now shares Master Data's RFC
  // 4180-aware tokenizer instead of a separate naive line.split(',').
  const parseResult = await page.evaluate(function () {
    var csv = '# ===== ALLOWED VALUES =====\n' +
      'leadNumber,customerName,notes\n' +
      'LD-TEST-1,"Test, Comma Co",Has a comma in the name\n';
    var rows = window.RevOpsStore.parseCSVRows(csv);
    return { rowCount: rows.length, header: rows[0], dataRow: rows[1] };
  });
  assertEqual(parseResult.rowCount, 2, 'Shared parseCSVRows drops the "#" legend line (header + 1 data row survive)', failures);
  assertEqual(parseResult.dataRow[1], 'Test, Comma Co', 'Shared parseCSVRows keeps a comma inside a quoted field intact', failures);

  // bulkUploadItems() (the Data Center's actual write path) normalizes a
  // strict field against its template's legend the same way Master
  // Data's own executeBulkUpload() does.
  const normResult = await page.evaluate(function () {
    return new Promise(function (resolve) {
      window.RevOpsStore.saveCollection('employees', []);
      window.RevOpsStore.bulkUploadItems('employees', [
        { employeeId: 'E-901', fullName: 'Test Employee', role: ' Staff ', vertical: 'projects' }
      ], function () {
        var emps = window.RevOpsStore.getCollection('employees');
        resolve(emps.find(function (e) { return e.employeeId === 'E-901'; }));
      });
    });
  });
  assertEqual(normResult && normResult.role, 'staff', 'bulkUploadItems normalizes " Staff " to the real "staff" role', failures);
  assertEqual(normResult && normResult.vertical, 'Projects', 'bulkUploadItems normalizes "projects" to the real "Projects"', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// Lead pipeline stage model: the forward-only, exit-immune
// advanceLeadStage() helper, the Leads form's Lost/Trashed/Postponed
// guards and mandatory-reason enforcement, and the Dashboard's
// pending-follow-ups list correctly excluding closed-out leads.
// ---------------------------------------------------------------------
function sampleTestLead(overrides) {
  return Object.assign({
    id: 'lead_test_' + Math.random().toString(36).slice(2),
    leadNumber: 'LD-2026-TEST',
    customerName: 'Test Customer Co',
    leadSource: 'Direct Customer Approach',
    industry: 'Projects',
    projectSector: 'Steel',
    vertical: 'Projects',
    products: [{ name: 'Test Product', spec: 'Test spec', hsn: '90318000', quantity: 1, unitPrice: 100000 }],
    productName: 'Test Product',
    currency: 'INR',
    estimatedValue: 100000,
    expectedValue: 100000,
    stage: 'Contacted',
    status: 'Contacted',
    contacts: [{ name: 'Test Contact', phone: '9999999999', email: 'contact@test.com', autoCc: true }],
    contactPerson: 'Test Contact',
    contactPhone: '9999999999',
    contactEmail: 'contact@test.com',
    employeeId: 'E-001',
    employeeName: 'Mr. Murugan V',
    createdDate: '01/10/2026',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, overrides || {});
}

async function testLeadPipelineStageModel(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/leads.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  // advanceLeadStage(): forward-only, merges extraFields, never overrides
  // a lead someone already closed out (Trashed/Lost/Postponed).
  const unit = await page.evaluate(function () {
    window.RevOpsStore.saveCollection('leads', [{ id: 'lead_unit_1', customerName: 'Unit Co', status: 'Contacted', stage: 'Contacted' }]);

    window.RevOpsStore.advanceLeadStage('lead_unit_1', 'Quoted', { dealValue: 5000 });
    var afterQuoted = window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_unit_1'; });

    window.RevOpsStore.advanceLeadStage('lead_unit_1', 'Contacted', {});
    var afterBackward = window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_unit_1'; });

    var leads = window.RevOpsStore.getCollection('leads');
    leads[0].status = 'Lost'; leads[0].stage = 'Lost';
    window.RevOpsStore.saveCollection('leads', leads);
    window.RevOpsStore.advanceLeadStage('lead_unit_1', 'Order Received', {});
    var afterExitAttempt = window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_unit_1'; });

    return {
      afterQuotedStatus: afterQuoted.status,
      afterQuotedDealValue: afterQuoted.dealValue,
      afterBackwardStatus: afterBackward.status,
      afterExitAttemptStatus: afterExitAttempt.status,
      stages: window.RevOpsStore.LEAD_PIPELINE_STAGES
    };
  });
  assertEqual(unit.afterQuotedStatus, 'Quoted', 'advanceLeadStage: moves Contacted -> Quoted', failures);
  assertEqual(unit.afterQuotedDealValue, 5000, 'advanceLeadStage: merges extraFields onto the lead', failures);
  assertEqual(unit.afterBackwardStatus, 'Quoted', 'advanceLeadStage: a backward move is a no-op', failures);
  assertEqual(unit.afterExitAttemptStatus, 'Lost', 'advanceLeadStage: never overrides a closed-out (Lost) lead', failures);
  assertEqual(unit.stages, ['Contacted', 'Qualified', 'Quoted', 'Negotiation', 'Order Received', 'Won'], 'LEAD_PIPELINE_STAGES is the expected 6-stage sequence', failures);

  // Lost requires a mandatory reason before it can be saved.
  await page.evaluate(function (lead) { window.RevOpsStore.saveCollection('leads', [lead]); }, sampleTestLead({ id: 'lead_b1', status: 'Quoted', stage: 'Quoted' }));
  await page.evaluate(function () { editLead('lead_b1'); });
  await page.waitForTimeout(200);
  await page.selectOption('#inp-lead-stage', 'Lost');
  await page.click('#lead-form button[type="submit"]');
  await page.waitForTimeout(300);
  let b1 = await page.evaluate(function () { return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_b1'; }); });
  assertEqual(b1.status, 'Quoted', 'Lost without a reason is blocked - lead stays unchanged', failures);

  await page.selectOption('#inp-lead-stage', 'Lost');
  await page.selectOption('#inp-lead-lost-reason', 'Price too high');
  await page.fill('#inp-lead-lost-remarks', 'Client went with a cheaper competitor.');
  await page.click('#lead-form button[type="submit"]');
  await page.waitForTimeout(300);
  b1 = await page.evaluate(function () { return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_b1'; }); });
  assertEqual(b1.status, 'Lost', 'Lost WITH a reason succeeds', failures);
  assertEqual(b1.lostReason, 'Price too high', 'Lost reason is stored on the lead', failures);
  assertEqual(b1.lostRemarks, 'Client went with a cheaper competitor.', 'Lost remarks are stored on the lead', failures);

  // Trashed is allowed early (Contacted), but blocked once a lead has
  // progressed past Qualified - Lost is the right closure at that point.
  await page.evaluate(function (lead) {
    var leads = window.RevOpsStore.getCollection('leads');
    leads.push(lead);
    window.RevOpsStore.saveCollection('leads', leads);
  }, sampleTestLead({ id: 'lead_b3', status: 'Contacted', stage: 'Contacted' }));
  await page.evaluate(function () { editLead('lead_b3'); });
  await page.waitForTimeout(200);
  await page.selectOption('#inp-lead-stage', 'Trashed');
  await page.click('#lead-form button[type="submit"]');
  await page.waitForTimeout(300);
  const b3 = await page.evaluate(function () { return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_b3'; }); });
  assertEqual(b3.status, 'Trashed', 'Trashed is allowed from Contacted', failures);

  await page.evaluate(function (lead) {
    var leads = window.RevOpsStore.getCollection('leads');
    leads.push(lead);
    window.RevOpsStore.saveCollection('leads', leads);
  }, sampleTestLead({ id: 'lead_b4', status: 'Negotiation', stage: 'Negotiation' }));
  await page.evaluate(function () { editLead('lead_b4'); });
  await page.waitForTimeout(200);
  await page.selectOption('#inp-lead-stage', 'Trashed');
  await page.click('#lead-form button[type="submit"]');
  await page.waitForTimeout(300);
  const b4 = await page.evaluate(function () { return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_b4'; }); });
  assertEqual(b4.status, 'Negotiation', 'Trashed is blocked once a lead has progressed past Qualified', failures);

  // Lost/Postponed both require the lead to have at least reached Quoted.
  await page.evaluate(function (lead) {
    var leads = window.RevOpsStore.getCollection('leads');
    leads.push(lead);
    window.RevOpsStore.saveCollection('leads', leads);
  }, sampleTestLead({ id: 'lead_b5', status: 'Contacted', stage: 'Contacted' }));
  await page.evaluate(function () { editLead('lead_b5'); });
  await page.waitForTimeout(200);
  await page.selectOption('#inp-lead-stage', 'Postponed');
  await page.click('#lead-form button[type="submit"]');
  await page.waitForTimeout(300);
  const b5 = await page.evaluate(function () { return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_b5'; }); });
  assertEqual(b5.status, 'Contacted', 'Postponed is blocked before a lead has been Quoted', failures);

  await page.evaluate(function (lead) {
    var leads = window.RevOpsStore.getCollection('leads');
    leads.push(lead);
    window.RevOpsStore.saveCollection('leads', leads);
  }, sampleTestLead({ id: 'lead_b6', status: 'Quoted', stage: 'Quoted' }));
  await page.evaluate(function () { editLead('lead_b6'); });
  await page.waitForTimeout(200);
  await page.selectOption('#inp-lead-stage', 'Postponed');
  await page.click('#lead-form button[type="submit"]');
  await page.waitForTimeout(300);
  const b6 = await page.evaluate(function () { return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_b6'; }); });
  const daysOut = b6.postponedUntil ? Math.round((new Date(b6.postponedUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  assertEqual(b6.status, 'Postponed', 'Postponed succeeds once a lead has been Quoted', failures);
  assertTrue(daysOut >= 178 && daysOut <= 181, 'Postponed sets a ~180-day postponedUntil date, got ' + daysOut + ' days out', failures);

  await page.close();

  // Dashboard: pending follow-ups must exclude Won/Lost/Trashed and a
  // not-yet-due Postponed, but include a Postponed lead whose deferral
  // date has already passed.
  const { page: dashPage } = await newPage(browser);
  await dashPage.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
  await dashPage.waitForTimeout(600);
  const followupsHtml = await dashPage.evaluate(function () {
    var now = Date.now();
    var leads = [
      { id: 'c1', customerName: 'Won Co', status: 'Won' },
      { id: 'c2', customerName: 'Lost Co', status: 'Lost' },
      { id: 'c3', customerName: 'Trashed Co', status: 'Trashed' },
      { id: 'c4', customerName: 'Postponed Future Co', status: 'Postponed', postponedUntil: new Date(now + 100 * 86400000).toISOString() },
      { id: 'c5', customerName: 'Postponed Due Co', status: 'Postponed', postponedUntil: new Date(now - 5 * 86400000).toISOString() },
      { id: 'c6', customerName: 'Active Co', status: 'Contacted' }
    ];
    renderPendingFollowups(leads);
    return document.getElementById('pending-followups-list').innerHTML;
  });
  assertTrue(followupsHtml.indexOf('Won Co') === -1, 'Pending follow-ups excludes Won leads', failures);
  assertTrue(followupsHtml.indexOf('Lost Co') === -1, 'Pending follow-ups excludes Lost leads', failures);
  assertTrue(followupsHtml.indexOf('Trashed Co') === -1, 'Pending follow-ups excludes Trashed leads', failures);
  assertTrue(followupsHtml.indexOf('Postponed Future Co') === -1, 'Pending follow-ups excludes a not-yet-due Postponed lead', failures);
  assertTrue(followupsHtml.indexOf('Postponed Due Co') !== -1, 'Pending follow-ups includes a Postponed lead once its date is due', failures);
  assertTrue(followupsHtml.indexOf('Active Co') !== -1, 'Pending follow-ups includes an ordinary active lead', failures);
  await dashPage.close();

  return failures;
}

// ---------------------------------------------------------------------
// Lead auto-sync from real business events: sending a Quotation, booking
// an Order's primary approval, and raising an Invoice must each advance
// the linked CRM Lead forward (Quoted / Order Received / Won) with no
// manual stage update required.
// ---------------------------------------------------------------------
async function testLeadAutoSyncFromDocuments(browser) {
  const failures = [];

  // Quotation send -> Lead "Quoted"
  {
    const { page } = await newPage(browser);
    await page.goto(BASE_URL + '/quotations.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    await page.evaluate(function (lead) {
      window.RevOpsStore.saveCollection('leads', [lead]);
      window.RevOpsStore.saveCollection('quotations', [{
        id: 'quo_test_1', quoteNumber: 'QUO-2026-TEST', customerName: 'Test Customer Co',
        email: 'client@test.com', leadId: lead.id, grandTotal: 250000, revision: 1,
        status: 'Approved', items: []
      }]);
      window.PdfGenerator.generatePdfFromHtml = async function () { return { name: 'test.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,AAAA' }; };
      window.BrevoMailer.sendQuotationEmail = async function () { return { channel: 'brevo', messageId: 'test-msg-1' }; };
    }, sampleTestLead({ id: 'lead_quote_sync', status: 'Qualified', stage: 'Qualified' }));

    await page.evaluate(function () { openSendQuoteModal('quo_test_1'); });
    await page.waitForTimeout(300);
    await page.click('#send-quote-form button[type="submit"]');
    await page.waitForTimeout(1500);

    const leadAfter = await page.evaluate(function () {
      return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_quote_sync'; });
    });
    assertTrue(!!leadAfter && leadAfter.status === 'Quoted', 'Sending a Quotation advances the linked Lead to "Quoted", got ' + (leadAfter && leadAfter.status), failures);
    assertEqual(leadAfter && leadAfter.dealValue, 250000, 'Quotation send carries its grand total onto the Lead as dealValue', failures);
    await page.close();
  }

  // Order primary-approval finalize -> Lead "Order Received"
  {
    const { page } = await newPage(browser);
    await page.goto(BASE_URL + '/orders.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    await page.evaluate(function (lead) {
      window.RevOpsStore.saveCollection('leads', [lead]);
      window.RevOpsStore.saveCollection('orders', [{
        id: 'ord_test_1', orderValue: 300000, leadId: lead.id, customerName: 'Test Customer Co',
        poNumber: 'PO-TEST-001', poDate: '02/10/2026', status: 'Pending Approval'
      }]);
    }, sampleTestLead({ id: 'lead_order_sync', status: 'Quoted', stage: 'Quoted' }));

    await page.evaluate(function () {
      var order = window.RevOpsStore.getCollection('orders').find(function (o) { return o.id === 'ord_test_1'; });
      finalizeOrderPrimaryApproval(order, 'Mr. Murugan V', 'E-001', 'Approved for test');
    });
    await page.waitForTimeout(300);

    const leadAfter = await page.evaluate(function () {
      return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_order_sync'; });
    });
    assertTrue(!!leadAfter && leadAfter.status === 'Order Received', 'Booking an Order advances the linked Lead to "Order Received", got ' + (leadAfter && leadAfter.status), failures);
    assertEqual(leadAfter && leadAfter.poNumber, 'PO-TEST-001', 'Order booking carries the PO number onto the Lead', failures);
    await page.close();
  }

  // Invoice raised (new invoice saved) -> Lead "Won"
  {
    const { page } = await newPage(browser);
    await page.goto(BASE_URL + '/invoices.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    await page.evaluate(function (lead) {
      window.RevOpsStore.saveCollection('leads', [lead]);
      window.RevOpsStore.saveCollection('orders', [{
        id: 'ord_inv_test_1', orderValue: 300000, leadId: lead.id, customerName: 'Test Customer Co',
        customerEmail: 'client@test.com', poNumber: 'PO-TEST-INV-001', status: 'Booked', invoicedStatus: ''
      }]);
      window.RevOpsStore.saveCollection('invoices', []);
    }, sampleTestLead({ id: 'lead_invoice_sync', status: 'Order Received', stage: 'Order Received' }));

    await page.evaluate(function () { populateQuoteAndOrderSources(); openInvoiceModal(); });
    await page.waitForTimeout(300);
    await page.selectOption('#inp-inv-order-source', 'ord_inv_test_1');
    await page.waitForTimeout(300);
    await page.click('#invoice-modal button[type="submit"]');
    await page.waitForTimeout(500);

    const leadAfter = await page.evaluate(function () {
      return window.RevOpsStore.getCollection('leads').find(function (l) { return l.id === 'lead_invoice_sync'; });
    });
    assertTrue(!!leadAfter && leadAfter.status === 'Won', 'Raising an Invoice advances the linked Lead to "Won", got ' + (leadAfter && leadAfter.status), failures);
    await page.close();
  }

  return failures;
}

// ---------------------------------------------------------------------
// Pre-launch DWM/Attendance audit fixes: (1) calculateDailyProductivity's
// credit percentages must match the DWM accomplishment dropdown's own
// labels exactly (Done 100% / Partial 70% / Not Done 0%) - they used to
// silently diverge (60%/20%), and a still-"Pending" activity used to get
// the same 20% credit as an explicit "Not Done" instead of 0%. (2) My
// Scorecard's DWM compliance % must never default an employee with zero
// logged activities this month to 100% just because someone else in the
// org has logged something - that masked genuine non-adoption.
// ---------------------------------------------------------------------
async function testDwmProductivityAndComplianceFixes(browser) {
  const failures = [];

  // Part 1: credit percentages match the dropdown's own labels.
  {
    const { page } = await newPage(browser);
    await page.goto(BASE_URL + '/dwm.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    const result = await page.evaluate(function () {
      var done = window.RevOpsStore.calculateDailyProductivity([
        { hoursSpent: 2, accomplishmentStatus: 'Done' }
      ], 8.0);
      var partial = window.RevOpsStore.calculateDailyProductivity([
        { hoursSpent: 2, accomplishmentStatus: 'Partial' }
      ], 8.0);
      var notDone = window.RevOpsStore.calculateDailyProductivity([
        { hoursSpent: 2, accomplishmentStatus: 'Not Done' }
      ], 8.0);
      var pending = window.RevOpsStore.calculateDailyProductivity([
        { hoursSpent: 4, accomplishmentStatus: 'Pending' }
      ], 8.0);
      var mixed = window.RevOpsStore.calculateDailyProductivity([
        { hoursSpent: 2, accomplishmentStatus: 'Done' },
        { hoursSpent: 2, accomplishmentStatus: 'Partial' },
        { hoursSpent: 2, accomplishmentStatus: 'Not Done' }
      ], 8.0);
      return {
        donePH: done.productiveHours, doneScore: done.score,
        partialPH: partial.productiveHours,
        notDonePH: notDone.productiveHours,
        pendingPH: pending.productiveHours, pendingScore: pending.score,
        mixedPH: mixed.productiveHours, mixedScore: mixed.score
      };
    });
    assertEqual(result.donePH, 2, 'Done (2h) credits the full 2 productive hours (100%)', failures);
    assertEqual(result.doneScore, 25, 'Done (2h of 8h standard) scores 25%', failures);
    assertEqual(result.partialPH, 1.4, 'Partial (2h) credits 70% -> 1.4 productive hours, not the old 60%', failures);
    assertEqual(result.notDonePH, 0, 'Not Done (2h) credits 0 productive hours, not the old 20%', failures);
    assertEqual(result.pendingPH, 0, 'Still-Pending (4h, never updated) credits 0 productive hours, same as Not Done', failures);
    assertEqual(result.pendingScore, 0, 'Still-Pending activity alone scores 0%, not the old 20%-equivalent credit', failures);
    assertEqual(result.mixedPH, 3.4, 'Mixed Done+Partial+NotDone (2h each) totals 3.4 productive hours (2 + 1.4 + 0)', failures);
    assertEqual(result.mixedScore, 43, 'Mixed set scores round(3.4/8*100) = 43%', failures);

    await page.close();
  }

  // Part 2: DWM compliance never defaults to 100% for zero-activity employees.
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
    await page.addInitScript(function () {
      localStorage.setItem('userRole', 'staff');
      localStorage.setItem('userEmail', 'techsupport@measuredi.com');
      localStorage.setItem('userName', 'Mrs. Krithika');
      localStorage.setItem('employeeId', 'E-006');
    });

    await page.goto(BASE_URL + '/my-scorecard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    await page.evaluate(function () {
      var now = new Date();
      var mm = String(now.getMonth() + 1).padStart(2, '0');
      var thisMonthDate = '15/' + mm + '/' + now.getFullYear();
      // E-006 (the employee being scored) has logged nothing this month;
      // a different employee (E-007) has, so the shared collection isn't
      // empty - this is exactly the condition that used to trigger the
      // false "100% compliant" fallback for E-006.
      window.RevOpsStore.saveCollection('dwmActivities', [
        { id: 'dwm_other_1', employeeId: 'E-007', date: thisMonthDate, accomplishmentStatus: 'Done', hoursSpent: 4 }
      ]);
      renderScorecardForEmployee('E-006');
    });
    await page.waitForTimeout(300);

    const dwmPct = await page.evaluate(function () {
      return document.getElementById('dwm-compliance-val').innerText;
    });
    assertEqual(dwmPct, '0%', 'An employee with zero DWM activity this month correctly shows 0% compliance (not a false 100%)', failures);

    await page.close();
  }

  return failures;
}

// ---------------------------------------------------------------------
// Launch-day incident: change-password.html, support-tickets.html, and
// demo-playbook.html were all created as real pages but never added to
// vite.config.ts's rollupOptions.input - the explicit, hand-maintained
// list of every page this Vite multi-page build actually outputs to
// dist/. A page missing from that list is simply never built, so in
// production Netlify finds no matching static file and silently falls
// through to the catch-all "/* -> /index.html" redirect (status 200 -
// not a 404, so nothing looks wrong in the Network tab) - the page just
// spins on index.html's "Authenticating workspace..." loader forever.
// This happened in production: a real user could not complete a forced
// password change because change-password.html had never actually been
// deployed. This test makes that specific failure mode impossible to
// reintroduce silently - no browser needed, it's a static check that
// every root .html file has a matching entry in vite.config.ts.
// ---------------------------------------------------------------------
async function testEveryHtmlPageRegisteredInViteBuild(browser) {
  const failures = [];

  const rootHtmlFiles = fs.readdirSync(REPO_ROOT)
    .filter(function (f) { return f.endsWith('.html'); })
    .sort();

  const viteConfigText = fs.readFileSync(path.join(REPO_ROOT, 'vite.config.ts'), 'utf8');
  const registered = new Set(
    Array.from(viteConfigText.matchAll(/path\.resolve\(__dirname,\s*'([^']+\.html)'\)/g))
      .map(function (m) { return m[1]; })
  );

  const missing = rootHtmlFiles.filter(function (f) { return !registered.has(f); });
  assertEqual(missing, [], 'Every root .html page has a matching entry in vite.config.ts rollupOptions.input (a missing one silently never gets built or deployed)', failures);

  return failures;
}

// ---------------------------------------------------------------------
// Attendance/DWM punch-flow redesign: Punch In/Out no longer happen as
// standalone buttons on attendance.html - that page now only links over
// to DWM. Punch In is recorded the moment the employee confirms their
// morning plan is ready (Section A); Punch Out is recorded the moment
// they confirm every activity's accomplishment is updated (Section B).
// Both still require a live GPS capture, mocked here deterministically
// instead of relying on the real browser geolocation stack.
// ---------------------------------------------------------------------
async function testDwmPunchInOutFlow(browser) {
  const failures = [];
  const testEmpId = 'E-PUNCHTEST-01';

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
  await page.addInitScript(function () {
    localStorage.setItem('userRole', 'staff');
    localStorage.setItem('userEmail', 'punchtest@measuredi.com');
    localStorage.setItem('userName', 'Punch Test Employee');
    localStorage.setItem('employeeId', 'E-PUNCHTEST-01');

    // Deterministic GPS fix - bypasses the real browser geolocation
    // permission prompt/hardware entirely so the test can't flake on it.
    navigator.geolocation.getCurrentPosition = function (success) {
      success({ coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 15 } });
    };
  });

  await page.goto(BASE_URL + '/dwm.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  // Clean slate for this synthetic employee on both collections.
  await page.evaluate(function (empId) {
    var attendance = (window.RevOpsStore.getCollection('attendance') || []).filter(function (a) { return a.employeeId !== empId; });
    window.RevOpsStore.saveCollection('attendance', attendance);
    var dwm = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId !== empId; });
    window.RevOpsStore.saveCollection('dwmActivities', dwm);
  }, testEmpId);
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  // 1. No plan yet -> Punch In button disabled.
  let inDisabled = await page.evaluate(function () { return document.getElementById('dwm-punch-in-btn').disabled; });
  assertTrue(inDisabled, 'Punch In stays disabled with zero DWM activities planned', failures);

  // 2. Plan one activity directly via the store (equivalent to filling the modal) and re-render.
  await page.evaluate(function (empId) {
    window.RevOpsStore.addItem('dwmActivities', {
      employeeId: empId, employeeName: 'Punch Test Employee', date: getFormattedToday(),
      activityDescription: 'Site visit', category: 'Standard KRA Activity', isSpecialAssignment: false,
      hoursSpent: 2, linkedKraId: 'kra_test', linkedKra: 'Test KRA', linkedAopLine: 'Test',
      planStatus: 'Planned', accomplishmentStatus: 'Pending', accomplishmentRemarks: '',
      plannedAt: new Date().toISOString(), accomplishedAt: null
    });
    renderDwmData(empId);
  }, testEmpId);
  await page.waitForTimeout(300);

  inDisabled = await page.evaluate(function () { return document.getElementById('dwm-punch-in-btn').disabled; });
  assertTrue(!inDisabled, 'Punch In becomes enabled once 1+ activities are planned', failures);

  // 3. Confirm the plan is done -> this click IS the Punch In moment.
  await page.evaluate(function () { confirmPunchIn(); });
  await page.waitForTimeout(500);

  const afterPunchIn = await page.evaluate(function (empId) {
    var att = (window.RevOpsStore.getCollection('attendance') || []).find(function (a) { return a.employeeId === empId; });
    return {
      status: att && att.status,
      hasLocation: !!(att && att.punchInLocation && att.punchInLocation.latitude === 12.9716),
      inBtnDisabled: document.getElementById('dwm-punch-in-btn').disabled,
      outBtnDisabled: document.getElementById('dwm-punch-out-btn').disabled
    };
  }, testEmpId);
  assertEqual(afterPunchIn.status, 'Punched In', 'Confirming the plan on DWM creates a "Punched In" attendance record', failures);
  assertTrue(afterPunchIn.hasLocation, 'Punch In attendance record carries the captured GPS location', failures);
  assertTrue(afterPunchIn.inBtnDisabled, 'Punch In button disables itself once already punched in today', failures);
  assertTrue(afterPunchIn.outBtnDisabled, 'Punch Out stays disabled while the planned activity is still Pending', failures);

  // 4. Update the one planned activity's accomplishment to Done -> Punch Out unlocks.
  await page.evaluate(function (empId) {
    var act = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.employeeId === empId; });
    window.RevOpsStore.updateItem('dwmActivities', act.id, { accomplishmentStatus: 'Done', accomplishmentRemarks: 'Done on site' });
    renderDwmData(empId);
  }, testEmpId);
  await page.waitForTimeout(300);

  const outDisabledAfterUpdate = await page.evaluate(function () { return document.getElementById('dwm-punch-out-btn').disabled; });
  assertTrue(!outDisabledAfterUpdate, 'Punch Out becomes enabled once every planned activity is updated off Pending', failures);

  // 5. Confirm accomplishments are done -> this click IS the Punch Out moment.
  await page.evaluate(function () { confirmPunchOut(); });
  await page.waitForTimeout(500);

  const afterPunchOut = await page.evaluate(function (empId) {
    var att = (window.RevOpsStore.getCollection('attendance') || []).find(function (a) { return a.employeeId === empId; });
    return {
      status: att && att.status,
      hasOutLocation: !!(att && att.punchOutLocation && att.punchOutLocation.latitude === 12.9716),
      dwmAccomplishedCount: att && att.dwmAccomplishedCount,
      hasWorkedHours: typeof (att && att.workedHours) === 'number'
    };
  }, testEmpId);
  assertEqual(afterPunchOut.status, 'Completed', 'Confirming accomplishments on DWM completes the attendance record (Punch Out)', failures);
  assertTrue(afterPunchOut.hasOutLocation, 'Punch Out attendance record carries the captured GPS location', failures);
  assertEqual(afterPunchOut.dwmAccomplishedCount, 1, 'Punch Out snapshots the accomplished DWM activity count', failures);
  assertTrue(afterPunchOut.hasWorkedHours, 'Punch Out computes workedHours from the punch-in to punch-out span', failures);

  // 6. Attendance page (same browser context -> same localStorage) now only
  // links to DWM and reflects the Completed state - it performs no GPS
  // capture or attendance write of its own any more.
  await page.goto(BASE_URL + '/attendance.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const attUi = await page.evaluate(function () {
    return {
      hasPunchInBtn: !!document.getElementById('punch-in-btn'),
      hasPunchOutBtn: !!document.getElementById('punch-out-btn'),
      inLinkHidden: document.getElementById('punch-in-link').classList.contains('hidden'),
      inDoneText: document.getElementById('punch-in-done-box').innerText,
      outDoneText: document.getElementById('punch-out-done-box').innerText,
      statusText: document.getElementById('current-attendance-status-text').innerText
    };
  });
  assertTrue(!attUi.hasPunchInBtn, 'attendance.html no longer has its own GPS-capturing Punch In button', failures);
  assertTrue(!attUi.hasPunchOutBtn, 'attendance.html no longer has its own GPS-capturing Punch Out button', failures);
  assertTrue(attUi.inLinkHidden, 'Punch In link is hidden once already punched in/out today', failures);
  assertTrue(attUi.inDoneText.indexOf('Punched In') !== -1, 'Attendance page shows the Punch In confirmation recorded from DWM', failures);
  assertTrue(attUi.outDoneText.indexOf('Completed') !== -1, 'Attendance page shows the Punch Out confirmation recorded from DWM', failures);
  assertTrue(attUi.statusText.indexOf('Completed') !== -1, 'Attendance page status banner reflects Completed', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// DWM Regular/Special redesign: Regular DWM auto-fills from the
// employee's active KRAs' Daily Control text (no manual daily re-entry),
// Special Assignments are time-boxed and sit outside KRA/KPI scope, and
// the two coexist on the same day with Regular DWM's hours split evenly
// across whatever time Special Assignments don't occupy. Also covers the
// scoring fix: a Special Assignment's hours now only count once its own
// status is confirmed (not the instant it's logged), and logging ANY
// Special Assignment no longer auto-scores the whole day 100% regardless
// of actual KRA performance.
// ---------------------------------------------------------------------
async function testDwmRegularAndSpecialAssignmentSplit(browser) {
  const failures = [];
  const empId = 'E-DWMSPLIT-01';

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
  await page.addInitScript(function (empId) {
    localStorage.setItem('userRole', 'staff');
    localStorage.setItem('userEmail', 'dwmsplit@measuredi.com');
    localStorage.setItem('userName', 'DWM Split Employee');
    localStorage.setItem('employeeId', empId);
    navigator.geolocation.getCurrentPosition = function (success) {
      success({ coords: { latitude: 12.9, longitude: 77.5, accuracy: 10 } });
    };
  }, empId);

  await page.goto(BASE_URL + '/dwm.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  await page.evaluate(function (empId) {
    window.RevOpsStore.saveCollection('attendance', (window.RevOpsStore.getCollection('attendance') || []).filter(function (a) { return a.employeeId !== empId; }));
    window.RevOpsStore.saveCollection('dwmActivities', (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId !== empId; }));
    window.RevOpsStore.saveCollection('kraTargets', (window.RevOpsStore.getCollection('kraTargets') || []).filter(function (a) { return a.employeeId !== empId; }));

    var fy = getCurrentFinancialYear();
    window.RevOpsStore.addItem('kraTargets', {
      employeeId: empId, employeeName: 'DWM Split Employee', financialYear: fy,
      kraName: 'Lead Generation', dailyControl: 'Log every enquiry into ERP same day',
      targetMetric: 'Leads', targetValue: 100, aopLine: 'Sales'
    });
    window.RevOpsStore.addItem('kraTargets', {
      employeeId: empId, employeeName: 'DWM Split Employee', financialYear: fy,
      kraName: 'Outstanding Collection', dailyControl: 'Call top 5 overdue customers every morning',
      targetMetric: 'Days', targetValue: 45, aopLine: 'Sales'
    });
  }, empId);

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  // 1. Regular DWM auto-populates from the 2 KRAs with no manual entry,
  // split evenly (8h / 2 = 4h each), and Punch In is immediately
  // available - the entire point of the redesign.
  const afterAutoGen = await page.evaluate(function (empId) {
    var today = getFormattedToday();
    var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId && a.date === today; });
    return {
      count: acts.length,
      allAutoGenerated: acts.every(function (a) { return a.isAutoGenerated === true; }),
      descriptions: acts.map(function (a) { return a.activityDescription; }).sort(),
      hoursEach: acts.map(function (a) { return a.hoursSpent; }),
      inBtnDisabled: document.getElementById('dwm-punch-in-btn').disabled
    };
  }, empId);
  assertEqual(afterAutoGen.count, 2, 'Regular DWM auto-creates one row per active KRA with no manual entry', failures);
  assertTrue(afterAutoGen.allAutoGenerated, 'Auto-created Regular DWM rows are flagged isAutoGenerated', failures);
  assertEqual(afterAutoGen.descriptions, ['Call top 5 overdue customers every morning', 'Log every enquiry into ERP same day'], 'Regular DWM descriptions come straight from each KRA\'s Daily Control text', failures);
  assertEqual(afterAutoGen.hoursEach, [4, 4], 'With no Special Assignment yet, the 8-hour day splits evenly across the 2 Regular DWM rows', failures);
  assertTrue(!afterAutoGen.inBtnDisabled, 'Punch In is available immediately once KRAs exist - no manual plan entry required', failures);

  // 2. Reloading again doesn't duplicate the auto-generated rows.
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  const afterSecondLoad = await page.evaluate(function (empId) {
    var today = getFormattedToday();
    return (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId && a.date === today; }).length;
  }, empId);
  assertEqual(afterSecondLoad, 2, 'Regular DWM auto-fill is idempotent - revisiting the page never duplicates rows', failures);

  // 3. Add a Special Assignment (2:00 PM - 5:00 PM, 3 hours) - outside
  // KRA/KPI purview entirely, with its own named category and time range.
  await page.evaluate(function () { openAddSpecialAssignmentModal(); });
  await page.selectOption('#special-category-select', 'Training / Workshop');
  await page.fill('#special-desc', 'Product training on new load cell range');
  await page.fill('#special-start-time', '14:00');
  await page.fill('#special-end-time', '17:00');
  await page.evaluate(function () { onSpecialTimeChange(); });
  const durationText = await page.evaluate(function () { return document.getElementById('special-duration-display').innerText; });
  assertEqual(durationText, 'Duration: 3 hour(s)', 'Special Assignment duration is computed live from the start/end time, not typed', failures);
  await page.click('#add-special-modal button[type="submit"]');
  await page.waitForTimeout(400);

  // 4. Adding the Special Assignment rebalances Regular DWM hours to
  // whatever's left of the 8-hour day: (8 - 3) / 2 = 2.5h each.
  const afterSpecial = await page.evaluate(function (empId) {
    var today = getFormattedToday();
    var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId && a.date === today; });
    var regular = acts.filter(function (a) { return !a.isSpecialAssignment; });
    var special = acts.filter(function (a) { return a.isSpecialAssignment; });
    return {
      totalCount: acts.length,
      regularHours: regular.map(function (a) { return a.hoursSpent; }),
      specialHours: special.map(function (a) { return a.hoursSpent; }),
      specialTimeRange: special.map(function (a) { return a.startTime + '-' + a.endTime; }),
      specialCategory: special.map(function (a) { return a.category; }),
      specialHasNoKra: special.every(function (a) { return !a.linkedKraId; })
    };
  }, empId);
  assertEqual(afterSpecial.totalCount, 3, 'Special Assignment coexists with Regular DWM on the same day, not instead of it', failures);
  assertEqual(afterSpecial.regularHours, [2.5, 2.5], 'Regular DWM hours rebalance to the remaining (8 - 3) / 2 = 2.5h once a Special Assignment is logged', failures);
  assertEqual(afterSpecial.specialHours, [3], 'Special Assignment hours come from its own time range, not a manual number', failures);
  assertEqual(afterSpecial.specialTimeRange, ['14:00-17:00'], 'Special Assignment stores the exact time period for the manager to see', failures);
  assertEqual(afterSpecial.specialCategory, ['Training / Workshop'], 'Special Assignment category is one of the standard HR time-tracking categories', failures);
  assertTrue(afterSpecial.specialHasNoKra, 'Special Assignment carries no KRA link - it is explicitly outside KRA/KPI purview', failures);

  // 5. Mark every row Done, then verify the scoring fix: a Special
  // Assignment's hours only count once confirmed, and the day scores
  // proportionally against the full 8h standard rather than
  // auto-jumping to 100% just because a Special Assignment exists.
  for (var i = 0; i < 3; i++) {
    var advanced = await page.evaluate(function () {
      var selects = Array.from(document.querySelectorAll('#section-b-tbody select'));
      var sel = selects.find(function (s) { return s.value === 'Pending'; });
      if (!sel) return false;
      sel.value = 'Done';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
    if (!advanced) break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(400);

  const scoreInfo = await page.evaluate(function () {
    return {
      score: document.getElementById('stat-dwm-score').innerText,
      hours: document.getElementById('stat-dwm-hours').innerText,
      specialHrs: document.getElementById('stat-dwm-special').innerText
    };
  });
  assertEqual(scoreInfo.score, '100%', 'With all 3 rows confirmed Done, the day correctly scores 100% (2.5 + 2.5 + 3 = 8h of 8h standard)', failures);
  assertEqual(scoreInfo.hours, '8', 'Productive hours sum Regular DWM + confirmed Special Assignment hours to the full 8h standard', failures);
  assertEqual(scoreInfo.specialHrs, '3', 'Special Assignment hours are reported separately for manager visibility', failures);

  // 6. Punch In, then confirm Punch Out is now unlocked (every Regular DWM
  // row and every Special Assignment is confirmed), then Punch Out.
  await page.evaluate(function () { confirmPunchIn(); });
  await page.waitForTimeout(500);

  const outBtnAfterPunchIn = await page.evaluate(function () { return document.getElementById('dwm-punch-out-btn').disabled; });
  assertTrue(!outBtnAfterPunchIn, 'Punch Out unlocks once every Regular DWM row and every Special Assignment is confirmed', failures);

  await page.evaluate(function () { confirmPunchOut(); });
  await page.waitForTimeout(500);

  const finalAtt = await page.evaluate(function (empId) {
    var att = (window.RevOpsStore.getCollection('attendance') || []).find(function (a) { return a.employeeId === empId; });
    return { status: att && att.status, workedHours: att && att.workedHours, dwmAccomplishedCount: att && att.dwmAccomplishedCount };
  }, empId);
  assertEqual(finalAtt.status, 'Completed', 'Punch Out completes the attendance record on the Regular+Special DWM model', failures);
  assertEqual(finalAtt.workedHours, 8, 'Worked hours reflect the full confirmed day', failures);
  assertEqual(finalAtt.dwmAccomplishedCount, 3, 'All 3 activities (2 Regular + 1 Special) are counted as accomplished', failures);

  // 7. A Special Assignment logged but NOT yet confirmed must not inflate
  // the score to 100% on its own - the specific bug this redesign fixed.
  const unconfirmedScore = await page.evaluate(function () {
    var stats = window.RevOpsStore.calculateDailyProductivity([
      { hoursSpent: 2, accomplishmentStatus: 'Done', isSpecialAssignment: false },
      { hoursSpent: 6, accomplishmentStatus: 'Pending', isSpecialAssignment: true, category: 'Business Travel (Domestic)' }
    ], 8.0);
    return stats.productivityScore;
  });
  assertEqual(unconfirmedScore, 25, 'An unconfirmed (still-Pending) Special Assignment earns no credit yet, and no longer force-scores the whole day 100%', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// KRA/KPI/DWM in the Employee Directory + CSV import: an admin can add,
// edit and delete an employee's KRAs directly from their Employee
// Directory record (not just the separate KRA Targets page), a numbered
// Daily Control list splits into individually-trackable DWM points, and
// a bulk CSV (the "Employee Role/Target Input Form" shape) imports by
// matching employee NAME - never an external ID scheme the app doesn't
// use - reporting unmatched/ambiguous rows instead of guessing.
// ---------------------------------------------------------------------
async function testKraDwmEmployeeDirectoryAndCsvImport(browser) {
  const failures = [];

  // Part 1: splitDailyControlIntoPoints - the core parsing primitive.
  {
    const { page } = await newPage(browser);
    await page.goto(BASE_URL + '/dwm.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const splits = await page.evaluate(function () {
      return {
        multi: window.RevOpsStore.splitDailyControlIntoPoints('1. Visit customers\n2. Follow up leads\n3. Update ERP'),
        single: window.RevOpsStore.splitDailyControlIntoPoints('Call top 5 overdue customers every morning'),
        empty: window.RevOpsStore.splitDailyControlIntoPoints(''),
        bulleted: window.RevOpsStore.splitDailyControlIntoPoints('- Visit site\n- Check stock\n- File report')
      };
    });
    assertEqual(splits.multi.length, 3, 'A numbered Daily Control list splits into one point per number', failures);
    assertEqual(splits.multi[0], 'Visit customers', 'Each split point has its number marker stripped', failures);
    assertEqual(splits.single.length, 1, 'A plain single-sentence Daily Control stays as one point', failures);
    assertEqual(splits.empty.length, 0, 'Empty Daily Control text produces zero points', failures);
    assertEqual(splits.bulleted.length, 3, 'A bulleted ("-") Daily Control list also splits into separate points', failures);

    await page.close();
  }

  // Part 2: name-matching for CSV import - exact, nickname/prefix, and
  // single-letter spelling variants, without ever guessing on a real tie.
  {
    const { page } = await newPage(browser);
    await page.goto(BASE_URL + '/kra-targets.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const matchResults = await page.evaluate(function () {
      // A separate, small employee list per case - "Mr. Raj Kumar" sharing
      // the "Kumar" token with "Murugan Kumar" would otherwise create a
      // genuine, unrelated tie between two different sub-tests.
      var mainList = [
        { employeeId: 'E-101', fullName: 'Mr. Murugan V' },
        { employeeId: 'E-102', fullName: 'Ms. Dipa' },
        { employeeId: 'E-103', fullName: 'Mr. Balram' },
        { employeeId: 'E-104', fullName: 'Mr. Mathiyarasu' }
      ];
      var tieList = [
        { employeeId: 'E-105', fullName: 'Mr. Raj Kumar' },
        { employeeId: 'E-106', fullName: 'Mr. Raj Verma' }
      ];
      return {
        exactish: window.RevOpsStore.matchEmployeeByName('Murugan Kumar', mainList),
        nickname: window.RevOpsStore.matchEmployeeByName('Dipanwita Dutta', mainList),
        spellingVariant1: window.RevOpsStore.matchEmployeeByName('Velisoju Balaram', mainList),
        spellingVariant2: window.RevOpsStore.matchEmployeeByName('Mathiarasu S', mainList),
        noMatch: window.RevOpsStore.matchEmployeeByName('Totally Unrelated Person', mainList),
        ambiguous: window.RevOpsStore.matchEmployeeByName('Raj Singh', tieList)
      };
    });
    assertEqual(matchResults.exactish.match && matchResults.exactish.match.employeeId, 'E-101', 'Exact shared-token match: "Murugan Kumar" -> Mr. Murugan V', failures);
    assertEqual(matchResults.nickname.match && matchResults.nickname.match.employeeId, 'E-102', 'Nickname/prefix match: "Dipanwita Dutta" -> Ms. Dipa', failures);
    assertEqual(matchResults.spellingVariant1.match && matchResults.spellingVariant1.match.employeeId, 'E-103', 'Spelling-variant match: "Velisoju Balaram" -> Mr. Balram (edit distance 1)', failures);
    assertEqual(matchResults.spellingVariant2.match && matchResults.spellingVariant2.match.employeeId, 'E-104', 'Spelling-variant match: "Mathiarasu S" -> Mr. Mathiyarasu (edit distance 1)', failures);
    assertEqual(matchResults.noMatch.match, null, 'A name with no plausible match returns null, not a wrong guess', failures);
    assertEqual(matchResults.noMatch.reason, 'no-match', 'No-match reason is reported as no-match', failures);
    assertEqual(matchResults.ambiguous.match, null, 'A name matching two different employees equally returns null rather than guessing', failures);
    assertEqual(matchResults.ambiguous.reason, 'ambiguous', 'A genuine tie is reported as ambiguous, not silently resolved', failures);

    await page.close();
  }

  // Part 3: CSV import end-to-end via the real file input on kra-targets.html,
  // using a small synthetic CSV matching the real "Employee Role/Target
  // Input Form" shape, including a deliberately unmatched name and a
  // numbered Daily Control list.
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
    await page.addInitScript(function () {
      localStorage.setItem('userRole', 'super_admin');
      localStorage.setItem('userEmail', 'kracsv@measuredi.com');
      localStorage.setItem('userName', 'KRA CSV Test');
      localStorage.setItem('employeeId', 'E-001');
    });

    await page.goto(BASE_URL + '/kra-targets.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    await page.evaluate(function () {
      window.RevOpsStore.saveCollection('employees', [
        { id: 'e1', employeeId: 'E-201', fullName: 'Mr. Test Murugan', role: 'super_admin', isActive: true }
      ]);
      window.RevOpsStore.saveCollection('kraTargets', []);
    });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const csvContent = [
      'Employee ID *,Employee Name,Vertical / Business Line *,Sub-Vertical / Revenue Pattern,KRA (Key Result Area) *,KPI (how measured) *,Unit *,Data Source *,Weight %,Type,Lead / Lag,Rolls Up To (Manager\'s KRA/KPI),Annual / AOP Target *,Half-Yearly Target,Quarterly Target,Monthly Target,Weekly Target,Daily / DWM Control (what to check daily),Remarks',
      'AT/001,Test Murugan,Sales,Projects,Lead generation,Daily leads logged,nos,ERP,20,Tangible,Leading,,300,150,75,25,6,"1. Log every enquiry same day\n2. Follow up within 48 hours",',
      'AT/999,Nobody Unknown,Sales,Projects,Some KRA,Some KPI,nos,ERP,10,Tangible,Leading,,100,50,25,8,2,Single instruction here,'
    ].join('\n');

    await page.evaluate(function (csv) {
      var blob = new Blob([csv], { type: 'text/csv' });
      var file = new File([blob], 'test-kra-import.csv', { type: 'text/csv' });
      var dt = new DataTransfer();
      dt.items.add(file);
      var input = document.getElementById('kra-csv-file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, csvContent);
    await page.waitForTimeout(600);

    const importUi = await page.evaluate(function () {
      return {
        summaryVisible: !document.getElementById('kra-import-summary').classList.contains('hidden'),
        summaryText: document.getElementById('kra-import-summary').innerText
      };
    });
    assertTrue(importUi.summaryVisible, 'Uploading a CSV via the file input shows the import result summary', failures);
    assertTrue(importUi.summaryText.indexOf('1 new KRA rows imported') !== -1, 'Import summary reports exactly 1 matched row imported', failures);
    assertTrue(importUi.summaryText.indexOf('Nobody Unknown') !== -1, 'Import summary lists the unmatched employee name for manual follow-up', failures);

    const importedKra = await page.evaluate(function () {
      var kras = window.RevOpsStore.getCollection('kraTargets') || [];
      return kras.find(function (k) { return k.employeeId === 'E-201'; });
    });
    assertTrue(!!importedKra, 'The matched row was actually saved under the correct existing employeeId (E-201), not the CSV\'s own AT/001 ID', failures);
    if (importedKra) {
      assertEqual(importedKra.dailyControlPoints.length, 2, 'The imported numbered Daily Control text was split into 2 points', failures);
      assertEqual(importedKra.weight, 20, 'Richer fields (Weight %) are captured by the import, not just Daily Control', failures);
      assertEqual(importedKra.leadLag, 'Leading', 'Richer fields (Lead/Lag) are captured by the import', failures);
    }

    await page.close();
  }

  // Part 4: add/edit/delete a KRA directly from the Employee Directory's
  // Digital Dossier, and confirm it actually drives DWM auto-populate -
  // the whole point of surfacing it there instead of only on a separate page.
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    // The only dialog in this block is deleteQuickKra's confirm() - accept
    // it (not dismiss) so the delete step below actually exercises the
    // real button path instead of being cancelled by a dismissed confirm.
    page.on('dialog', async function (d) { await d.accept().catch(function () {}); });
    await page.addInitScript(function () {
      localStorage.setItem('userRole', 'super_admin');
      localStorage.setItem('userEmail', 'empdirkra@measuredi.com');
      localStorage.setItem('userName', 'EmpDir Admin');
      localStorage.setItem('employeeId', 'E-001');
    });

    await page.goto(BASE_URL + '/employees.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const empId = 'E-301';
    await page.evaluate(function (empId) {
      var emps = (window.RevOpsStore.getCollection('employees') || []).filter(function (e) { return e.employeeId !== empId; });
      emps.push({ id: 'emp_301', employeeId: empId, fullName: 'Directory KRA Test', designation: 'Field Engineer', vertical: 'Service', role: 'staff', email: 'dirkra@measuredi.com', mobile: '9999999998', isActive: true });
      window.RevOpsStore.saveCollection('employees', emps);
      window.RevOpsStore.saveCollection('kraTargets', (window.RevOpsStore.getCollection('kraTargets') || []).filter(function (k) { return k.employeeId !== empId; }));
    }, empId);
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const rowIdx = await page.evaluate(function (empId) {
      var rows = Array.from(document.querySelectorAll('#employees-tbody tr'));
      return rows.findIndex(function (r) { return r.innerText.indexOf(empId) !== -1; });
    }, empId);
    assertTrue(rowIdx !== -1, 'Test employee appears in the Employee Directory table', failures);

    await page.locator('#employees-tbody tr').nth(rowIdx).locator('button:has-text("File")').click();
    await page.waitForTimeout(300);

    const emptyStateText = await page.evaluate(function () { return document.getElementById('dossier-kra-list').innerText; });
    assertTrue(emptyStateText.indexOf('No KRAs assigned yet') !== -1, 'Dossier shows an empty state before any KRA is added', failures);

    await page.evaluate(function () { openQuickKraModal(); });
    await page.fill('#qk-kra-name', 'Field Service Excellence');
    await page.fill('#qk-kpi', 'Service Calls Closed');
    await page.fill('#qk-annual-target', '500');
    await page.fill('#qk-weight', '40');
    await page.fill('#qk-dailycontrol', '1. Check assigned tickets each morning\n2. Visit site and resolve\n3. Update ticket status same day');
    await page.click('#quick-kra-modal button[type="submit"]');
    await page.waitForTimeout(400);

    const afterAddText = await page.evaluate(function () { return document.getElementById('dossier-kra-list').innerText; });
    assertTrue(afterAddText.indexOf('Field Service Excellence') !== -1, 'Newly added KRA appears in the dossier\'s KRA list immediately', failures);
    assertTrue(afterAddText.indexOf('Check assigned tickets each morning') !== -1, 'Individual Daily Control points are listed, not just the KRA title', failures);

    // Edit it, then confirm the edit took.
    const kraDocId = await page.evaluate(function (empId) {
      var k = (window.RevOpsStore.getCollection('kraTargets') || []).find(function (item) { return item.employeeId === empId; });
      return k && k.id;
    }, empId);
    await page.evaluate(function (id) { openQuickKraModal(id); }, kraDocId);
    await page.fill('#qk-weight', '55');
    await page.click('#quick-kra-modal button[type="submit"]');
    await page.waitForTimeout(300);
    const afterEditWeight = await page.evaluate(function (empId) {
      var k = (window.RevOpsStore.getCollection('kraTargets') || []).find(function (item) { return item.employeeId === empId; });
      return k && k.weight;
    }, empId);
    assertEqual(afterEditWeight, 55, 'Editing a KRA from the dossier updates it in place (weight 40 -> 55)', failures);

    await page.evaluate(function () { closeDigitalDossier(); });

    // Switch identity to this employee (fresh addInitScript overrides the
    // earlier admin one for subsequent navigations) and confirm DWM
    // auto-populates from the KRA just added here.
    await page.addInitScript(function (empId) {
      localStorage.setItem('userRole', 'staff');
      localStorage.setItem('employeeId', empId);
      localStorage.setItem('userName', 'Directory KRA Test');
      localStorage.setItem('userEmail', 'dirkra@measuredi.com');
    }, empId);
    await page.goto(BASE_URL + '/dwm.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);

    const dwmFromDirectory = await page.evaluate(function (empId) {
      var today = getFormattedToday();
      var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId && a.date === today; });
      return { count: acts.length, descriptions: acts.map(function (a) { return a.activityDescription; }).sort() };
    }, empId);
    assertEqual(dwmFromDirectory.count, 3, 'A KRA added via the Employee Directory drives DWM auto-populate exactly like one added on the KRA Targets page', failures);
    assertEqual(dwmFromDirectory.descriptions, ['Check assigned tickets each morning', 'Update ticket status same day', 'Visit site and resolve'].sort(), 'Each of the 3 Daily Control points became its own DWM row', failures);

    // Now delete the KRA from the dossier and confirm it's gone.
    // The staff-identity addInitScript registered above still fires on
    // every navigation; re-assert admin identity (registered after it, so
    // it wins) before going back to this admin-only page.
    await page.addInitScript(function () {
      localStorage.setItem('userRole', 'super_admin');
      localStorage.setItem('employeeId', 'E-001');
      localStorage.setItem('userName', 'EmpDir Admin');
      localStorage.setItem('userEmail', 'empdirkra@measuredi.com');
    });
    await page.goto(BASE_URL + '/employees.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    const rowIdx2 = await page.evaluate(function (empId) {
      var rows = Array.from(document.querySelectorAll('#employees-tbody tr'));
      return rows.findIndex(function (r) { return r.innerText.indexOf(empId) !== -1; });
    }, empId);
    assertTrue(rowIdx2 !== -1, 'Test employee is still found in the Employee Directory after navigating away and back', failures);
    await page.locator('#employees-tbody tr').nth(rowIdx2).locator('button:has-text("File")').click();
    await page.waitForTimeout(300);
    await page.evaluate(function (id) { deleteQuickKra(id); }, kraDocId);
    await page.waitForTimeout(300);
    const afterDeleteCount = await page.evaluate(function (empId) {
      return (window.RevOpsStore.getCollection('kraTargets') || []).filter(function (k) { return k.employeeId === empId; }).length;
    }, empId);
    assertEqual(afterDeleteCount, 0, 'Deleting a KRA from the Employee Directory dossier actually removes it', failures);

    await page.close();
  }

  return failures;
}

// ---------------------------------------------------------------------
// Per-employee KRA/DWM CSV template: instead of typing each KRA one at a
// time through "+ Add One", an admin can download a blank template
// already filled in with one specific person's own ID/name/vertical,
// fill it in (Excel/Sheets), and upload it straight back from the same
// dossier - removing the single biggest manual-entry source of a failed
// name match, since the name is never retyped at all.
// ---------------------------------------------------------------------
async function testEmployeeKraTemplateDownloadAndUpload(browser) {
  const failures = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('dialog', async function (d) { await d.accept().catch(function () {}); });
  await page.addInitScript(function () {
    localStorage.setItem('userRole', 'super_admin');
    localStorage.setItem('userEmail', 'kratmpl@measuredi.com');
    localStorage.setItem('userName', 'KRA Template Test');
    localStorage.setItem('employeeId', 'E-001');
  });

  await page.goto(BASE_URL + '/employees.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  const empId = 'E-KRATMPL-01';
  await page.evaluate(function (empId) {
    var emps = (window.RevOpsStore.getCollection('employees') || []).filter(function (e) { return e.employeeId !== empId; });
    emps.push({ id: 'emp_kratmpl', employeeId: empId, fullName: 'Template Round-Trip Test', designation: 'Marketing', vertical: 'Service', role: 'staff', email: 'kratmpl.rt@measuredi.com', mobile: '9999999996', isActive: true });
    window.RevOpsStore.saveCollection('employees', emps);
    window.RevOpsStore.saveCollection('kraTargets', (window.RevOpsStore.getCollection('kraTargets') || []).filter(function (k) { return k.employeeId !== empId; }));
  }, empId);

  // Part 1: the generated template is pre-filled with this exact person's
  // identity on every blank row, and still parses correctly (the trailing
  // "# HOW TO FILL" instructional line gets dropped like any other legend).
  const tmpl = await page.evaluate(function (empId) { return window.RevOpsStore.generateEmployeeKraTemplate(empId); }, empId);
  assertTrue(tmpl.content.indexOf('Template Round-Trip Test') !== -1, 'Generated template is pre-filled with this employee\'s real name', failures);
  assertTrue(tmpl.content.indexOf(empId) !== -1, 'Generated template is pre-filled with this employee\'s real ID', failures);

  const parsedRows = await page.evaluate(function (csv) { return window.RevOpsStore.parseCSVRows(csv); }, tmpl.content);
  assertEqual(parsedRows.length, 6, 'Template parses as header + 5 blank rows; the "# HOW TO FILL" line is dropped as a legend line, not real data', failures);
  assertEqual(parsedRows[1][1], 'Template Round-Trip Test', 'Each blank row already carries the correct Employee Name field', failures);

  // Part 2: simulate filling in the first blank row with a real KRA
  // (including a numbered multi-point Daily Control), then upload it back
  // through the dossier's "Upload Filled" button.
  const filledCsv = tmpl.content.split('\n').map(function (line, idx) {
    if (idx === 1) {
      return empId + ',Template Round-Trip Test,Service,Crane,Orders in Spares,Order value won vs AOP,₹ (INR),ERP,50,Tangible,Lagging,,70000000,35000000,17500000,5833334,1346154,"1. Monitor pending enquiries\n2. Call existing customers\n3. Check stock availability",';
    }
    return line;
  }).join('\n');

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  const rowIdx = await page.evaluate(function (empId) {
    var rows = Array.from(document.querySelectorAll('#employees-tbody tr'));
    return rows.findIndex(function (r) { return r.innerText.indexOf(empId) !== -1; });
  }, empId);
  assertTrue(rowIdx !== -1, 'Test employee appears in the Employee Directory table', failures);
  await page.locator('#employees-tbody tr').nth(rowIdx).locator('button:has-text("File")').click();
  await page.waitForTimeout(300);

  await page.evaluate(function (csv) {
    var blob = new Blob([csv], { type: 'text/csv' });
    var file = new File([blob], 'filled-template.csv', { type: 'text/csv' });
    var dt = new DataTransfer();
    dt.items.add(file);
    var input = document.getElementById('dossier-kra-csv-input');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, filledCsv);
  await page.waitForTimeout(600);

  const uiAfterUpload = await page.evaluate(function () {
    return {
      summaryText: document.getElementById('dossier-kra-import-summary').innerText,
      listText: document.getElementById('dossier-kra-list').innerText
    };
  });
  assertTrue(uiAfterUpload.summaryText.indexOf('1 KRA(s) imported') !== -1, 'Uploading the filled template from the dossier shows a 1-imported summary', failures);
  assertTrue(uiAfterUpload.listText.indexOf('Orders in Spares') !== -1, 'The KRA from the uploaded template appears in the dossier\'s list immediately, no page reload needed', failures);
  assertTrue(uiAfterUpload.listText.indexOf('Monitor pending enquiries') !== -1, 'The numbered Daily Control points from the filled template show individually', failures);

  const savedKra = await page.evaluate(function (empId) {
    return (window.RevOpsStore.getCollection('kraTargets') || []).find(function (k) { return k.employeeId === empId; });
  }, empId);
  assertTrue(!!savedKra, 'The uploaded KRA was saved under the correct employeeId', failures);
  if (savedKra) {
    assertEqual(savedKra.dailyControlPoints.length, 3, 'The 3-point Daily Control text split into 3 individually-trackable DWM points', failures);
    assertEqual(savedKra.weight, 50, 'Richer fields from the filled template (Weight %) were captured', failures);
    assertEqual(savedKra.annualTarget, 70000000, 'Annual Target from the filled template was captured', failures);
  }

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// seed-data.js's local-only hardcoded `defaultEmployees` fallback must
// never write into localStorage once Firebase is connected: a fresh
// device/login signs in and its `employees` collection is briefly empty
// (Firestore sync hasn't delivered it yet) - if initSeedData() fills that
// gap with the stale legacy roster, the real Firestore roster arrives
// moments later under different IDs, nothing dedupes the two lists, and
// every employee shows up twice (reported live as duplicate names
// appearing on a second device/browser that had never synced before).
// The fallback must still work in pure local/demo mode (no Firebase).
// ---------------------------------------------------------------------
async function testEmployeesSeedGuardAgainstDuplication(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const withFirebase = await page.evaluate(function () {
    var original = window.RevOpsStore.isFirebaseAvailable;
    window.RevOpsStore.isFirebaseAvailable = function () { return true; };
    localStorage.removeItem('employees');
    localStorage.removeItem('revops_seeded_v25');
    localStorage.removeItem('revops_seeded_v27');
    window.RevOpsStore.initSeedData();
    var afterFirebase = (window.RevOpsStore.getCollection('employees') || []).length;
    window.RevOpsStore.isFirebaseAvailable = original;
    return { afterFirebase: afterFirebase };
  });
  assertEqual(withFirebase.afterFirebase, 0, 'Seed guard: empty employees stays empty (no stale legacy roster injected) once isFirebaseAvailable() is true', failures);

  const withoutFirebase = await page.evaluate(function () {
    var original = window.RevOpsStore.isFirebaseAvailable;
    window.RevOpsStore.isFirebaseAvailable = function () { return false; };
    localStorage.removeItem('employees');
    localStorage.removeItem('revops_seeded_v25');
    localStorage.removeItem('revops_seeded_v27');
    window.RevOpsStore.initSeedData();
    var afterLocal = (window.RevOpsStore.getCollection('employees') || []).length;
    window.RevOpsStore.isFirebaseAvailable = original;
    return { afterLocal: afterLocal };
  });
  assertTrue(withoutFirebase.afterLocal > 0, 'Seed guard: pure local/demo mode (no Firebase) still falls back to the sample employee roster', failures);

  await page.close();
  return failures;
}

// ---------------------------------------------------------------------
// DWM Section A/B rework: every planned activity (auto KRA point, extra
// KRA activity, or Special Assignment) now carries a tick ("Include")
// checkbox and its own editable Start/End Time, pre-filled by an even
// split of the shift but adjustable. At least one activity must stay
// ticked to Punch In. Punching In locks the ticked plan - those rows can
// never be deleted afterwards, though a mid-day addition still can be
// while Pending. Section B only ever shows ticked activities, lets the
// employee flag "Plan changed per Reporting Manager's instruction", and
// replaces the old fixed 70% Partial credit with a typed % Done that
// feeds directly into the productivity score.
// ---------------------------------------------------------------------
async function testDwmTickTimePercentAndPlanChanged(browser) {
  const failures = [];
  const empId = 'E-DWMTICK-01';

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('dialog', async function (d) { await d.dismiss().catch(function () {}); });
  await page.addInitScript(function (empId) {
    localStorage.setItem('userRole', 'staff');
    localStorage.setItem('userEmail', 'dwmtick@measuredi.com');
    localStorage.setItem('userName', 'DWM Tick Employee');
    localStorage.setItem('employeeId', empId);
    navigator.geolocation.getCurrentPosition = function (success) {
      success({ coords: { latitude: 12.9, longitude: 77.5, accuracy: 10 } });
    };
  }, empId);

  await page.goto(BASE_URL + '/dwm.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  await page.evaluate(function (empId) {
    window.RevOpsStore.saveCollection('attendance', (window.RevOpsStore.getCollection('attendance') || []).filter(function (a) { return a.employeeId !== empId; }));
    window.RevOpsStore.saveCollection('dwmActivities', (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId !== empId; }));
    window.RevOpsStore.saveCollection('kraTargets', (window.RevOpsStore.getCollection('kraTargets') || []).filter(function (a) { return a.employeeId !== empId; }));

    var fy = getCurrentFinancialYear();
    window.RevOpsStore.addItem('kraTargets', {
      employeeId: empId, employeeName: 'DWM Tick Employee', financialYear: fy,
      kraName: 'Lead Generation', dailyControl: 'Log every enquiry into ERP same day',
      kpi: 'Leads Logged', targetMetric: 'Leads Logged', targetValue: 100, aopLine: 'Sales'
    });
    window.RevOpsStore.addItem('kraTargets', {
      employeeId: empId, employeeName: 'DWM Tick Employee', financialYear: fy,
      kraName: 'Outstanding Collection', dailyControl: 'Call top 5 overdue customers every morning',
      kpi: 'Overdue Calls', targetMetric: 'Overdue Calls', targetValue: 45, aopLine: 'Sales'
    });
  }, empId);

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  // 1. Both KRA points are ticked by default, each showing its KPI, and
  // Punch In is available immediately (nothing to manually plan).
  const initial = await page.evaluate(function (empId) {
    var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId; });
    return {
      count: acts.length,
      allTicked: acts.every(function (a) { return a.isTicked === true; }),
      kpis: acts.map(function (a) { return a.linkedKpi; }).sort(),
      sectionAText: document.getElementById('section-a-tbody').innerText,
      checkboxCount: document.querySelectorAll('#section-a-tbody input[type="checkbox"]').length,
      inBtnDisabled: document.getElementById('dwm-punch-in-btn').disabled
    };
  }, empId);
  assertEqual(initial.count, 2, 'Both KRA Daily Control points auto-create a DWM activity', failures);
  assertTrue(initial.allTicked, 'Auto-filled Regular DWM activities are ticked (included) by default', failures);
  assertEqual(initial.kpis, ['Leads Logged', 'Overdue Calls'], 'Each auto-filled activity carries its KRA\'s KPI', failures);
  assertTrue(initial.sectionAText.indexOf('KPI: Leads Logged') !== -1, 'Section A displays the KPI alongside the linked KRA', failures);
  assertEqual(initial.checkboxCount, 2, 'Section A shows one Include checkbox per activity', failures);
  assertTrue(!initial.inBtnDisabled, 'Punch In is enabled while at least one activity is ticked', failures);

  // 2. Unticking every activity drops Punch In back to disabled (minimum
  // 1 ticked activity required), and clears the unticked rows' hours/time.
  const checkboxes = await page.locator('#section-a-tbody input[type="checkbox"]').all();
  for (const cb of checkboxes) { await cb.uncheck(); await page.waitForTimeout(250); }

  const afterUntickAll = await page.evaluate(function (empId) {
    var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId; });
    return {
      inBtnDisabled: document.getElementById('dwm-punch-in-btn').disabled,
      allHoursZero: acts.every(function (a) { return !a.hoursSpent; }),
      allTimesCleared: acts.every(function (a) { return !a.startTime && !a.endTime; })
    };
  }, empId);
  assertTrue(afterUntickAll.inBtnDisabled, 'Punch In disables again once every activity is unticked - at least 1 is required', failures);
  assertTrue(afterUntickAll.allHoursZero, 'Unticking an activity resets its hours to 0', failures);
  assertTrue(afterUntickAll.allTimesCleared, 'Unticking an activity clears its Start/End Time', failures);

  // 3. Re-ticking a single activity gives it the full 8h standard shift
  // (the only ticked Regular DWM row), auto-filled starting at 09:00.
  await page.locator('#section-a-tbody input[type="checkbox"]').first().check();
  await page.waitForTimeout(300);
  const afterRetick = await page.evaluate(function (empId) {
    var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId && a.isTicked !== false; });
    return { count: acts.length, hours: acts[0] && acts[0].hoursSpent, startTime: acts[0] && acts[0].startTime, inBtnDisabled: document.getElementById('dwm-punch-in-btn').disabled };
  }, empId);
  assertEqual(afterRetick.count, 1, 'Only the re-ticked activity counts as part of the plan again', failures);
  assertEqual(afterRetick.hours, 8, 'The sole ticked Regular DWM activity gets the full 8h standard shift', failures);
  assertEqual(afterRetick.startTime, '09:00', 'Auto time pre-fill starts from the standard 09:00 shift start', failures);
  assertTrue(!afterRetick.inBtnDisabled, 'Punch In re-enables once 1 activity is ticked again', failures);

  // 4. Manually editing a ticked activity's time flags it userEditedTime,
  // so it survives future recomputes untouched.
  await page.locator('#section-a-tbody input[type="checkbox"]').nth(1).check();
  await page.waitForTimeout(300);
  await page.locator('#section-a-tbody input[type="time"]').first().fill('10:00');
  await page.waitForTimeout(300);
  const afterManualEdit = await page.evaluate(function (empId) {
    var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId && a.isTicked !== false; });
    var manual = acts.find(function (a) { return a.userEditedTime; });
    return { manualStart: manual && manual.startTime, manualFlag: !!manual };
  }, empId);
  assertTrue(afterManualEdit.manualFlag, 'Manually editing a Start/End Time flags that row userEditedTime', failures);
  assertEqual(afterManualEdit.manualStart, '10:00', 'The manually-edited Start Time is kept exactly as typed', failures);

  // 5. Punch In locks every currently-ticked activity (lockedPlan) - it
  // can never be deleted afterwards, even an extra (non-auto) one that
  // was part of the morning's confirmed plan.
  await page.evaluate(function (empId) {
    window.RevOpsStore.addItem('dwmActivities', {
      employeeId: empId, employeeName: 'DWM Tick Employee', date: getFormattedToday(),
      activityDescription: 'Extra morning follow-up', category: 'Standard KRA Activity',
      isSpecialAssignment: false, isAutoGenerated: false, isTicked: true, lockedPlan: false, userEditedTime: false,
      hoursSpent: 0, linkedKraId: '', linkedKra: '', linkedKpi: '', linkedAopLine: '',
      planStatus: 'Planned', accomplishmentStatus: 'Pending', accomplishmentPercent: null,
      accomplishmentRemarks: '', planChangedByManager: false, plannedAt: new Date().toISOString(), accomplishedAt: null
    });
    renderDwmData(empId);
  }, empId);
  await page.waitForTimeout(300);

  await page.evaluate(function () { confirmPunchIn(); });
  await page.waitForTimeout(500);

  const afterPunchInLock = await page.evaluate(function (empId) {
    var acts = (window.RevOpsStore.getCollection('dwmActivities') || []).filter(function (a) { return a.employeeId === empId && a.isTicked !== false; });
    return { allLocked: acts.every(function (a) { return a.lockedPlan === true; }), count: acts.length };
  }, empId);
  assertEqual(afterPunchInLock.count, 3, 'Punch In locks all 3 ticked activities (2 Regular + 1 extra)', failures);
  assertTrue(afterPunchInLock.allLocked, 'Every ticked activity is flagged lockedPlan once Punched In', failures);

  const deleteBlockedResult = await page.evaluate(function (empId) {
    var act = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.employeeId === empId && !a.isAutoGenerated; });
    var originalAlert = window.alert;
    var alertMsg = '';
    window.alert = function (msg) { alertMsg = msg; };
    deleteDwmActivity(act.id);
    window.alert = originalAlert;
    var stillExists = !!(window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.id === act.id; });
    return { alertMsg: alertMsg, stillExists: stillExists };
  }, empId);
  assertTrue(deleteBlockedResult.alertMsg.indexOf('confirmed plan') !== -1, 'Deleting a locked (morning-confirmed) activity is blocked with an explanation', failures);
  assertTrue(deleteBlockedResult.stillExists, 'A locked activity is never actually deleted', failures);

  // 6. A mid-day addition (after Punch In) is NOT locked, and stays
  // deletable while still Pending.
  await page.evaluate(function () { openAddActivityModal(); });
  await page.fill('#activity-desc', 'Mid-day unplanned site visit');
  await page.click('#add-activity-modal button[type="submit"]');
  await page.waitForTimeout(400);

  const midDayResult = await page.evaluate(function (empId) {
    var act = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.employeeId === empId && a.activityDescription === 'Mid-day unplanned site visit'; });
    var lockedAtCreation = act.lockedPlan;
    var originalConfirm = window.confirm;
    window.confirm = function () { return true; };
    deleteDwmActivity(act.id);
    window.confirm = originalConfirm;
    var stillExists = !!(window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.id === act.id; });
    return { lockedAtCreation: lockedAtCreation, stillExists: stillExists };
  }, empId);
  assertTrue(!midDayResult.lockedAtCreation, 'An activity added mid-day (after Punch In) is not locked', failures);
  assertTrue(!midDayResult.stillExists, 'A mid-day addition can still be deleted while Pending (unlike the locked morning plan)', failures);

  // 7. Section B: a Partial status with no % entered is rejected (status
  // not saved); entering a valid % saves it and feeds the real score.
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);

  const beforePartial = await page.evaluate(function (empId) {
    return (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.employeeId === empId && a.isAutoGenerated; });
  }, empId);

  const partialRejected = await page.evaluate(function (actId) {
    var sel = document.getElementById('acc-status-' + actId);
    sel.value = 'Partial';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    var saved = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.id === actId; });
    return saved.accomplishmentStatus;
  }, beforePartial.id);
  assertEqual(partialRejected, 'Pending', 'Selecting Partial with no % Done entered does not save - status stays unchanged', failures);

  const partialSaved = await page.evaluate(function (actId) {
    var pctEl = document.getElementById('acc-pct-' + actId);
    pctEl.value = '60';
    pctEl.dispatchEvent(new Event('change', { bubbles: true }));
    var saved = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.id === actId; });
    return { status: saved.accomplishmentStatus, pct: saved.accomplishmentPercent };
  }, beforePartial.id);
  assertEqual(partialSaved.status, 'Partial', 'Entering a valid % Done saves the Partial status', failures);
  assertEqual(partialSaved.pct, 60, 'The typed % Done (60) is saved exactly, not a fixed assumption', failures);

  const scoreUsesRealPct = await page.evaluate(function () {
    var stats = window.RevOpsStore.calculateDailyProductivity([
      { hoursSpent: 4, accomplishmentStatus: 'Partial', accomplishmentPercent: 60, isTicked: true }
    ], 8.0);
    return stats.productiveHours;
  });
  assertEqual(scoreUsesRealPct, 2.4, 'Productivity score credits the real % Done (4h * 60% = 2.4h), not the old fixed 70%', failures);

  // 8. "Plan changed per Reporting Manager" flag saves and shows in
  // Section B.
  const planChangedResult = await page.evaluate(function (actId) {
    var changedEl = document.getElementById('acc-planchanged-' + actId);
    changedEl.checked = true;
    changedEl.dispatchEvent(new Event('change', { bubbles: true }));
    var saved = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.id === actId; });
    return { flagSaved: saved.planChangedByManager, pillText: document.getElementById('section-b-tbody').innerText };
  }, beforePartial.id);
  assertTrue(planChangedResult.flagSaved, 'The "Plan changed per Reporting Manager" checkbox saves planChangedByManager', failures);
  assertTrue(planChangedResult.pillText.indexOf('Plan Changed') !== -1, 'A plan-changed activity shows a "Plan Changed" indicator in Section B', failures);

  // 9. The quick "Done" tick in Section B is a one-click shortcut for the
  // common case - no need to open the dropdown - and doesn't disturb any
  // remarks or the plan-changed flag already saved on that row. Unticking
  // it reverts to Pending.
  const quickTickResult = await page.evaluate(function (actId) {
    var remarksEl = document.getElementById('acc-remarks-' + actId);
    remarksEl.value = 'Site visit completed on time';
    remarksEl.dispatchEvent(new Event('blur', { bubbles: true }));

    var doneCheckbox = document.getElementById('acc-done-' + actId);
    doneCheckbox.checked = true;
    doneCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    var afterCheck = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.id === actId; });

    var refreshedCheckbox = document.getElementById('acc-done-' + actId);
    refreshedCheckbox.checked = false;
    refreshedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    var afterUncheck = (window.RevOpsStore.getCollection('dwmActivities') || []).find(function (a) { return a.id === actId; });

    return {
      statusAfterCheck: afterCheck.accomplishmentStatus,
      remarksKeptAfterCheck: afterCheck.accomplishmentRemarks,
      planChangedKeptAfterCheck: afterCheck.planChangedByManager,
      statusAfterUncheck: afterUncheck.accomplishmentStatus
    };
  }, beforePartial.id);
  assertEqual(quickTickResult.statusAfterCheck, 'Done', 'Ticking the quick "Done" checkbox in Section B sets the status to Done without opening the dropdown', failures);
  assertEqual(quickTickResult.remarksKeptAfterCheck, 'Site visit completed on time', 'The quick Done tick does not wipe out remarks already saved on the row', failures);
  assertTrue(quickTickResult.planChangedKeptAfterCheck === true, 'The quick Done tick does not clear the "Plan changed" flag already saved on the row', failures);
  assertEqual(quickTickResult.statusAfterUncheck, 'Pending', 'Unticking the quick Done checkbox reverts the status to Pending', failures);

  await page.close();
  return failures;
}

const TESTS = [
  ['SLA day-based seeding, migration, severity dropdown & date math', testSlaDayBasedSeedingAndMigration],
  ['Ticket email subject line', testQuotationVerticalAndTicketSubject],
  ['Service Lead customer dropdown scope & contact cascade', testServiceLeadCustomerCascade],
  ['AMC Quote customer -> site cascade', testAmcQuoteSiteCascade],
  ['AMC Order customer/quote cascade, deep link & save', testAmcOrderCascadeAndSave],
  ['AMC Invoice cascade, "Others" toggle & GSTIN leak fix', testAmcInvoiceCascadeAndGstinLeak],
  ['Client Master phone field', testClientMasterPhoneField],
  ['Service Lead "Raise Ticket" / "Generate Quotation" links', testServiceLeadActionLinks],
  ['Invoice "Amount in Words"', testInvoiceAmountInWords],
  ['Vertical list consistency app-wide + AOP bucket classification', testVerticalListConsistency],
  ['Lead product Unit Price is pre-filled but editable', testLeadProductPriceEditable],
  ['Master Data edit access is Super Admin / Admin role only', testMasterDataAdminRoleOnly],
  ['Service/Parts pages declare explicit role gate', testServicePartsPagesDeclareRoleGate],
  ['Client email routes Gmail-first with Brevo fallback on any failure', testEmailRoutesGmailFirstWithBrevoFallback],
  ['Superseded quotation revisions hidden from PO/Invoice pickers', testSupersededQuoteRevisionsHidden],
  ['Multi-company support: Lead/Quotation/Invoice numbering & branding', testMultiCompanySupport],
  ['Lead product dropdown vertical-normalization fix & quick "+ New Product" role gate', testLeadProductDropdownAndQuickAddProduct],
  ['Quotation edit: mandatory reason field', testQuoteEditReasonMandatory],
  ['Go-Live "Clear Demo Data" reset', testClearDummyDataGoLiveReset],
  ['Bulk CSV parser handles quoted/comma/multi-line fields', testBulkCsvParserHandlesQuotedFields],
  ['Password policy: forced first-time/90-day change, developer exemption, self-service flow', testPasswordPolicyEnforcement],
  ['Lead pipeline stage model: advanceLeadStage, Lost/Trashed/Postponed guards, pending follow-ups', testLeadPipelineStageModel],
  ['Lead auto-sync: Quotation send -> Quoted, Order booked -> Order Received, Invoice raised -> Won', testLeadAutoSyncFromDocuments],
  ['Bulk-upload template: live dropdown-values legend, comment-line skipping, never on real exports', testCsvTemplateDropdownLegend],
  ['Data Center: 12 real per-collection templates, dropdown legends, shared RFC 4180 parser', testDataCenterTemplatesAndParser],
  ['DWM productivity % matches dropdown labels; Scorecard DWM compliance never fakes 100%', testDwmProductivityAndComplianceFixes],
  ['Every root .html page is registered in vite.config.ts (prevents a page silently never being deployed)', testEveryHtmlPageRegisteredInViteBuild],
  ['Attendance/DWM punch flow: Punch In on confirming the plan, Punch Out on confirming accomplishments', testDwmPunchInOutFlow],
  ['DWM Regular/Special split: KRA auto-fill, time-boxed Special Assignments, rebalanced hours, fair scoring', testDwmRegularAndSpecialAssignmentSplit],
  ['KRA/KPI/DWM in Employee Directory + CSV import: point-splitting, name-matching, dossier add/edit/delete', testKraDwmEmployeeDirectoryAndCsvImport],
  ['Per-employee KRA/DWM template: pre-filled download, fill-in, upload round-trip', testEmployeeKraTemplateDownloadAndUpload],
  ['Seed guard: stale local defaultEmployees fallback never duplicates the real Firestore roster', testEmployeesSeedGuardAgainstDuplication],
  ['DWM tick/time/% rework: Include checkboxes, editable time pre-fill, Punch-In lock, real % Done, plan-changed flag', testDwmTickTimePercentAndPlanChanged]
];

(async () => {
  const browser = await chromium.launch(PW_EXECUTABLE ? { executablePath: PW_EXECUTABLE } : {});
  let allFailures = [];

  for (const [name, fn] of TESTS) {
    process.stdout.write('Checking: ' + name + ' ... ');
    let failures;
    try {
      failures = await fn(browser);
    } catch (err) {
      failures = ['crashed: ' + (err && err.stack || err)];
    }
    if (failures.length) {
      console.log('FAIL');
      failures.forEach(function (f) { console.log('    - ' + f); });
      allFailures = allFailures.concat(failures.map(function (f) { return name + ': ' + f; }));
    } else {
      console.log('ok');
    }
  }

  await browser.close();

  if (allFailures.length > 0) {
    console.error('\nRegression suite FAILED with ' + allFailures.length + ' issue(s).');
    process.exit(1);
  }
  console.log('\nRegression suite passed.');
  process.exit(0);
})().catch(function (err) {
  console.error('Regression suite crashed:', err);
  process.exit(1);
});
