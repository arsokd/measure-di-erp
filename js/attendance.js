var viewingAttEmpId = null;

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initAttendancePage();
        }
      });

      function initAttendancePage() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        document.getElementById('today-date-display').innerText = getFormattedToday();

        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var container = document.getElementById('att-filter-container');
          var dropdown = document.getElementById('att-filter-emp');
          container.classList.remove('hidden');

          dropdown.innerHTML = "";
          employees.forEach(function(e) {
            var opt = document.createElement('option');
            opt.value = e.employeeId;
            opt.innerText = e.fullName + " (" + e.employeeId + ")";
            if (e.employeeId === myEmpId) opt.selected = true;
            dropdown.appendChild(opt);
          });
        }

        viewingAttEmpId = myEmpId;
        renderAttendanceUI(myEmpId);
      }

      function onAttFilterChange() {
        var dropdown = document.getElementById('att-filter-emp');
        viewingAttEmpId = dropdown.value;
        renderAttendanceUI(viewingAttEmpId);
      }

      function renderAttendanceUI(empId) {
        var myEmpId = localStorage.getItem('employeeId');
        var isOwnRecord = (empId === myEmpId);

        var punchCard = document.getElementById('punch-actions-card');
        if (isOwnRecord) {
          punchCard.classList.remove('hidden');
        } else {
          punchCard.classList.add('hidden');
        }

        var attendance = window.RevOpsStore.getCollection('attendance') || [];
        var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];
        var today = getFormattedToday();

        // Check Today's Attendance Record for this employee
        var todayAtt = attendance.find(function(a) {
          return a.employeeId === empId && a.date === today;
        });

        // Check Today's DWM Activities for this employee - only the ones
        // actually ticked into today's plan (an unticked KRA point is
        // never part of it and never gets updated, so including it here
        // would permanently inflate the pending count).
        var todayDwm = dwmActivities.filter(function(a) {
          return a.employeeId === empId && a.date === today && a.isTicked !== false;
        });

        var pendingDwmCount = todayDwm.filter(function(a) {
          return a.accomplishmentStatus === 'Pending';
        }).length;

        // Render Status Banner
        var statusText = document.getElementById('current-attendance-status-text');
        var inLink = document.getElementById('punch-in-link');
        var inDoneBox = document.getElementById('punch-in-done-box');
        var outLink = document.getElementById('punch-out-link');
        var outBlockedBox = document.getElementById('punch-out-blocked-box');
        var outDoneBox = document.getElementById('punch-out-done-box');

        inDoneBox.classList.add('hidden');
        outLink.classList.add('hidden');
        outBlockedBox.classList.add('hidden');
        outDoneBox.classList.add('hidden');
        inLink.classList.remove('hidden');

        if (!todayAtt) {
          statusText.innerText = "Status: Not Punched In Today";
          statusText.className = "text-sm font-bold text-amber-600 mt-1";

          // Punch In happens on the DWM page now; Punch Out stays blocked until then.
          outBlockedBox.classList.remove('hidden');

        } else if (todayAtt.status === 'Punched In') {
          var timeStr = todayAtt.punchInTime ? new Date(todayAtt.punchInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today';
          statusText.innerText = "Status: Punched In at " + timeStr;
          statusText.className = "text-sm font-bold text-emerald-600 mt-1";

          inLink.classList.add('hidden');
          inDoneBox.classList.remove('hidden');
          inDoneBox.innerText = "✅ Punched In at " + timeStr;

          // Punch Out happens on the DWM page once accomplishments are updated.
          outLink.classList.remove('hidden');
          if (pendingDwmCount > 0) {
            outLink.querySelector('span').innerText = "Go to DWM Accomplishment to Punch Out (" + pendingDwmCount + " of " + todayDwm.length + " pending)";
          } else {
            outLink.querySelector('span').innerText = "Go to DWM Accomplishment to Punch Out";
          }

        } else if (todayAtt.status === 'Completed') {
          statusText.innerText = "Status: Completed — " + (todayAtt.workedHours || 8.0) + " hours worked";
          statusText.className = "text-sm font-bold text-blue-600 mt-1";

          var inTimeStr = todayAtt.punchInTime ? new Date(todayAtt.punchInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today';
          inLink.classList.add('hidden');
          inDoneBox.classList.remove('hidden');
          inDoneBox.innerText = "✅ Punched In at " + inTimeStr;

          outDoneBox.classList.remove('hidden');
          outDoneBox.innerText = "✅ Completed — " + (todayAtt.workedHours || 8.0) + " hours worked";
        }

        // Render History Table
        renderAttendanceHistoryTable(empId, attendance);
      }

      function renderAttendanceHistoryTable(empId, attendance) {
        var tbody = document.getElementById('att-history-tbody');
        tbody.innerHTML = "";

        var period = document.getElementById('att-period-filter') ? document.getElementById('att-period-filter').value : '2026-27';

        var myAttHistory = attendance.filter(function(a) {
          if (a.employeeId !== empId) return false;
          if (period === 'All') return true;
          var attFy = typeof getFinancialYear === 'function' ? getFinancialYear(a.date) : '2026-27';
          return attFy === period;
        });

        if (myAttHistory.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">No attendance history records found.</td></tr>`;
          return;
        }

        myAttHistory.forEach(function(att) {
          var inTime = att.punchInTime ? new Date(att.punchInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--';
          var outTime = att.punchOutTime ? new Date(att.punchOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--';
          var worked = att.workedHours ? att.workedHours + " hrs" : '--';

          // Render GPS Location Pill for Punch In
          var inLocBadge = "";
          if (att.punchInLocation && att.punchInLocation.latitude) {
            var inLat = Number(att.punchInLocation.latitude).toFixed(4);
            var inLng = Number(att.punchInLocation.longitude).toFixed(4);
            var inAcc = att.punchInLocation.accuracy ? " (±" + att.punchInLocation.accuracy + "m)" : "";
            var inMapUrl = att.punchInLocation.googleMapsUrl || ("https://www.google.com/maps?q=" + att.punchInLocation.latitude + "," + att.punchInLocation.longitude);
            inLocBadge = `<a href="${inMapUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors mt-1" title="Click to view live GPS location on Google Maps"><svg class="w-3 h-3 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span>📍 ${inLat}, ${inLng}${inAcc}</span></a>`;
          } else if (att.locationName) {
            inLocBadge = `<span class="inline-flex items-center space-x-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mt-1"><span>📍 ${att.locationName}</span></span>`;
          } else if (att.punchInTime) {
            inLocBadge = `<span class="inline-flex items-center space-x-1 text-[10px] text-slate-400 mt-1"><span>📍 HQ Office</span></span>`;
          } else {
            inLocBadge = `<span class="text-slate-400">--</span>`;
          }

          // Render GPS Location Pill for Punch Out
          var outLocBadge = "";
          if (att.punchOutLocation && att.punchOutLocation.latitude) {
            var outLat = Number(att.punchOutLocation.latitude).toFixed(4);
            var outLng = Number(att.punchOutLocation.longitude).toFixed(4);
            var outAcc = att.punchOutLocation.accuracy ? " (±" + att.punchOutLocation.accuracy + "m)" : "";
            var outMapUrl = att.punchOutLocation.googleMapsUrl || ("https://www.google.com/maps?q=" + att.punchOutLocation.latitude + "," + att.punchOutLocation.longitude);
            outLocBadge = `<a href="${outMapUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors mt-1" title="Click to view live GPS location on Google Maps"><svg class="w-3 h-3 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span>📍 ${outLat}, ${outLng}${outAcc}</span></a>`;
          } else if (att.punchOutTime) {
            outLocBadge = `<span class="inline-flex items-center space-x-1 text-[10px] text-slate-400 mt-1"><span>📍 HQ Office</span></span>`;
          } else {
            outLocBadge = `<span class="text-slate-400">--</span>`;
          }

          var dwmComp = (att.dwmAccomplishedCount || 0) + "/" + (att.dwmPlanCount || 0) + " activities completed";

          var scoreBadge = "";
          if (typeof att.autoScore === 'number') {
            if (att.scoreRatificationStatus === 'Pending') {
              scoreBadge = `<div class="mt-1 text-[10px] text-slate-500">Score: ${escapeHtml(att.autoScore)}% <span class="px-1.5 py-0.5 rounded font-bold uppercase bg-indigo-100 text-indigo-800">⏳ Ratification Pending</span></div>`;
            } else if (att.scoreRatificationStatus === 'Ratified') {
              scoreBadge = `<div class="mt-1 text-[10px] text-slate-500">Score: <span class="font-bold text-emerald-700">${escapeHtml(att.finalScore)}%</span> <span class="px-1.5 py-0.5 rounded font-bold uppercase bg-emerald-100 text-emerald-800">✓ Ratified</span></div>`;
            } else if (att.scoreRatificationStatus === 'Modified') {
              scoreBadge = `<div class="mt-1 text-[10px] text-slate-500">Score: <span class="font-bold text-amber-700">${escapeHtml(att.finalScore)}%</span> <span class="px-1.5 py-0.5 rounded font-bold uppercase bg-amber-100 text-amber-800" title="${escapeHtml(att.scoreRatificationRemarks || '')}">✎ Modified by Manager</span></div>`;
            } else if (att.scoreRatificationStatus === 'Rejected') {
              scoreBadge = `<div class="mt-1 text-[10px] text-slate-500"><span class="px-1.5 py-0.5 rounded font-bold uppercase bg-rose-100 text-rose-800" title="${escapeHtml(att.scoreRatificationRemarks || '')}">✕ Score Rejected</span></div>`;
            }
          }

          var statusPill = "bg-amber-100 text-amber-800";
          if (att.status === 'Completed') statusPill = "bg-emerald-100 text-emerald-800";

          var correctionBadge = "";
          if (att.correctionStatus === 'Pending') {
            correctionBadge = `<div class="mt-1"><span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800" title="Awaiting your reporting manager's approval">⏳ Correction Pending</span></div>`;
          } else if (att.correctionStatus === 'Rejected') {
            correctionBadge = `<div class="mt-1"><span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-100 text-rose-800" title="${escapeHtml(att.correctionReviewRemarks || '')}">✕ Correction Rejected</span></div>`;
          } else if (att.correctionStatus === 'Approved') {
            correctionBadge = `<div class="mt-1"><span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-sky-100 text-sky-800">✓ Correction Approved</span></div>`;
          }

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3.5 px-4 font-semibold text-slate-900 align-top">${escapeHtml(att.date)}</td>
            <td class="py-3.5 px-4 text-slate-700 align-top">
              <div class="font-bold text-slate-900">${escapeHtml(inTime)}</div>
              <div>${inLocBadge}</div>
            </td>
            <td class="py-3.5 px-4 text-slate-700 align-top">
              <div class="font-bold text-slate-900">${escapeHtml(outTime)}</div>
              <div>${outLocBadge}</div>
            </td>
            <td class="py-3.5 px-4 text-center font-bold text-slate-900 align-top">${escapeHtml(worked)}</td>
            <td class="py-3.5 px-4 text-center text-slate-600 font-medium align-top">${escapeHtml(dwmComp)}${scoreBadge}</td>
            <td class="py-3.5 px-4 text-center align-top">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusPill}">${escapeHtml(att.status)}</span>
              ${correctionBadge}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Live GPS capture + the actual Punch In/Out recording now live in
      // RevOpsStore (js/store.js) so the DWM page can call them too — Punch
      // In/Out happen there now, triggered by confirming the plan/
      // accomplishments are done. This page only shows status and links
      // over to DWM; "Test GPS Readiness" still runs a real capture here
      // so staff can troubleshoot GPS before making the trip to DWM.
      // ===== Attendance Correction Request (missed Punch In/Out on a past day) =====

      function openCorrectionModal() {
        document.getElementById('correction-date').value = "";
        document.getElementById('correction-date').max = getIsoYesterday();
        document.getElementById('correction-punch-in').value = "";
        document.getElementById('correction-punch-out').value = "";
        document.getElementById('correction-reason').value = "";
        document.getElementById('correction-modal').classList.remove('hidden');
      }

      function closeCorrectionModal() {
        document.getElementById('correction-modal').classList.add('hidden');
      }

      function getIsoYesterday() {
        var d = new Date();
        d.setDate(d.getDate() - 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }

      // Native <input type="date"> gives back YYYY-MM-DD - converts to
      // this app's DD/MM/YYYY date string format used everywhere else.
      function isoDateToAppDate(iso) {
        var p = (iso || '').split('-');
        if (p.length < 3) return '';
        return p[2] + '/' + p[1] + '/' + p[0];
      }

      function handleSubmitCorrection(e) {
        e.preventDefault();
        var isoDate = document.getElementById('correction-date').value;
        var punchIn = document.getElementById('correction-punch-in').value;
        var punchOut = document.getElementById('correction-punch-out').value;
        var reason = document.getElementById('correction-reason').value.trim();

        if (!isoDate) {
          alert("Please select the date you missed punching in/out.");
          return;
        }
        if (!punchIn && !punchOut) {
          alert("Please enter at least a Punch In or Punch Out time.");
          return;
        }
        if (!reason) {
          alert("Please explain why this correction is needed.");
          return;
        }

        var appDate = isoDateToAppDate(isoDate);
        var myEmpId = localStorage.getItem('employeeId');
        var myName = localStorage.getItem('userName');

        var result = window.RevOpsStore.requestAttendanceCorrection(myEmpId, myName, appDate, punchIn, punchOut, reason);
        if (!result.success) {
          var messages = {
            'not-past-date': "You can only request a correction for a past day - today's attendance goes through the normal Punch In/Out flow on the DWM page.",
            'already-complete': "That day's attendance is already complete - nothing to correct.",
            'already-pending': "You already have a correction request pending approval for that day."
          };
          alert(messages[result.reason] || "Could not submit the correction request.");
          return;
        }

        alert("✅ Correction request submitted. Your reporting manager will need to approve it before it's reflected in your attendance.");
        closeCorrectionModal();
        renderAttendanceUI(viewingAttEmpId);
      }

      function retryGpsCheck() {
        window.RevOpsStore.captureLiveGpsLocation(function(loc, err) {
          if (loc) {
            alert("✅ Live GPS Verified Successfully!\n\nCaptured Coordinates:\n" + loc.formattedLocation + "\n\nYou are ready to Punch In or Punch Out!");
          } else {
            alert("❌ Live GPS Check Failed!\n\nReason: " + (err || "GPS inactive") + "\n\nPlease switch ON device location/GPS and allow browser permissions.");
          }
        });
      }
