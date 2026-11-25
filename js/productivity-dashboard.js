// js/productivity-dashboard.js - Productivity Dashboard (A-7 from the
// 24-Nov K-30 review). Deliberately reuses the app's own existing,
// manager-ratified numbers (Daily Productivity Score + DWM Compliance %)
// via RevOpsStore.getProductivityForMonth - no new productivity measure
// was invented for this page.

document.addEventListener('DOMContentLoaded', function() {
  if (checkAuth(['super_admin', 'admin'])) {
    populateProductivityMonthSelect();
    renderProductivityDashboard();
  }
});

function _prodCurrentYearMonth() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function _prodYearMonthLabel(yearMonth) {
  var m = /^(\d{4})-(\d{2})$/.exec(yearMonth || '');
  if (!m) return yearMonth;
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

// Last 12 months (this one first, most recent to oldest).
function populateProductivityMonthSelect() {
  var select = document.getElementById('prod-month-select');
  if (!select) return;
  var currentVal = select.value;
  var now = new Date();
  var options = [];
  for (var i = 0; i < 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    options.push('<option value="' + ym + '">' + _prodYearMonthLabel(ym) + '</option>');
  }
  select.innerHTML = options.join('');
  select.value = currentVal && options.some(function(o) { return o.indexOf('value="' + currentVal + '"') !== -1; }) ? currentVal : _prodCurrentYearMonth();
}

function renderProductivityDashboard() {
  var select = document.getElementById('prod-month-select');
  var yearMonth = (select && select.value) || _prodCurrentYearMonth();

  var employees = (window.RevOpsStore.getCollection('employees') || []).filter(function(e) {
    return e.isActive !== false && e.employeeId !== 'E-001'; // Business Head leads everyone, excluded same as Reports
  });
  var attendance = window.RevOpsStore.getCollection('attendance') || [];
  var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];

  var m = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  var year = parseInt(m[1], 10), month = parseInt(m[2], 10);
  var monthPrefix1 = '/' + String(month).padStart(2, '0') + '/' + year;

  var rows = employees.map(function(emp) {
    var prod = window.RevOpsStore.getProductivityForMonth(emp.employeeId, yearMonth, attendance, dwmActivities);
    return {
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      avgScore: prod.avgScore,
      daysScored: prod.daysScored,
      dwmPct: prod.dwmPct,
      overallPct: prod.overallPct
    };
  }).sort(function(a, b) { return b.overallPct - a.overallPct; });

  var pendingCount = attendance.filter(function(a) {
    return a.scoreRatificationStatus === 'Pending' && a.date && a.date.indexOf(monthPrefix1) !== -1;
  }).length;

  var scoredRows = rows.filter(function(r) { return r.daysScored > 0; });
  var teamAvgScore = scoredRows.length > 0 ? Math.round(scoredRows.reduce(function(s, r) { return s + r.avgScore; }, 0) / scoredRows.length) : 0;
  var teamAvgDwm = rows.length > 0 ? Math.round(rows.reduce(function(s, r) { return s + r.dwmPct; }, 0) / rows.length) : 0;

  document.getElementById('prod-stat-score').innerText = teamAvgScore + '%';
  document.getElementById('prod-stat-dwm').innerText = teamAvgDwm + '%';
  document.getElementById('prod-stat-pending').innerText = pendingCount;

  var tbody = document.getElementById('productivity-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-4 px-4 text-center text-slate-400">No employees found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(function(r) {
    var pctClass = function(pct) { return pct >= 90 ? 'text-emerald-600' : (pct >= 70 ? 'text-amber-600' : 'text-rose-600'); };
    return '<tr class="hover:bg-slate-50 transition-colors">' +
      '<td class="py-3 px-4 font-bold text-slate-900">' + escapeHtml(r.fullName) + ' (' + escapeHtml(r.employeeId) + ')</td>' +
      '<td class="py-3 px-4 text-center font-bold ' + pctClass(r.avgScore) + '">' + r.avgScore + '%</td>' +
      '<td class="py-3 px-4 text-center font-bold text-slate-700">' + r.daysScored + '</td>' +
      '<td class="py-3 px-4 text-center font-bold ' + pctClass(r.dwmPct) + '">' + r.dwmPct + '%</td>' +
      '<td class="py-3 px-4 text-center font-black ' + pctClass(r.overallPct) + '">' + r.overallPct + '%</td>' +
      '</tr>';
  }).join('');
}
