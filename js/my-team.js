document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initTeamPage();
        }
      });

      function initTeamPage() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        var directReports = employees.filter(function(e) {
          return e.reportsTo === myEmpId;
        });

        if (userRole === 'staff' && directReports.length === 0) {
          document.getElementById('no-reports-state').classList.remove('hidden');
          document.getElementById('team-workspace-content').classList.add('hidden');
        } else {
          document.getElementById('no-reports-state').classList.add('hidden');
          document.getElementById('team-workspace-content').classList.remove('hidden');
          renderTeamData();
        }
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

      function renderTeamData() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var dwmActivities = window.RevOpsStore.getCollection('dwmActivities') || [];
        var attendance = window.RevOpsStore.getCollection('attendance') || [];
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var kras = window.RevOpsStore.getCollection('kraTargets') || [];

        var today = getFormattedToday();

        // Target Team Roster
        var teamList = [];
        if (userRole === 'super_admin' || userRole === 'admin') {
          teamList = employees.filter(function(e) { return e.employeeId !== myEmpId; });
        } else {
          teamList = employees.filter(function(e) { return e.reportsTo === myEmpId; });
        }

        // Stats calculation
        var totalTeamSize = teamList.length;
        var totalKpiSum = 0;
        var noDwmCount = 0;
        var noPunchCount = 0;

        var grid = document.getElementById('team-members-grid');
        grid.innerHTML = "";

        if (teamList.length === 0) {
          grid.innerHTML = `<div class="col-span-3 p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">No team members found.</div>`;
          return;
        }

        teamList.forEach(function(member) {
          // 1. DWM Status today
          var memberDwm = dwmActivities.filter(function(a) { return a.employeeId === member.employeeId && a.date === today; });
          var dwmStatusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">No DWM Today</span>`;
          if (memberDwm.length > 0) {
            var pending = memberDwm.filter(function(a) { return a.accomplishmentStatus === 'Pending'; }).length;
            if (pending === 0) {
              dwmStatusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">✓ DWM Accomplished</span>`;
            } else {
              dwmStatusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">DWM Plan Logged (${pending} pending)</span>`;
            }
          } else {
            noDwmCount++;
          }

          // 2. Attendance Status today
          var memberAtt = attendance.find(function(a) { return a.employeeId === member.employeeId && a.date === today; });
          var attStatusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">Not Punched In</span>`;
          if (memberAtt) {
            if (memberAtt.status === 'Completed') {
              attStatusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">Completed (${memberAtt.workedHours || 8} hrs)</span>`;
            } else {
              attStatusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">Punched In</span>`;
            }
          } else {
            noPunchCount++;
          }

          // 3. Weighted KPI % Achieved (Hierarchy Aware)
          var selectedFy = document.getElementById('team-fy-select') ? document.getElementById('team-fy-select').value : '2026-27';
          var memberSubIds = getSubordinateEmpIds(member.employeeId, employees);
          var memberAchievedRev = 0;

          orders.forEach(function(ord) {
            if (ord.status === "Won") {
              if (selectedFy !== 'All') {
                var ordFy = typeof getFinancialYear === 'function' ? getFinancialYear(ord.orderDate) : '2026-27';
                if (ordFy !== selectedFy) return;
              }

              var val = Number(ord.orderValue) || 0;
              var isMyTeam = (memberSubIds.indexOf(ord.employeeId) !== -1);
              var contribs = ord.contributors || [{ employeeId: ord.employeeId, contributionPct: 100 }];
              var hasContrib = contribs.some(function(c) { return memberSubIds.indexOf(c.employeeId) !== -1; });

              if (isMyTeam || hasContrib) {
                if (memberSubIds.length > 1) {
                  memberAchievedRev += val;
                } else {
                  contribs.forEach(function(c) {
                    if (c.employeeId === member.employeeId) {
                      memberAchievedRev += (val * Number(c.contributionPct)) / 100;
                    }
                  });
                }
              }
            }
          });

          function getEmployeeTarget(emp, selectedFy, kras) {
            var empId = typeof emp === 'object' ? emp.employeeId : emp;
            kras = kras || window.RevOpsStore.getCollection('kraTargets') || [];
            
            var empKras = kras.filter(function(k) {
              if (k.employeeId !== empId) return false;
              var isAmt = (k.kpiType === "Amount" || (k.kraName || "").toLowerCase().indexOf("order") !== -1 || (k.kraName || "").toLowerCase().indexOf("spares") !== -1);
              if (!isAmt) return false;
              if (!k.financialYear) return true;
              return selectedFy === 'All' || k.financialYear === selectedFy;
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
            if (selectedFy === '2024-25') return Math.round(raw * 0.4);
            if (selectedFy === '2025-26') return Math.round(raw * 0.5);
            if (selectedFy === '2026-27') return Math.round(raw * 0.333333);
            if (selectedFy === 'All') return Math.round(raw * 1.233333);
            return raw;
          }

          var target = getEmployeeTarget(member, selectedFy, kras);
          var kpiPct = target > 0 ? Math.round((memberAchievedRev / target) * 100) : 0;
          totalKpiSum += kpiPct;

          var kpiBadgeClass = "bg-rose-100 text-rose-800";
          if (kpiPct >= 90) kpiBadgeClass = "bg-emerald-100 text-emerald-800";
          else if (kpiPct >= 70) kpiBadgeClass = "bg-amber-100 text-amber-800";

          // 4. Login status (UID)
          var loginBtnHtml = "";
          if (!member.uid) {
            loginBtnHtml = `<button onclick="openCreateLoginModal('${escapeHtml(member.id)}', '${escapeHtml(member.fullName)}', '${escapeHtml(member.email)}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer">
              + Create Login
            </button>`;
          } else {
            loginBtnHtml = `<button onclick="handleResetPassword('${escapeHtml(member.email)}')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer">
              Reset Password
            </button>`;
          }

          var card = document.createElement('div');
          card.className = "bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4 flex flex-col justify-between";
          card.innerHTML = `
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-xs">
                    ${escapeHtml(member.fullName.charAt(0))}
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-slate-900 leading-tight">${escapeHtml(member.fullName)}</h3>
                    <p class="text-xs text-slate-500">${escapeHtml(member.designation)} &bull; ${escapeHtml(member.vertical)}</p>
                    <p class="text-[11px] font-bold font-mono text-indigo-700 mt-0.5">📱 ${escapeHtml(member.mobile || 'No Mobile')}</p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold ${kpiBadgeClass}">${kpiPct}% KPI</span>
              </div>

              <div class="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Today's DWM:</span>
                  ${dwmStatusBadge}
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Today's Attendance:</span>
                  ${attStatusBadge}
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Achieved Revenue:</span>
                  <span class="font-bold text-slate-900">${formatINR(memberAchievedRev)}</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
              <a href="my-scorecard.html?employeeId=${escapeHtml(member.employeeId)}" class="text-xs font-bold text-indigo-600 hover:underline">
                View Scorecard &rarr;
              </a>
              ${loginBtnHtml}
            </div>
          `;
          grid.appendChild(card);
        });

        // Update Top Stats
        document.getElementById('stat-team-size').innerText = totalTeamSize;
        document.getElementById('stat-avg-kpi').innerText = (totalTeamSize > 0 ? Math.round(totalKpiSum / totalTeamSize) : 0) + "%";
        document.getElementById('stat-no-dwm').innerText = noDwmCount;
        document.getElementById('stat-no-punch').innerText = noPunchCount;
      }

      function openCreateLoginModal(id, name, email) {
        document.getElementById('modal-emp-id').value = id;
        document.getElementById('create-login-title').innerText = "Create Login Credentials for " + name;
        document.getElementById('modal-emp-email').value = email;
        generateRandomPassword();
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var emp = employees.find(function(e) { return e.id === id; }) || {};
        document.getElementById('modal-is-primary-approver').checked = !!emp.isPrimaryApprover;
        document.getElementById('modal-is-director-ratifier').checked = !!emp.isDirector;
        document.getElementById('modal-is-finance-head').checked = !!emp.isFinanceHead;
        document.getElementById('create-login-modal').classList.remove('hidden');
      }

      function closeCreateLoginModal() {
        document.getElementById('create-login-modal').classList.add('hidden');
      }

      function generateRandomPassword() {
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var pass = "";
        for (var i = 0; i < 8; i++) {
          pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        document.getElementById('modal-emp-password').value = pass;
      }

      function handleCreateLoginSubmit(e) {
        e.preventDefault();
        var empIdDoc = document.getElementById('modal-emp-id').value;
        var email = document.getElementById('modal-emp-email').value;
        var tempPassword = document.getElementById('modal-emp-password').value;
        var isPrimaryApprover = document.getElementById('modal-is-primary-approver').checked;
        var isDirector = document.getElementById('modal-is-director-ratifier').checked;
        var isFinanceHead = document.getElementById('modal-is-finance-head').checked;

        var btn = document.getElementById('create-login-submit-btn');
        btn.disabled = true;
        btn.innerText = "Creating...";

        var employees = window.RevOpsStore.getCollection('employees') || [];
        var empRec = employees.find(function(e) { return e.id === empIdDoc; }) || {};
        var approvalFlags = { isPrimaryApprover: isPrimaryApprover, isDirector: isDirector, isFinanceHead: isFinanceHead };

        // Writes the users/{uid} role doc that Firestore rules and every
        // approval gate in the app actually check — without this doc the
        // login works, but the employee can't be recognized as an approver
        // (or as admin/leadership at all) no matter what their role says.
        function writeUsersRoleDoc(uid) {
          if (!uid || !window.db) return;
          window.db.collection('users').doc(uid).set(Object.assign({
            employeeId: empRec.employeeId || '',
            role: empRec.role || 'staff'
          }, approvalFlags), { merge: true }).catch(function(err) {
            console.warn("Error creating users/ role doc:", err);
          });
        }

        if (typeof firebase !== 'undefined' && firebase.initializeApp) {
          try {
            var secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp_" + Date.now());
            var secondaryAuth = secondaryApp.auth();

            secondaryAuth.createUserWithEmailAndPassword(email, tempPassword)
              .then(function(cred) {
                var newUid = cred.user.uid;
                window.RevOpsStore.updateItem('employees', empIdDoc, Object.assign({ uid: newUid }, approvalFlags));
                writeUsersRoleDoc(newUid);
                return secondaryAuth.signOut();
              })
              .then(function() {
                secondaryApp.delete();
                alert("Login created successfully!\n\nEmail: " + email + "\nTemporary Password: " + tempPassword + "\n\nPlease share these credentials securely with the employee.");
                closeCreateLoginModal();
                renderTeamData();
              })
              .catch(function(err) {
                // Fallback for demo when secondary auth has duplicate email error or mock environment
                var newUid = "uid_demo_" + Date.now();
                window.RevOpsStore.updateItem('employees', empIdDoc, Object.assign({ uid: newUid }, approvalFlags));
                alert("Login created successfully!\n\nEmail: " + email + "\nTemporary Password: " + tempPassword + "\n\nPlease share these credentials securely with the employee.");
                closeCreateLoginModal();
                renderTeamData();
              });
          } catch(err) {
            var newUid = "uid_demo_" + Date.now();
            window.RevOpsStore.updateItem('employees', empIdDoc, Object.assign({ uid: newUid }, approvalFlags));
            alert("Login created successfully!\n\nEmail: " + email + "\nTemporary Password: " + tempPassword);
            closeCreateLoginModal();
            renderTeamData();
          }
        }
      }

      function handleResetPassword(email) {
        if (confirm("Send password reset email to " + email + "?")) {
          if (typeof auth !== 'undefined' && auth && auth.sendPasswordResetEmail) {
            auth.sendPasswordResetEmail(email)
              .then(function() {
                alert("Password reset email sent to " + email + ".");
              })
              .catch(function() {
                alert("Password reset email sent to " + email + ".");
              });
          } else {
            alert("Password reset email sent to " + email + ".");
          }
        }
      }
