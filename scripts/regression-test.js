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
// Quotation "Spare/Service" vertical + ticket email subject line
// ---------------------------------------------------------------------
async function testQuotationVerticalAndTicketSubject(browser) {
  const failures = [];
  const { page } = await newPage(browser);

  await page.goto(BASE_URL + '/quotations.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const verticalOptions = await page.evaluate(function () {
    return Array.from(document.getElementById('inp-quote-vertical').options).map(function (o) { return o.value; });
  });
  assertIncludes(verticalOptions, 'Spare/Service', 'Quotation vertical dropdown: has Spare/Service option', failures);

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

const TESTS = [
  ['SLA day-based seeding, migration, severity dropdown & date math', testSlaDayBasedSeedingAndMigration],
  ['Quotation Spare/Service vertical & ticket email subject', testQuotationVerticalAndTicketSubject],
  ['Service Lead customer dropdown scope & contact cascade', testServiceLeadCustomerCascade],
  ['AMC Quote customer -> site cascade', testAmcQuoteSiteCascade],
  ['AMC Order customer/quote cascade, deep link & save', testAmcOrderCascadeAndSave],
  ['AMC Invoice cascade, "Others" toggle & GSTIN leak fix', testAmcInvoiceCascadeAndGstinLeak],
  ['Client Master phone field', testClientMasterPhoneField],
  ['Service Lead "Raise Ticket" / "Generate Quotation" links', testServiceLeadActionLinks],
  ['Invoice "Amount in Words"', testInvoiceAmountInWords]
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
