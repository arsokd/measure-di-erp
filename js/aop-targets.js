document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['super_admin', 'admin'])) {
          renderAopData();
        }
      });

      function renderAopData() {
        var fy = document.getElementById('fy-select').value;
        var aopTargets = window.RevOpsStore.getCollection('aopTargets') || [];
        var orders = window.RevOpsStore.getCollection('orders') || [];

        // FY Benchmark Default Rules (Indian Financial Year Apr-Mar):
        // FY 2024-25: Company Target = ₹8 Crore (80M) - Full Year
        // FY 2025-26: Company Target = ₹10 Crore (100M) - Full Year
        // FY 2026-27: Company Target = ₹6.67 Crore (66.67M) - 4 Months Pro-Rata (Apr-Jul 2026 elapsed)
        // All FYs: Company Target = ₹24.67 Crore (246.67M) - Combined Total
        var fyDefaults = {
          '2024-25': { company: 80000000, sales: 20000000, service: 60000000, projects: 0, sub: 'Full Year Target (12 Months)' },
          '2025-26': { company: 100000000, sales: 25000000, service: 75000000, projects: 0, sub: 'Full Year Target (12 Months)' },
          '2026-27': { company: 66666667, sales: 16666667, service: 50000000, projects: 0, sub: '4 Months Pro-Rata Target (Apr-Jul)' },
          'All':     { company: 246666667, sales: 61666667, service: 185000000, projects: 0, sub: 'Combined All FYs Target' }
        };

        var curDefault = fyDefaults[fy] || fyDefaults['2025-26'];

        // 1. Determine Company & Vertical Targets for selected FY
        var customRecord = aopTargets.find(function(a) { 
          return (fy === 'All' || a.financialYear === fy) && (a.companyTarget !== undefined || a.verticalTargets !== undefined); 
        });

        var companyTarget = curDefault.company;
        var verticalTargets = {
          "Sales": curDefault.sales,
          "Service/Parts": curDefault.service,
          "Projects": curDefault.projects
        };

        if (customRecord) {
          if (customRecord.companyTarget !== undefined) companyTarget = customRecord.companyTarget;
          if (customRecord.verticalTargets) {
            verticalTargets["Sales"] = customRecord.verticalTargets["Sales"] !== undefined ? customRecord.verticalTargets["Sales"] : curDefault.sales;
            verticalTargets["Service/Parts"] = customRecord.verticalTargets["Service/Parts"] !== undefined ? customRecord.verticalTargets["Service/Parts"] : curDefault.service;
            verticalTargets["Projects"] = customRecord.verticalTargets["Projects"] !== undefined ? customRecord.verticalTargets["Projects"] : curDefault.projects;
          }
        } else {
          // Look up from default AOP line items for this FY
          var companyItem = aopTargets.find(function(a) { 
            return (fy === 'All' || a.financialYear === fy) && a.lineItem && a.lineItem.indexOf('Company Total') !== -1; 
          });
          if (companyItem && companyItem.annualTarget) {
            companyTarget = companyItem.annualTarget;
          }

          var salesItem = aopTargets.find(function(a) { 
            return (fy === 'All' || a.financialYear === fy) && a.lineItem === 'Sales Vertical Revenue'; 
          });
          if (salesItem && salesItem.annualTarget) {
            verticalTargets["Sales"] = salesItem.annualTarget;
          }

          var serviceItem = aopTargets.find(function(a) { 
            return (fy === 'All' || a.financialYear === fy) && a.lineItem && a.lineItem.indexOf('Service/Parts') !== -1; 
          });
          if (serviceItem && serviceItem.annualTarget) {
            verticalTargets["Service/Parts"] = serviceItem.annualTarget;
          }
        }

        if (fy === 'All') {
          var companySum = 0;
          aopTargets.forEach(function(a) {
            if (a.lineItem && a.lineItem.indexOf('Company Total') !== -1) {
              companySum += (Number(a.annualTarget) || 0);
            }
          });
          if (companySum > 0) companyTarget = companySum;
        }

        document.getElementById('inp-company-aop').value = companyTarget;

        // 2. Calculate Actual Won Orders per vertical for selected FY
        var actuals = {
          "Sales": 0,
          "Service/Parts": 0,
          "Projects": 0
        };

        var totalWonRevenue = 0;

        orders.forEach(function(o) {
          if (window.RevOpsStore.isOrderWon(o)) {
            var ordFy = typeof getFinancialYear === 'function' ? getFinancialYear(window.RevOpsStore.getOrderDate(o)) : '2026-27';
            if (fy !== 'All' && ordFy !== fy) return;
            var val = Number(o.orderValue) || 0;
            totalWonRevenue += val;

            var rawV = o.vertical || "Sales";
            var v = "Sales";
            if (rawV.indexOf("Service") !== -1 || rawV.indexOf("Parts") !== -1) {
              v = "Service/Parts";
            } else if (rawV.indexOf("Projects") !== -1) {
              v = "Projects";
            } else if (rawV === "Sales") {
              v = "Sales";
            }
            actuals[v] = (actuals[v] || 0) + val;
          }
        });

        // 2b. Render KPI Cards
        var overallPct = companyTarget > 0 ? ((totalWonRevenue / companyTarget) * 100).toFixed(1) : 0;
        document.getElementById('kpi-aop-target').innerText = formatINR(companyTarget);
        document.getElementById('kpi-aop-target-sub').innerText = curDefault.sub || (fy === 'All' ? 'Combined All FYs Target' : 'FY ' + fy + ' Target');
        document.getElementById('kpi-aop-actual').innerText = formatINR(totalWonRevenue);
        document.getElementById('kpi-aop-actual-sub').innerText = 'Won Orders (' + (fy === 'All' ? 'All FYs' : 'FY ' + fy) + ')';
        document.getElementById('kpi-aop-pct').innerText = overallPct + '%';

        var badgeEl = document.getElementById('kpi-aop-status-badge');
        var barEl = document.getElementById('kpi-aop-bar');
        
        if (overallPct >= 100) {
          badgeEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800";
          badgeEl.innerText = "Target Exceeded (" + overallPct + "%)";
          barEl.className = "bg-emerald-500 h-2 rounded-full";
        } else if (overallPct >= 70) {
          badgeEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800";
          badgeEl.innerText = "On Track (" + overallPct + "%)";
          barEl.className = "bg-amber-500 h-2 rounded-full";
        } else {
          badgeEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800";
          badgeEl.innerText = "Behind Target (" + overallPct + "%)";
          barEl.className = "bg-rose-500 h-2 rounded-full";
        }
        barEl.style.width = Math.min(overallPct, 100) + '%';

        // 3. Render Vertical Targets vs Actuals Table
        var tbody = document.getElementById('aop-verticals-tbody');
        tbody.innerHTML = "";

        var verticals = ["Sales", "Service/Parts", "Projects"];
        verticals.forEach(function(v) {
          var target = verticalTargets[v] || 10000000;
          var won = actuals[v] || 0;
          var pct = target > 0 ? Math.round((won / target) * 100) : 0;

          var pColor = "bg-rose-500";
          if (pct >= 90) pColor = "bg-emerald-500";
          else if (pct >= 70) pColor = "bg-amber-500";

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-slate-900">${v}</td>
            <td class="py-3 px-4 text-right font-black text-slate-900">${formatINR(target)}</td>
            <td class="py-3 px-4 text-right font-black text-indigo-600">${formatINR(won)}</td>
            <td class="py-3 px-4">
              <div class="flex items-center space-x-2">
                <div class="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div class="${pColor} h-2 rounded-full" style="width: ${Math.min(pct, 100)}%"></div>
                </div>
                <span class="text-xs font-bold text-slate-700 w-10 text-right">${pct}%</span>
              </div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pct >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                ${pct >= 100 ? 'Achieved' : (pct >= 70 ? 'On Track' : 'Lagging')}
              </span>
            </td>
          `;
          tbody.appendChild(tr);
        });

        // 4. Populate Master AOP Top Sheet Table (Tab 3 Data)
        var topSheetTbody = document.getElementById('aop-topsheet-tbody');
        if (topSheetTbody) {
          topSheetTbody.innerHTML = "";
          var employees = window.RevOpsStore.getCollection('employees') || [];
          
          var filteredAop = aopTargets.filter(function(a) {
            if (!a.lineItem && !a.vertical) return false;
            return fy === 'All' || (a.financialYear || '2025-26') === fy;
          });

          if (filteredAop.length === 0) {
            topSheetTbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">No AOP top sheet items found for selected FY (${fy}).</td></tr>`;
          } else {
            filteredAop.forEach(function(item) {
              var ownerEmp = employees.find(function(e) { return e.employeeId === item.ownerEmployeeId; });
              var ownerName = ownerEmp ? ownerEmp.fullName : (item.ownerEmployeeId || 'MD');
              var ownerDesig = ownerEmp ? ownerEmp.designation : '';

              var tr = document.createElement('tr');
              tr.className = "hover:bg-slate-50 transition-colors";
              tr.innerHTML = `
                <td class="py-3 px-4 font-bold text-slate-900">${escapeHtml(item.lineItem || item.vertical || 'AOP Line')}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">${escapeHtml(item.vertical || 'Sales')}</span>
                </td>
                <td class="py-3 px-4 text-slate-600 max-w-xs truncate" title="${escapeHtml(item.subVertical || '')}">${escapeHtml(item.subVertical || '--')}</td>
                <td class="py-3 px-4 text-right font-black text-slate-900">${formatINR(item.annualTarget || 0)}</td>
                <td class="py-3 px-4">
                  <div class="font-bold text-indigo-700">${escapeHtml(ownerName)} (${escapeHtml(item.ownerEmployeeId || 'E-001')})</div>
                  <div class="text-[10px] text-slate-500">${escapeHtml(ownerDesig)}</div>
                </td>
                <td class="py-3 px-4 text-slate-600">
                  <div class="font-medium text-slate-800 text-[11px]">${escapeHtml(item.rollupType || 'Leaf target')}</div>
                  <div class="text-[10px] text-slate-400 truncate max-w-xs" title="${escapeHtml(item.splitBasis || item.notes || '')}">${escapeHtml(item.splitBasis || item.notes || '')}</div>
                </td>
              `;
              topSheetTbody.appendChild(tr);
            });
          }
        }
      }

      function handleSaveCompanyAop(e) {
        e.preventDefault();
        var fy = document.getElementById('fy-select').value;
        if (fy === 'All') fy = '2025-26';
        var val = Number(document.getElementById('inp-company-aop').value) || 200000000;

        var aopTargets = window.RevOpsStore.getCollection('aopTargets') || [];
        var customRecord = aopTargets.find(function(a) { return a.financialYear === fy && (a.companyTarget !== undefined || a.verticalTargets !== undefined); });

        if (customRecord) {
          window.RevOpsStore.updateItem('aopTargets', customRecord.id, { companyTarget: val });
        } else {
          window.RevOpsStore.addItem('aopTargets', {
            financialYear: fy,
            companyTarget: val,
            verticalTargets: { "Sales": 50000000, "Service/Parts": 150000000, "Projects": 30000000 }
          });
        }

        var companyItem = aopTargets.find(function(a) { return a.financialYear === fy && a.lineItem && a.lineItem.indexOf('Company Total') !== -1; });
        if (companyItem) {
          window.RevOpsStore.updateItem('aopTargets', companyItem.id, { annualTarget: val });
        }

        alert("Company AOP Target benchmark updated for FY " + fy + "!");
        renderAopData();
      }

      function openVerticalAopModal() {
        var fy = document.getElementById('fy-select').value;
        if (fy === 'All') fy = '2025-26';
        var aopTargets = window.RevOpsStore.getCollection('aopTargets') || [];
        var customRecord = aopTargets.find(function(a) { return a.financialYear === fy && (a.companyTarget !== undefined || a.verticalTargets !== undefined); });

        var vt = customRecord ? (customRecord.verticalTargets || {}) : {};
        
        var salesItem = aopTargets.find(function(a) { return a.financialYear === fy && a.lineItem === 'Sales Vertical Revenue'; });
        var serviceItem = aopTargets.find(function(a) { return a.financialYear === fy && a.lineItem && a.lineItem.indexOf('Service/Parts') !== -1; });

        document.getElementById('inp-vert-sales').value = vt["Sales"] || (salesItem ? salesItem.annualTarget : 50000000);
        document.getElementById('inp-vert-service').value = vt["Service/Parts"] || (serviceItem ? serviceItem.annualTarget : 150000000);
        document.getElementById('inp-vert-projects').value = vt["Projects"] || 30000000;

        document.getElementById('vertical-aop-modal').classList.remove('hidden');
      }

      function closeVerticalAopModal() {
        document.getElementById('vertical-aop-modal').classList.add('hidden');
      }

      function handleSaveVerticalAop(e) {
        e.preventDefault();
        var fy = document.getElementById('fy-select').value;
        if (fy === 'All') fy = '2025-26';
        var vt = {
          "Sales": Number(document.getElementById('inp-vert-sales').value) || 0,
          "Service/Parts": Number(document.getElementById('inp-vert-service').value) || 0,
          "Projects": Number(document.getElementById('inp-vert-projects').value) || 0
        };

        var aopTargets = window.RevOpsStore.getCollection('aopTargets') || [];
        var customRecord = aopTargets.find(function(a) { return a.financialYear === fy && (a.companyTarget !== undefined || a.verticalTargets !== undefined); });

        if (customRecord) {
          window.RevOpsStore.updateItem('aopTargets', customRecord.id, { verticalTargets: vt });
        } else {
          window.RevOpsStore.addItem('aopTargets', {
            financialYear: fy,
            companyTarget: 200000000,
            verticalTargets: vt
          });
        }

        var salesItem = aopTargets.find(function(a) { return a.financialYear === fy && a.lineItem === 'Sales Vertical Revenue'; });
        if (salesItem) window.RevOpsStore.updateItem('aopTargets', salesItem.id, { annualTarget: vt["Sales"] });

        var serviceItem = aopTargets.find(function(a) { return a.financialYear === fy && a.lineItem && a.lineItem.indexOf('Service/Parts') !== -1; });
        if (serviceItem) window.RevOpsStore.updateItem('aopTargets', serviceItem.id, { annualTarget: vt["Service/Parts"] });

        closeVerticalAopModal();
        renderAopData();
      }
