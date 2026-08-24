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

        // Check Today's DWM Activities for this employee
        var todayDwm = dwmActivities.filter(function(a) {
          return a.employeeId === empId && a.date === today;
        });

        var pendingDwmCount = todayDwm.filter(function(a) {
          return a.accomplishmentStatus === 'Pending';
        }).length;

        // Render Status Banner
        var statusText = document.getElementById('current-attendance-status-text');
        var inBtn = document.getElementById('punch-in-btn');
        var outBtn = document.getElementById('punch-out-btn');
        var inWarnBox = document.getElementById('punch-in-warning-box');
        var outWarnBox = document.getElementById('punch-out-warning-box');

        inWarnBox.classList.add('hidden');
        outWarnBox.classList.add('hidden');

        if (!todayAtt) {
          statusText.innerText = "Status: Not Punched In Today";
          statusText.className = "text-sm font-bold text-amber-600 mt-1";

          // Punch In Check
          if (todayDwm.length === 0) {
            inBtn.disabled = true;
            inWarnBox.classList.remove('hidden');
          } else {
            inBtn.disabled = false;
          }

          // Punch Out Disabled
          outBtn.disabled = true;

        } else if (todayAtt.status === 'Punched In') {
          var timeStr = todayAtt.punchInTime ? new Date(todayAtt.punchInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today';
          statusText.innerText = "Status: Punched In at " + timeStr;
          statusText.className = "text-sm font-bold text-emerald-600 mt-1";

          inBtn.disabled = true; // Already punched in

          // Punch Out Check
          if (pendingDwmCount > 0) {
            outBtn.disabled = true;
            outWarnBox.classList.remove('hidden');
            document.getElementById('pending-dwm-msg').innerText = "⚠️ Please update accomplishment for all today's DWM activities first (" + pendingDwmCount + " of " + todayDwm.length + " still pending).";
          } else {
            outBtn.disabled = false;
          }

        } else if (todayAtt.status === 'Completed') {
          statusText.innerText = "Status: Completed — " + (todayAtt.workedHours || 8.0) + " hours worked";
          statusText.className = "text-sm font-bold text-blue-600 mt-1";

          inBtn.disabled = true;
          outBtn.disabled = true;
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

          var statusPill = "bg-amber-100 text-amber-800";
          if (att.status === 'Completed') statusPill = "bg-emerald-100 text-emerald-800";

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
            <td class="py-3.5 px-4 text-center text-slate-600 font-medium align-top">${escapeHtml(dwmComp)}</td>
            <td class="py-3.5 px-4 text-center align-top">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusPill}">${escapeHtml(att.status)}</span>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function captureLiveGpsLocation(callback) {
        var errAlert = document.getElementById('gps-error-alert');
        var errMsg = document.getElementById('gps-error-message');
        if (errAlert) errAlert.classList.add('hidden');

        if (!navigator.geolocation) {
          if (errAlert && errMsg) {
            errAlert.classList.remove('hidden');
            errMsg.innerText = "Geolocation / GPS is not supported by your device or browser. Attendance cannot be marked without location verification.";
          }
          callback(null, "Geolocation unsupported");
          return;
        }

        var options = {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
          function(position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            var acc = Math.round(position.coords.accuracy || 0);
            var isoTime = new Date().toISOString();

            var locationObj = {
              latitude: lat,
              longitude: lng,
              accuracy: acc,
              timestamp: isoTime,
              formattedLocation: "Lat: " + lat.toFixed(5) + ", Lng: " + lng.toFixed(5) + " (±" + acc + "m)",
              googleMapsUrl: "https://www.google.com/maps?q=" + lat + "," + lng
            };

            if (errAlert) errAlert.classList.add('hidden');
            callback(locationObj, null);
          },
          function(error) {
            var txt = "";
            switch(error.code) {
              case error.PERMISSION_DENIED:
                txt = "Location access permission was denied by user/browser. Attendance CANNOT be marked when GPS is denied. Please allow location access in browser/device settings.";
                break;
              case error.POSITION_UNAVAILABLE:
                txt = "GPS / Location Services are turned off or inactive on your device. Attendance CANNOT be marked. Please turn ON GPS on your mobile/computer and try again.";
                break;
              case error.TIMEOUT:
                txt = "GPS request timed out. Please ensure high accuracy location services are turned ON and retry.";
                break;
              default:
                txt = "Could not detect live GPS location (" + (error.message || 'GPS inactive') + "). Attendance cannot be marked without location verification.";
                break;
            }
            if (errAlert && errMsg) {
              errAlert.classList.remove('hidden');
              errMsg.innerText = txt;
            }
            callback(null, txt);
          },
          options
        );
      }

      function retryGpsCheck() {
        captureLiveGpsLocation(function(loc, err) {
          if (loc) {
            alert("✅ Live GPS Verified Successfully!\n\nCaptured Coordinates:\n" + loc.formattedLocation + "\n\nYou are ready to Punch In or Punch Out!");
          } else {
            alert("❌ Live GPS Check Failed!\n\nReason: " + (err || "GPS inactive") + "\n\nPlease switch ON device location/GPS and allow browser permissions.");
          }
        });
      }

      function executePunchIn() {
        var inBtn = document.getElementById('punch-in-btn');
        var originalBtnContent = inBtn ? inBtn.innerHTML : "";
        if (inBtn) {
          inBtn.disabled = true;
          inBtn.innerHTML = `
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Capturing Live GPS & Punching In...</span>
          `;
        }

        captureLiveGpsLocation(function(locationObj, errorMsg) {
          if (!locationObj) {
            if (inBtn) {
              inBtn.disabled = false;
              inBtn.innerHTML = originalBtnContent;
            }
            alert("⚠️ ATTENDANCE CANNOT BE MARKED!\n\nReason: GPS location is inactive or permission was denied.\n\nRule: Employees MUST have active GPS location to punch in.");
            return;
          }

          var myEmpId = localStorage.getItem('employeeId');
          var myName = localStorage.getItem('userName');
          var today = getFormattedToday();

          var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];
          var todayDwm = dwmActivities.filter(function(a) {
            return a.employeeId === myEmpId && a.date === today;
          });

          var nowIso = new Date().toISOString();

          var newAtt = {
            employeeId: myEmpId,
            employeeName: myName,
            date: today,
            punchInTime: nowIso,
            punchInLocation: locationObj,
            punchOutTime: null,
            punchOutLocation: null,
            workedHours: null,
            dwmPlanCount: todayDwm.length,
            dwmAccomplishedCount: 0,
            status: 'Punched In'
          };

          window.RevOpsStore.addItem('attendance', newAtt);
          alert("✅ Punched In Successfully!\n\nTimestamp: " + new Date(nowIso).toLocaleTimeString() + "\nLive GPS Location: " + locationObj.formattedLocation);
          renderAttendanceUI(myEmpId);
        });
      }

      function executePunchOut() {
        var outBtn = document.getElementById('punch-out-btn');
        var originalBtnContent = outBtn ? outBtn.innerHTML : "";
        if (outBtn) {
          outBtn.disabled = true;
          outBtn.innerHTML = `
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Capturing Live GPS & Punching Out...</span>
          `;
        }

        captureLiveGpsLocation(function(locationObj, errorMsg) {
          if (!locationObj) {
            if (outBtn) {
              outBtn.disabled = false;
              outBtn.innerHTML = originalBtnContent;
            }
            alert("⚠️ ATTENDANCE CANNOT BE MARKED!\n\nReason: GPS location is inactive or permission was denied.\n\nRule: Employees MUST have active GPS location to punch out.");
            return;
          }

          var myEmpId = localStorage.getItem('employeeId');
          var today = getFormattedToday();

          var attendance = window.RevOpsStore.getCollection('attendance') || [];
          var todayAtt = attendance.find(function(a) {
            return a.employeeId === myEmpId && a.date === today;
          });

          if (!todayAtt) {
            if (outBtn) {
              outBtn.disabled = false;
              outBtn.innerHTML = originalBtnContent;
            }
            return;
          }

          var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];
          var todayDwm = dwmActivities.filter(function(a) {
            return a.employeeId === myEmpId && a.date === today;
          });

          var accomplishedCount = todayDwm.filter(function(a) {
            return a.accomplishmentStatus && a.accomplishmentStatus !== 'Pending';
          }).length;

          var punchInTime = new Date(todayAtt.punchInTime);
          var punchOutTime = new Date();
          var diffMs = punchOutTime - punchInTime;
          var computedHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
          if (computedHours <= 0) computedHours = 8.0;

          window.RevOpsStore.updateItem('attendance', todayAtt.id, {
            punchOutTime: punchOutTime.toISOString(),
            punchOutLocation: locationObj,
            workedHours: computedHours,
            dwmAccomplishedCount: accomplishedCount,
            status: 'Completed'
          });

          alert("✅ Punched Out Successfully!\n\nTimestamp: " + punchOutTime.toLocaleTimeString() + "\nDuration: " + computedHours + " hours\nLive GPS Location: " + locationObj.formattedLocation);
          renderAttendanceUI(myEmpId);
        });
      }
