// js/k30-rollup.js - K-30 Rollup Report (A-5, 24-Nov K-30 review). Pure
// aggregation of numbers this app already computes correctly elsewhere
// (Commitments, Monthly Plan vs Actual, Productivity, Service/Spares
// Opportunity, isOrderWon/getOrderContributions) - nothing new is
// invented here, and it deliberately comes last in the build order
// because it rolls up A-1, A-2, A-3, A-6, A-7, A-9 and A-10.

document.addEventListener('DOMContentLoaded', function() {
  if (checkAuth(['super_admin', 'admin'])) {
    populateRollupMonthSelect();
    renderK30Rollup();
  }
});

function _rollCurrentYearMonth() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function _rollYearMonthLabel(yearMonth) {
  var m = /^(\d{4})-(\d{2})$/.exec(yearMonth || '');
  if (!m) return yearMonth;
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

function populateRollupMonthSelect() {
  var select = document.getElementById('rollup-month-select');
  if (!select) return;
  var currentVal = select.value;
  var now = new Date();
  var options = [];
  for (var i = 0; i < 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    options.push('<option value="' + ym + '">' + _rollYearMonthLabel(ym) + '</option>');
  }
  select.innerHTML = options.join('');
  select.value = currentVal && options.some(function(o) { return o.indexOf('value="' + currentVal + '"') !== -1; }) ? currentVal : _rollCurrentYearMonth();
}

function renderK30Rollup() {
  var select = document.getElementById('rollup-month-select');
  var yearMonth = (select && select.value) || _rollCurrentYearMonth();
  var financialYear = getFinancialYear(yearMonth + '-01');

  var employees = (window.RevOpsStore.getCollection('employees') || []).filter(function(e) {
    return e.isActive !== false && e.employeeId !== 'E-001';
  });
  var orders = window.RevOpsStore.getCollection('orders') || [];
  var commitments = window.RevOpsStore.getCollection('commitments') || [];
  var attendance = window.RevOpsStore.getCollection('attendance') || [];
  var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];
  var aopTargets = window.RevOpsStore.getCollection('aopTargets') || [];

  // 1. Revenue This Month + Industry breakdown.
  var wonOrdersThisMonth = orders.filter(function(o) {
    return window.RevOpsStore.isOrderWon(o) && window.RevOpsStore._dateInYearMonth(window.RevOpsStore.getOrderDate(o), yearMonth);
  });
  var wonRevenue = 0;
  var industryMap = {};
  wonOrdersThisMonth.forEach(function(o) {
    var val = Number(o.orderValue) || 0;
    wonRevenue += val;
    var key = o.industry || 'Unspecified';
    if (!industryMap[key]) industryMap[key] = { industry: key, count: 0, revenue: 0 };
    industryMap[key].count++;
    industryMap[key].revenue += val;
  });
  document.getElementById('roll-stat-wonorders').innerText = wonOrdersThisMonth.length;
  document.getElementById('roll-stat-wonrevenue').innerText = formatINR(wonRevenue);

  var customAopRecord = aopTargets.find(function(a) { return a.financialYear === financialYear && a.companyTarget !== undefined; });
  document.getElementById('roll-stat-aoptarget').innerText = customAopRecord ? formatINR(customAopRecord.companyTarget) : 'Not set yet';
  document.getElementById('roll-stat-aoptarget-fy').innerText = 'FY ' + financialYear + (customAopRecord ? '' : ' - set it in AOP Configuration');

  var industryRows = Object.keys(industryMap).map(function(k) { return industryMap[k]; }).sort(function(a, b) { return b.revenue - a.revenue; });
  var industryTbody = document.getElementById('roll-industry-tbody');
  if (industryRows.length === 0) {
    industryTbody.innerHTML = '<tr><td colspan="3" class="py-4 px-4 text-center text-slate-400">No won orders this month.</td></tr>';
  } else {
    industryTbody.innerHTML = industryRows.map(function(r) {
      return '<tr class="hover:bg-slate-50 transition-colors">' +
        '<td class="py-3 px-4 font-bold text-slate-900">' + escapeHtml(r.industry) + '</td>' +
        '<td class="py-3 px-4 text-center font-bold text-slate-700">' + r.count + '</td>' +
        '<td class="py-3 px-4 text-right font-black text-emerald-600">' + formatINR(r.revenue) + '</td>' +
        '</tr>';
    }).join('');
  }

  // 2. Commitments This Month (by datePromised).
  var commitmentsThisMonth = commitments.filter(function(c) {
    return window.RevOpsStore._dateInYearMonth(c.datePromised, yearMonth);
  });
  var todayISO = typeof getLocalTodayISO === 'function' ? getLocalTodayISO() : new Date().toISOString().slice(0, 10);
  var completedCount = commitmentsThisMonth.filter(function(c) { return c.status === 'Completed'; }).length;
  var overdueCount = commitmentsThisMonth.filter(function(c) { return window.RevOpsStore.isCommitmentOverdue(c, todayISO); }).length;
  var openCount = commitmentsThisMonth.length - completedCount;
  document.getElementById('roll-commit-total').innerText = commitmentsThisMonth.length;
  document.getElementById('roll-commit-completed').innerText = completedCount;
  document.getElementById('roll-commit-open').innerText = openCount;
  document.getElementById('roll-commit-overdue').innerText = overdueCount;

  // 3. Monthly Plan vs Actual (team average %, per metric).
  var visitsPcts = [], enquiriesPcts = [], valuePcts = [];
  employees.forEach(function(emp) {
    var plan = window.RevOpsStore.getOrCreateMonthlyPlan(emp.employeeId, yearMonth);
    var actuals = window.RevOpsStore.getMonthlyPlanActuals(emp.employeeId, yearMonth);
    if (Number(plan.planVisits) > 0) visitsPcts.push(Math.min(200, Math.round((Number(plan.actualVisits) || 0) / Number(plan.planVisits) * 100)));
    if (Number(plan.planEnquiries) > 0) enquiriesPcts.push(Math.min(200, Math.round(actuals.enquiries / Number(plan.planEnquiries) * 100)));
    if (Number(plan.planValue) > 0) valuePcts.push(Math.min(200, Math.round(actuals.value / Number(plan.planValue) * 100)));
  });
  function _avg(arr) { return arr.length > 0 ? Math.round(arr.reduce(function(s, v) { return s + v; }, 0) / arr.length) : 0; }
  document.getElementById('roll-plan-visits').innerText = _avg(visitsPcts) + '%';
  document.getElementById('roll-plan-enquiries').innerText = _avg(enquiriesPcts) + '%';
  document.getElementById('roll-plan-value').innerText = _avg(valuePcts) + '%';

  // 4. Productivity (team average).
  var scorePcts = [], dwmPcts = [];
  employees.forEach(function(emp) {
    var prod = window.RevOpsStore.getProductivityForMonth(emp.employeeId, yearMonth, attendance, dwmActivities);
    if (prod.daysScored > 0) scorePcts.push(prod.avgScore);
    dwmPcts.push(prod.dwmPct);
  });
  document.getElementById('roll-prod-score').innerText = _avg(scorePcts) + '%';
  document.getElementById('roll-prod-dwm').innerText = _avg(dwmPcts) + '%';

  // 5. Attendance (team average), "as of" the right reference point for
  // the selected month - today if still in progress, else month-end.
  var range = window.RevOpsStore._refDateForYearMonth(yearMonth);
  var empIds = employees.map(function(e) { return e.employeeId; });
  var attResult = window.RevOpsStore.computeAttendanceCompliance(empIds, attendance, range ? range.refDate : new Date());
  document.getElementById('roll-attendance-pct').innerText = attResult.pct + '%';

  // 6. Service & Spares Opportunity (as-of-today state, not month-scoped).
  var opportunities = window.RevOpsStore.getServiceSparesOpportunities();
  document.getElementById('roll-opp-total').innerText = opportunities.length;
  document.getElementById('roll-opp-conversion').innerText = opportunities.filter(function(o) { return o.type === 'AMC Conversion'; }).length;
  document.getElementById('roll-opp-renewal').innerText = opportunities.filter(function(o) { return o.type === 'AMC Renewal Due'; }).length;
  document.getElementById('roll-opp-repeat').innerText = opportunities.filter(function(o) { return o.type === 'Repeat Claims'; }).length;
}
