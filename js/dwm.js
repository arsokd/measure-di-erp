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

      // Formats a stored "HH:MM" 24-hour time string (from a native <input
      // type="time">) into a friendly 12-hour display, e.g. "14:00" -> "2:00 PM".
      function formatTimeLabel(hhmm) {
        if (!hhmm) return '';
        var parts = hhmm.split(':');
        var h = Number(parts[0]);
        var m = parts[1];
        var period = h >= 12 ? 'PM' : 'AM';
        var h12 = h % 12;
        if (h12 === 0) h12 = 12;
        return h12 + ':' + m + ' ' + period;
      }

      function renderDwmData(empId) {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var emp = employees.find(function(e) { return e.employeeId === empId; });

        // Regular DWM auto-fills from this employee's own active KRAs -
        // only when they're looking at their own TODAY, never while a
        // manager is just viewing someone else's day, and never while
        // browsing a past period (that would plant a brand-new "today"
        // row while looking at history).
        var viewMode = document.getElementById('dwm-view-mode') ? document.getElementById('dwm-view-mode').value : 'Today';
        if (isOwnDwm && viewMode === 'Today') {
          window.RevOpsStore.ensureTodayRegularDwmActivities(empId, emp ? emp.fullName : 'User');
        }

        var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];

        // Filter Activities by Selected Period
        var today = getFormattedToday();
        var allPeriodActivities = dwmActivities.filter(function(a) {
          if (a.employeeId !== empId) return false;
          if (viewMode === 'Today') return a.date === today;
          if (viewMode === 'All') return true;

          var actFy = typeof getFinancialYear === 'function' ? getFinancialYear(a.date) : '2026-27';
          return actFy === viewMode;
        });

        // Only ticked activities are ever part of the confirmed plan - an
        // unticked KRA point stays visible (unticked) in Section A so it
        // can still be ticked before Punch In, but it never counts toward
        // stats, Section B or Punch In/Out. Records saved before this
        // field existed (isTicked undefined) are treated as ticked.
        var todayActivities = allPeriodActivities.filter(function(a) { return a.isTicked !== false; });

        // Whether today's plan is already locked in (Punched In) - drives
        // whether Section A is still editable (checkboxes/times) or
        // read-only, and whether it shows every today-activity (including
        // unticked, so they can still be ticked) or just the locked plan.
        var attendanceColl = window.RevOpsStore.getCollection('attendance') || [];
        var todayAttRecord = isOwnDwm ? attendanceColl.find(function(a) { return a.employeeId === empId && a.date === today; }) : null;
        var isPunchedInToday = viewMode === 'Today' && !!todayAttRecord;

        // Calculate Productivity Score & Update Metrics
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

        // SECTION A Tbody. Before Punch In (today, own DWM), every KRA
        // point shows up - ticked or not - so unticked ones can still be
        // ticked. Once Punched In (or viewing a past period/someone else),
        // only the locked/ticked plan shows, read-only.
        var secATbody = document.getElementById('section-a-tbody');
        secATbody.innerHTML = "";

        var sectionAEditable = isOwnDwm && viewMode === 'Today' && !isPunchedInToday;
        var sectionAList = sectionAEditable ? allPeriodActivities : todayActivities;

        if (sectionAList.length === 0) {
          secATbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">No KRAs assigned yet, so nothing is auto-filled. Click "⭐ + Add Special Assignment" to log something, or ask your manager to set up your KRAs.</td></tr>`;
        } else {
          sectionAList.forEach(function(act) {
            var tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";

            var isTicked = act.isTicked !== false;
            var canToggle = sectionAEditable && !act.lockedPlan;
            var checkboxCell = `<input type="checkbox" ${isTicked ? 'checked' : ''} ${canToggle ? '' : 'disabled'} onchange="toggleDwmActivityTick('${escapeHtml(act.id)}', this.checked)" class="w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed" />`;

            var deleteBtn = "";
            if (act.isAutoGenerated) {
              deleteBtn = `<span class="text-slate-400 text-[10px]">From KRA</span>`;
            } else if (isOwnDwm && !act.lockedPlan && (act.accomplishmentStatus === 'Pending' || !act.accomplishmentStatus)) {
              deleteBtn = `<button onclick="deleteDwmActivity('${act.id}')" class="text-rose-600 hover:text-rose-800 font-semibold hover:underline">Delete</button>`;
            } else {
              deleteBtn = `<span class="text-slate-400 text-[10px]">Locked</span>`;
            }

            var isSpecial = !!act.isSpecialAssignment;
            var specialPill = isSpecial ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">⭐ Special</span>` : '';
            var kpiLine = (!isSpecial && act.linkedKpi) ? `<div class="text-[10px] text-slate-500 font-semibold mt-0.5">KPI: ${escapeHtml(act.linkedKpi)}</div>` : '';
            var categoryCell = isSpecial
              ? `<span class="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px]">${escapeHtml(act.category || 'Special Assignment')}</span>`
              : `<span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">${escapeHtml(act.linkedKra || 'KRA Activity')}</span>${kpiLine}`;

            var timeEditable = canToggle && isTicked;
            var startTimeCell = `<input type="time" value="${escapeHtml(act.startTime || '')}" ${timeEditable ? '' : 'disabled'} onchange="onDwmActivityTimeInlineChange('${escapeHtml(act.id)}', 'startTime', this.value)" class="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-500" />`;
            var endTimeCell = `<input type="time" value="${escapeHtml(act.endTime || '')}" ${timeEditable ? '' : 'disabled'} onchange="onDwmActivityTimeInlineChange('${escapeHtml(act.id)}', 'endTime', this.value)" class="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-500" />`;

            var statusBadge = !isTicked
              ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Not Included</span>`
              : act.lockedPlan
                ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Locked In</span>`
                : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Planned</span>`;

            tr.innerHTML = `
              <td class="py-3 px-4 text-center">${checkboxCell}</td>
              <td class="py-3 px-4 font-semibold text-slate-900">
                <div class="flex items-center">
                  <span>${escapeHtml(act.activityDescription)}</span>
                  ${specialPill}
                </div>
              </td>
              <td class="py-3 px-4 text-slate-600">${categoryCell}</td>
              <td class="py-3 px-4 whitespace-nowrap">${startTimeCell}</td>
              <td class="py-3 px-4 whitespace-nowrap">${endTimeCell}</td>
              <td class="py-3 px-4 text-center">${statusBadge}</td>
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
          secBTbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">No activities to update. Section A will fill in automatically once you have KRAs assigned, or log a Special Assignment above.</td></tr>`;
        } else {
          todayActivities.forEach(function(act) {
            if (act.accomplishmentStatus && act.accomplishmentStatus !== 'Pending') {
              updatedCount++;
            }

            var tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";

            var disabledAttr = isOwnDwm ? "" : "disabled";
            var isSpecial = !!act.isSpecialAssignment;
            var specialPill = isSpecial ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">⭐ Special</span>` : '';
            var changedPill = act.planChangedByManager ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">Plan Changed</span>` : '';
            var kpiLine = (!isSpecial && act.linkedKpi) ? `<div class="text-[10px] text-slate-500 font-semibold mt-0.5">KPI: ${escapeHtml(act.linkedKpi)}</div>` : '';
            var categoryCell = isSpecial
              ? `<span class="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[10px]">${escapeHtml(act.category || 'Special Assignment')}</span>`
              : `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">${escapeHtml(act.linkedKra || 'KRA Activity')}</span>${kpiLine}`;
            var timeCell = (act.startTime && act.endTime)
              ? `${escapeHtml(formatTimeLabel(act.startTime))}–${escapeHtml(formatTimeLabel(act.endTime))} <span class="text-slate-400">(${act.hoursSpent || 0}h)</span>`
              : `<span class="text-slate-400">${act.hoursSpent ? act.hoursSpent + 'h' : '--'}</span>`;

            var pctId = 'acc-pct-' + escapeHtml(act.id);
            var isPartial = act.accomplishmentStatus === 'Partial';
            var pctValue = (typeof act.accomplishmentPercent === 'number') ? act.accomplishmentPercent : '';
            var pctRow = `
              <div id="pct-wrapper-${pctId}" class="mt-1.5 ${isPartial ? '' : 'hidden'}">
                <input ${disabledAttr} type="number" min="1" max="99" id="${pctId}" value="${pctValue}" onchange="saveAccomplishmentRow('${escapeHtml(act.id)}')" placeholder="% done" class="w-20 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500" />
                <span class="text-[10px] text-slate-500">% actually done</span>
              </div>
            `;

            var remarksRequired = act.planChangedByManager && !act.accomplishmentRemarks;
            var isDone = act.accomplishmentStatus === 'Done';

            tr.innerHTML = `
              <td class="py-3 px-4 text-center">
                <input ${disabledAttr} type="checkbox" id="acc-done-${escapeHtml(act.id)}" ${isDone ? 'checked' : ''} onchange="toggleActivityDoneQuick('${escapeHtml(act.id)}', this.checked)" title="Tick once this activity is fully done" class="w-4 h-4 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed" />
              </td>
              <td class="py-3 px-4 font-semibold text-slate-900">
                <div class="flex items-center">
                  <span>${escapeHtml(act.activityDescription)}</span>
                  ${specialPill}
                  ${changedPill}
                </div>
              </td>
              <td class="py-3 px-4">${categoryCell}</td>
              <td class="py-3 px-4 whitespace-nowrap">${timeCell}</td>
              <td class="py-3 px-4">
                <select ${disabledAttr} data-no-search="true" id="acc-status-${escapeHtml(act.id)}" onchange="onAccomplishmentStatusChange('${escapeHtml(act.id)}', this.value)" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Pending" ${act.accomplishmentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                  <option value="Done" ${act.accomplishmentStatus === 'Done' ? 'selected' : ''}>Done (100%)</option>
                  <option value="Partial" ${act.accomplishmentStatus === 'Partial' ? 'selected' : ''}>Partially Done</option>
                  <option value="Not Done" ${act.accomplishmentStatus === 'Not Done' ? 'selected' : ''}>Not Done (0%)</option>
                </select>
                ${pctRow}
              </td>
              <td class="py-3 px-4">
                <input ${disabledAttr} type="text" id="acc-remarks-${escapeHtml(act.id)}" value="${escapeHtml(act.accomplishmentRemarks || '')}" onblur="saveAccomplishmentRow('${escapeHtml(act.id)}')" placeholder="Add remarks..." class="w-full px-2.5 py-1 bg-slate-50 border ${remarksRequired ? 'border-rose-300' : 'border-slate-200'} rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <label class="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-600 font-semibold cursor-pointer">
                  <input ${disabledAttr} type="checkbox" id="acc-planchanged-${escapeHtml(act.id)}" ${act.planChangedByManager ? 'checked' : ''} onchange="saveAccomplishmentRow('${escapeHtml(act.id)}')" class="w-3.5 h-3.5 accent-sky-600 cursor-pointer" />
                  <span>Plan changed (per Reporting Manager's instruction)${remarksRequired ? ' <span class="text-rose-600">— explain in Remarks</span>' : ''}</span>
                </label>
              </td>
            `;
            secBTbody.appendChild(tr);
          });
        }

        document.getElementById('accomplishment-progress-summary').innerText = updatedCount + " of " + todayActivities.length + " activities updated";

        // Render 7-Day History Strip
        renderHistoryStrip(empId, dwmActivities);

        // Render Punch In / Punch Out Confirmation Rows (Self Only)
        renderPunchControls(empId, dwmActivities);
      }

      // Punch In/Out now happen from here, not from the Attendance page —
      // the Attendance page just links in. Confirming the plan (Section A)
      // records Punch In; confirming accomplishments (Section B) records
      // Punch Out. Always computed against TODAY's real date, independent
      // of whatever historical period the "Period" dropdown is showing.
      function renderPunchControls(empId, dwmActivities) {
        var inRow = document.getElementById('dwm-punch-in-row');
        var outRow = document.getElementById('dwm-punch-out-row');
        if (!inRow || !outRow) return;

        if (!isOwnDwm) {
          inRow.classList.add('hidden');
          outRow.classList.add('hidden');
          return;
        }
        inRow.classList.remove('hidden');
        outRow.classList.remove('hidden');

        var today = getFormattedToday();
        var attendance = window.RevOpsStore.getCollection('attendance') || [];
        var todayAtt = attendance.find(function(a) { return a.employeeId === empId && a.date === today; });
        var todayDwm = dwmActivities.filter(function(a) { return a.employeeId === empId && a.date === today && a.isTicked !== false; });
        var pendingCount = todayDwm.filter(function(a) { return !a.accomplishmentStatus || a.accomplishmentStatus === 'Pending'; }).length;

        var inBtn = document.getElementById('dwm-punch-in-btn');
        var outBtn = document.getElementById('dwm-punch-out-btn');
        var inText = document.getElementById('dwm-punch-in-status-text');
        var outText = document.getElementById('dwm-punch-out-status-text');

        if (!todayAtt) {
          if (todayDwm.length === 0) {
            inBtn.disabled = true;
            inText.innerText = "No KRAs assigned and nothing logged yet — add a Special Assignment, or ask your manager to set up your KRAs, then confirm to Punch In.";
          } else {
            inBtn.disabled = false;
            inText.innerText = "✅ Plan ready (" + todayDwm.length + " activities). Confirm below to Punch In.";
          }
          outBtn.disabled = true;
          outText.innerText = "Punch In first, then update every activity above before Punch Out.";
        } else if (todayAtt.status === 'Punched In') {
          inBtn.disabled = true;
          var inTimeStr = todayAtt.punchInTime ? new Date(todayAtt.punchInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today';
          inText.innerText = "✅ Punched In at " + inTimeStr + ".";

          if (pendingCount > 0) {
            outBtn.disabled = true;
            outText.innerText = "Update accomplishment for all today's activities first (" + pendingCount + " of " + todayDwm.length + " still pending).";
          } else {
            outBtn.disabled = false;
            outText.innerText = "✅ All activities updated. Confirm below to Punch Out.";
          }
        } else if (todayAtt.status === 'Completed') {
          inBtn.disabled = true;
          var inTimeStr2 = todayAtt.punchInTime ? new Date(todayAtt.punchInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today';
          inText.innerText = "✅ Punched In at " + inTimeStr2 + ".";

          outBtn.disabled = true;
          outText.innerText = "✅ Punched Out — " + (todayAtt.workedHours || 8.0) + " hours worked today.";
        }
      }

      function confirmPunchIn() {
        var myEmpId = localStorage.getItem('employeeId');
        var myName = localStorage.getItem('userName');
        var btn = document.getElementById('dwm-punch-in-btn');
        var originalHtml = btn ? btn.innerHTML : "";

        if (btn) {
          btn.disabled = true;
          btn.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Capturing Live GPS & Punching In...</span>
          `;
        }

        window.RevOpsStore.captureLiveGpsLocation(function(locationObj, errorMsg) {
          if (!locationObj) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            alert("⚠️ PUNCH IN CANNOT BE RECORDED!\n\nReason: GPS location is inactive or permission was denied.\n\nRule: Employees MUST have active GPS location to punch in.");
            return;
          }

          var result = window.RevOpsStore.recordPunchIn(myEmpId, myName, locationObj);
          if (!result.success) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            if (result.reason === 'already-punched-in') {
              alert("You have already punched in today.");
            } else {
              alert("Please plan at least 1 DWM activity before punching in.");
            }
            renderDwmData(dwmViewingEmpId);
            return;
          }

          alert("✅ Punched In Successfully!\n\nTimestamp: " + new Date(result.record.punchInTime).toLocaleTimeString() + "\nLive GPS Location: " + locationObj.formattedLocation);
          renderDwmData(dwmViewingEmpId);
        });
      }

      function confirmPunchOut() {
        var myEmpId = localStorage.getItem('employeeId');
        var btn = document.getElementById('dwm-punch-out-btn');
        var originalHtml = btn ? btn.innerHTML : "";

        if (btn) {
          btn.disabled = true;
          btn.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Capturing Live GPS & Punching Out...</span>
          `;
        }

        window.RevOpsStore.captureLiveGpsLocation(function(locationObj, errorMsg) {
          if (!locationObj) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            alert("⚠️ PUNCH OUT CANNOT BE RECORDED!\n\nReason: GPS location is inactive or permission was denied.\n\nRule: Employees MUST have active GPS location to punch out.");
            return;
          }

          var result = window.RevOpsStore.recordPunchOut(myEmpId, locationObj);
          if (!result.success) {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            if (result.reason === 'not-punched-in') {
              alert("You need to Punch In first before you can Punch Out.");
            } else if (result.reason === 'pending-dwm') {
              alert("Please update accomplishment status for all today's DWM activities first (" + result.pendingCount + " of " + result.total + " still pending).");
            }
            renderDwmData(dwmViewingEmpId);
            return;
          }

          alert("✅ Punched Out Successfully!\n\nTimestamp: " + result.punchOutTime.toLocaleTimeString() + "\nDuration: " + result.workedHours + " hours\nLive GPS Location: " + locationObj.formattedLocation);
          renderDwmData(dwmViewingEmpId);
        });
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
            return a.employeeId === empId && a.date === formattedDate && a.isTicked !== false;
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

      // ===== Extra KRA Activity modal (regular work beyond the auto-filled daily control) =====

      function openAddActivityModal() {
        var kras = window.RevOpsStore.getCollection('kraTargets') || [];
        var myEmpId = localStorage.getItem('employeeId');
        var myKras = kras.filter(function(k) { return k.employeeId === myEmpId; });

        var select = document.getElementById('activity-kra-select');
        var warning = document.getElementById('no-kra-warning');

        if (myKras.length === 0) {
          warning.classList.remove('hidden');
        } else {
          warning.classList.add('hidden');
          select.innerHTML = "";
          myKras.forEach(function(k) {
            var opt = document.createElement('option');
            opt.value = k.id;
            opt.setAttribute('data-kra-name', k.kraName);
            opt.setAttribute('data-kpi', k.kpi || k.targetMetric || '');
            opt.setAttribute('data-aop-line', k.aopLine || '');
            opt.innerText = k.kraName + " (" + (k.aopLine || 'General') + ")";
            select.appendChild(opt);
          });
        }

        document.getElementById('activity-desc').value = "";
        document.getElementById('add-activity-modal').classList.remove('hidden');
      }

      function closeAddActivityModal() {
        document.getElementById('add-activity-modal').classList.add('hidden');
      }

      function handleSaveExtraActivity(e) {
        e.preventDefault();
        var desc = document.getElementById('activity-desc').value.trim();
        var select = document.getElementById('activity-kra-select');

        if (!desc) {
          alert("Please describe what you plan to do.");
          return;
        }

        var selectedOpt = select.options[select.selectedIndex];
        if (!selectedOpt) {
          alert("Please select a valid Linked KRA, or use Special Assignment if this is outside your KRAs.");
          return;
        }

        var employees = window.RevOpsStore.getCollection('employees') || [];
        var myEmpId = localStorage.getItem('employeeId');
        var myEmp = employees.find(function(e) { return e.employeeId === myEmpId; });
        var today = getFormattedToday();

        window.RevOpsStore.addItem('dwmActivities', {
          employeeId: myEmpId,
          employeeName: myEmp ? myEmp.fullName : 'User',
          date: today,
          activityDescription: desc,
          category: 'Standard KRA Activity',
          isSpecialAssignment: false,
          isAutoGenerated: false,
          // Explicitly added mid-day -> included in the plan right away,
          // but (unlike the auto-filled KRA points) not part of the
          // morning's locked plan, so it stays deletable while Pending.
          isTicked: true,
          lockedPlan: false,
          userEditedTime: false,
          hoursSpent: 0,
          startTime: '',
          endTime: '',
          linkedKraId: select.value,
          linkedKra: selectedOpt.getAttribute('data-kra-name'),
          linkedKpi: selectedOpt.getAttribute('data-kpi') || '',
          linkedAopLine: selectedOpt.getAttribute('data-aop-line'),
          planStatus: 'Planned',
          accomplishmentStatus: 'Pending',
          accomplishmentPercent: null,
          accomplishmentRemarks: '',
          planChangedByManager: false,
          plannedAt: new Date().toISOString(),
          accomplishedAt: null
        });

        window.RevOpsStore.recomputeRegularDwmHoursForDay(myEmpId, today);
        closeAddActivityModal();
        renderDwmData(dwmViewingEmpId);
      }

      // ===== Special Assignment modal (outside KRA/KPI purview, time-boxed) =====

      function openAddSpecialAssignmentModal() {
        var select = document.getElementById('special-category-select');
        select.innerHTML = "";
        window.RevOpsStore.SPECIAL_ASSIGNMENT_CATEGORIES.forEach(function(cat) {
          var opt = document.createElement('option');
          opt.value = cat;
          opt.innerText = cat;
          select.appendChild(opt);
        });

        document.getElementById('special-desc').value = "";
        document.getElementById('special-start-time').value = "";
        document.getElementById('special-end-time').value = "";
        document.getElementById('special-duration-display').innerText = "Enter a start and end time to see the duration.";

        document.getElementById('add-special-modal').classList.remove('hidden');
      }

      function closeAddSpecialAssignmentModal() {
        document.getElementById('add-special-modal').classList.add('hidden');
      }

      function onSpecialTimeChange() {
        var start = document.getElementById('special-start-time').value;
        var end = document.getElementById('special-end-time').value;
        var display = document.getElementById('special-duration-display');
        var hours = window.RevOpsStore.computeTimeRangeHours(start, end);

        if (hours === null) {
          display.innerText = (start && end) ? "End time must be after start time." : "Enter a start and end time to see the duration.";
        } else {
          display.innerText = "Duration: " + hours + " hour(s)";
        }
      }

      function handleSaveSpecialAssignment(e) {
        e.preventDefault();
        var category = document.getElementById('special-category-select').value;
        var desc = document.getElementById('special-desc').value.trim();
        var startTime = document.getElementById('special-start-time').value;
        var endTime = document.getElementById('special-end-time').value;

        if (!desc) {
          alert("Please describe the special assignment.");
          return;
        }

        var hours = window.RevOpsStore.computeTimeRangeHours(startTime, endTime);
        if (hours === null) {
          alert("Please enter a valid start and end time, with end time after start time.");
          return;
        }

        var employees = window.RevOpsStore.getCollection('employees') || [];
        var myEmpId = localStorage.getItem('employeeId');
        var myEmp = employees.find(function(e) { return e.employeeId === myEmpId; });
        var today = getFormattedToday();

        window.RevOpsStore.addItem('dwmActivities', {
          employeeId: myEmpId,
          employeeName: myEmp ? myEmp.fullName : 'User',
          date: today,
          activityDescription: desc,
          category: category,
          isSpecialAssignment: true,
          isAutoGenerated: false,
          // Explicitly added by the employee -> included in today's plan
          // right away. Its time range is already the one they chose in
          // this modal, so it's treated as "manually set" and excluded
          // from the Regular DWM auto time-split.
          isTicked: true,
          lockedPlan: false,
          userEditedTime: true,
          startTime: startTime,
          endTime: endTime,
          hoursSpent: hours,
          linkedKraId: '',
          linkedKra: '',
          linkedKpi: '',
          linkedAopLine: '',
          planStatus: 'Planned',
          accomplishmentStatus: 'Pending',
          accomplishmentPercent: null,
          accomplishmentRemarks: '',
          planChangedByManager: false,
          plannedAt: new Date().toISOString(),
          accomplishedAt: null
        });

        window.RevOpsStore.recomputeRegularDwmHoursForDay(myEmpId, today);
        closeAddSpecialAssignmentModal();
        renderDwmData(dwmViewingEmpId);
      }

      // Toggling the "Include" checkbox in Section A - only available
      // before Punch In, on a row that isn't already locked in. Unticking
      // clears its hours/time (handled server-side by
      // recomputeRegularDwmHoursForDay) and rebalances whatever's left
      // among the other ticked Regular DWM rows.
      function toggleDwmActivityTick(actId, isChecked) {
        var allActs = window.RevOpsStore.getCollection('dwmActivities') || [];
        var act = allActs.find(function(a) { return a.id === actId; });
        if (!act) return;

        window.RevOpsStore.updateItem('dwmActivities', actId, { isTicked: !!isChecked });
        window.RevOpsStore.recomputeRegularDwmHoursForDay(act.employeeId, act.date);
        renderDwmData(dwmViewingEmpId);
      }

      // Inline Start/End Time edit in Section A, before Punch In. Pre-
      // filled automatically (see recomputeRegularDwmHoursForDay), but the
      // employee can override either side here - once they do, this row
      // is flagged userEditedTime so future auto-recomputes (from ticking
      // another row, adding a Special Assignment, etc.) leave it alone.
      function onDwmActivityTimeInlineChange(actId, field, value) {
        var allActs = window.RevOpsStore.getCollection('dwmActivities') || [];
        var act = allActs.find(function(a) { return a.id === actId; });
        if (!act) return;

        var startTime = field === 'startTime' ? value : act.startTime;
        var endTime = field === 'endTime' ? value : act.endTime;
        var hours = window.RevOpsStore.computeTimeRangeHours(startTime, endTime);
        if (hours === null) {
          alert("End time must be after start time.");
          renderDwmData(dwmViewingEmpId);
          return;
        }

        window.RevOpsStore.updateItem('dwmActivities', actId, {
          startTime: startTime,
          endTime: endTime,
          hoursSpent: hours,
          userEditedTime: true
        });
        window.RevOpsStore.recomputeRegularDwmHoursForDay(act.employeeId, act.date);
        renderDwmData(dwmViewingEmpId);
      }

      // Quick "Done" tick in Section B - a one-click shortcut equivalent to
      // opening the Accomplishment Status dropdown and picking "Done
      // (100%)", for the common case where an activity simply happened as
      // planned. Doesn't touch remarks or the plan-changed flag. Unticking
      // only makes sense once it was ticked Done, so it reverts to Pending
      // rather than guessing Partial/Not Done - the dropdown still covers
      // those two directly.
      function toggleActivityDoneQuick(actId, isChecked) {
        var updates = isChecked
          ? { accomplishmentStatus: 'Done', accomplishmentPercent: null, accomplishedAt: new Date().toISOString() }
          : { accomplishmentStatus: 'Pending', accomplishedAt: new Date().toISOString() };
        window.RevOpsStore.updateItem('dwmActivities', actId, updates);
        renderDwmData(dwmViewingEmpId);
      }

      // Switching the Accomplishment Status dropdown just toggles the %
      // Done input's visibility live (no full re-render needed for that),
      // then saves like any other Section B field change.
      function onAccomplishmentStatusChange(actId, newStatus) {
        var wrapper = document.getElementById('pct-wrapper-acc-pct-' + actId);
        if (wrapper) {
          if (newStatus === 'Partial') wrapper.classList.remove('hidden');
          else wrapper.classList.add('hidden');
        }
        saveAccomplishmentRow(actId);
      }

      // Section B autosaves on every field change (status, % done, remarks,
      // "Plan changed" flag) - reads the row's current DOM state and
      // writes it all in one update, same live-as-you-go pattern the page
      // already used for the old status-only autosave.
      function saveAccomplishmentRow(actId) {
        var statusEl = document.getElementById('acc-status-' + actId);
        var pctEl = document.getElementById('acc-pct-' + actId);
        var remarksEl = document.getElementById('acc-remarks-' + actId);
        var changedEl = document.getElementById('acc-planchanged-' + actId);

        var status = statusEl ? statusEl.value : 'Pending';
        var remarks = remarksEl ? remarksEl.value.trim() : '';
        var planChanged = changedEl ? changedEl.checked : false;

        var updates = {
          accomplishmentStatus: status,
          accomplishmentRemarks: remarks,
          planChangedByManager: planChanged,
          accomplishedAt: new Date().toISOString()
        };

        if (status === 'Partial') {
          var pct = pctEl ? parseInt(pctEl.value, 10) : NaN;
          if (isNaN(pct) || pct < 1 || pct > 99) {
            alert("Please enter a % Done between 1 and 99 for a Partially Done activity.");
            if (pctEl) pctEl.focus();
            return;
          }
          updates.accomplishmentPercent = pct;
        } else {
          updates.accomplishmentPercent = null;
        }

        window.RevOpsStore.updateItem('dwmActivities', actId, updates);
        renderDwmData(dwmViewingEmpId);
      }

      function deleteDwmActivity(actId) {
        var allActs = window.RevOpsStore.getCollection('dwmActivities') || [];
        var act = allActs.find(function(a) { return a.id === actId; });
        if (act && act.lockedPlan) {
          alert("This activity was part of this morning's confirmed plan and can't be deleted. Mark it Not Done and explain in Remarks if it's no longer relevant.");
          return;
        }
        if (!confirm("Are you sure you want to delete this planned activity?")) return;

        window.RevOpsStore.deleteItem('dwmActivities', actId);

        if (act) {
          window.RevOpsStore.recomputeRegularDwmHoursForDay(act.employeeId, act.date);
        }
        renderDwmData(dwmViewingEmpId);
      }
