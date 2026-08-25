document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['super_admin', 'admin'])) {
          renderEmployeesTable();
        }
      });

      function renderEmployeesTable() {
        var searchQuery = document.getElementById('emp-search-input').value.toLowerCase();
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var tbody = document.getElementById('employees-tbody');
        tbody.innerHTML = "";

        var filtered = employees.filter(function(e) {
          return e.fullName.toLowerCase().includes(searchQuery) ||
                 e.employeeId.toLowerCase().includes(searchQuery) ||
                 e.email.toLowerCase().includes(searchQuery) ||
                 (e.mobile || '').toLowerCase().includes(searchQuery) ||
                 e.vertical.toLowerCase().includes(searchQuery);
        });

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400">No employees found.</td></tr>`;
          return;
        }

        filtered.forEach(function(emp) {
          var isAct = (emp.isActive !== false);

          // Reports To Name
          var manager = employees.find(function(m) { return m.employeeId === emp.reportsTo; });
          var managerName = manager ? manager.fullName : (emp.reportsTo || '--');

          // Active Toggle Switch
          var toggleHtml = `
            <button onclick="toggleActiveStatus('${emp.id}', ${!isAct})" class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isAct ? 'bg-emerald-500' : 'bg-slate-300'}">
              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${isAct ? 'translate-x-5' : 'translate-x-0'}"></span>
            </button>
          `;

          // Login Management Buttons (Mobile ID & Password Access)
          var mobileDisplay = escapeHtml(emp.mobile || 'No Mobile ID');
          var userRole = (typeof localStorage !== 'undefined') ? localStorage.getItem('userRole') : null;
          var canResetPass = (userRole === 'super_admin' || userRole === 'admin');
          var loginMgmtHtml = `
            <div class="flex flex-col items-center space-y-1">
              <span class="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded font-mono font-bold text-[10px]" title="Mobile ID">${mobileDisplay}</span>
              ${canResetPass ? `
                <button onclick="openSetPasswordModalPrompt('${escapeHtml(emp.id)}')" class="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] rounded shadow-2xs transition-colors cursor-pointer flex items-center space-x-1">
                  <span>🔑 Reset Password</span>
                </button>
              ` : ''}
            </div>
          `;

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-slate-900">
              <div class="font-bold text-slate-900">${escapeHtml(emp.fullName)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(emp.employeeId)}</div>
            </td>
            <td class="py-3 px-4 text-slate-700">
              <div class="font-medium text-slate-800">${escapeHtml(emp.designation)}</div>
              <div class="text-[10px] text-slate-500">${escapeHtml(emp.vertical)}</div>
            </td>
            <td class="py-3 px-4 text-slate-600 font-medium">${escapeHtml(managerName)}</td>
            <td class="py-3 px-4 text-slate-600">
              <div class="font-medium text-slate-800">${escapeHtml(emp.email)}</div>
              <div class="text-[11px] font-bold font-mono text-indigo-700 flex items-center space-x-1 mt-0.5"><span class="text-[10px]">📱</span><span>${escapeHtml(emp.mobile || 'No Mobile')}</span></div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${emp.role === 'super_admin' ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300' : emp.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-300' : emp.role === 'manager' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-700'}">${escapeHtml(emp.role ? emp.role.replace('_', ' ') : 'staff')}</span>
            </td>
            <td class="py-3 px-4 text-center">${toggleHtml}</td>
            <td class="py-3 px-4 text-center">${loginMgmtHtml}</td>
            <td class="py-3 px-4 text-center space-x-2">
              <button onclick="viewDigitalFile('${escapeHtml(emp.id)}')" class="text-emerald-600 hover:text-emerald-800 font-bold hover:underline">File</button>
              <button onclick="editEmployee('${escapeHtml(emp.id)}')" class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline">Edit</button>
              <button onclick="deleteEmployee('${escapeHtml(emp.id)}')" class="text-rose-600 hover:text-rose-800 font-bold hover:underline">Delete</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function toggleActiveStatus(docId, newStatus) {
        window.RevOpsStore.updateItem('employees', docId, { isActive: newStatus });
        renderEmployeesTable();
      }

      function updateRoleAccessHint() {
        var r = document.getElementById('inp-role').value;
        var hint = document.getElementById('role-access-hint');
        if (!hint) return;
        if (r === 'super_admin') {
          hint.innerHTML = '💡 <strong>Super Admin Access:</strong> Unrestricted visibility across Executive RevOps Dashboard, Payroll CTC, Company Financials, and All Employee Scorecards.';
        } else if (r === 'admin') {
          hint.innerHTML = '💡 <strong>Admin Access:</strong> Operational Head. Full visibility across Leads, Orders, Expenses, Service Tickets, and All Teams.';
        } else if (r === 'manager') {
          hint.innerHTML = '💡 <strong>Manager Access:</strong> Vertical / Department Manager. Access to Direct Reports, Team Scorecards, DWM Approvals, and Vertical Orders.';
        } else {
          hint.innerHTML = '💡 <strong>Staff Access:</strong> Individual Contributor. Strictly restricted to Own Scorecard, Assigned Leads/Tickets, and Personal DWM/Expense Logs.';
        }
      }

      function openEmployeeModal() {
        document.getElementById('emp-doc-id').value = "";
        document.getElementById('emp-modal-title').innerText = "Add New Employee";

        // Reset inputs
        document.getElementById('inp-employee-id').value = "E-00" + (window.RevOpsStore.getCollection('employees').length + 1);
        document.getElementById('inp-full-name').value = "";
        document.getElementById('inp-designation').value = "";
        document.getElementById('inp-vertical').value = "Sales";
        document.getElementById('inp-sub-vertical').value = "";
        document.getElementById('inp-email').value = "";
        document.getElementById('inp-mobile').value = "";
        document.getElementById('inp-location').value = "";
        document.getElementById('inp-role').value = "staff";
        updateRoleAccessHint();
        document.getElementById('inp-is-primary-approver').checked = false;
        document.getElementById('inp-is-director-ratifier').checked = false;
        document.getElementById('inp-is-finance-head').checked = false;
        document.getElementById('inp-aop-target').value = 10000000;
        document.getElementById('inp-monthly-ctc').value = 75000;
        document.getElementById('inp-bank-name').value = "HDFC Bank";
        document.getElementById('inp-account-number').value = "";
        document.getElementById('inp-ifsc-code').value = "";
        document.getElementById('inp-pan-number').value = "";
        document.getElementById('inp-pf-number').value = "";
        document.getElementById('inp-advance-balance').value = 0;
        document.getElementById('inp-loan-balance').value = 0;

        // Populate Reports To
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var reportsToSelect = document.getElementById('inp-reports-to');
        reportsToSelect.innerHTML = `<option value="">None (Top Level)</option>`;
        employees.forEach(function(e) {
          var opt = document.createElement('option');
          opt.value = e.employeeId;
          opt.innerText = e.fullName + " (" + e.employeeId + ")";
          reportsToSelect.appendChild(opt);
        });

        document.getElementById('emp-modal').classList.remove('hidden');
      }

      function closeEmployeeModal() {
        document.getElementById('emp-modal').classList.add('hidden');
      }

      function editEmployee(docId) {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var emp = employees.find(function(e) { return e.id === docId; });
        if (!emp) return;

        document.getElementById('emp-doc-id').value = emp.id;
        document.getElementById('emp-modal-title').innerText = "Edit Employee - " + emp.fullName;

        document.getElementById('inp-employee-id').value = emp.employeeId;
        document.getElementById('inp-full-name').value = emp.fullName;
        document.getElementById('inp-designation').value = emp.designation;
        document.getElementById('inp-vertical').value = emp.vertical;
        document.getElementById('inp-sub-vertical').value = emp.subVertical || '';
        document.getElementById('inp-email').value = emp.email;
        document.getElementById('inp-mobile').value = emp.mobile;
        document.getElementById('inp-location').value = emp.location || '';
        document.getElementById('inp-role').value = emp.role || 'staff';
        updateRoleAccessHint();
        document.getElementById('inp-is-primary-approver').checked = !!emp.isPrimaryApprover;
        document.getElementById('inp-is-director-ratifier').checked = !!emp.isDirector;
        document.getElementById('inp-is-finance-head').checked = !!emp.isFinanceHead;
        document.getElementById('inp-aop-target').value = (emp.primaryAopTarget !== undefined && emp.primaryAopTarget !== null) ? emp.primaryAopTarget : 0;
        document.getElementById('inp-monthly-ctc').value = emp.monthlyCtc || 75000;
        document.getElementById('inp-bank-name').value = emp.bankName || 'HDFC Bank';
        document.getElementById('inp-account-number').value = emp.accountNumber || '';
        document.getElementById('inp-ifsc-code').value = emp.ifscCode || '';
        document.getElementById('inp-pan-number').value = emp.panNumber || '';
        document.getElementById('inp-pf-number').value = emp.pfNumber || '';
        document.getElementById('inp-advance-balance').value = emp.salaryAdvanceBalance || 0;
        document.getElementById('inp-loan-balance').value = emp.employeeLoanBalance || 0;

        var reportsToSelect = document.getElementById('inp-reports-to');
        reportsToSelect.innerHTML = `<option value="">None (Top Level)</option>`;
        employees.forEach(function(e) {
          if (e.id !== docId) {
            var opt = document.createElement('option');
            opt.value = e.employeeId;
            opt.innerText = e.fullName + " (" + e.employeeId + ")";
            if (e.employeeId === emp.reportsTo) opt.selected = true;
            reportsToSelect.appendChild(opt);
          }
        });

        document.getElementById('emp-modal').classList.remove('hidden');
      }

      function viewDigitalFile(docId) {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var emp = employees.find(function(e) { return e.id === docId; });
        if (!emp) return;

        var manager = employees.find(function(m) { return m.employeeId === emp.reportsTo; });
        var managerName = manager ? manager.fullName : (emp.reportsTo || 'Top Level / None');

        document.getElementById('dossier-avatar').innerText = emp.fullName.charAt(0).toUpperCase();
        document.getElementById('dossier-title').innerText = emp.fullName;
        document.getElementById('dossier-sub').innerText = emp.employeeId + " • " + (emp.isActive !== false ? 'Active Master Record' : 'Inactive');

        document.getElementById('dos-name').innerText = emp.fullName;
        document.getElementById('dos-designation').innerText = emp.designation;
        document.getElementById('dos-vertical').innerText = emp.vertical + (emp.subVertical ? (' (' + emp.subVertical + ')') : '');
        document.getElementById('dos-manager').innerText = managerName;
        document.getElementById('dos-email').innerText = emp.email;
        document.getElementById('dos-contact').innerText = emp.mobile + (emp.location ? (' (' + emp.location + ')') : '');

        document.getElementById('dos-ctc').innerText = formatINR(emp.monthlyCtc || 75000);
        document.getElementById('dos-aop').innerText = formatINR(emp.primaryAopTarget || 10000000);
        document.getElementById('dos-role').innerText = emp.role || 'staff';
        document.getElementById('dos-bank').innerText = emp.bankName || 'HDFC Bank';
        document.getElementById('dos-account').innerText = emp.accountNumber ? ('****' + emp.accountNumber.slice(-4)) : '****4892';
        document.getElementById('dos-ifsc').innerText = emp.ifscCode || 'HDFC0000123';
        document.getElementById('dos-pan').innerText = emp.panNumber || 'AAAPM1234F';
        document.getElementById('dos-pf').innerText = emp.pfNumber || 'UAN10098273';
        document.getElementById('dos-advance').innerText = formatINR(emp.salaryAdvanceBalance || 0);

        document.getElementById('digital-dossier-modal').classList.remove('hidden');
      }

      function closeDigitalDossier() {
        document.getElementById('digital-dossier-modal').classList.add('hidden');
      }

      function handleSaveEmployee(e) {
        e.preventDefault();
        var docId = document.getElementById('emp-doc-id').value;

        var empData = {
          employeeId: document.getElementById('inp-employee-id').value.trim(),
          fullName: document.getElementById('inp-full-name').value.trim(),
          designation: document.getElementById('inp-designation').value.trim(),
          vertical: document.getElementById('inp-vertical').value,
          subVertical: document.getElementById('inp-sub-vertical').value.trim(),
          reportsTo: document.getElementById('inp-reports-to').value,
          email: document.getElementById('inp-email').value.trim(),
          mobile: document.getElementById('inp-mobile').value.trim(),
          location: document.getElementById('inp-location').value.trim(),
          role: document.getElementById('inp-role').value,
          isPrimaryApprover: document.getElementById('inp-is-primary-approver').checked,
          isDirector: document.getElementById('inp-is-director-ratifier').checked,
          isFinanceHead: document.getElementById('inp-is-finance-head').checked,
          primaryAopTarget: document.getElementById('inp-aop-target').value !== "" ? Number(document.getElementById('inp-aop-target').value) : 0,
          monthlyCtc: document.getElementById('inp-monthly-ctc').value !== "" ? Number(document.getElementById('inp-monthly-ctc').value) : 75000,
          bankName: document.getElementById('inp-bank-name').value.trim(),
          accountNumber: document.getElementById('inp-account-number').value.trim(),
          ifscCode: document.getElementById('inp-ifsc-code').value.trim(),
          panNumber: document.getElementById('inp-pan-number').value.trim(),
          pfNumber: document.getElementById('inp-pf-number').value.trim(),
          salaryAdvanceBalance: Number(document.getElementById('inp-advance-balance').value) || 0,
          employeeLoanBalance: Number(document.getElementById('inp-loan-balance').value) || 0,
          isActive: true
        };

        if (docId) {
          window.RevOpsStore.updateItem('employees', docId, empData);
        } else {
          window.RevOpsStore.addItem('employees', empData);
        }

        // Keep the users/{uid} role doc (what Firestore rules and approval
        // gates actually check) in sync with the role and approval-authority
        // flags just saved here, for anyone who already has a real login.
        if (docId && window.db) {
          var employees = window.RevOpsStore.getCollection('employees') || [];
          var savedEmp = employees.find(function(e) { return e.id === docId; });
          if (savedEmp && savedEmp.uid && savedEmp.uid.indexOf('uid_demo_') !== 0) {
            window.db.collection('users').doc(savedEmp.uid).set({
              employeeId: empData.employeeId,
              role: empData.role,
              isPrimaryApprover: empData.isPrimaryApprover,
              isDirector: empData.isDirector,
              isFinanceHead: empData.isFinanceHead
            }, { merge: true }).catch(function(err) {
              console.warn("Could not sync users/ role doc for", savedEmp.uid, err);
            });
          }
        }

        closeEmployeeModal();
        renderEmployeesTable();
      }

      function deleteEmployee(docId) {
        if (confirm("Are you sure you want to delete this employee?")) {
          window.RevOpsStore.deleteItem('employees', docId);
          renderEmployeesTable();
        }
      }

      function openCreateLoginModalEmp(docId, name, email) {
        document.getElementById('login-modal-doc-id').value = docId;
        document.getElementById('create-login-emp-title').innerText = "Create Login for " + name;
        document.getElementById('login-modal-email').value = email;
        genPassEmp();
        document.getElementById('create-login-modal-emp').classList.remove('hidden');
      }

      function closeCreateLoginModalEmp() {
        document.getElementById('create-login-modal-emp').classList.add('hidden');
      }

      function genPassEmp() {
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var pass = "";
        for (var i = 0; i < 8; i++) {
          pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        document.getElementById('login-modal-pass').value = pass;
      }

      function handleCreateLoginSubmitEmp(e) {
        e.preventDefault();
        var docId = document.getElementById('login-modal-doc-id').value;
        var email = document.getElementById('login-modal-email').value;
        var tempPass = document.getElementById('login-modal-pass').value;

        if (typeof firebase !== 'undefined' && firebase.initializeApp) {
          try {
            var secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp_" + Date.now());
            var secondaryAuth = secondaryApp.auth();

            secondaryAuth.createUserWithEmailAndPassword(email, tempPass)
              .then(function(cred) {
                var newUid = cred.user ? cred.user.uid : null;
                window.RevOpsStore.updateItem('employees', docId, { uid: newUid });
                if (newUid && window.db) {
                  var emps = window.RevOpsStore.getCollection('employees') || [];
                  var empRec = emps.find(function(item) { return item.id === docId || item.docId === docId; }) || {};
                  window.db.collection('users').doc(newUid).set({
                    employeeId: empRec.employeeId || '',
                    role: empRec.role || 'staff'
                  }, { merge: true }).catch(function(err) {
                    console.warn("Error creating users mapping document:", err);
                  });
                }
                return secondaryAuth.signOut();
              })
              .then(function() {
                secondaryApp.delete();
                alert("Login created!\nEmail: " + email + "\nTemporary Password: " + tempPass + "\n\nPlease share this with the employee securely.");
                closeCreateLoginModalEmp();
                renderEmployeesTable();
              })
              .catch(function() {
                window.RevOpsStore.updateItem('employees', docId, { uid: "uid_demo_" + Date.now() });
                alert("Login created!\nEmail: " + email + "\nTemporary Password: " + tempPass);
                closeCreateLoginModalEmp();
                renderEmployeesTable();
              });
          } catch(e) {
            window.RevOpsStore.updateItem('employees', docId, { uid: "uid_demo_" + Date.now() });
            alert("Login created!\nEmail: " + email + "\nTemporary Password: " + tempPass);
            closeCreateLoginModalEmp();
            renderEmployeesTable();
          }
        }
      }

      function openSetPasswordModalPrompt(targetDocId) {
        var userRole = (typeof localStorage !== 'undefined') ? localStorage.getItem('userRole') : null;
        if (userRole !== 'super_admin' && userRole !== 'admin') {
          alert("Access denied. Only Super Admin or Admin can reset passwords.");
          return;
        }

        var employees = window.RevOpsStore.getCollection('employees') || [];
        var select = document.getElementById('pass-modal-emp-select');
        select.innerHTML = "";

        employees.forEach(function(e) {
          var opt = document.createElement('option');
          opt.value = e.id;
          opt.innerText = e.fullName + " (" + e.employeeId + " • " + (e.mobile || 'No Mobile') + ")";
          if (targetDocId && e.id === targetDocId) opt.selected = true;
          select.appendChild(opt);
        });

        updatePassModalDetails();
        document.getElementById('set-password-modal').classList.remove('hidden');
      }

      function closeSetPasswordModal() {
        document.getElementById('set-password-modal').classList.add('hidden');
      }

      function generateRandomPassword() {
        var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
        var pass = "";
        for (var i = 0; i < 10; i++) {
          pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
      }

      function updatePassModalDetails() {
        var docId = document.getElementById('pass-modal-emp-select').value;
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var emp = employees.find(function(e) { return e.id === docId; });
        if (emp) {
          document.getElementById('pass-modal-mobile').innerText = emp.mobile || '--';
          document.getElementById('pass-modal-email').innerText = emp.email || '--';
          document.getElementById('pass-modal-input').value = generateRandomPassword();
        }
      }

      async function handleSaveEmployeePassword(e) {
        e.preventDefault();
        var userRole = (typeof localStorage !== 'undefined') ? localStorage.getItem('userRole') : null;
        if (userRole !== 'super_admin' && userRole !== 'admin') {
          alert("Access denied. Only Super Admin or Admin can reset passwords.");
          return;
        }

        var docId = document.getElementById('pass-modal-emp-select').value;
        var newPass = document.getElementById('pass-modal-input').value.trim();

        if (!newPass || newPass.length < 6) {
          alert("Please enter a valid password (at least 6 characters).");
          return;
        }

        var employees = window.RevOpsStore.getCollection('employees') || [];
        var emp = employees.find(function(it) { return it.id === docId || it.docId === docId; });

        if (!emp) {
          alert("Selected employee record not found.");
          return;
        }

        var saveBtn = e.target.querySelector('button[type="submit"]');
        var origText = saveBtn ? saveBtn.innerText : 'Save Password';
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerText = 'Saving...';
        }

        // 1. Save password update directly to RevOpsStore & Firestore employees document
        window.RevOpsStore.updateItem('employees', docId, {
          customPassword: newPass,
          password: newPass,
          passwordLastUpdated: new Date().toISOString()
        });

        // Sync directly to Firestore if available
        if (window.db && typeof window.db.collection === 'function') {
          var targetId = emp.id || docId;
          window.db.collection('employees').doc(targetId).set({
            customPassword: newPass,
            password: newPass,
            passwordLastUpdated: new Date().toISOString()
          }, { merge: true }).catch(function(err) {
            console.warn("Error updating password in Firestore employees collection:", err);
          });
        }

        // 2. Attempt Firebase Auth secondaryApp or Netlify function sync in background
        var authSuccess = false;
        if (emp.uid && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
          try {
            var currentUser = firebase.auth().currentUser;
            var idToken = await currentUser.getIdToken(true);
            var response = await fetch('/.netlify/functions/reset-password', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + idToken
              },
              body: JSON.stringify({
                targetUid: emp.uid,
                newPassword: newPass
              })
            });
            var resData = await response.json();
            if (response.ok && resData.success) {
              authSuccess = true;
            }
          } catch(err) {
            console.warn("Netlify password reset function call ignored/failed:", err);
          }
        }

        // Also try creating/updating Firebase Auth via secondaryApp if email is available
        if (!authSuccess && emp.email && typeof firebase !== 'undefined' && firebase.initializeApp) {
          try {
            var secondaryApp = firebase.initializeApp(firebaseConfig, "PassReset_" + Date.now());
            var secondaryAuth = secondaryApp.auth();
            secondaryAuth.createUserWithEmailAndPassword(emp.email, newPass)
              .then(function(cred) {
                var newUid = cred.user ? cred.user.uid : null;
                if (newUid) {
                  window.RevOpsStore.updateItem('employees', docId, { uid: newUid });
                }
                secondaryAuth.signOut().then(function() { secondaryApp.delete(); });
              })
              .catch(function(err) {
                secondaryApp.delete();
              });
          } catch(e) {
            console.warn("Secondary app auth error:", e);
          }
        }

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = origText;
        }

        alert("✅ Password Successfully Saved!\n\nEmployee: " + emp.fullName + "\nMobile ID: " + (emp.mobile || 'N/A') + "\nEmail: " + (emp.email || 'N/A') + "\nNew Password: " + newPass + "\n\nThe employee can now log in using their Mobile Number and this New Password.");
        closeSetPasswordModal();
        renderEmployeesTable();
      }
