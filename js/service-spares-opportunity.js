// js/service-spares-opportunity.js - Service/Spares Opportunity Tracker
// (A-10 from the 24-Nov K-30 review). The 3 opportunity rules themselves
// live in the shared window.RevOpsStore.getServiceSparesOpportunities()
// (also used by the K-30 Rollup Report's summary) - this file is purely
// the page's rendering. Ms. Dipa's corrected 5-year installed-base
// figures will flow straight into this the moment they're entered/
// uploaded into clientEquipmentMaster (via Master Data, same as any
// other master list), with zero code changes needed here.

document.addEventListener('DOMContentLoaded', function() {
  if (checkAuth(['super_admin', 'admin'])) {
    renderServiceSparesOpportunities();
  }
});

function renderServiceSparesOpportunities() {
  var opportunities = window.RevOpsStore.getServiceSparesOpportunities();

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
