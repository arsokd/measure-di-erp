// Global Chart Instances
      var chartTimeline = null;
      var chartVerticalDonut = null;
      var chartPipelineFunnel = null;
      var chartTeamContribution = null;

      // Active Preset Tracking
      var currentPreset = 'Full';
      var customStartDate = null;
      var customEndDate = null;

      // Currency Formatting Helper
      if (typeof formatINR === 'undefined') {
        window.formatINR = function(val) {
          var num = Number(val) || 0;
          if (Math.abs(num) >= 10000000) {
            return '₹' + (num / 10000000).toFixed(2) + ' Cr';
          } else if (Math.abs(num) >= 100000) {
            return '₹' + (num / 100000).toFixed(2) + ' L';
          }
          return '₹' + num.toLocaleString('en-IN');
        };
      }

      function initDashboardPage() {
        if (window.RevOpsStore && window.RevOpsStore.initSeedData) {
          window.RevOpsStore.initSeedData();
        }
        if (typeof checkAuth === 'function' && checkAuth(['super_admin', 'admin', 'manager', 'staff'])) {
          populateEmployeeDropdown();
          renderDashboardData();
          renderLiveActivityStream();
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboardPage);
      } else {
        initDashboardPage();
      }

      function populateEmployeeDropdown() {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var sel = document.getElementById('dash-employee-select');
        if (!sel) return;
        
        sel.innerHTML = '<option value="All">All Team Members</option>';
        employees.forEach(function(emp) {
          if (emp.employeeId === 'E-001') return; // Exclude MD E-001
          var opt = document.createElement('option');
          opt.value = emp.employeeId;
          opt.innerText = emp.fullName + " (" + emp.employeeId + " - " + emp.vertical + ")";
          sel.appendChild(opt);
        });
      }

      function applyPreset(presetKey) {
        currentPreset = presetKey;
        // Highlight active preset button
        var buttons = document.querySelectorAll('.preset-btn');
        buttons.forEach(function(btn) {
          btn.classList.remove('active', 'bg-indigo-600', 'text-white');
          btn.classList.add('bg-slate-800', 'text-slate-300');
        });

        var activeBtn = document.getElementById('btn-preset-' + presetKey);
        if (activeBtn) {
          activeBtn.classList.add('active', 'bg-indigo-600', 'text-white');
          activeBtn.classList.remove('bg-slate-800', 'text-slate-300');
        }

        // Reset custom date inputs
        document.getElementById('dash-start-date').value = "";
        document.getElementById('dash-end-date').value = "";
        customStartDate = null;
        customEndDate = null;

        renderDashboardData();
      }

      function onCustomDateChange() {
        var sVal = document.getElementById('dash-start-date').value;
        var eVal = document.getElementById('dash-end-date').value;

        if (sVal || eVal) {
          currentPreset = 'Custom';
          var buttons = document.querySelectorAll('.preset-btn');
          buttons.forEach(function(btn) {
            btn.classList.remove('active', 'bg-indigo-600', 'text-white');
            btn.classList.add('bg-slate-800', 'text-slate-300');
          });
          customStartDate = sVal ? new Date(sVal) : null;
          customEndDate = eVal ? new Date(eVal + 'T23:59:59') : null;
          renderDashboardData();
        }
      }

      function onFilterChange() {
        renderDashboardData();
      }

      function toggleDashboardMobileFilters() {
        var panel = document.getElementById('dashboard-filter-panel');
        var icon = document.getElementById('filter-toggle-icon');
        if (!panel) return;
        if (panel.classList.contains('hidden')) {
          panel.classList.remove('hidden');
          if (icon) icon.classList.add('rotate-180');
        } else {
          panel.classList.add('hidden');
          if (icon) icon.classList.remove('rotate-180');
        }
      }

      function resetAllDashboardFilters() {
        document.getElementById('dash-fy-select').value = '2026-27';
        document.getElementById('dash-vertical-select').value = 'All';
        document.getElementById('dash-employee-select').value = 'All';
        document.getElementById('dash-start-date').value = "";
        document.getElementById('dash-end-date').value = "";
        customStartDate = null;
        customEndDate = null;
        applyPreset('Full');
      }

      // Helper Date Parser
      function parseAppDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        if (dateStr.indexOf('/') !== -1) {
          var parts = dateStr.split('/');
          if (parts.length >= 3) {
            var day = parseInt(parts[0], 10);
            var month = parseInt(parts[1], 10) - 1;
            var year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            return new Date(year, month, day);
          }
        } else if (dateStr.indexOf('-') !== -1) {
          var parts = dateStr.split('T')[0].split('-');
          if (parts.length >= 3) {
            var year = parseInt(parts[0], 10);
            var month = parseInt(parts[1], 10) - 1;
            var day = parseInt(parts[2], 10);
            return new Date(year, month, day);
          }
        }
        var d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
      }

      // Get Start & End Dates for Selected Preset in Financial Year
      function getPeriodRange(fy, preset) {
        var startYear = 2025;
        if (fy === '2024-25') startYear = 2024;
        else if (fy === '2026-27') startYear = 2026;
        else if (fy === 'All') startYear = 2024; // Base

        if (preset === 'Custom') {
          var ratio = 1.0;
          if (customStartDate && customEndDate) {
            var diffMs = customEndDate.getTime() - customStartDate.getTime();
            var diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
            ratio = Math.min(1.0, Math.max(0.01, diffDays / 365.0));
          }
          return {
            current: { start: customStartDate, end: customEndDate },
            previous: null,
            ratio: ratio,
            label: 'Custom Range',
            shortLabel: 'Custom',
            prevLabel: 'Previous Period'
          };
        }

        if (preset === 'WTD') {
          var now = new Date();
          var day = now.getDay();
          var diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
          var mon = new Date(now.setDate(diffToMon));
          mon.setHours(0,0,0,0);
          var today = new Date();

          var prevMon = new Date(mon);
          prevMon.setDate(prevMon.getDate() - 7);
          var prevSun = new Date(mon);
          prevSun.setDate(prevSun.getDate() - 1);

          return {
            current: { start: mon, end: today },
            previous: { start: prevMon, end: prevSun },
            ratio: 7 / 365.0,
            label: 'Week To Date (WTD)',
            shortLabel: 'WTD',
            prevLabel: 'Previous Week'
          };
        }

        if (preset === 'MTD') {
          var now = new Date();
          var startM = new Date(now.getFullYear(), now.getMonth(), 1);
          var today = new Date();

          var prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          var prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

          return {
            current: { start: startM, end: today },
            previous: { start: prevMonthStart, end: prevMonthEnd },
            ratio: 1 / 12.0,
            label: 'Month To Date (MTD)',
            shortLabel: 'MTD',
            prevLabel: 'Previous Month'
          };
        }

        if (preset === 'QTD') {
          var now = new Date();
          var m = now.getMonth();
          var qStartMonth = Math.floor(m / 3) * 3;
          var startQ = new Date(now.getFullYear(), qStartMonth, 1);
          var today = new Date();

          var prevQStart = new Date(now.getFullYear(), qStartMonth - 3, 1);
          var prevQEnd = new Date(now.getFullYear(), qStartMonth, 0);

          return {
            current: { start: startQ, end: today },
            previous: { start: prevQStart, end: prevQEnd },
            ratio: 0.25,
            label: 'Quarter To Date (QTD)',
            shortLabel: 'QTD',
            prevLabel: 'Previous Quarter'
          };
        }

        if (preset === 'Q1') {
          return {
            current: { start: new Date(startYear, 3, 1), end: new Date(startYear, 5, 30, 23, 59, 59) },
            previous: { start: new Date(startYear - 1, 0, 1), end: new Date(startYear, 2, 31, 23, 59, 59) },
            ratio: 0.25,
            label: 'Q1 (Apr-Jun ' + startYear + ')',
            shortLabel: 'Q1',
            prevLabel: 'Q4 (Jan-Mar ' + startYear + ')'
          };
        }

        if (preset === 'Q2') {
          return {
            current: { start: new Date(startYear, 6, 1), end: new Date(startYear, 8, 30, 23, 59, 59) },
            previous: { start: new Date(startYear, 3, 1), end: new Date(startYear, 5, 30, 23, 59, 59) },
            ratio: 0.25,
            label: 'Q2 (Jul-Sep ' + startYear + ')',
            shortLabel: 'Q2',
            prevLabel: 'Q1 (Apr-Jun ' + startYear + ')'
          };
        }

        if (preset === 'Q3') {
          return {
            current: { start: new Date(startYear, 9, 1), end: new Date(startYear, 11, 31, 23, 59, 59) },
            previous: { start: new Date(startYear, 6, 1), end: new Date(startYear, 8, 30, 23, 59, 59) },
            ratio: 0.25,
            label: 'Q3 (Oct-Dec ' + startYear + ')',
            shortLabel: 'Q3',
            prevLabel: 'Q2 (Jul-Sep ' + startYear + ')'
          };
        }

        if (preset === 'Q4') {
          return {
            current: { start: new Date(startYear + 1, 0, 1), end: new Date(startYear + 1, 2, 31, 23, 59, 59) },
            previous: { start: new Date(startYear, 9, 1), end: new Date(startYear, 11, 31, 23, 59, 59) },
            ratio: 0.25,
            label: 'Q4 (Jan-Mar ' + (startYear + 1) + ')',
            shortLabel: 'Q4',
            prevLabel: 'Q3 (Oct-Dec ' + startYear + ')'
          };
        }

        if (preset === 'H1') {
          return {
            current: { start: new Date(startYear, 3, 1), end: new Date(startYear, 8, 30, 23, 59, 59) },
            previous: { start: new Date(startYear - 1, 9, 1), end: new Date(startYear, 2, 31, 23, 59, 59) },
            ratio: 0.5,
            label: 'H1 (Apr-Sep ' + startYear + ')',
            shortLabel: 'H1',
            prevLabel: 'H2 Previous'
          };
        }

        if (preset === 'H2') {
          return {
            current: { start: new Date(startYear, 9, 1), end: new Date(startYear + 1, 2, 31, 23, 59, 59) },
            previous: { start: new Date(startYear, 3, 1), end: new Date(startYear, 8, 30, 23, 59, 59) },
            ratio: 0.5,
            label: 'H2 (Oct-Mar ' + (startYear + 1) + ')',
            shortLabel: 'H2',
            prevLabel: 'H1 (Apr-Sep ' + startYear + ')'
          };
        }

        // Full Year
        if (fy === 'All') {
          return {
            current: { start: new Date(2024, 3, 1), end: new Date(2027, 2, 31, 23, 59, 59) },
            previous: null,
            ratio: 1.0,
            label: 'All Time (2024-2027)',
            shortLabel: 'All Time',
            prevLabel: 'Previous Period'
          };
        }

        return {
          current: { start: new Date(startYear, 3, 1), end: new Date(startYear + 1, 2, 31, 23, 59, 59) },
          previous: { start: new Date(startYear - 1, 3, 1), end: new Date(startYear, 2, 31, 23, 59, 59) },
          ratio: 1.0,
          label: 'Full Year (' + fy + ')',
          shortLabel: 'Full Year',
          prevLabel: 'FY ' + (startYear - 1) + '-' + (startYear % 100)
        };
      }

      function renderDashboardData() {
        if (typeof Chart === 'undefined') {
          console.warn("Chart.js loading from CDN... Retrying render in 200ms...");
          setTimeout(renderDashboardData, 200);
          return;
        }

        var employees = window.RevOpsStore.getCollection('employees') || [];
        var rawOrders = window.RevOpsStore.getCollection('orders') || [];
        var rawLeads = window.RevOpsStore.getCollection('leads') || [];
        var aopTargets = window.RevOpsStore.getCollection('aopTargets') || [];

        if ((!rawOrders || rawOrders.length === 0) && window.RevOpsStore && window.RevOpsStore.initSeedData) {
          window.RevOpsStore.initSeedData();
          employees = window.RevOpsStore.getCollection('employees') || [];
          rawOrders = window.RevOpsStore.getCollection('orders') || [];
          rawLeads = window.RevOpsStore.getCollection('leads') || [];
          aopTargets = window.RevOpsStore.getCollection('aopTargets') || [];
        }

        // Active Dropdown Filters
        var selectedFy = document.getElementById('dash-fy-select').value;
        var selectedVertical = document.getElementById('dash-vertical-select').value;
        var selectedEmpId = document.getElementById('dash-employee-select').value;

        // Active Period Range
        var periodInfo = getPeriodRange(selectedFy, currentPreset);
        var currStart = periodInfo.current ? periodInfo.current.start : null;
        var currEnd = periodInfo.current ? periodInfo.current.end : null;

        var prevStart = periodInfo.previous ? periodInfo.previous.start : null;
        var prevEnd = periodInfo.previous ? periodInfo.previous.end : null;

        // Update Summary Filter Text Bar
        var empText = selectedEmpId === 'All' ? 'All Employees' : (employees.find(e => e.employeeId === selectedEmpId)?.fullName || selectedEmpId);
        var vertText = selectedVertical === 'All' ? 'All Verticals' : selectedVertical;
        document.getElementById('summary-filter-text').innerText = selectedFy + ' • ' + vertText + ' • ' + empText + ' • ' + periodInfo.label;
        document.getElementById('comparison-benchmark-label').innerText = periodInfo.prevLabel ? ('Benchmark vs ' + periodInfo.prevLabel) : 'Full Cumulative View';

        // Filter Orders for Current Period
        function filterOrdersList(ordList, rangeStart, rangeEnd) {
          return ordList.filter(function(ord) {
            // FY Filter
            if (selectedFy !== 'All') {
              var ordFy = typeof getFinancialYear === 'function' ? getFinancialYear(window.RevOpsStore.getOrderDate(ord), ord.invoiceNumber) : '2025-26';
              if (ordFy !== selectedFy) return false;
            }

            // Date Range Filter (only when not 'Full' or when selectedFy === 'All')
            if ((currentPreset !== 'Full' || selectedFy === 'All') && (rangeStart || rangeEnd)) {
              var d = parseAppDate(window.RevOpsStore.getOrderDate(ord));
              if (d) {
                if (rangeStart && d < rangeStart) return false;
                if (rangeEnd && d > rangeEnd) return false;
              }
            }

            // Vertical Filter
            if (selectedVertical !== 'All') {
              var rawV = ord.vertical || 'Sales';
              var normV = 'Sales';
              if (rawV.indexOf('Projects') !== -1 && rawV.indexOf('Service') === -1) normV = 'Projects';
              else if (rawV !== 'Sales') normV = 'Service/Parts';
              if (normV !== selectedVertical) return false;
            }

            // Employee Filter
            if (selectedEmpId !== 'All') {
              var contribs = window.RevOpsStore.getOrderContributions(ord);
              var isContrib = contribs.some(c => c.employeeId === selectedEmpId);
              if (!isContrib) return false;
            }

            return true;
          });
        }

        var currentOrders = filterOrdersList(rawOrders, currStart, currEnd);
        var previousOrders = prevStart ? filterOrdersList(rawOrders, prevStart, prevEnd) : [];

        // Compute Revenue for Period
        function computeRevenueData(ordersList) {
          var tot = 0;
          var vertMap = { "Sales": 0, "Service/Parts": 0, "Projects": 0 };
          var empMap = {};
          employees.forEach(e => empMap[e.employeeId] = 0);

          ordersList.forEach(function(ord) {
            if (window.RevOpsStore.isOrderWon(ord)) {
              var val = Number(ord.orderValue) || 0;
              tot += val;

              // Vertical
              var rawV = ord.vertical || "Sales";
              var vName = "Sales";
              if (rawV.indexOf("Projects") !== -1 && rawV.indexOf("Service") === -1) vName = "Projects";
              else if (rawV !== "Sales") vName = "Service/Parts";
              vertMap[vName] = (vertMap[vName] || 0) + val;

              // Employee Share — split exactly per the Sales Contribution
              // Split % recorded on the order (falls back to 100% to the
              // sole owner for legacy demo orders with no split).
              window.RevOpsStore.getOrderContributions(ord).forEach(function(c) {
                empMap[c.employeeId] = (empMap[c.employeeId] || 0) + c.amount;
              });
            }
          });

          return { total: tot, verticals: vertMap, employees: empMap, count: ordersList.filter(o => window.RevOpsStore.isOrderWon(o)).length };
        }

        var currRev = computeRevenueData(currentOrders);
        var prevRev = computeRevenueData(previousOrders);

        // Compute Targets for Selected FY
        var fyDefaults = {
          '2024-25': { company: 80000000, sales: 20000000, service: 48000000, projects: 12000000 },
          '2025-26': { company: 100000000, sales: 25000000, service: 60000000, projects: 15000000 },
          '2026-27': { company: 66666667, sales: 16666667, service: 40000000, projects: 10000000 },
          'All':     { company: 246666667, sales: 61666667, service: 148000000, projects: 37000000 }
        };
        var def = fyDefaults[selectedFy] || fyDefaults['2025-26'];
        var periodRatio = periodInfo.ratio || 1.0;

        var periodCompanyTarget = Math.round(def.company * periodRatio);
        var periodSalesTarget = Math.round(def.sales * periodRatio);
        var periodServiceTarget = Math.round(def.service * periodRatio);
        var periodProjectsTarget = Math.round(def.projects * periodRatio);

        // Render KPI Scorecards
        renderKpiScorecards(currRev, prevRev, periodCompanyTarget, periodSalesTarget, periodServiceTarget, periodProjectsTarget, periodInfo);

        // Render Vertical Progress Bars
        renderVerticalProgress(currRev.verticals, periodSalesTarget, periodServiceTarget, periodProjectsTarget, periodInfo);

        // Filter Leads for Pipeline Stage Chart (strictly scoped to selected reporting period date range)
        var filteredLeads = rawLeads.filter(function(l) {
          var leadDateStr = l.createdDate || l.createdAt || l.date;
          if (selectedFy !== 'All') {
            var lFy = typeof getFinancialYear === 'function' ? getFinancialYear(leadDateStr) : '2026-27';
            if (lFy !== selectedFy) return false;
          }
          if ((currentPreset !== 'Full' || selectedFy === 'All') && (currStart || currEnd)) {
            var d = parseAppDate(leadDateStr);
            if (d) {
              if (currStart && d < currStart) return false;
              if (currEnd && d > currEnd) return false;
            }
          }
          if (selectedVertical !== 'All') {
            var rawV = l.vertical || 'Sales';
            if (selectedVertical === 'Sales' && rawV !== 'Sales') return false;
            if (selectedVertical === 'Projects' && rawV.indexOf('Projects') === -1) return false;
            if (selectedVertical === 'Service/Parts' && rawV.indexOf('Service') === -1 && rawV.indexOf('Parts') === -1) return false;
          }
          if (selectedEmpId !== 'All' && l.employeeId !== selectedEmpId) return false;
          return true;
        });

        // Render Pending Follow-ups Today Widget
        renderPendingFollowups(filteredLeads);

        // Render Leaderboard Rows
        window.currentLeaderboardEmps = employees;
        window.currentAchievedMap = currRev.employees;
        window.currentPeriodRatio = periodRatio;
        window.currentPeriodInfo = periodInfo;
        renderLeaderboardRows(employees, currRev.employees, selectedFy, periodRatio, periodInfo);

        // RENDER CHARTS (Safely isolated)
        try { renderTimelineChart(rawOrders, selectedFy, selectedVertical, selectedEmpId, periodCompanyTarget, periodInfo); } catch(e1) { console.error("Timeline chart error:", e1); }
        try { renderVerticalDonutChart(currRev.verticals); } catch(e2) { console.error("Vertical donut chart error:", e2); }
        try { renderPipelineFunnelChart(filteredLeads, false, periodInfo); } catch(e3) { console.error("Pipeline funnel error:", e3); }
        try { renderSalesConversionFunnel(filteredLeads, periodInfo); } catch(e4) { console.error("Conversion funnel error:", e4); }
        try { renderTeamContributionChart(employees, currRev.employees, selectedFy, periodRatio, periodInfo); } catch(e5) { console.error("Team contribution chart error:", e5); }
      }

      function calculateTrendBadge(currentVal, prevVal, label) {
        if (!prevVal || prevVal === 0) {
          if (currentVal > 0) return `<span class="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">▲ New vs ${label}</span>`;
          return `<span class="inline-flex items-center text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">-- vs ${label}</span>`;
        }

        var diff = currentVal - prevVal;
        var pct = ((diff / prevVal) * 100).toFixed(1);

        if (diff >= 0) {
          return `<span class="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">▲ +${pct}% vs ${label}</span>`;
        } else {
          return `<span class="inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">▼ ${pct}% vs ${label}</span>`;
        }
      }

      function renderKpiScorecards(currRev, prevRev, companyTarget, salesTarget, serviceTarget, projectsTarget, periodInfo) {
        var prevLabel = periodInfo.prevLabel || 'Prev';
        var shortLabel = periodInfo.shortLabel || 'Period';

        var compAchPct = companyTarget > 0 ? Math.round((currRev.total / companyTarget) * 100) : 0;
        var salesAchPct = salesTarget > 0 ? Math.round(((currRev.verticals["Sales"] || 0) / salesTarget) * 100) : 0;
        var serviceAchPct = serviceTarget > 0 ? Math.round(((currRev.verticals["Service/Parts"] || 0) / serviceTarget) * 100) : 0;
        var projAchPct = projectsTarget > 0 ? Math.round(((currRev.verticals["Projects"] || 0) / projectsTarget) * 100) : 0;

        var compTrend = calculateTrendBadge(currRev.total, prevRev.total, prevLabel);
        var salesTrend = calculateTrendBadge(currRev.verticals["Sales"] || 0, prevRev.verticals["Sales"] || 0, prevLabel);
        var serviceTrend = calculateTrendBadge(currRev.verticals["Service/Parts"] || 0, prevRev.verticals["Service/Parts"] || 0, prevLabel);
        var projTrend = calculateTrendBadge(currRev.verticals["Projects"] || 0, prevRev.verticals["Projects"] || 0, prevLabel);

        var grid = document.getElementById('kpi-scorecards-grid');
        grid.innerHTML = `
          <!-- Card 1: Total Revenue -->
          <div class="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Revenue Booked</span>
                ${compTrend}
              </div>
              <div class="text-2xl font-black text-slate-900 tracking-tight">${formatINR(currRev.total)}</div>
              <div class="text-xs text-slate-500 mt-1">Target (${shortLabel}): <span class="font-semibold text-slate-700">${formatINR(companyTarget)}</span></div>
            </div>
            <div class="mt-4">
              <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500" style="width: ${Math.min(100, compAchPct)}%"></div>
              </div>
              <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 mt-1.5">
                <span>${shortLabel} Achievement</span>
                <span class="text-indigo-600">${compAchPct}%</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Equipment Sales -->
          <div class="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Equipment Sales</span>
                ${salesTrend}
              </div>
              <div class="text-2xl font-black text-slate-900 tracking-tight">${formatINR(currRev.verticals["Sales"] || 0)}</div>
              <div class="text-xs text-slate-500 mt-1">Target (${shortLabel}): <span class="font-semibold text-slate-700">${formatINR(salesTarget)}</span></div>
            </div>
            <div class="mt-4">
              <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-500" style="width: ${Math.min(100, salesAchPct)}%"></div>
              </div>
              <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 mt-1.5">
                <span>${shortLabel} Achievement</span>
                <span class="text-blue-600">${salesAchPct}%</span>
              </div>
            </div>
          </div>

          <!-- Card 3: Service & Spares -->
          <div class="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Service & Spares</span>
                ${serviceTrend}
              </div>
              <div class="text-2xl font-black text-slate-900 tracking-tight">${formatINR(currRev.verticals["Service/Parts"] || 0)}</div>
              <div class="text-xs text-slate-500 mt-1">Target (${shortLabel}): <span class="font-semibold text-slate-700">${formatINR(serviceTarget)}</span></div>
            </div>
            <div class="mt-4">
              <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-emerald-600 h-2 rounded-full transition-all duration-500" style="width: ${Math.min(100, serviceAchPct)}%"></div>
              </div>
              <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 mt-1.5">
                <span>${shortLabel} Achievement</span>
                <span class="text-emerald-600">${serviceAchPct}%</span>
              </div>
            </div>
          </div>

          <!-- Card 4: Steel Plant Projects -->
          <div class="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Steel Plant Projects</span>
                ${projTrend}
              </div>
              <div class="text-2xl font-black text-slate-900 tracking-tight">${formatINR(currRev.verticals["Projects"] || 0)}</div>
              <div class="text-xs text-slate-500 mt-1">Target (${shortLabel}): <span class="font-semibold text-slate-700">${formatINR(projectsTarget)}</span></div>
            </div>
            <div class="mt-4">
              <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-purple-600 h-2 rounded-full transition-all duration-500" style="width: ${Math.min(100, projAchPct)}%"></div>
              </div>
              <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 mt-1.5">
                <span>${shortLabel} Achievement</span>
                <span class="text-purple-600">${projAchPct}%</span>
              </div>
            </div>
          </div>
        `;
      }

      function renderVerticalProgress(vMap, salesTarget, serviceTarget, projectsTarget, periodInfo) {
        var salesAch = vMap["Sales"] || 0;
        var serviceAch = vMap["Service/Parts"] || 0;
        var projAch = vMap["Projects"] || 0;

        var salesPct = salesTarget > 0 ? Math.round((salesAch / salesTarget) * 100) : 0;
        var servicePct = serviceTarget > 0 ? Math.round((serviceAch / serviceTarget) * 100) : 0;
        var projPct = projectsTarget > 0 ? Math.round((projAch / projectsTarget) * 100) : 0;

        var html = `
          <div class="space-y-2">
            <div class="flex justify-between text-xs font-semibold text-slate-700">
              <span class="flex items-center space-x-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>Equipment Sales Vertical</span>
              </span>
              <span>${formatINR(salesAch)} / ${formatINR(salesTarget)} Target (${salesPct}%)</span>
            </div>
            <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div class="bg-blue-600 h-3 rounded-full transition-all duration-500" style="width: ${Math.min(100, salesPct)}%"></div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs font-semibold text-slate-700">
              <span class="flex items-center space-x-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span>Service & Maintenance AMC Vertical</span>
              </span>
              <span>${formatINR(serviceAch)} / ${formatINR(serviceTarget)} Target (${servicePct}%)</span>
            </div>
            <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div class="bg-emerald-600 h-3 rounded-full transition-all duration-500" style="width: ${Math.min(100, servicePct)}%"></div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs font-semibold text-slate-700">
              <span class="flex items-center space-x-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <span>Steel Plant Turnkey Projects Vertical</span>
              </span>
              <span>${formatINR(projAch)} / ${formatINR(projectsTarget)} Target (${projPct}%)</span>
            </div>
            <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div class="bg-purple-600 h-3 rounded-full transition-all duration-500" style="width: ${Math.min(100, projPct)}%"></div>
            </div>
          </div>
        `;
        document.getElementById('vertical-progress-bars').innerHTML = html;
      }

      function renderPendingFollowups(leads) {
        var pendingLeads = leads.filter(l => l.status !== "Won" && l.status !== "Lost");
        var container = document.getElementById('pending-followups-list');
        if (pendingLeads.length === 0) {
          container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No active pending leads matching current filter.</div>`;
          return;
        }

        var html = "";
        pendingLeads.slice(0, 7).forEach(function(l) {
          var val = l.estimatedValue || l.expectedValue || l.dealValue || 0;
          html += `
            <div class="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors flex items-center justify-between">
              <div>
                <div class="font-semibold text-xs text-slate-900">${l.customerName}</div>
                <div class="text-[11px] text-slate-500">${l.vertical || 'Sales'} &bull; Est: ${formatINR(val)}</div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">${l.status || 'New'}</span>
            </div>
          `;
        });
        container.innerHTML = html;
      }

      function getEmployeeTarget(emp, fy, kraList) {
        var empId = typeof emp === 'object' ? emp.employeeId : emp;
        var empKras = (kraList || []).filter(function(k) {
          if (k.employeeId !== empId) return false;
          var isAmt = (k.kpiType === "Amount" || (k.kraName || "").toLowerCase().indexOf("order") !== -1 || (k.kraName || "").toLowerCase().indexOf("spares") !== -1);
          if (!isAmt) return false;
          if (!k.financialYear) return true;
          return fy === 'All' || k.financialYear === fy;
        });

        if (empKras.length > 0) {
          var tot = 0;
          empKras.forEach(function(k) {
            tot += (Number(k.annualTarget) || Number(k.targetValue) || 0);
          });
          if (tot > 0) return tot;
        }

        var raw = typeof emp === 'object' ? (Number(emp.primaryAopTarget) || 0) : 0;
        if (!raw) return 0;
        if (fy === '2024-25') return Math.round(raw * 0.4);
        if (fy === '2025-26') return Math.round(raw * 0.5);
        if (fy === '2026-27') return Math.round(raw * 0.333333);
        if (fy === 'All') return Math.round(raw * 1.233333);
        return raw;
      }

      function renderLeaderboardRows(employees, achievedMap, selectedFy, periodRatio, periodInfo) {
        var tbody = document.getElementById('leaderboard-tbody');
        tbody.innerHTML = "";
        var kras = window.RevOpsStore.getCollection('kraTargets') || [];

        var shortLabel = (periodInfo && periodInfo.shortLabel) ? periodInfo.shortLabel : 'Period';
        var thTarget = document.getElementById('th-leaderboard-target');
        if (thTarget) {
          thTarget.innerText = shortLabel + ' Target';
        }

        employees.forEach(function(emp) {
          if (emp.employeeId === 'E-001') return; // Business Head excluded
          var annualTarget = getEmployeeTarget(emp, selectedFy, kras);
          var target = Math.round(annualTarget * (periodRatio || 1.0));
          var achieved = Number(achievedMap[emp.employeeId]) || 0;
          var pct = target > 0 ? Math.round((achieved / target) * 100) : 0;

          var pillClass = "bg-rose-100 text-rose-800";
          var statusText = "Needs Push";
          if (pct >= 90) {
            pillClass = "bg-emerald-100 text-emerald-800";
            statusText = "On Track";
          } else if (pct >= 70) {
            pillClass = "bg-amber-100 text-amber-800";
            statusText = "Moderate";
          }

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-slate-900">
              <div class="flex items-center space-x-2">
                <div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                  ${emp.fullName.charAt(0)}
                </div>
                <div>
                  <div class="font-bold text-slate-900">${emp.fullName}</div>
                  <div class="text-[10px] text-slate-400 font-mono">${emp.employeeId}</div>
                </div>
              </div>
            </td>
            <td class="py-3 px-4">
              <div class="text-slate-800 font-medium">${emp.designation}</div>
              <div class="text-[11px] text-slate-500">${emp.vertical}</div>
            </td>
            <td class="py-3 px-4 text-right font-medium text-slate-600">${formatINR(target)}</td>
            <td class="py-3 px-4 text-right font-bold text-slate-900">${formatINR(achieved)}</td>
            <td class="py-3 px-4 text-right font-black text-indigo-600">${pct}%</td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${pillClass}">${statusText}</span>
            </td>
            <td class="py-3 px-4 text-center">
              <a href="my-scorecard.html?employeeId=${emp.employeeId}" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs hover:underline">
                Scorecard &rarr;
              </a>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function filterLeaderboard() {
        var query = document.getElementById('leaderboard-search').value.toLowerCase();
        if (!window.currentLeaderboardEmps) return;
        var filtered = window.currentLeaderboardEmps.filter(function(e) {
          return e.fullName.toLowerCase().includes(query) || e.employeeId.toLowerCase().includes(query) || e.vertical.toLowerCase().includes(query);
        });
        var selectedFy = document.getElementById('dash-fy-select').value;
        renderLeaderboardRows(filtered, window.currentAchievedMap, selectedFy, window.currentPeriodRatio, window.currentPeriodInfo);
      }

      // CHART 1: TIMELINE TRAJECTORY & MONTHLY REVENUE (Combo Bar + Line)
      function renderTimelineChart(rawOrders, selectedFy, selectedVertical, selectedEmpId, periodCompanyTarget, periodInfo) {
        var ctx = document.getElementById('timelineChart').getContext('2d');
        if (chartTimeline) chartTimeline.destroy();

        var preset = currentPreset;
        var allMonths = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
        var activeMonthIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // default Full Year

        if (preset === 'Q1') activeMonthIndices = [0, 1, 2];
        else if (preset === 'Q2') activeMonthIndices = [3, 4, 5];
        else if (preset === 'Q3') activeMonthIndices = [6, 7, 8];
        else if (preset === 'Q4') activeMonthIndices = [9, 10, 11];
        else if (preset === 'H1') activeMonthIndices = [0, 1, 2, 3, 4, 5];
        else if (preset === 'H2') activeMonthIndices = [6, 7, 8, 9, 10, 11];
        else if (preset === 'QTD') {
          var now = new Date();
          var m = now.getMonth();
          var qStartMonth = Math.floor(m / 3) * 3;
          var fyStartM = (qStartMonth >= 3) ? (qStartMonth - 3) : (qStartMonth + 9);
          activeMonthIndices = [fyStartM, fyStartM + 1, fyStartM + 2];
        } else if (preset === 'MTD' || preset === 'WTD') {
          var now = new Date();
          var m = now.getMonth();
          var fyM = (m >= 3) ? (m - 3) : (m + 9);
          activeMonthIndices = [fyM];
        }

        var monthLabels = activeMonthIndices.map(idx => allMonths[idx]);
        var monthlyValues = activeMonthIndices.map(() => 0);

        var currStart = periodInfo.current ? periodInfo.current.start : null;
        var currEnd = periodInfo.current ? periodInfo.current.end : null;

        rawOrders.forEach(function(ord) {
          if (!window.RevOpsStore.isOrderWon(ord)) return;

          var ordDateStr = window.RevOpsStore.getOrderDate(ord);

          // FY Filter
          if (selectedFy !== 'All') {
            var ordFy = typeof getFinancialYear === 'function' ? getFinancialYear(ordDateStr) : '2025-26';
            if (ordFy !== selectedFy) return;
          }

          if (currStart || currEnd) {
            var dRange = parseAppDate(ordDateStr);
            if (dRange) {
              if (currStart && dRange < currStart) return;
              if (currEnd && dRange > currEnd) return;
            }
          }

          // Vertical Filter
          if (selectedVertical !== 'All') {
            var rawV = ord.vertical || 'Sales';
            var normV = 'Sales';
            if (rawV.indexOf('Projects') !== -1 && rawV.indexOf('Service') === -1) normV = 'Projects';
            else if (rawV !== 'Sales') normV = 'Service/Parts';
            if (normV !== selectedVertical) return;
          }

          var contribs = window.RevOpsStore.getOrderContributions(ord);

          // Employee Filter
          if (selectedEmpId !== 'All') {
            if (!contribs.some(c => c.employeeId === selectedEmpId)) return;
          }

          var d = parseAppDate(ordDateStr);
          if (!d) return;

          var m = d.getMonth(); // 0=Jan..11=Dec
          var fyIndex = (m >= 3) ? (m - 3) : (m + 9); // Apr=0..Mar=11
          var slotIndex = activeMonthIndices.indexOf(fyIndex);

          var val = Number(ord.orderValue) || 0;

          // If employee filter active, calculate share
          if (selectedEmpId !== 'All') {
            var c = contribs.find(item => item.employeeId === selectedEmpId);
            if (c) val = c.amount;
          }

          if (slotIndex !== -1) {
            monthlyValues[slotIndex] += val;
          }
        });

        // Cumulative Trajectory
        var cumulativeValues = [];
        var running = 0;
        monthlyValues.forEach(v => {
          running += v;
          cumulativeValues.push(running);
        });

        var stepTarget = periodCompanyTarget / activeMonthIndices.length;
        var targetTrajectoryLine = activeMonthIndices.map((_, i) => Math.round((i + 1) * stepTarget));

        var shortLabel = periodInfo ? periodInfo.shortLabel : 'Period';
        document.getElementById('timeline-stat-badge').innerText = shortLabel + ' Booked: ' + formatINR(running) + ' / Target: ' + formatINR(periodCompanyTarget);

        chartTimeline = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: monthLabels,
            datasets: [
              {
                type: 'bar',
                label: 'Revenue (₹)',
                data: monthlyValues,
                backgroundColor: 'rgba(99, 102, 241, 0.75)',
                borderColor: '#4f46e5',
                borderWidth: 1,
                borderRadius: 6,
                yAxisID: 'y'
              },
              {
                type: 'line',
                label: 'Cumulative Revenue (₹)',
                data: cumulativeValues,
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.3,
                yAxisID: 'y'
              },
              {
                type: 'line',
                label: shortLabel + ' Target Trajectory (₹)',
                data: targetTrajectoryLine,
                borderColor: '#cbd5e1',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                yAxisID: 'y'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, weight: 'bold' } } },
              tooltip: {
                callbacks: {
                  label: function(ctx) {
                    return ctx.dataset.label + ': ' + formatINR(ctx.raw);
                  }
                }
              }
            },
            scales: {

              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: {
                beginAtZero: true,
                ticks: {
                  font: { size: 10 },
                  callback: function(val) { return '₹' + (val / 1e5).toFixed(0) + 'L'; }
                }
              }
            }
          }
        });
      }

      // CHART 2: VERTICAL DONUT CHART
      function renderVerticalDonutChart(vMap) {
        var ctx = document.getElementById('verticalDonutChart').getContext('2d');
        if (chartVerticalDonut) chartVerticalDonut.destroy();

        var sales = vMap["Sales"] || 0;
        var service = vMap["Service/Parts"] || 0;
        var proj = vMap["Projects"] || 0;
        var total = sales + service + proj;

        var legendEl = document.getElementById('vertical-share-legend');
        if (total > 0) {
          legendEl.innerHTML = `
            <div><span class="font-bold text-blue-600 block">Equipment</span>${Math.round((sales/total)*100)}%</div>
            <div><span class="font-bold text-emerald-600 block">Service</span>${Math.round((service/total)*100)}%</div>
            <div><span class="font-bold text-purple-600 block">Projects</span>${Math.round((proj/total)*100)}%</div>
          `;
        } else {
          legendEl.innerHTML = `<div class="col-span-3 text-slate-400">No revenue data</div>`;
        }

        chartVerticalDonut = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Equipment Sales', 'Service & Spares', 'Steel Plant Projects'],
            datasets: [{
              data: [sales, service, proj],
              backgroundColor: ['#2563eb', '#059669', '#9333ea'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(ctx) {
                    return ctx.label + ': ' + formatINR(ctx.raw);
                  }
                }
              }
            },
            cutout: '68%'
          }
        });
      }

      // GLOBAL STORE FOR FUNNEL LEADS & IN-VIEW VERTICAL FILTER
      window.masterFunnelLeads = [];
      window.activeFunnelLeadsMap = {};
      window.selectedFunnelStage = null;

      function populateFunnelVerticalOptions(leads) {
        var selectEl = document.getElementById('funnel-vertical-select');
        if (!selectEl) return;
        var currentVal = selectEl.value || 'ALL';

        var verts = ['ALL', 'Sales', 'Service/Parts', 'Projects'];
        var knownSet = new Set(['ALL', 'Sales', 'Service/Parts', 'Projects']);

        if (leads && leads.length) {
          leads.forEach(function(l) {
            if (l.vertical && !knownSet.has(l.vertical)) {
              knownSet.add(l.vertical);
              verts.push(l.vertical);
            }
          });
        }

        var html = '';
        verts.forEach(function(v) {
          var label = v === 'ALL' ? 'All Verticals' : (v === 'Service/Parts' ? 'Service & Parts' : v);
          var selected = (v === currentVal) ? 'selected' : '';
          html += `<option value="${v}" ${selected}>${label}</option>`;
        });
        selectEl.innerHTML = html;
      }

      function onFunnelVerticalChange() {
        if (window.masterFunnelLeads) {
          renderPipelineFunnelChart(window.masterFunnelLeads, true);
        }
      }

      function selectFunnelStagePill(idx) {
        window.selectedFunnelStage = idx;

        // Update pill UI styles
        var allPill = document.getElementById('pill-stage-all');
        if (allPill) {
          if (idx === null) {
            allPill.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-2xs';
          } else {
            allPill.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 bg-white border border-slate-200 cursor-pointer';
          }
        }

        [0, 1, 2, 3, 4].forEach(function(i) {
          var pill = document.getElementById('pill-stage-' + i);
          if (pill) {
            if (idx === i) {
              pill.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-2xs cursor-pointer';
            } else {
              pill.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 bg-white border border-slate-200 cursor-pointer';
            }
          }
        });

        if (idx === null) {
          var box = document.getElementById('funnel-drilldown-box');
          if (box) box.classList.add('hidden');
        } else {
          renderFunnelStageDrilldown(idx);
        }

        if (window.masterFunnelLeads) {
          renderPipelineFunnelChart(window.masterFunnelLeads, true);
        }
      }

      // Helper: Parse Date String to Date object
      function parseDateString(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        var d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        var parts = String(dateStr).split(/[\/\-]/);
        if (parts.length === 3) {
          var p0 = parseInt(parts[0], 10);
          var p1 = parseInt(parts[1], 10);
          var p2 = parseInt(parts[2], 10);
          if (p2 > 1000) return new Date(p2, p1 - 1, p0);
          if (p0 > 1000) return new Date(p0, p1 - 1, p2);
        }
        return null;
      }

      function getDealAgeDays(deal) {
        var dtStr = deal.stageEntryDate || deal.createdDate || deal.createdAt || deal.orderDate;
        var dt = parseDateString(dtStr);
        if (!dt) return 14;
        var diff = Math.floor((new Date() - dt) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff);
      }

      function getSalesCycleDays(deal) {
        var createDt = parseDateString(deal.createdDate || deal.createdAt || deal.orderDate);
        var wonDt = parseDateString(deal.wonDate || deal.updatedAt || deal.orderDate);
        if (createDt && wonDt && wonDt >= createDt) {
          var diff = Math.floor((wonDt - createDt) / (1000 * 60 * 60 * 24));
          return Math.max(1, diff);
        }
        return 18;
      }

      function getDealProbability(deal, stageIdx) {
        if (typeof deal.probability === 'number') return deal.probability > 1 ? deal.probability / 100 : deal.probability;
        if (deal.probability && !isNaN(parseFloat(deal.probability))) {
          var p = parseFloat(deal.probability);
          return p > 1 ? p / 100 : p;
        }
        var probs = [0.10, 0.30, 0.50, 0.80, 1.00];
        return probs[stageIdx] !== undefined ? probs[stageIdx] : 0.20;
      }

      function getStageAvgDealAge(leadsInStage) {
        if (!leadsInStage || leadsInStage.length === 0) return 0;
        var sum = 0;
        leadsInStage.forEach(function(l) {
          sum += getDealAgeDays(l);
        });
        return Math.round(sum / leadsInStage.length);
      }

      // WIDGET 1: LIVE SALES PIPELINE CHART (FIXED CRM FUNNEL TEMPLATE & 8 ENTERPRISE KPI CARDS)
      function renderPipelineFunnelChart(leads, isFilterTriggered, periodInfo) {
        if (!isFilterTriggered) {
          window.masterFunnelLeads = leads || [];
          populateFunnelVerticalOptions(leads);
        }

        var selectEl = document.getElementById('funnel-vertical-select');
        var selectedVertical = selectEl ? selectEl.value : 'ALL';

        var activeLeads = window.masterFunnelLeads || leads || [];

        // Synchronize with top vertical filter if present
        var topVertEl = document.getElementById('filter-vertical');
        if (topVertEl && topVertEl.value !== 'All' && !isFilterTriggered && selectEl) {
          var topVal = topVertEl.value;
          selectEl.value = topVal;
          selectedVertical = topVal;
        }

        // Apply Vertical Filter inside the Funnel View
        if (selectedVertical && selectedVertical !== 'ALL') {
          activeLeads = activeLeads.filter(function(l) {
            var v = (l.vertical || '').toLowerCase();
            var sv = (l.subVertical || '').toLowerCase();
            var target = selectedVertical.toLowerCase();
            if (target === 'service/parts' || target === 'service & parts' || target === 'service') {
              return v.indexOf('service') !== -1 || v.indexOf('parts') !== -1 || sv.indexOf('service') !== -1 || sv.indexOf('spares') !== -1;
            }
            if (target === 'sales') {
              return v.indexOf('sales') !== -1 || sv.indexOf('sales') !== -1;
            }
            if (target === 'projects') {
              return v.indexOf('project') !== -1 || sv.indexOf('project') !== -1;
            }
            return v === target || sv === target;
          });
        }

        // Update Widget Header Date Period Subtitle Badge
        var pInfo = periodInfo || window.currentPeriodInfo;
        var periodDisplayEl = document.getElementById('pipeline-selected-period-display');
        if (periodDisplayEl && pInfo) {
          periodDisplayEl.innerText = 'Selected Period: ' + pInfo.label;
        }

        var stages = ['New Enquiry', 'Qualified', 'Quoted', 'Negotiation', 'Won'];
        var stageCounts = [0, 0, 0, 0, 0];
        var stageValues = [0, 0, 0, 0, 0];
        var stageLeadsMap = [[], [], [], [], []];

        activeLeads.forEach(function(l) {
          var st = l.status || l.stage || 'New Enquiry';
          var idx = stages.indexOf(st);
          if (idx === -1) {
            if (st === 'In Discussion' || st === 'Qualified') idx = 1;
            else if (st === 'Quote Sent' || st === 'Quoted') idx = 2;
            else if (st === 'Won' || st === 'Closed Won') idx = 4;
            else if (st === 'Lost' || st === 'Closed Lost') return;
            else idx = 0;
          }
          var val = l.estimatedValue || l.expectedValue || l.dealValue || 0;
          stageCounts[idx]++;
          stageValues[idx] += val;
          stageLeadsMap[idx].push(l);
        });

        window.activeFunnelLeadsMap = stageLeadsMap;

        var totalValSum = stageValues.reduce((a, b) => a + b, 0);
        var totalDealsSum = stageCounts.reduce((a, b) => a + b, 0);

        var container = document.getElementById('pipelineFunnelContainer');
        if (!container) return;

        // Dynamic Funnel Stage Geometry (Proportional to Stage Deal Value)
        var maxVal = Math.max.apply(null, stageValues) || 1;
        var maxCount = Math.max.apply(null, stageCounts) || 1;

        var stageGeometries = stages.map(function(st, idx) {
          var y1 = 10 + idx * 72;
          var y2 = y1 + 64;

          var valRatio = totalValSum > 0 ? (stageValues[idx] / maxVal) : (totalDealsSum > 0 ? (stageCounts[idx] / maxCount) : 0.5);
          var topW = Math.max(180, Math.round(180 + valRatio * 400));
          
          var botW;
          if (idx < 4) {
            var nextValRatio = totalValSum > 0 ? (stageValues[idx + 1] / maxVal) : (totalDealsSum > 0 ? (stageCounts[idx + 1] / maxCount) : 0.4);
            var nextTopW = Math.max(180, Math.round(180 + nextValRatio * 400));
            botW = Math.max(140, Math.round(topW * 0.70 + nextTopW * 0.30));
            if (botW >= topW) {
              botW = Math.max(140, Math.round(topW * 0.85));
            }
          } else {
            botW = Math.max(100, Math.round(topW * 0.65));
          }

          return { topW: topW, botW: botW, y1: y1, y2: y2 };
        });

        var svgHtml = `
          <div class="w-full relative select-none">
            <svg viewBox="0 0 740 370" class="w-full h-auto max-h-[380px] filter drop-shadow-lg overflow-visible">
              <defs>
                <linearGradient id="funnelGrad0" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#3b82f6" />
                  <stop offset="100%" stop-color="#1d4ed8" />
                </linearGradient>
                <linearGradient id="funnelGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#6366f1" />
                  <stop offset="100%" stop-color="#4338ca" />
                </linearGradient>
                <linearGradient id="funnelGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0284c7" />
                  <stop offset="100%" stop-color="#0369a1" />
                </linearGradient>
                <linearGradient id="funnelGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#f59e0b" />
                  <stop offset="100%" stop-color="#b45309" />
                </linearGradient>
                <linearGradient id="funnelGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#10b981" />
                  <stop offset="100%" stop-color="#047857" />
                </linearGradient>

                <filter id="funnelGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
        `;

        var centerX = 370;

        stages.forEach(function(stageName, idx) {
          var geom = stageGeometries[idx];
          var count = stageCounts[idx];
          var val = stageValues[idx];

          var x1 = centerX - (geom.topW / 2);
          var x2 = centerX + (geom.topW / 2);
          var x3 = centerX + (geom.botW / 2);
          var x4 = centerX - (geom.botW / 2);

          var pathD = `M ${x1} ${geom.y1} L ${x2} ${geom.y1} L ${x3} ${geom.y2} L ${x4} ${geom.y2} Z`;

          var isSelected = window.selectedFunnelStage === idx;
          var strokeAttr = isSelected ? 'stroke="#ffffff" stroke-width="4" filter="url(#funnelGlow)"' : 'stroke="rgba(255,255,255,0.45)" stroke-width="1.5"';

          var centerY = (geom.y1 + geom.y2) / 2;

          // Fixed Funnel Stage polygon path with high contrast stage label, total value and active deal count (NO conversion percentages!)
          svgHtml += `
            <g class="funnel-stage-group cursor-pointer group transition-all duration-200" onclick="selectFunnelStagePill(${idx})" onmouseenter="showFunnelTooltip(event, ${idx}, ${totalValSum})" onmouseleave="hideFunnelTooltip()">
              <path d="${pathD}" fill="url(#funnelGrad${idx})" ${strokeAttr} class="transition-all duration-300 group-hover:brightness-110 group-hover:scale-[1.01]" />
              
              <!-- High Contrast White Typography Overlay directly on funnel shape -->
              <text x="${centerX}" y="${centerY - 4}" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="900" letter-spacing="0.8" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.6));" class="pointer-events-none">
                ${stageName.toUpperCase()}
              </text>
              <text x="${centerX}" y="${centerY + 16}" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="800" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.6));" class="pointer-events-none">
                ${formatINR(val)} &bull; ${count} Deal${count !== 1 ? 's' : ''}
              </text>

              <!-- Step Number Badge on Left -->
              <g transform="translate(${x1 - 38}, ${centerY - 13})" class="pointer-events-none">
                <circle cx="13" cy="13" r="13" fill="rgba(15, 23, 42, 0.88)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
                <text x="13" y="17" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="900">#${idx + 1}</text>
              </g>
            </g>
          `;
        });

        svgHtml += `
            </svg>
            
            <!-- Floating Hover Tooltip -->
            <div id="funnel-tooltip" class="absolute hidden pointer-events-none z-30 bg-slate-900/95 text-white p-3.5 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md text-xs space-y-2 transform -translate-x-1/2 -translate-y-full transition-opacity duration-150 min-w-[240px]">
            </div>
          </div>
        `;

        container.innerHTML = svgHtml;

        // 4 KPI CARDS BELOW LIVE PIPELINE FUNNEL
        var statsContainer = document.getElementById('funnel-stats-row');
        if (statsContainer) {
          var avgDealVal = totalDealsSum > 0 ? (totalValSum / totalDealsSum) : 0;

          // Average deal age across active deals
          var totalAgeDays = 0;
          var totalActiveLeadsCount = 0;
          stages.forEach(function(stName, idx) {
            var leadsInStage = stageLeadsMap[idx] || [];
            leadsInStage.forEach(function(l) {
              totalAgeDays += getDealAgeDays(l);
              totalActiveLeadsCount++;
            });
          });
          var avgDealAgeDays = totalActiveLeadsCount > 0 ? Math.round(totalAgeDays / totalActiveLeadsCount) : 12;

          statsContainer.className = 'grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-100 text-left';
          statsContainer.innerHTML = `
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Pipeline Value</span>
              <span class="text-sm font-black text-slate-900 block">${formatINR(totalValSum)}</span>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Active Deals</span>
              <span class="text-sm font-black text-indigo-700 block">${totalDealsSum} Deals</span>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Average Deal Size</span>
              <span class="text-sm font-black text-sky-700 block">${formatINR(avgDealVal)}</span>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Average Deal Age</span>
              <span class="text-sm font-black text-amber-700 block">${avgDealAgeDays} Days</span>
            </div>
          `;
        }

        // If a stage was already clicked/selected, re-render its drilldown table
        if (window.selectedFunnelStage !== null && window.selectedFunnelStage !== undefined) {
          renderFunnelStageDrilldown(window.selectedFunnelStage);
        }
      }

      function showFunnelTooltip(e, idx, totalPipelineVal) {
        var tooltip = document.getElementById('funnel-tooltip');
        if (!tooltip) return;

        var stages = ['New Enquiry', 'Qualified', 'Quoted', 'Negotiation', 'Won'];
        var stageName = stages[idx];
        var leads = (window.activeFunnelLeadsMap && window.activeFunnelLeadsMap[idx]) || [];
        var count = leads.length;
        var valSum = leads.reduce((acc, l) => acc + (l.estimatedValue || l.expectedValue || l.dealValue || 0), 0);
        var avgDealVal = count > 0 ? (valSum / count) : 0;
        var stageAvgAge = getStageAvgDealAge(leads);
        var pctOfPipeline = totalPipelineVal > 0 ? ((valSum / totalPipelineVal) * 100).toFixed(1) : '0.0';

        tooltip.innerHTML = `
          <div class="font-extrabold text-sky-400 text-sm flex items-center justify-between border-b border-slate-700 pb-1.5 gap-3">
            <span>Stage: ${stageName}</span>
            <span class="text-[10px] bg-indigo-900/90 text-indigo-200 px-2 py-0.5 rounded-md font-bold">${pctOfPipeline}% of Pipeline</span>
          </div>
          <div class="space-y-1.5 pt-1 text-xs">
            <div class="flex justify-between items-center space-x-4">
              <span class="text-slate-300 font-medium">Active Deals:</span>
              <span class="font-black text-indigo-300">${count}</span>
            </div>
            <div class="flex justify-between items-center space-x-4">
              <span class="text-slate-300 font-medium">Pipeline Value:</span>
              <span class="font-black text-white">${formatINR(valSum)}</span>
            </div>
            <div class="flex justify-between items-center space-x-4">
              <span class="text-slate-300 font-medium">Average Deal Size:</span>
              <span class="font-black text-emerald-400">${formatINR(avgDealVal)}</span>
            </div>
            <div class="flex justify-between items-center space-x-4">
              <span class="text-slate-300 font-medium">Average Deal Age:</span>
              <span class="font-black text-amber-300">${stageAvgAge} Days</span>
            </div>
            <div class="flex justify-between items-center space-x-4">
              <span class="text-slate-300 font-medium">% of Total Pipeline Value:</span>
              <span class="font-black text-sky-300">${pctOfPipeline}%</span>
            </div>
          </div>
          <div class="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 italic text-center">
            Click stage to view deal breakdown
          </div>
        `;

        var rect = e.currentTarget.getBoundingClientRect();
        var parentRect = tooltip.parentElement.getBoundingClientRect();
        
        var topPos = rect.top - parentRect.top + (rect.height / 2);
        var leftPos = rect.left - parentRect.left + (rect.width / 2);

        tooltip.style.top = topPos + 'px';
        tooltip.style.left = leftPos + 'px';
        tooltip.classList.remove('hidden');
      }

      function hideFunnelTooltip() {
        var tooltip = document.getElementById('funnel-tooltip');
        if (tooltip) tooltip.classList.add('hidden');
      }

      // WIDGET 2: SALES CONVERSION FUNNEL (COHORT CONVERSION, STAGE HISTORY & MONOTONIC WIDTH RULES)
      function renderSalesConversionFunnel(leads, periodInfo) {
        var container = document.getElementById('salesConversionFunnelContainer');
        if (!container) return;

        var activeLeads = leads || [];
        var stages = ['New Enquiry', 'Qualified', 'Quoted', 'Negotiation', 'Won'];

        // Calculate stage history / progressive cohort counts
        var cCounts = [0, 0, 0, 0, 0];
        var cValues = [0, 0, 0, 0, 0];
        var lostInCohort = 0;
        var totalCohortSalesCycleDays = 0;
        var wonCohortCount = 0;
        var forecastRevenue = 0;

        activeLeads.forEach(function(l) {
          var st = l.status || l.stage || 'New Enquiry';
          var isLost = (st === 'Lost' || st === 'Closed Lost' || l.status === 'Lost');
          if (isLost) lostInCohort++;

          var idx = stages.indexOf(st);
          if (idx === -1) {
            if (st === 'In Discussion' || st === 'Qualified') idx = 1;
            else if (st === 'Quote Sent' || st === 'Quoted') idx = 2;
            else if (st === 'Won' || st === 'Closed Won') idx = 4;
            else idx = 0;
          }

          var val = l.estimatedValue || l.expectedValue || l.dealValue || 0;

          // Determine maximum stage reached in cohort progression
          var maxReached = idx;
          if (isLost) {
            maxReached = typeof l.lostAtStageIdx === 'number' ? l.lostAtStageIdx : Math.max(0, idx);
          }

          for (var i = 0; i <= maxReached; i++) {
            cCounts[i]++;
            cValues[i] += val;
          }

          if (idx === 4 && !isLost) {
            wonCohortCount++;
            totalCohortSalesCycleDays += getSalesCycleDays(l);
          } else if (!isLost) {
            var prob = getDealProbability(l, idx);
            forecastRevenue += val * prob;
          }
        });

        var c0 = cCounts[0];
        var c1 = cCounts[1];
        var c2 = cCounts[2];
        var c3 = cCounts[3];
        var c4 = cCounts[4];

        if (c0 === 0) {
          container.innerHTML = `
            <div class="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center space-y-2">
              <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 font-bold text-base flex items-center justify-center mx-auto">📊</div>
              <h3 class="text-sm font-extrabold text-slate-800">No Deals Created in Selected Period</h3>
              <p class="text-xs text-slate-500">Sales conversion analytics require deals created within the active filter date range.</p>
            </div>
          `;
          return;
        }

        // Validation Rule: New Enquiry >= Qualified >= Quoted >= Negotiation >= Won
        var isValid = (c0 >= c1 && c1 >= c2 && c2 >= c3 && c3 >= c4) && (c0 > 0);

        if (!isValid) {
          container.innerHTML = `
            <div class="bg-amber-50 border border-amber-200/80 p-6 rounded-2xl text-center space-y-2">
              <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-800 font-bold text-lg flex items-center justify-center mx-auto">⚠️</div>
              <h3 class="text-sm font-extrabold text-amber-900">Invalid Cohort Data</h3>
              <p class="text-xs font-semibold text-amber-800">Historical deals detected.</p>
              <p class="text-xs text-amber-700">Conversion Funnel cannot be calculated.</p>
            </div>
          `;
          return;
        }

        // Conversion % Calculations
        var overallConv = c0 > 0 ? (c4 / c0) * 100 : 0;
        var totalClosed = c4 + lostInCohort;
        var winRate = totalClosed > 0 ? (c4 / totalClosed) * 100 : (c0 > 0 ? (c4 / c0) * 100 : 0);
        var lossRate = totalClosed > 0 ? (lostInCohort / totalClosed) * 100 : 0;
        var avgSalesCycle = wonCohortCount > 0 ? Math.round(totalCohortSalesCycleDays / wonCohortCount) : 18;

        // Render Conversion Funnel Blocks with Widths Decreasing Automatically according to remaining deals (NEVER INCREASES)
        var maxW = 540;
        var minW = 120;

        var stageGeometries = stages.map(function(stName, idx) {
          var ratio = cCounts[idx] / c0;
          var nextRatio = idx < 4 ? (cCounts[idx + 1] / c0) : ratio * 0.7;

          var topW = Math.max(minW, Math.round(maxW * ratio));
          var botW = Math.max(minW - 20, Math.round(maxW * nextRatio));

          if (botW > topW) botW = topW; // Strict width decrease constraint

          var y1 = 10 + idx * 60;
          var y2 = y1 + 52;
          return { topW: topW, botW: botW, y1: y1, y2: y2 };
        });

        var svgHtml = `
          <div class="w-full relative select-none">
            <svg viewBox="0 0 600 310" class="w-full h-auto max-h-[320px] filter drop-shadow-md overflow-visible">
              <defs>
                <linearGradient id="convGrad0" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient>
                <linearGradient id="convGrad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4338ca"/></linearGradient>
                <linearGradient id="convGrad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/></linearGradient>
                <linearGradient id="convGrad3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
                <linearGradient id="convGrad4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#047857"/></linearGradient>
              </defs>
        `;

        var centerX = 300;
        stages.forEach(function(stName, idx) {
          var geom = stageGeometries[idx];
          var count = cCounts[idx];
          var overallPct = ((count / c0) * 100).toFixed(1);

          var x1 = centerX - (geom.topW / 2);
          var x2 = centerX + (geom.topW / 2);
          var x3 = centerX + (geom.botW / 2);
          var x4 = centerX - (geom.botW / 2);

          var pathD = `M ${x1} ${geom.y1} L ${x2} ${geom.y1} L ${x3} ${geom.y2} L ${x4} ${geom.y2} Z`;
          var centerY = (geom.y1 + geom.y2) / 2;

          svgHtml += `
            <g class="funnel-conv-group cursor-pointer group">
              <path d="${pathD}" fill="url(#convGrad${idx})" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" class="transition-all duration-300 group-hover:brightness-110" />
              <text x="${centerX}" y="${centerY - 2}" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="900" letter-spacing="0.5" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.6));" class="pointer-events-none">
                ${stName.toUpperCase()}
              </text>
              <text x="${centerX}" y="${centerY + 14}" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="800" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.6));" class="pointer-events-none">
                ${count} Deals (${overallPct}%)
              </text>
            </g>
          `;
        });

        svgHtml += `</svg></div>`;

        // Step-by-Step Transition Cards
        var transitionsHtml = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">`;
        for (var idx = 0; idx < 4; idx++) {
          var fromName = stages[idx];
          var toName = stages[idx + 1];
          var prevC = cCounts[idx];
          var curC = cCounts[idx + 1];

          var stepConv = prevC > 0 ? ((curC / prevC) * 100).toFixed(1) : '0.0';
          var stepDrop = prevC > 0 ? (((prevC - curC) / prevC) * 100).toFixed(1) : '0.0';

          transitionsHtml += `
            <div class="bg-slate-50 border border-slate-200 p-2 rounded-xl text-left space-y-1">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-tight truncate">${fromName} &rarr; ${toName}</span>
              <div class="flex items-center justify-between text-xs font-black">
                <span class="text-emerald-700">${stepConv}% Conv</span>
                <span class="text-rose-600">${stepDrop}% Drop</span>
              </div>
            </div>
          `;
        }
        transitionsHtml += `</div>`;

        // 5 KPI Cards for Conversion Funnel
        var kpiHtml = `
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-100 text-left">
            <div class="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Overall Conversion</span>
              <span class="text-sm font-black text-emerald-700 block">${overallConv.toFixed(1)}%</span>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Win Rate</span>
              <span class="text-sm font-black text-indigo-700 block">${winRate.toFixed(1)}%</span>
            </div>
            <div class="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">Loss Rate</span>
              <span class="text-sm font-black text-rose-700 block">${lossRate.toFixed(1)}%</span>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Avg Sales Cycle</span>
              <span class="text-sm font-black text-purple-700 block">${avgSalesCycle} Days</span>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5 col-span-2 sm:col-span-1">
              <span class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Forecast Revenue</span>
              <span class="text-sm font-black text-teal-700 block">${formatINR(forecastRevenue)}</span>
            </div>
          </div>
        `;

        container.innerHTML = svgHtml + transitionsHtml + kpiHtml;
      }

      function onFunnelStageClick(idx) {
        if (window.selectedFunnelStage === idx) {
          window.selectedFunnelStage = null;
          var box = document.getElementById('funnel-drilldown-box');
          if (box) box.classList.add('hidden');
        } else {
          window.selectedFunnelStage = idx;
          renderFunnelStageDrilldown(idx);
        }
        if (window.masterFunnelLeads) {
          renderPipelineFunnelChart(window.masterFunnelLeads, true);
        }
      }

      function renderFunnelStageDrilldown(idx) {
        var box = document.getElementById('funnel-drilldown-box');
        if (!box) return;

        var stages = ['New Enquiry', 'Qualified', 'Quoted', 'Negotiation', 'Won'];
        var stageName = stages[idx];
        var leads = (window.activeFunnelLeadsMap && window.activeFunnelLeadsMap[idx]) || [];

        if (!leads || leads.length === 0) {
          box.innerHTML = `
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
              No active deals found in <strong class="text-slate-800">${stageName}</strong> stage for this vertical selection.
            </div>
          `;
          box.classList.remove('hidden');
          return;
        }

        var rowsHtml = '';
        leads.forEach(function(l) {
          var val = l.estimatedValue || l.expectedValue || l.dealValue || 0;
          rowsHtml += `
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-2 px-3 font-bold text-slate-900">${l.customerName || 'N/A'}</td>
              <td class="py-2 px-3 font-semibold text-slate-600 text-xs">${l.subVertical || l.vertical || 'Sales'}</td>
              <td class="py-2 px-3 font-extrabold text-indigo-700">${formatINR(val)}</td>
              <td class="py-2 px-3 font-medium text-slate-600 text-xs">${l.contactPerson || l.salesRep || 'Sales Owner'}</td>
              <td class="py-2 px-3 text-slate-500 text-xs">${l.followUpDate || l.createdDate || '-'}</td>
            </tr>
          `;
        });

        box.innerHTML = `
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <div class="flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                <span class="text-xs font-extrabold text-slate-900">Stage Deals: ${stageName}</span>
                <span class="bg-indigo-100 text-indigo-800 font-black text-[10px] px-2 py-0.5 rounded-full">${leads.length} Deals</span>
              </div>
              <button onclick="onFunnelStageClick(${idx})" class="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                ✕ Close
              </button>
            </div>
            
            <div class="max-h-48 overflow-y-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-200/60 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th class="py-1.5 px-3">Customer</th>
                    <th class="py-1.5 px-3">Vertical</th>
                    <th class="py-1.5 px-3">Value</th>
                    <th class="py-1.5 px-3">Contact/Rep</th>
                    <th class="py-1.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
        box.classList.remove('hidden');
      }

      // CHART 4: TEAM MEMBER CONTRIBUTION
      function renderTeamContributionChart(employees, empAchievedMap, selectedFy, periodRatio, periodInfo) {
        var ctx = document.getElementById('teamContributionChart').getContext('2d');
        if (chartTeamContribution) chartTeamContribution.destroy();

        var kras = window.RevOpsStore.getCollection('kraTargets') || [];

        var labels = [];
        var achievedData = [];
        var targetData = [];

        employees.forEach(function(emp) {
          if (emp.employeeId === 'E-001') return; // Exclude MD E-001

          labels.push(emp.fullName.split(' ')[0] + ' (' + emp.employeeId + ')');

          var ach = Number(empAchievedMap[emp.employeeId]) || 0;
          achievedData.push(ach);

          // Calculate Target for selected FY & period ratio
          var annualTgt = getEmployeeTarget(emp, selectedFy, kras);
          var periodTgt = Math.round(annualTgt * (periodRatio || 1.0));
          targetData.push(periodTgt);
        });

        var shortLabel = (periodInfo && periodInfo.shortLabel) ? periodInfo.shortLabel : 'Period';

        chartTeamContribution = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: shortLabel + ' Achieved (₹)',
                data: achievedData,
                backgroundColor: '#4f46e5',
                borderRadius: 6
              },
              {
                label: shortLabel + ' Target (₹)',
                data: targetData,
                backgroundColor: '#cbd5e1',
                borderRadius: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: function(ctx) { return ctx.dataset.label + ': ' + formatINR(ctx.raw); }
                }
              }
            },
            scales: {
              x: { ticks: { font: { size: 10 } } },
              y: {
                beginAtZero: true,
                ticks: {
                  font: { size: 10 },
                  callback: function(v) { return '₹' + (v / 1e5).toFixed(0) + 'L'; }
                }
              }
            }
          }
        });
      }

      // Render Live Multi-User Activity Stream (Feature 4)
      function renderLiveActivityStream() {
        var container = document.getElementById('live-activity-stream-list');
        if (!container) return;

        var filter = document.getElementById('activity-type-filter')?.value || 'All';

        var dwm = window.RevOpsStore.getCollection('dwmActivities') || [];
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var payments = window.RevOpsStore.getCollection('payments') || [];
        var attendance = window.RevOpsStore.getCollection('attendance') || [];
        var emps = window.RevOpsStore.getCollection('employees') || [];

        var empMap = {};
        emps.forEach(function(e) { empMap[e.employeeId] = e.fullName || e.name; });

        var stream = [];

        if (filter === 'All' || filter === 'DWM') {
          dwm.slice(-10).reverse().forEach(function(d) {
            stream.push({
              type: 'DWM Log',
              badgeClass: 'bg-indigo-950 text-indigo-300 border-indigo-700/50',
              title: d.activityName || d.title || 'DWM Task Activity',
              empName: empMap[d.employeeId] || d.employeeId || 'Team Member',
              subtitle: (d.vertical || 'RevOps') + ' • ' + (d.status || 'Completed'),
              dateStr: d.date || 'Today',
              icon: '📅'
            });
          });
        }

        if (filter === 'All' || filter === 'Orders') {
          orders.slice(-10).reverse().forEach(function(o) {
            stream.push({
              type: 'Order',
              badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-700/50',
              title: 'Order #' + (o.poNumber || o.orderId || o.id) + ' — ' + (o.customerName || 'Customer'),
              empName: empMap[o.employeeId] || o.employeeId || 'Sales Lead',
              subtitle: 'Amount: ₹' + (Number(o.orderValue || o.amount) || 0).toLocaleString('en-IN') + ' • ' + (o.vertical || 'Sales'),
              dateStr: window.RevOpsStore.getOrderDate(o) || o.date || 'Today',
              icon: '📦'
            });
          });
        }

        if (filter === 'All' || filter === 'Payments') {
          payments.slice(-10).reverse().forEach(function(p) {
            stream.push({
              type: 'Payment AR',
              badgeClass: 'bg-sky-950 text-sky-300 border-sky-700/50',
              title: 'Payment Collection — ' + (p.customerName || 'Customer AR'),
              empName: empMap[p.employeeId] || p.employeeId || 'Accounts Lead',
              subtitle: 'Collected: ₹' + (Number(p.amount) || 0).toLocaleString('en-IN') + ' • ' + (p.paymentMode || 'Bank Transfer'),
              dateStr: p.paymentDate || 'Today',
              icon: '💳'
            });
          });
        }

        if (filter === 'All' || filter === 'Attendance') {
          attendance.slice(-10).reverse().forEach(function(a) {
            stream.push({
              type: 'Attendance',
              badgeClass: 'bg-amber-950 text-amber-300 border-amber-700/50',
              title: 'Punch Log: ' + (a.status || 'Present'),
              empName: empMap[a.employeeId] || a.employeeId || 'Staff Member',
              subtitle: 'In: ' + (a.checkIn || '09:00 AM') + ' • Out: ' + (a.checkOut || '06:30 PM'),
              dateStr: a.date || 'Today',
              icon: '⏰'
            });
          });
        }

        if (stream.length === 0) {
          container.innerHTML = `<div class="col-span-3 text-center py-6 text-slate-500 text-xs">No activity stream logs recorded yet.</div>`;
          return;
        }

        var html = stream.slice(0, 6).map(function(item) {
          return `
            <div class="bg-slate-800/70 p-3.5 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-all flex items-start space-x-3">
              <div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-sm shrink-0 border border-slate-700">
                ${item.icon}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <h4 class="text-xs font-bold text-white truncate">${item.title}</h4>
                  <span class="text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold border shrink-0 ${item.badgeClass}">${item.type}</span>
                </div>
                <p class="text-[11px] text-slate-300 font-semibold mt-0.5 truncate">${item.empName}</p>
                <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span class="truncate">${item.subtitle}</span>
                  <span class="shrink-0 font-mono text-slate-400">${item.dateStr}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');

        container.innerHTML = html;
      }

