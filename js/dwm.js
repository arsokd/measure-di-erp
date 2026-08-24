var dwmViewingEmpId = null;
      var isOwnDwm = true;

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initDwmView();
        }
      });

      function initDwmView() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        document.getElementById('date-badge').innerText = getFormattedToday();

        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var selectorWrapper = document.getElementById('dwm-employee-selector');
          var dropdown = document.getElementById('dwm-select-emp');
          selectorWrapper.classList.remove('hidden');

          dropdown.innerHTML = "";
          employees.forEach(function(e) {
            var opt = document.createElement('option');
            opt.value = e.employeeId;
            opt.innerText = e.fullName + " (" + e.employeeId + " - " + (e.vertical || 'General') + ")";
            if (e.employeeId === myEmpId) opt.selected = true;
            dropdown.appendChild(opt);
          });

          dwmViewingEmpId = myEmpId;
          isOwnDwm = true;
        } else {
          dwmViewingEmpId = myEmpId;
          isOwnDwm = true;
        }

        renderDwmData(dwmViewingEmpId);
      }

      function onDwmEmpChange() {
        var dropdown = document.getElementById('dwm-select-emp');
        dwmViewingEmpId = dropdown.value;
        var myEmpId = localStorage.getItem('employeeId');
        isOwnDwm = (dwmViewingEmpId === myEmpId);

        var addBtn = document.getElementById('add-plan-btn-wrapper');
        if (isOwnDwm) {
          addBtn.classList.remove('hidden');
        } else {
          addBtn.classList.add('hidden');
        }

        renderDwmData(dwmViewingEmpId);
      }

      function renderDwmData(empId) {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var kras = window.RevOpsStore.getCollection('kraTargets') || [];
        var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];

        var emp = employees.find(function(e) { return e.employeeId === empId; });
        var empKras = kras.filter(function(k) { return k.employeeId === empId; });

        // 1. Render Daily Control Points Box
        var dcContainer = document.getElementById('daily-control-points-container');
        if (empKras.length === 0) {
          dcContainer.innerHTML = `<div class="text-slate-500 italic col-span-2">No KRAs assigned yet. (Special assignments can still be logged).</div>`;
        } else {
          var dcHtml = "";
          empKras.forEach(function(k) {
            dcHtml += `
              <div class="bg-white p-2.5 rounded-xl border border-slate-200">
                <span class="font-bold text-slate-800">${escapeHtml(k.kraName)}:</span>
                <span class="text-slate-600"> ${escapeHtml(k.dailyControl || 'Maintain daily discipline')}</span>
              </div>
            `;
          });
          dcContainer.innerHTML = dcHtml;
        }

        // 2. Filter Activities by Selected Period
        var today = getFormattedToday();
        var viewMode = document.getElementById('dwm-view-mode') ? document.getElementById('dwm-view-mode').value : 'Today';
        var todayActivities = dwmActivities.filter(function(a) {
          if (a.employeeId !== empId) return false;
          if (viewMode === 'Today') return a.date === today;
          if (viewMode === 'All') return true;
          
          var actFy = typeof getFinancialYear === 'function' ? getFinancialYear(a.date) : '2026-27';
          return actFy === viewMode;
        });

        // 3. Calculate Productivity Score & Update Metrics
        var prodStats = window.RevOpsStore.calculateDailyProductivity(todayActivities, 8.0);
        document.getElementById('stat-dwm-score').innerText = prodStats.productivityScore + "%";
        document.getElementById('stat-dwm-hours').innerText = prodStats.productiveHours;
        document.getElementById('stat-dwm-special').innerText = prodStats.specialAssignmentHours;
        document.getElementById('stat-dwm-progress').style.width = Math.min(100, prodStats.productivityScore) + "%";

        var scoreBadge = document.getElementById('stat-dwm-score-badge');
        if (prodStats.productivityScore >= 90) {
          scoreBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800";
          scoreBadge.innerText = "⭐ High Productivity";
          document.getElementById('stat-dwm-progress').className = "bg-emerald-600 h-full rounded-full transition-all duration-300";
        } else if (prodStats.productivityScore >= 60) {
          scoreBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800";
          scoreBadge.innerText = "Good Progress";
          document.getElementById('stat-dwm-progress').className = "bg-indigo-600 h-full rounded-full transition-all duration-300";
        } else if (prodStats.productivityScore > 0) {
          scoreBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800";
          scoreBadge.innerText = "In Progress";
          document.getElementById('stat-dwm-progress').className = "bg-amber-500 h-full rounded-full transition-all duration-300";
        } else {
          scoreBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600";
          scoreBadge.innerText = "Pending";
          document.getElementById('stat-dwm-progress').className = "bg-slate-400 h-full rounded-full transition-all duration-300";
        }

        var doneActs = todayActivities.filter(function(a) { return a.accomplishmentStatus === 'Done' || a.accomplishmentStatus === 'Completed'; }).length;
        document.getElementById('stat-dwm-done-count').innerText = doneActs;
        document.getElementById('stat-dwm-total-count').innerText = "/ " + todayActivities.length + " total";

        // SECTION A Tbody
        var secATbody = document.getElementById('section-a-tbody');
        secATbody.innerHTML = "";

        if (todayActivities.length === 0) {
          secATbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">No DWM activities planned for today yet. Click "+ Add Activity" or "⭐ Special Assignment" above to start.</td></tr>`;
        } else {
          todayActivities.forEach(function(act) {
            var tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";
            
            var deleteBtn = "";
            if (isOwnDwm && (act.accomplishmentStatus === 'Pending' || !act.accomplishmentStatus)) {
              deleteBtn = `<button onclick="deleteDwmActivity('${act.id}')" class="text-rose-600 hover:text-rose-800 font-semibold hover:underline">Delete</button>`;
            } else {
              deleteBtn = `<span class="text-slate-400 text-[10px]">Locked</span>`;
            }

            var isSpecial = act.isSpecialAssignment || act.category === 'Full Day Training' || act.category === 'Full Day Meeting' || act.category === 'Special Assignment' || act.category === 'Client Emergency Call';
            var specialPill = isSpecial ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">⭐ ${escapeHtml(act.category || 'Special')}</span>` : '';
            var hoursLabel = act.hoursSpent ? `<span class="text-slate-400 font-normal ml-1">(${act.hoursSpent} hrs)</span>` : '';

            tr.innerHTML = `
              <td class="py-3 px-4 font-semibold text-slate-900">
                <div class="flex items-center">
                  <span>${escapeHtml(act.activityDescription)}</span>
                  ${specialPill}
                  ${hoursLabel}
                </div>
              </td>
              <td class="py-3 px-4 text-slate-600">
                <span class="px-2 py-0.5 rounded ${isSpecial ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'} font-bold text-[10px]">${escapeHtml(act.linkedKra || 'Special Assignment')}</span>
              </td>
              <td class="py-3 px-4 text-center">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Planned</span>
              </td>
              <td class="py-3 px-4 text-center">${deleteBtn}</td>
            `;
            secATbody.appendChild(tr);
          });
        }

        // SECTION B Tbody
        var secBTbody = document.getElementById('section-b-tbody');
        secBTbody.innerHTML = "";

        var updatedCount = 0;
        if (todayActivities.length === 0) {
          secBTbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">No activities to update. Plan activities in Section A first.</td></tr>`;
        } else {
          todayActivities.forEach(function(act) {
            if (act.accomplishmentStatus && act.accomplishmentStatus !== 'Pending') {
              updatedCount++;
            }

            var tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";

            var disabledAttr = isOwnDwm ? "" : "disabled";
            var isSpecial = act.isSpecialAssignment || act.category === 'Full Day Training' || act.category === 'Full Day Meeting' || act.category === 'Special Assignment' || act.category === 'Client Emergency Call';
            var specialPill = isSpecial ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">⭐ Special</span>` : '';

            tr.innerHTML = `
              <td class="py-3 px-4 font-semibold text-slate-900">
                <div class="flex items-center">
                  <span>${escapeHtml(act.activityDescription)}</span>
                  ${specialPill}
                  ${act.hoursSpent ? `<span class="text-slate-400 font-normal ml-1">(${act.hoursSpent}h)</span>` : ''}
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">${escapeHtml(act.linkedKra || 'Special Assignment')}</span>
              </td>
              <td class="py-3 px-4">
                <select ${disabledAttr} onchange="updateActivityAccomplishment('${escapeHtml(act.id)}', this.value, 'acc-remarks-${escapeHtml(act.id)}')" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Pending" ${act.accomplishmentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                  <option value="Done" ${act.accomplishmentStatus === 'Done' ? 'selected' : ''}>Done (100%)</option>
                  <option value="Partial" ${act.accomplishmentStatus === 'Partial' ? 'selected' : ''}>Partial (70%)</option>
                  <option value="Not Done" ${act.accomplishmentStatus === 'Not Done' ? 'selected' : ''}>Not Done (0%)</option>
                </select>
              </td>
              <td class="py-3 px-4">
                <input ${disabledAttr} type="text" id="acc-remarks-${escapeHtml(act.id)}" value="${escapeHtml(act.accomplishmentRemarks || '')}" onblur="updateActivityAccomplishment('${escapeHtml(act.id)}', null, 'acc-remarks-${escapeHtml(act.id)}')" placeholder="Add remarks..." class="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </td>
            `;
            secBTbody.appendChild(tr);
          });
        }

        document.getElementById('accomplishment-progress-summary').innerText = updatedCount + " of " + todayActivities.length + " activities updated";

        // 4. Render 7-Day History Strip
        renderHistoryStrip(empId, dwmActivities);
      }

      function renderHistoryStrip(empId, dwmActivities) {
        var stripContainer = document.getElementById('history-strip-container');
        stripContainer.innerHTML = "";

        var today = new Date();
        for (var i = 6; i >= 0; i--) {
          var d = new Date();
          d.setDate(today.getDate() - i);
          
          var formattedDate = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();

          var dayActivities = dwmActivities.filter(function(a) {
            return a.employeeId === empId && a.date === formattedDate;
          });

          var dotColor = "bg-slate-300"; // No activities
          var tooltipText = formattedDate + ": No activities logged";

          if (dayActivities.length > 0) {
            var nonPending = dayActivities.filter(function(a) { return a.accomplishmentStatus && a.accomplishmentStatus !== 'Pending'; }).length;
            if (nonPending === dayActivities.length) {
              dotColor = "bg-emerald-500";
              tooltipText = formattedDate + ": All " + dayActivities.length + " activities completed";
            } else if (nonPending > 0) {
              dotColor = "bg-amber-500";
              tooltipText = formattedDate + ": " + nonPending + "/" + dayActivities.length + " activities updated";
            } else {
              dotColor = "bg-rose-500";
              tooltipText = formattedDate + ": " + dayActivities.length + " activities pending";
            }
          }

          var dayItem = document.createElement('div');
          dayItem.className = "flex flex-col items-center p-2.5 bg-slate-50 rounded-xl border border-slate-200 min-w-20 text-center relative group";
          dayItem.innerHTML = `
            <span class="text-[10px] font-bold text-slate-500 uppercase">${i === 0 ? 'Today' : formattedDate.substring(0,5)}</span>
            <span class="w-3.5 h-3.5 rounded-full ${dotColor} my-1.5 shadow-xs"></span>
            <span class="text-[10px] font-semibold text-slate-700">${dayActivities.length} Plan</span>
            
            <!-- Tooltip -->
            <div class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap z-20">
              ${tooltipText}
            </div>
          `;
          stripContainer.appendChild(dayItem);
        }
      }

      function onActivityCategoryChange() {
        var cat = document.getElementById('activity-category-select').value;
        var hoursInp = document.getElementById('activity-hours');
        var creditBadge = document.getElementById('productivity-credit-badge');
        var kraSection = document.getElementById('kra-field-section');
        var kraSelect = document.getElementById('activity-kra-select');
        var isSpecialInp = document.getElementById('inp-is-special');

        if (cat === 'Full Day Training' || cat === 'Full Day Meeting') {
          hoursInp.value = 8.0;
          creditBadge.className = "px-3 py-2 bg-purple-100 text-purple-800 rounded-xl text-xs font-bold";
          creditBadge.innerText = "⭐ 100% Full Day Credit (8h)";
          kraSection.classList.add('opacity-50');
          kraSelect.required = false;
          isSpecialInp.value = "true";
        } else if (cat === 'Client Emergency Call' || cat === 'Special Assignment') {
          if (Number(hoursInp.value) < 4) hoursInp.value = 4.0;
          creditBadge.className = "px-3 py-2 bg-purple-100 text-purple-800 rounded-xl text-xs font-bold";
          creditBadge.innerText = "⭐ Full Org Credit (" + hoursInp.value + "h)";
          kraSection.classList.add('opacity-50');
          kraSelect.required = false;
          isSpecialInp.value = "true";
        } else {
          creditBadge.className = "px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold";
          creditBadge.innerText = "KRA Linked Progress";
          kraSection.classList.remove('opacity-50');
          kraSelect.required = true;
          isSpecialInp.value = "false";
        }
      }

      function openAddSpecialAssignmentModal() {
        openAddActivityModal();
        document.getElementById('activity-category-select').value = "Full Day Training";
        onActivityCategoryChange();
      }

      function openAddActivityModal() {
        var kras = window.RevOpsStore.getCollection('kraTargets') || [];
        var myEmpId = localStorage.getItem('employeeId');
        var myKras = kras.filter(function(k) { return k.employeeId === myEmpId; });

        var select = document.getElementById('activity-kra-select');
        var warning = document.getElementById('no-kra-warning');
        var wrapper = document.getElementById('kra-dropdown-wrapper');
        var saveBtn = document.getElementById('save-activity-btn');

        if (myKras.length === 0) {
          warning.classList.remove('hidden');
        } else {
          warning.classList.add('hidden');
          select.innerHTML = "";
          myKras.forEach(function(k) {
            var opt = document.createElement('option');
            opt.value = k.id;
            opt.setAttribute('data-kra-name', k.kraName);
            opt.setAttribute('data-aop-line', k.aopLine || '');
            opt.innerText = k.kraName + " (" + (k.aopLine || 'General') + ")";
            select.appendChild(opt);
          });
        }

        document.getElementById('activity-category-select').value = "Standard KRA Activity";
        document.getElementById('activity-desc').value = "";
        document.getElementById('activity-hours').value = "2.0";
        document.getElementById('inp-is-special').value = "false";
        onActivityCategoryChange();

        document.getElementById('add-activity-modal').classList.remove('hidden');
      }

      function closeAddActivityModal() {
        document.getElementById('add-activity-modal').classList.add('hidden');
      }

      function handleSaveActivity(e) {
        e.preventDefault();
        var desc = document.getElementById('activity-desc').value.trim();
        var cat = document.getElementById('activity-category-select').value;
        var hours = Number(document.getElementById('activity-hours').value) || 2.0;
        var select = document.getElementById('activity-kra-select');
        var isSpecial = (cat !== 'Standard KRA Activity');
        
        if (!desc) {
          alert("Please describe what you plan to do.");
          return;
        }

        var kraId = 'kra_special';
        var kraName = 'Special Assignment (' + cat + ')';
        var aopLine = 'Organizational Priority';

        if (!isSpecial) {
          var selectedOpt = select.options[select.selectedIndex];
          if (!selectedOpt) {
            alert("Please select a valid Linked KRA or choose a Special Assignment category.");
            return;
          }
          kraId = select.value;
          kraName = selectedOpt.getAttribute('data-kra-name');
          aopLine = selectedOpt.getAttribute('data-aop-line');
        }

        var employees = window.RevOpsStore.getCollection('employees') || [];
        var myEmpId = localStorage.getItem('employeeId');
        var myEmp = employees.find(function(e) { return e.employeeId === myEmpId; });

        var newAct = {
          employeeId: myEmpId,
          employeeName: myEmp ? myEmp.fullName : 'User',
          date: getFormattedToday(),
          activityDescription: desc,
          category: cat,
          isSpecialAssignment: isSpecial,
          hoursSpent: hours,
          linkedKraId: kraId,
          linkedKra: kraName,
          linkedAopLine: aopLine,
          planStatus: 'Planned',
          accomplishmentStatus: 'Pending',
          accomplishmentRemarks: '',
          plannedAt: new Date().toISOString(),
          accomplishedAt: null
        };

        window.RevOpsStore.addItem('dwmActivities', newAct);
        closeAddActivityModal();
        renderDwmData(dwmViewingEmpId);
      }

      function updateActivityAccomplishment(actId, newStatus, remarksElemId) {
        var remarks = document.getElementById(remarksElemId).value.trim();
        var updates = {
          accomplishmentRemarks: remarks,
          accomplishedAt: new Date().toISOString()
        };
        if (newStatus) {
          updates.accomplishmentStatus = newStatus;
        }

        window.RevOpsStore.updateItem('dwmActivities', actId, updates);
        renderDwmData(dwmViewingEmpId);
      }

      function deleteDwmActivity(actId) {
        if (confirm("Are you sure you want to delete this planned activity?")) {
          window.RevOpsStore.deleteItem('dwmActivities', actId);
          renderDwmData(dwmViewingEmpId);
        }
      }
