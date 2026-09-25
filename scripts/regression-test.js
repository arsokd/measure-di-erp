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

const BASE_URL = process.argv[2] || 'http://localhost:8099';
const PW_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

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
  ['Vertical list consistency app-wide + AOP bucket classification', testVerticalListConsistency]
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
