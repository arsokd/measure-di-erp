// js/service-spares-opportunity.js - Service/Spares Opportunity Tracker
// (A-10 from the 24-Nov K-30 review). Deliberately computes ONLY from
// data already in the app (clientEquipmentMaster's installed base +
// warranty, and amcContracts) - nothing is invented. Ms. Dipa's
// corrected 5-year installed-base figures will flow straight into this
// the moment they're entered/uploaded into clientEquipmentMaster (via
// Master Data, same as any other master list), with zero code changes
// needed here.

document.addEventListener('DOMContentLoaded', function() {
  if (checkAuth(['super_admin', 'admin'])) {
    renderServiceSparesOpportunities();
  }
});

// Mirrors warranty-management.js's own computeWarrantyStatus day-math
// exactly, so "Expired"/"Expiring Soon" here always agrees with what
// that page itself shows for the same equipment.
function _oppWarrantyDaysRemaining(expiryDate) {
  var today = new Date();
  var exp = new Date(expiryDate);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

// Mirrors amc-contracts.js's own computeAmcStatus day-math exactly.
function _oppAmcDaysRemaining(endDate) {
  var today = new Date();
  var end = new Date(endDate);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function renderServiceSparesOpportunities() {
  var equipment = window.RevOpsStore.getCollection('clientEquipmentMaster') || [];
  var amcContracts = window.RevOpsStore.getCollection('amcContracts') || [];

  // A customer counts as "already on AMC" for conversion purposes if
  // they have ANY contract that hasn't itself expired - loose match by
  // customerName (the same join key both collections already carry),
  // rather than invented equipment-to-contract linkage that doesn't
  // exist in the data model yet.
  var customersWithActiveAmc = {};
  amcContracts.forEach(function(c) {
    if (_oppAmcDaysRemaining(c.endDate) >= 0) {
      customersWithActiveAmc[c.customerName] = true;
    }
  });

  var opportunities = [];

  // 1. AMC Conversion: warranty expired, not already marked converted,
  // and the customer has no currently-active AMC contract.
  equipment.forEach(function(w) {
    if (w.statusOverride === 'Converted to AMC') return;
    if (customersWithActiveAmc[w.customerName]) return;
    var daysRemaining = _oppWarrantyDaysRemaining(w.expiryDate);
    if (daysRemaining < 0) {
      opportunities.push({
        type: 'AMC Conversion',
        customerName: w.customerName,
        equipmentModel: w.equipmentModel,
        vertical: w.vertical,
        detail: 'Warranty expired ' + Math.abs(daysRemaining) + ' days ago, no AMC contract in place',
        estValue: null
      });
    }
  });

  // 2. AMC Renewal Due: an existing contract expiring within 60 days -
  // same threshold amc-contracts.js itself uses for "Expiring Soon".
  // Est. Value is the contract's OWN real annualValue, never a guess.
  amcContracts.forEach(function(c) {
    var daysRemaining = _oppAmcDaysRemaining(c.endDate);
    if (daysRemaining >= 0 && daysRemaining <= 60) {
      opportunities.push({
        type: 'AMC Renewal Due',
        customerName: c.customerName,
        equipmentModel: c.equipmentModel,
        vertical: c.vertical || '',
        detail: 'Contract ' + (c.contractNumber || '') + ' renews in ' + daysRemaining + ' days',
        estValue: Number(c.annualValue) || null
      });
    }
  });

  // 3. Repeat Claims: 2+ warranty claims logged on the same equipment -
  // a real signal of recurring trouble, worth a spares/service visit.
  equipment.forEach(function(w) {
    var claimCount = Array.isArray(w.claims) ? w.claims.length : 0;
    if (claimCount >= 2) {
      opportunities.push({
        type: 'Repeat Claims',
        customerName: w.customerName,
        equipmentModel: w.equipmentModel,
        vertical: w.vertical,
        detail: claimCount + ' warranty claims logged on this unit',
        estValue: null
      });
    }
  });

  document.getElementById('opp-stat-total').innerText = opportunities.length;
  document.getElementById('opp-stat-conversion').innerText = opportunities.filter(function(o) { return o.type === 'AMC Conversion'; }).length;
  document.getElementById('opp-stat-renewal').innerText = opportunities.filter(function(o) { return o.type === 'AMC Renewal Due'; }).length;
  document.getElementById('opp-stat-repeat').innerText = opportunities.filter(function(o) { return o.type === 'Repeat Claims'; }).length;

  var tbody = document.getElementById('opportunity-tbody');
  if (opportunities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">No opportunities found in the current installed-base/AMC data.</td></tr>';
    return;
  }

  var typeBadge = {
    'AMC Conversion': 'bg-rose-100 text-rose-800',
    'AMC Renewal Due': 'bg-amber-100 text-amber-800',
    'Repeat Claims': 'bg-indigo-100 text-indigo-800'
  };

  tbody.innerHTML = opportunities.map(function(o) {
    return '<tr class="hover:bg-slate-50 transition-colors">' +
      '<td class="py-3 px-4 font-bold text-slate-900">' + escapeHtml(o.customerName || '') + '</td>' +
      '<td class="py-3 px-4 text-slate-700">' + escapeHtml(o.equipmentModel || '') + '<div class="text-[10px] text-slate-400">' + escapeHtml(o.vertical || '') + '</div></td>' +
      '<td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ' + (typeBadge[o.type] || 'bg-slate-100 text-slate-700') + '">' + escapeHtml(o.type) + '</span></td>' +
      '<td class="py-3 px-4 text-slate-600">' + escapeHtml(o.detail || '') + '</td>' +
      '<td class="py-3 px-4 text-right font-black text-slate-900">' + (o.estValue ? formatINR(o.estValue) : '--') + '</td>' +
      '</tr>';
  }).join('');
}
