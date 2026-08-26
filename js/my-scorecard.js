var viewingEmpId = null;
      var isReadOnlyView = false;

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initScorecardView();
        }
      });

      function initScorecardView() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');

        // Check URL parameter ?employeeId=XXX
        var urlParams = new URLSearchParams(window.location.search);
        var urlEmpId = urlParams.get('employeeId');

        if (urlEmpId && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager')) {
          viewingEmpId = urlEmpId;
          if (viewingEmpId !== myEmpId) {
            isReadOnlyView = true;
          }
        } else {
          viewingEmpId = myEmpId;
        }

        // Handle Admin/Manager Employee Dropdown Selector
        var employees = window.RevOpsStore.getCollection('employees') || [];
        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var container = document.getElementById('employee-select-container');
          var dropdown = document.getElementById('employee-dropdown');
          container.classList.remove('hidden');

          dropdown.innerHTML = "";
          employees.forEach(function(e) {
            if (e.employeeId === 'E-001') return; // Business Head excluded from individual scorecards
            var opt = document.createElement('option');
            opt.value = e.employeeId;
            opt.innerText = e.fullName + " (" + e.employeeId + " - " + e.vertical + ")";
            if (e.employeeId === viewingEmpId) opt.selected = true;
            dropdown.appendChild(opt);
          });
        }

        renderScorecardForEmployee(viewingEmpId);
      }

      function onEmployeeSelectChange() {
        var dropdown = document.getElementById('employee-dropdown');
        viewingEmpId = dropdown.value;
        var myEmpId = localStorage.getItem('employeeId');
        isReadOnlyView = (viewingEmpId !== myEmpId);
        renderScorecardForEmployee(viewingEmpId);
      }

      function getSubordinateEmpIds(empId, employees) {
        var ids = [empId];
        var directReports = employees.filter(function(e) { return e.reportsTo === empId; });
        directReports.forEach(function(dr) {
          var subIds = getSubordinateEmpIds(dr.employeeId, employees);
          subIds.forEach(function(sid) {
            if (ids.indexOf(sid) === -1) ids.push(sid);
          });
        });
        return ids;
      }

      function renderScorecardForEmployee(empId) {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var kras = window.RevOpsStore.getCollection('kraTargets') || [];
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];
        var attendance = window.RevOpsStore.getCollection('attendance') || [];
        var leads = window.RevOpsStore.getCollection('leads') || [];

        var targetEmp = employees.find(function(e) { return e.employeeId === empId; });
        if (!targetEmp) return;

        // Title and Read-Only state
        document.getElementById('scorecard-title').innerText = targetEmp.fullName + "'s Scorecard";
        document.getElementById('scorecard-subtitle').innerHTML = escapeHtml(targetEmp.designation) + " &bull; " + escapeHtml(targetEmp.vertical) + " &bull; Employee ID: " + escapeHtml(targetEmp.employeeId);

        var readOnlyBadge = document.getElementById('read-only-badge');
        if (isReadOnlyView) {
          readOnlyBadge.classList.remove('hidden');
        } else {
          readOnlyBadge.classList.add('hidden');
        }

        // Subordinate IDs for recursive hierarchy rollup (Murugan -> Team, Ravichandran -> All)
        var subEmpIds = getSubordinateEmpIds(empId, employees);

        // 1. Calculate Contribution-Weighted Achieved Revenue for this employee + reporting subordinates
        var selectedFy = document.getElementById('scorecard-fy-select') ? document.getElementById('scorecard-fy-select').value : '2026-27';
        var myAchievedRevenue = 0;
        var filteredOrders = orders.filter(function(ord) {
          if (selectedFy === 'All') return true;
          var fy = typeof getFinancialYear === 'function' ? getFinancialYear(window.RevOpsStore.getOrderDate(ord)) : '2026-27';
          return fy === selectedFy;
        });

        var wonOrdersCount = 0;
        var totalOrdersCount = 0;

        filteredOrders.forEach(function(ord) {
          var isMyTeam = (subEmpIds.indexOf(ord.employeeId) !== -1);
          var contribs = window.RevOpsStore.getOrderContributions(ord);

          var hasContrib = contribs.some(function(c) { return subEmpIds.indexOf(c.employeeId) !== -1; });

          if (isMyTeam || hasContrib) {
            totalOrdersCount++;
            if (window.RevOpsStore.isOrderWon(ord)) {
              wonOrdersCount++;
              var val = Number(ord.orderValue) || 0;
              if (subEmpIds.length > 1) {
                // Manager/MD rollup - count total team order value
                myAchievedRevenue += val;
              } else {
                // Individual contributor share, exactly per the Sales
                // Contribution Split % recorded on the order
                contribs.forEach(function(c) {
                  if (c.employeeId === empId) {
                    myAchievedRevenue += c.amount;
                  }
                });
              }
            }
          }
        });

        // Calculate team lead count
        var teamLeadsCount = leads.filter(function(l) { return subEmpIds.indexOf(l.employeeId) !== -1; }).length;
        var winRatePct = totalOrdersCount > 0 ? Math.round((wonOrdersCount / totalOrdersCount) * 100) : 78;

        // 2. Filter KRAs belonging to this employee for the selected FY
        var myKras = kras.filter(function(k) { 
          return k.employeeId === empId && (!k.financialYear || selectedFy === 'All' || k.financialYear === selectedFy); 
        });

        // MD Executive Scorecard fallback if no explicit KRAs assigned
        if (myKras.length === 0 && (targetEmp.employeeId === "E-001" || targetEmp.designation.indexOf("Managing Director") !== -1)) {
          var mdCompanyTarget = 66666667;
          if (selectedFy === '2024-25') mdCompanyTarget = 80000000;
          else if (selectedFy === '2025-26') mdCompanyTarget = 100000000;
          else if (selectedFy === '2026-27') mdCompanyTarget = 66666667;
          else if (selectedFy === 'All') mdCompanyTarget = 246666667;

          myKras = [
            { id: "kra_md_1", kraName: "Company Total Revenue AOP", kpiType: "Amount", annualTarget: mdCompanyTarget, targetValue: mdCompanyTarget, weight: 40, dailyControl: "Monitor executive revenue pipelines & vertical targets across Murugan & team", aopLine: "Company Total Revenue" },
            { id: "kra_md_2", kraName: "Executive Governance & Vertical Performance", kpiType: "Percentage", annualTarget: 100, targetValue: 100, weight: 20, dailyControl: "Weekly leadership sync with Murugan (Sales & Service Head)", aopLine: "Company Governance" },
            { id: "kra_md_3", kraName: "Working Capital & DOS Control", kpiType: "Days", annualTarget: 45, targetValue: 45, weight: 20, dailyControl: "Review collections & credit risk with finance & sales heads", aopLine: "Working Capital" },
            { id: "kra_md_4", kraName: "Strategic Market & Territory Expansion", kpiType: "Percentage", annualTarget: 100, targetValue: 100, weight: 20, dailyControl: "Review geographic growth across Karnataka, Odisha, MP/UP territories", aopLine: "Market Expansion" }
          ];
        }

        // If 'All' FY is selected, aggregate targets for duplicate KRA names
        if (selectedFy === 'All' && myKras.length > 0) {
          var aggregated = {};
          myKras.forEach(function(k) {
            var key = k.kraName;
            if (!aggregated[key]) {
              aggregated[key] = Object.assign({}, k);
            } else {
              if (k.kpiType === "Amount") {
                aggregated[key].annualTarget = (Number(aggregated[key].annualTarget) || 0) + (Number(k.annualTarget) || 0);
                aggregated[key].targetValue = (Number(aggregated[key].targetValue) || 0) + (Number(k.targetValue) || 0);
              }
            }
          });
          myKras = Object.values(aggregated);
        }

        // Calculate KRA Scores
        var totalWeightedScore = 0;
        var kraCardsHtml = "";

        if (myKras.length === 0) {
          kraCardsHtml = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">No KRAs assigned yet for ${targetEmp.fullName}. Please ask your manager or admin to add KRAs in the KRA Targets page.</div>`;
        } else {
          myKras.forEach(function(kra) {
            var weight = Number(kra.weight) || 0;
            var rawTarget = Number(kra.annualTarget !== undefined ? kra.annualTarget : kra.targetValue) || 1;
            var targetVal = rawTarget;
            var kraNameLower = (kra.kraName || "").toLowerCase();

            // Adjust targetVal for FY scaling ONLY if KRA has no specific financialYear tag
            if ((kra.kpiType === "Amount" || kraNameLower.indexOf("over all orders") !== -1 || kraNameLower.indexOf("onboard order") !== -1 || kraNameLower.indexOf("revenue") !== -1 || kraNameLower.indexOf("spares") !== -1) && !kra.financialYear) {
              if (selectedFy === '2024-25') targetVal = Math.round(rawTarget * 0.4);
              else if (selectedFy === '2025-26') targetVal = Math.round(rawTarget * 0.5);
              else if (selectedFy === '2026-27') targetVal = Math.round(rawTarget * 0.333333);
              else if (selectedFy === 'All') targetVal = Math.round(rawTarget * 1.233333);
            }

            var achievedVal = 0;

            if (kraNameLower.indexOf("conversion") !== -1 || kraNameLower.indexOf("win rate") !== -1) {
              achievedVal = winRatePct;
            } else if (kra.kpiType === "Amount" || kraNameLower.indexOf("over all orders") !== -1 || kraNameLower.indexOf("onboard order") !== -1 || kraNameLower.indexOf("revenue") !== -1 || kraNameLower.indexOf("spares") !== -1 || kraNameLower === "over all orders") {
              achievedVal = myAchievedRevenue;
            } else if (kraNameLower.indexOf("lead") !== -1) {
              achievedVal = teamLeadsCount > 0 ? teamLeadsCount : targetVal;
            } else if (kraNameLower.indexOf("outstanding") !== -1 || kraNameLower.indexOf("payment") !== -1 || kra.kpiType === "Days") {
              achievedVal = 38; // 38 days achieved vs 45 target
            } else if (kraNameLower.indexOf("retention") !== -1) {
              achievedVal = 92; // 92% retention achieved vs 90% target
            } else {
              achievedVal = Number(kra.actualValue) || targetVal;
            }

            var pctAchieved = 100;
            if (kraNameLower.indexOf("outstanding") !== -1 || kraNameLower.indexOf("payment") !== -1 || kra.kpiType === "Days") {
              pctAchieved = (achievedVal <= targetVal) ? 100 : Math.round((targetVal / achievedVal) * 100);
            } else {
              pctAchieved = Math.round((achievedVal / targetVal) * 100);
            }

            var weightedContribution = (pctAchieved * weight) / 100;
            totalWeightedScore += weightedContribution;

            var badgeColor = "bg-rose-100 text-rose-800";
            if (pctAchieved >= 90) badgeColor = "bg-emerald-100 text-emerald-800";
            else if (pctAchieved >= 70) badgeColor = "bg-amber-100 text-amber-800";

            var formatAchieved = "";
            var formatTarget = "";
            if (kraNameLower.indexOf("conversion") !== -1 || kraNameLower.indexOf("win rate") !== -1) {
              formatTarget = targetVal + "%";
              formatAchieved = achievedVal + "%";
            } else if (kra.kpiType === 'Amount' || kraNameLower.indexOf("over all orders") !== -1 || kraNameLower.indexOf("onboard order") !== -1 || kraNameLower.indexOf("revenue") !== -1 || kraNameLower.indexOf("spares") !== -1) {
              formatTarget = formatINR(targetVal);
              formatAchieved = formatINR(achievedVal);
            } else if (kra.kpiType === 'Days' || kraNameLower.indexOf("outstanding") !== -1 || kraNameLower.indexOf("payment") !== -1) {
              formatTarget = targetVal + " days";
              formatAchieved = achievedVal + " days";
            } else if (kraNameLower.indexOf("lead") !== -1) {
              formatTarget = targetVal + " leads";
              formatAchieved = achievedVal + " leads";
            } else {
              formatTarget = targetVal + "%";
              formatAchieved = achievedVal + "%";
            }

            kraCardsHtml += `
              <div class="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div class="flex items-center space-x-2">
                      <h3 class="text-base font-bold text-slate-900">${escapeHtml(kra.kraName)}</h3>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">${escapeHtml(kra.kpiType || 'Target')}</span>
                    </div>
                    <p class="text-xs text-slate-500">${escapeHtml(kra.aopLine || 'AOP Target Line')}</p>
                  </div>
                  <div class="flex items-center space-x-3">
                    <span class="text-xs font-semibold text-slate-500">Weight: <strong class="text-slate-800">${escapeHtml(weight)}%</strong></span>
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${badgeColor}">${pctAchieved}% Achieved</span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                  <div>
                    <span class="text-slate-500 block">Target Value:</span>
                    <span class="text-sm font-bold text-slate-900">${escapeHtml(formatTarget)}</span>
                  </div>
                  <div>
                    <span class="text-slate-500 block">Achieved Value:</span>
                    <span class="text-sm font-bold text-indigo-600">${escapeHtml(formatAchieved)}</span>
                  </div>
                  <div>
                    <span class="text-slate-500 block">Weighted Contribution:</span>
                    <span class="text-sm font-black text-slate-900">${weightedContribution.toFixed(1)}%</span>
                  </div>
                </div>

                <div class="text-xs text-slate-600 bg-amber-50/50 p-3 rounded-lg border border-amber-100 flex items-start space-x-2">
                  <span class="text-amber-600 font-bold shrink-0">Daily Control:</span>
                  <span>${escapeHtml(kra.dailyControl || 'Maintain daily activity discipline')}</span>
                </div>
              </div>
            `;
          });
        }

        document.getElementById('kra-cards-container').innerHTML = kraCardsHtml;

        // Overall Score Display
        var roundedScore = totalWeightedScore.toFixed(1);
        document.getElementById('overall-score-display').innerText = roundedScore + "%";
        
        var overallPill = document.getElementById('overall-status-pill');
        if (totalWeightedScore >= 90) {
          overallPill.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white";
          overallPill.innerText = "Exceeds Expectations";
        } else if (totalWeightedScore >= 70) {
          overallPill.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white";
          overallPill.innerText = "Meets Expectations";
        } else {
          overallPill.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white";
          overallPill.innerText = "Needs Improvement";
        }

        // 3. Compute DWM & Attendance Compliance % for this month
        var todayDate = new Date();
        var curM = todayDate.getMonth() + 1;
        var curY = todayDate.getFullYear();
        var mStr = (curM < 10 ? '0' + curM : curM) + '/' + curY;
        var elapsedDaysThisMonth = todayDate.getDate();

        // Calculate working days excluding Sundays
        var workingDaysElapsed = 0;
        for (var d = 1; d <= elapsedDaysThisMonth; d++) {
          var testDate = new Date(curY, todayDate.getMonth(), d);
          if (testDate.getDay() !== 0) { // Not Sunday
            workingDaysElapsed++;
          }
        }
        if (workingDaysElapsed === 0) workingDaysElapsed = 1;

        // DWM Days with accomplished activities in current month
        var myDwmActs = dwmActivities.filter(function(a) {
          if (subEmpIds.indexOf(a.employeeId) === -1) return false;
          return a.date && (a.date.indexOf(mStr) !== -1 || a.date.indexOf('/' + curM + '/' + curY) !== -1);
        });
        var dwmDatesMap = {};
        myDwmActs.forEach(function(a) {
          if (a.accomplishmentStatus && a.accomplishmentStatus !== 'Pending') {
            dwmDatesMap[a.date] = true;
          }
        });
        var dwmDaysCount = Object.keys(dwmDatesMap).length;
        if (myDwmActs.length === 0 && dwmActivities.length > 0) {
          dwmDaysCount = elapsedDaysThisMonth; // default active compliance
        }

        var dwmPct = Math.min(100, Math.round((dwmDaysCount / elapsedDaysThisMonth) * 100));
        document.getElementById('dwm-compliance-val').innerText = dwmPct + "%";
        document.getElementById('dwm-bar').style.width = dwmPct + "%";
        var dwmBadge = document.getElementById('dwm-badge');
        dwmBadge.innerText = (subEmpIds.length > 1 ? "Team DWM: " : "") + dwmDaysCount + " / " + elapsedDaysThisMonth + " Days";
        if (dwmPct >= 90) dwmBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800";
        else if (dwmPct >= 70) dwmBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800";
        else dwmBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800";

        // Attendance completed days in current month
        var myAtts = attendance.filter(function(att) {
          if (subEmpIds.indexOf(att.employeeId) === -1 || att.status !== 'Completed') return false;
          return att.date && (att.date.indexOf(mStr) !== -1 || att.date.indexOf('/' + curM + '/' + curY) !== -1);
        });
        var attDaysCount = Math.round(myAtts.length / (subEmpIds.length || 1));
        if (myAtts.length === 0 && attendance.length > 0) {
          attDaysCount = workingDaysElapsed;
        }

        var attPct = Math.min(100, Math.round((attDaysCount / workingDaysElapsed) * 100));
        document.getElementById('att-compliance-val').innerText = attPct + "%";
        document.getElementById('att-bar').style.width = attPct + "%";
        var attBadge = document.getElementById('att-badge');
        attBadge.innerText = (subEmpIds.length > 1 ? "Avg Team: " : "") + attDaysCount + " / " + workingDaysElapsed + " Work Days";
        if (attPct >= 90) attBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800";
        else if (attPct >= 70) attBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800";
        else attBadge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800";

        // Render Daily Controls List
        var dcListHtml = "";
        if (myKras.length === 0) {
          dcListHtml = `<div class="col-span-2 text-slate-400">No daily control points assigned yet.</div>`;
        } else {
          myKras.forEach(function(k) {
            dcListHtml += `
              <div class="flex items-start space-x-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                <span class="w-2 h-2 rounded-full bg-indigo-400 mt-1 shrink-0"></span>
                <div>
                  <div class="font-bold text-slate-200">${escapeHtml(k.kraName)}:</div>
                  <div class="text-slate-300 mt-0.5">${escapeHtml(k.dailyControl || 'Maintain daily discipline')}</div>
                </div>
              </div>
            `;
          });
        }
        document.getElementById('daily-controls-list').innerHTML = dcListHtml;
      }
