var currentTab = 'travel-app';
      var currentClaimPage = 1;
      var claimItemsStore = [];

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth()) {
          initDefaultFinancialData();
          populateProjectDropdown();
          populateEmployeeDropdowns();
          renderTravelApprovals();
          renderExpensesTable();
          renderPolicyMaster();
          renderProjectProfitability();
          renderBudgets();

          var urlParams = new URLSearchParams(window.location.search);
          var tabParam = urlParams.get('tab');
          if (tabParam) {
            switchMainTab(tabParam);
          }
        }
      });

      function initDefaultFinancialData() {
        // Initialize Projects Master (Project Code Revenue & Cost Center)
        var projects = window.RevOpsStore.getCollection('projectsMaster');
        if (!projects || projects.length === 0) {
          var defaultProjects = [
            {
              id: 'PRJ-2026-101',
              projectCode: 'PRJ-2026-101',
              projectName: 'Tata Steel Weighbridge SLA & Automation',
              clientName: 'Tata Steel Long Products',
              vertical: 'Projects',
              budget: 2500000,
              milestones: [
                { id: 'M1', title: 'Supply & Hardware Dispatch', amount: 1500000, status: 'Received' },
                { id: 'M2', title: 'Installation & Calibration Commissioning', amount: 800000, status: 'Invoiced' }
              ],
              tmBillings: [
                { id: 'TM1', title: 'Overtime Automation Engineering (40 hrs @ ₹2,000)', hours: 40, rate: 2000, amount: 80000, status: 'Invoiced' }
              ],
              changeOrders: [
                { id: 'CO1', title: 'Additional Heavy-Duty Load Cell Cables', amount: 50000, status: 'Approved' }
              ],
              directLaborCost: 350000,
              subcontractorCost: 280000,
              materialsCost: 850000
            },
            {
              id: 'PRJ-2026-102',
              projectCode: 'PRJ-2026-102',
              projectName: 'Jindal Steels Crane Scales Overhaul',
              clientName: 'Jindal Steels & Minerals Ltd',
              vertical: 'Projects',
              budget: 1800000,
              milestones: [
                { id: 'M1', title: 'Phase 1 Sensor Supply & Disassembly', amount: 1000000, status: 'Received' },
                { id: 'M2', title: 'Phase 2 Load Cell Testing & Final Signoff', amount: 600000, status: 'Invoiced' }
              ],
              tmBillings: [
                { id: 'TM1', title: 'Specialist On-site Calibration (30 hrs @ ₹2,500)', hours: 30, rate: 2500, amount: 75000, status: 'Invoiced' }
              ],
              changeOrders: [
                { id: 'CO1', title: 'Wireless Display Module Upgrade', amount: 45000, status: 'Approved' }
              ],
              directLaborCost: 250000,
              subcontractorCost: 190000,
              materialsCost: 620000
            },
            {
              id: 'PRJ-2026-103',
              projectCode: 'PRJ-2026-103',
              projectName: 'Vedanta Smelter Belt Weighers Integration',
              clientName: 'Vedanta Aluminium & Power',
              vertical: 'Projects',
              budget: 1400000,
              milestones: [
                { id: 'M1', title: 'Belt Weigher Hardware Supply', amount: 900000, status: 'Received' },
                { id: 'M2', title: 'Site Integration & PLC Interfacing', amount: 400000, status: 'Pending' }
              ],
              tmBillings: [],
              changeOrders: [],
              directLaborCost: 180000,
              subcontractorCost: 120000,
              materialsCost: 510000
            }
          ];
          window.RevOpsStore.saveCollection('projectsMaster', defaultProjects);
        }

        // Initialize Expense Splits Collection
        var splits = window.RevOpsStore.getCollection('expenseSplits');
        if (!splits || splits.length === 0) {
          var defaultSplits = [
            { splitId: 'SPL-101', expenseId: 'TRV-1001', projectCode: 'PRJ-2026-101', allocationMode: 'weighted', allocatedPercentage: 60, allocatedAmount: 11100, expenseClassification: 'Allocated Shared' },
            { splitId: 'SPL-102', expenseId: 'TRV-1001', projectCode: 'PRJ-2026-102', allocationMode: 'weighted', allocatedPercentage: 40, allocatedAmount: 7400, expenseClassification: 'Allocated Shared' }
          ];
          window.RevOpsStore.saveCollection('expenseSplits', defaultSplits);
        }

        // Initialize Grade-based Master Travel Policy
        var policy = window.RevOpsStore.getCollection('travelPolicyMaster');
        if (!policy || policy.length === 0 || !policy[0].gradeCode) {
          var defaultGradePolicies = [
            {
              id: 'pol_M1',
              gradeCode: 'M1',
              gradeName: 'Executive Board & Directors (Grade M1)',
              description: 'Director / Board Members / C-Suite Leadership',
              hotelLimitPerDay: 8000,
              daLimitPerDay: 2500,
              localConveyancePerDay: 3000,
              flightLimitPerTrip: 25000,
              clientEntertainmentLimit: 15000,
              travelModeClass: 'Air (Business/Economy) / AC Taxi / Premium Stay',
              requiresPreApproval: false,
              updatedAt: '2026-08-01'
            },
            {
              id: 'pol_M2',
              gradeCode: 'M2',
              gradeName: 'Senior Management & Department Heads (Grade M2)',
              description: 'Marketing Head, Technical Head, VPs, General Managers',
              hotelLimitPerDay: 5500,
              daLimitPerDay: 1800,
              localConveyancePerDay: 2200,
              flightLimitPerTrip: 15000,
              clientEntertainmentLimit: 10000,
              travelModeClass: 'Air (Economy) / Express Train AC 1st Class / Premium Cab',
              requiresPreApproval: true,
              updatedAt: '2026-08-01'
            },
            {
              id: 'pol_M3',
              gradeCode: 'M3',
              gradeName: 'Middle Management & Team Leads (Grade M3)',
              description: 'Project Leads, Onboard Lead, Digital Marketing Lead, Territory Leads',
              hotelLimitPerDay: 3800,
              daLimitPerDay: 1300,
              localConveyancePerDay: 1600,
              flightLimitPerTrip: 10000,
              clientEntertainmentLimit: 5000,
              travelModeClass: 'Air (Economy) / Train AC 2-Tier / Dedicated Taxi',
              requiresPreApproval: true,
              updatedAt: '2026-08-01'
            },
            {
              id: 'pol_E1',
              gradeCode: 'E1',
              gradeName: 'Senior Engineers & Senior Executives (Grade E1)',
              description: 'Senior Engineers, Senior Sales Execs, Specialists',
              hotelLimitPerDay: 2500,
              daLimitPerDay: 900,
              localConveyancePerDay: 1100,
              flightLimitPerTrip: 6000,
              clientEntertainmentLimit: 2000,
              travelModeClass: 'Express Train AC 3-Tier / AC Bus / Auto/Taxi',
              requiresPreApproval: true,
              updatedAt: '2026-08-01'
            },
            {
              id: 'pol_E2',
              gradeCode: 'E2',
              gradeName: 'Field Engineers & Field Executives (Grade E2)',
              description: 'Service Engineers, Site Technicians, Trainees',
              hotelLimitPerDay: 1800,
              daLimitPerDay: 600,
              localConveyancePerDay: 800,
              flightLimitPerTrip: 0,
              clientEntertainmentLimit: 0,
              travelModeClass: 'Train AC 3-Tier / Sleeper / Bus / Local Conveyance',
              requiresPreApproval: true,
              updatedAt: '2026-08-01'
            }
          ];
          window.RevOpsStore.saveCollection('travelPolicyMaster', defaultGradePolicies);
        }

        // Initialize Travel Pre-Approvals
        var preApps = window.RevOpsStore.getCollection('travelApprovals');
        if (!preApps || preApps.length === 0) {
          var defaultPreApps = [
            {
              id: 'TRV-APP-101',
              empId: 'EMP-101',
              employeeName: 'Murugan',
              vertical: 'Sales',
              startDate: '2026-07-15',
              endDate: '2026-07-18',
              places: 'Jharsuguda & Rourkela Industrial Belts',
              purpose: 'New Crane Scale SLA contract & plant load cell inspection',
              clientType: 'existing',
              clientName: 'Tata Steel Long Products',
              contactPerson: 'Mr. S. K. Mahapatra (Sr. GM Projects)',
              contactPhone: '+91 97760 88210',
              estimatedBudget: 18000,
              isExtension: false,
              refId: '',
              status: 'Approved',
              appliedDate: '2026-07-10',
              extensionReason: ''
            },
            {
              id: 'TRV-APP-102',
              empId: 'EMP-102',
              employeeName: 'Sivakumar',
              vertical: 'Service/Parts',
              startDate: '2026-07-20',
              endDate: '2026-07-22',
              places: 'Toranagallu, Bellary Cluster',
              purpose: 'Emergency Weighbridge Indicator Replacement & Calibration',
              clientType: 'new',
              clientName: 'Jindal Steels & Minerals Ltd',
              contactPerson: 'Mr. Rajesh Sharma (Plant Head)',
              contactPhone: '+91 98450 12345',
              estimatedBudget: 12000,
              isExtension: false,
              refId: '',
              status: 'Approved',
              appliedDate: '2026-07-18',
              extensionReason: ''
            }
          ];
          window.RevOpsStore.saveCollection('travelApprovals', defaultPreApps);
        }

        var expenses = window.RevOpsStore.getCollection('expenses');
        if (!expenses || expenses.length === 0) {
          var sampleExpenses = [
            {
              id: 'exp_1',
              voucherNo: 'TRV-1001',
              date: '2026-07-18',
              category: 'Travelling',
              payee: 'Murugan',
              amount: 18500,
              vertical: 'Sales',
              projectId: '',
              paymentMode: 'Bank Transfer',
              remarks: 'Travel Claim: Jharsuguda Cluster (2026-07-15 - 2026-07-18) [Hotel: ₹10500, DA: ₹3600, Tickets: ₹4400]',
              status: 'Approved',
              receiptBase64: '',
              policyExceeded: false,
              preAppRefId: 'TRV-APP-101',
              clientName: 'Tata Steel Long Products',
              items: [
                { date: '2026-07-15', category: 'Flight/Train Ticket', desc: 'Flight Chennai to Jharsuguda', amount: 4400, receiptBase64: '' },
                { date: '2026-07-16', category: 'Hotel Accommodation', desc: 'Hotel Grand Residency 2 nights', amount: 10500, receiptBase64: '' },
                { date: '2026-07-17', category: 'Daily Allowance (Food)', desc: 'Daily allowance 3 days', amount: 3600, receiptBase64: '' }
              ]
            },
            {
              id: 'exp_2',
              voucherNo: 'VOUCH-1002',
              date: '2026-07-14',
              category: 'Project Expenses',
              payee: 'Universal Testing Corp',
              amount: 650000,
              vertical: 'Projects',
              projectId: 'ORD_101',
              paymentMode: 'Bank Transfer',
              remarks: 'Raw material load cell sensors & crane scale calibration kit for Steel Plant Project',
              status: 'Approved',
              receiptBase64: ''
            },
            {
              id: 'exp_3',
              voucherNo: 'VOUCH-1003',
              date: '2026-07-18',
              category: 'Admin',
              payee: 'Airtel Broadband & Utilities',
              amount: 14200,
              vertical: 'Overhead',
              projectId: '',
              paymentMode: 'UPI',
              remarks: 'Head office internet, landline & cloud server hosting bill',
              status: 'Approved',
              receiptBase64: ''
            },
            {
              id: 'exp_4',
              voucherNo: 'VOUCH-1004',
              date: '2026-07-22',
              category: 'Salary Advance',
              payee: 'Sivakumar',
              amount: 25000,
              vertical: 'Service/Parts',
              projectId: '',
              paymentMode: 'Bank Transfer',
              remarks: 'Temporary salary advance for field service emergency',
              status: 'Approved',
              receiptBase64: ''
            }
          ];
          window.RevOpsStore.saveCollection('expenses', sampleExpenses);
        }

        var budgets = window.RevOpsStore.getCollection('budgets');
        if (!budgets || budgets.length === 0) {
          var sampleBudgets = [
            { id: 'bud_1', vertical: 'Sales', category: 'Travelling', monthlyLimit: 50000 },
            { id: 'bud_2', vertical: 'Projects', category: 'Project Expenses', monthlyLimit: 1000000 },
            { id: 'bud_3', vertical: 'Overhead', category: 'Admin', monthlyLimit: 50000 },
            { id: 'bud_4', vertical: 'Service/Parts', category: 'Equipment', monthlyLimit: 80000 }
          ];
          window.RevOpsStore.saveCollection('budgets', sampleBudgets);
        }
      }

      function populateProjectDropdown() {
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var select = document.getElementById('exp-project-id');
        if (!select) return;
        select.innerHTML = `<option value="">None / General Expense</option>`;
        orders.forEach(function(ord) {
          var opt = document.createElement('option');
          opt.value = ord.id || ord.orderId;
          opt.innerText = (ord.customerName || 'Project') + " (Val: " + formatINR(ord.orderValue || 0) + ")";
          select.appendChild(opt);
        });
      }

      function populateEmployeeDropdowns() {
        var emps = window.RevOpsStore.getCollection('employees') || [];
        var selects = ['travel-emp-id', 'preapp-emp-id'];
        selects.forEach(function(sId) {
          var el = document.getElementById(sId);
          if (!el) return;
          el.innerHTML = "";
          emps.forEach(function(e) {
            var opt = document.createElement('option');
            opt.value = e.employeeId;
            opt.innerText = e.fullName + " (" + e.employeeId + " - " + e.vertical + ")";
            el.appendChild(opt);
          });
        });

        // Populate clients in pre-app
        var clients = window.RevOpsStore.getCollection('clients') || window.RevOpsStore.getCollection('leads') || [];
        var clientSelect = document.getElementById('preapp-existing-client');
        if (clientSelect) {
          clientSelect.innerHTML = `<option value="">-- Select Master Client --</option>`;
          if (clients.length === 0) {
            clientSelect.innerHTML += `<option value="Tata Steel Long Products">Tata Steel Long Products</option>`;
            clientSelect.innerHTML += `<option value="Jindal Stainless Works">Jindal Stainless Works</option>`;
            clientSelect.innerHTML += `<option value="Vedanta Aluminium & Power">Vedanta Aluminium & Power</option>`;
          } else {
            clients.forEach(function(c) {
              var opt = document.createElement('option');
              opt.value = c.companyName || c.clientName || c.name || 'Client';
              opt.innerText = c.companyName || c.clientName || c.name || 'Client';
              clientSelect.appendChild(opt);
            });
          }
        }
      }

      function switchMainTab(tabName) {
        currentTab = tabName;
        document.getElementById('sec-travel-app').classList.add('hidden');
        document.getElementById('sec-ledger').classList.add('hidden');
        document.getElementById('sec-policy').classList.add('hidden');
        document.getElementById('sec-profit').classList.add('hidden');
        document.getElementById('sec-budget').classList.add('hidden');
        if (document.getElementById('sec-split')) document.getElementById('sec-split').classList.add('hidden');
        if (document.getElementById('sec-fin-statements')) document.getElementById('sec-fin-statements').classList.add('hidden');

        var btnIds = ['tab-btn-travel-app', 'tab-btn-ledger', 'tab-btn-split', 'tab-btn-policy', 'tab-btn-profit', 'tab-btn-budget', 'tab-btn-fin-statements'];
        btnIds.forEach(function(bId) {
          var btn = document.getElementById(bId);
          if (btn) btn.className = "px-4 py-2.5 font-bold text-xs border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-2 cursor-pointer";
        });

        if (tabName === 'travel-app') {
          document.getElementById('sec-travel-app').classList.remove('hidden');
          document.getElementById('tab-btn-travel-app').className = "px-4 py-2.5 font-bold text-xs border-b-2 border-sky-600 text-sky-600 flex items-center space-x-2 cursor-pointer";
          renderTravelApprovals();
        } else if (tabName === 'ledger') {
          document.getElementById('sec-ledger').classList.remove('hidden');
          document.getElementById('tab-btn-ledger').className = "px-4 py-2.5 font-bold text-xs border-b-2 border-indigo-600 text-indigo-600 flex items-center space-x-2 cursor-pointer";
          renderExpensesTable();
        } else if (tabName === 'split') {
          if (document.getElementById('sec-split')) document.getElementById('sec-split').classList.remove('hidden');
          document.getElementById('tab-btn-split').className = "px-4 py-2.5 font-bold text-xs border-b-2 border-indigo-600 text-indigo-600 flex items-center space-x-2 cursor-pointer";
          renderProjectRevenueAndSplitSection();
        } else if (tabName === 'policy') {
          document.getElementById('sec-policy').classList.remove('hidden');
          document.getElementById('tab-btn-policy').className = "px-4 py-2.5 font-bold text-xs border-b-2 border-indigo-600 text-indigo-600 flex items-center space-x-2 cursor-pointer";
          renderPolicyMaster();
        } else if (tabName === 'profit') {
          document.getElementById('sec-profit').classList.remove('hidden');
          document.getElementById('tab-btn-profit').className = "px-4 py-2.5 font-bold text-xs border-b-2 border-indigo-600 text-indigo-600 flex items-center space-x-2 cursor-pointer";
          renderProjectProfitability();
        } else if (tabName === 'budget') {
          document.getElementById('sec-budget').classList.remove('hidden');
          document.getElementById('tab-btn-budget').className = "px-4 py-2.5 font-bold text-xs border-b-2 border-indigo-600 text-indigo-600 flex items-center space-x-2 cursor-pointer";
          renderBudgets();
        } else if (tabName === 'fin-statements') {
          if (document.getElementById('sec-fin-statements')) document.getElementById('sec-fin-statements').classList.remove('hidden');
          document.getElementById('tab-btn-fin-statements').className = "px-4 py-2.5 font-bold text-xs border-b-2 border-indigo-600 text-indigo-600 flex items-center space-x-2 cursor-pointer";
          renderFinancialStatements();
        }
      }

      /* RENDER TRAVEL PRE-APPROVALS */
      function renderTravelApprovals() {
        var preApps = window.RevOpsStore.getCollection('travelApprovals') || [];
        var statusFlt = document.getElementById('flt-preapp-status').value;
        var search = document.getElementById('flt-preapp-search').value.toLowerCase();

        var pendingCount = 0, approvedCount = 0, extendedCount = 0;
        preApps.forEach(function(a) {
          if (a.status === 'Pending Manager Approval') pendingCount++;
          if (a.status === 'Approved') approvedCount++;
          if (a.isExtension) extendedCount++;
        });

        document.getElementById('stat-preapp-pending').innerText = pendingCount + " Requests";
        document.getElementById('stat-preapp-approved').innerText = approvedCount + " Authorized";
        document.getElementById('stat-preapp-extended').innerText = extendedCount + " Extended Trips";

        var filtered = preApps.filter(function(a) {
          if (statusFlt !== 'All' && a.status !== statusFlt) return false;
          if (search && !((a.employeeName||'').toLowerCase().includes(search) || (a.places||'').toLowerCase().includes(search) || (a.clientName||'').toLowerCase().includes(search))) return false;
          return true;
        });

        var tbody = document.getElementById('travel-approvals-tbody');
        tbody.innerHTML = "";

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">No travel pre-approvals match current search.</td></tr>`;
          return;
        }

        filtered.forEach(function(app) {
          var statusBadge = 'bg-slate-100 text-slate-700 border-slate-300';
          if (app.status === 'Approved') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
          if (app.status === 'Pending Manager Approval') statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
          if (app.status === 'Rejected') statusBadge = 'bg-rose-100 text-rose-800 border-rose-300';

          var extTag = app.isExtension ? `<span class="px-2 py-0.5 ml-1 rounded bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-300">TRIP EXTENDED</span>` : '';

          var approveBtn = app.status === 'Pending Manager Approval'
            ? `<button onclick="approvePreApproval('${app.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shadow-xs">Approve</button>`
            : '';

          var extendBtn = (app.status === 'Approved')
            ? `<button onclick="openPreApprovalModalForExtension('${app.id}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] rounded-lg border border-amber-300 transition-colors cursor-pointer">Extend Trip</button>`
            : '';

          var claimBtn = (app.status === 'Approved')
            ? `<button onclick="openTravelClaimForApprovedPreApp('${app.id}')" class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-[11px] rounded-lg border border-sky-300 transition-colors cursor-pointer">Submit Claim</button>`
            : '';

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-slate-900">
              <div class="font-bold text-sky-900">${escapeHtml(app.id)} ${extTag}</div>
              <div class="text-[10px] text-slate-400">Applied: ${escapeHtml(app.appliedDate || app.startDate)}</div>
            </td>
            <td class="py-3 px-4 text-slate-700">
              <div class="font-bold text-slate-900">${escapeHtml(app.employeeName)}</div>
              <div class="text-[10px] text-slate-500 font-medium">${escapeHtml(app.vertical)} (${escapeHtml(app.empId)})</div>
            </td>
            <td class="py-3 px-4 text-slate-700">
              <div class="font-bold text-slate-800 text-xs">${escapeHtml(app.startDate)} to ${escapeHtml(app.endDate)}</div>
              <div class="text-[11px] text-sky-700 font-semibold">${escapeHtml(app.places)}</div>
            </td>
            <td class="py-3 px-4 text-slate-600">
              <div class="font-bold text-indigo-800">${app.clientName || 'General Client'}</div>
              <div class="text-[10px] text-slate-500">${app.contactPerson || 'Contact N/A'} (${app.purpose})</div>
            </td>
            <td class="py-3 px-4 text-right font-extrabold text-slate-900">
              ${formatINR(app.estimatedBudget)}
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusBadge}">${app.status}</span>
            </td>
            <td class="py-3 px-4 text-center space-x-1">
              ${approveBtn}
              ${extendBtn}
              ${claimBtn}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function approvePreApproval(appId) {
        window.RevOpsStore.updateItem('travelApprovals', appId, { status: 'Approved' });
        renderTravelApprovals();
        alert("Travel Pre-Approval " + appId + " approved by Reporting Manager.");
      }

      /* MASTER POLICY RENDER (GRADE LEVEL HIERARCHY) */
      var selectedPolicyGradeFilter = 'ALL';

      function renderPolicyMaster() {
        var policies = window.RevOpsStore.getCollection('travelPolicyMaster') || [];
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var container = document.getElementById('policy-cards-container');
        var pillsContainer = document.getElementById('policy-grade-filter-pills');

        if (!container) return;
        container.innerHTML = "";

        if (!policies || policies.length === 0) {
          container.innerHTML = `<div class="col-span-3 py-8 text-center text-slate-400">No travel policy grade levels defined yet. Click above to configure grade rules.</div>`;
          return;
        }

        // Render Grade Filter Pills
        if (pillsContainer) {
          pillsContainer.innerHTML = "";
          var allPill = document.createElement('button');
          allPill.type = 'button';
          allPill.className = "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer " + (selectedPolicyGradeFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200');
          allPill.innerText = "All Grades (" + policies.length + ")";
          allPill.onclick = function() { selectedPolicyGradeFilter = 'ALL'; renderPolicyMaster(); };
          pillsContainer.appendChild(allPill);

          policies.forEach(function(p) {
            var pill = document.createElement('button');
            pill.type = 'button';
            pill.className = "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer " + (selectedPolicyGradeFilter === p.gradeCode ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200');
            pill.innerText = (p.gradeCode || 'Grade') + " (" + (p.gradeName || '').split('-')[0].trim() + ")";
            pill.onclick = function() { selectedPolicyGradeFilter = p.gradeCode; renderPolicyMaster(); };
            pillsContainer.appendChild(pill);
          });
        }

        var filteredPolicies = policies.filter(function(p) {
          if (selectedPolicyGradeFilter !== 'ALL' && p.gradeCode !== selectedPolicyGradeFilter) return false;
          return true;
        });

        filteredPolicies.forEach(function(p) {
          // Count matching employees
          var matchingEmps = employees.filter(function(e) { return e.grade === p.gradeCode; });
          var empCount = matchingEmps.length;
          var empNames = matchingEmps.slice(0, 3).map(function(e) { return e.fullName || e.name || e.employeeId; }).join(', ');
          if (empCount > 3) empNames += ' + ' + (empCount - 3) + ' more';

          var card = document.createElement('div');
          card.className = "bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 hover:border-indigo-300 transition-all flex flex-col justify-between";
          card.innerHTML = `
            <div class="space-y-3">
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="px-2.5 py-0.5 rounded-lg text-xs font-extrabold uppercase bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono">${escapeHtml(p.gradeCode || 'Grade')}</span>
                    <h3 class="text-sm font-extrabold text-slate-900">${escapeHtml(p.gradeName || 'Grade Policy')}</h3>
                  </div>
                  <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${escapeHtml(p.description || 'Applicable grade level policy')}</p>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">${empCount} Employees</span>
              </div>

              ${empCount > 0 ? `<div class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 font-medium truncate">👥 Employees in Grade: <span class="font-bold text-slate-800">${escapeHtml(empNames)}</span></div>` : ''}

              <div class="grid grid-cols-2 gap-2 text-xs pt-1">
                <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span class="text-[10px] font-bold text-slate-400 uppercase block">🏨 Hotel Stay / Day</span>
                  <span class="font-extrabold text-slate-900 text-sm">${formatINR(p.hotelLimitPerDay)}</span>
                </div>
                <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span class="text-[10px] font-bold text-slate-400 uppercase block">🍽️ Food / DA / Day</span>
                  <span class="font-extrabold text-slate-900 text-sm">${formatINR(p.daLimitPerDay)}</span>
                </div>
                <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span class="text-[10px] font-bold text-slate-400 uppercase block">🚕 Local Conveyance</span>
                  <span class="font-extrabold text-slate-900 text-sm">${formatINR(p.localConveyancePerDay)}</span>
                </div>
                <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span class="text-[10px] font-bold text-slate-400 uppercase block">✈️ Flight / Transit</span>
                  <span class="font-extrabold text-indigo-900 text-sm">${p.flightLimitPerTrip > 0 ? formatINR(p.flightLimitPerTrip) : 'Train / Bus Only'}</span>
                </div>
              </div>

              <div class="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-slate-500 font-medium">🤝 Client Entertainment:</span>
                  <strong class="text-slate-800">${p.clientEntertainmentLimit > 0 ? formatINR(p.clientEntertainmentLimit) : 'Not Allowed'}</strong>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500 font-medium">📋 Pre-Approval Status:</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.requiresPreApproval !== false ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}">${p.requiresPreApproval !== false ? 'Mandatory' : 'Exempt'}</span>
                </div>
                <div class="text-[11px] text-slate-500 pt-1 font-medium">
                  <span class="font-bold text-slate-700">🚗 Class & Mode:</span> ${escapeHtml(p.travelModeClass || 'Economy Transit')}
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
              <span class="text-[10px] text-slate-400 font-mono">Updated: ${escapeHtml(p.updatedAt || 'Current')}</span>
              <button type="button" onclick="openPolicyEditModal('${p.gradeCode}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors cursor-pointer">
                Edit Grade Policy
              </button>
            </div>
          `;
          container.appendChild(card);
        });
      }

      function openPolicyEditModal(gradeCode) {
        var policies = window.RevOpsStore.getCollection('travelPolicyMaster') || [];
        var targetPolicy = policies.find(function(p) { return p.gradeCode === gradeCode; });

        if (targetPolicy) {
          document.getElementById('pol-id').value = targetPolicy.id || ('pol_' + targetPolicy.gradeCode);
          document.getElementById('pol-grade-code').value = targetPolicy.gradeCode;
          document.getElementById('pol-grade-name').value = targetPolicy.gradeName || ('Grade ' + targetPolicy.gradeCode);
          document.getElementById('pol-grade-desc').value = targetPolicy.description || '';
          document.getElementById('pol-hotel-limit').value = targetPolicy.hotelLimitPerDay || 0;
          document.getElementById('pol-da-limit').value = targetPolicy.daLimitPerDay || 0;
          document.getElementById('pol-local-limit').value = targetPolicy.localConveyancePerDay || 0;
          document.getElementById('pol-flight-limit').value = targetPolicy.flightLimitPerTrip || 0;
          document.getElementById('pol-client-limit').value = targetPolicy.clientEntertainmentLimit || 0;
          document.getElementById('pol-preapp-required').value = String(targetPolicy.requiresPreApproval !== false);
          document.getElementById('pol-travel-class').value = targetPolicy.travelModeClass || '';
        } else {
          document.getElementById('pol-id').value = 'pol_' + Date.now();
          document.getElementById('pol-grade-code').value = 'M3';
          document.getElementById('pol-grade-name').value = 'Grade M3 - Middle Management';
          document.getElementById('pol-grade-desc').value = '';
          document.getElementById('pol-hotel-limit').value = 3800;
          document.getElementById('pol-da-limit').value = 1300;
          document.getElementById('pol-local-limit').value = 1600;
          document.getElementById('pol-flight-limit').value = 10000;
          document.getElementById('pol-client-limit').value = 5000;
          document.getElementById('pol-preapp-required').value = 'true';
          document.getElementById('pol-travel-class').value = 'Air (Economy) / Train AC 2-Tier';
        }
        document.getElementById('modal-policy-edit').classList.remove('hidden');
      }

      function closePolicyEditModal() {
        document.getElementById('modal-policy-edit').classList.add('hidden');
      }

      function handlePolicyGradeChange() {
        var code = document.getElementById('pol-grade-code').value;
        if (code === 'NEW') {
          document.getElementById('pol-grade-name').value = 'Grade Custom - New Tier';
          document.getElementById('pol-grade-desc').value = 'Custom organizational tier';
        } else {
          var policies = window.RevOpsStore.getCollection('travelPolicyMaster') || [];
          var p = policies.find(function(x) { return x.gradeCode === code; });
          if (p) {
            document.getElementById('pol-grade-name').value = p.gradeName;
            document.getElementById('pol-grade-desc').value = p.description || '';
            document.getElementById('pol-hotel-limit').value = p.hotelLimitPerDay;
            document.getElementById('pol-da-limit').value = p.daLimitPerDay;
            document.getElementById('pol-local-limit').value = p.localConveyancePerDay;
            document.getElementById('pol-flight-limit').value = p.flightLimitPerTrip;
            document.getElementById('pol-client-limit').value = p.clientEntertainmentLimit;
            document.getElementById('pol-preapp-required').value = String(p.requiresPreApproval !== false);
            document.getElementById('pol-travel-class').value = p.travelModeClass || '';
          }
        }
      }

      function handleSaveMasterPolicy(evt) {
        evt.preventDefault();
        var id = document.getElementById('pol-id').value;
        var gradeCode = document.getElementById('pol-grade-code').value;
        if (gradeCode === 'NEW') gradeCode = 'Grade_' + Date.now();

        var gradeName = document.getElementById('pol-grade-name').value;
        var desc = document.getElementById('pol-grade-desc').value;
        var h = Number(document.getElementById('pol-hotel-limit').value);
        var d = Number(document.getElementById('pol-da-limit').value);
        var l = Number(document.getElementById('pol-local-limit').value);
        var f = Number(document.getElementById('pol-flight-limit').value);
        var c = Number(document.getElementById('pol-client-limit').value);
        var preapp = document.getElementById('pol-preapp-required').value === 'true';
        var travelClass = document.getElementById('pol-travel-class').value;

        var policies = window.RevOpsStore.getCollection('travelPolicyMaster') || [];
        var idx = policies.findIndex(function(p) { return p.gradeCode === gradeCode || p.id === id; });

        var updatedPolicy = {
          id: id || ('pol_' + gradeCode),
          gradeCode: gradeCode,
          gradeName: gradeName,
          description: desc,
          hotelLimitPerDay: h,
          daLimitPerDay: d,
          localConveyancePerDay: l,
          flightLimitPerTrip: f,
          clientEntertainmentLimit: c,
          requiresPreApproval: preapp,
          travelModeClass: travelClass,
          updatedAt: new Date().toISOString().split('T')[0]
        };

        if (idx >= 0) {
          policies[idx] = updatedPolicy;
        } else {
          policies.push(updatedPolicy);
        }

        window.RevOpsStore.saveCollection('travelPolicyMaster', policies);
        if (window.db && typeof window.db.collection === 'function') {
          window.db.collection('travelPolicyMaster').doc(updatedPolicy.id).set(updatedPolicy, { merge: true }).catch(function(e){});
        }

        closePolicyEditModal();
        renderPolicyMaster();
        alert("Travel Expense Limits Policy for " + gradeName + " updated successfully!");
      }

      /* PRE-APPROVAL MODAL LOGIC */
      function openPreApprovalModal() {
        document.getElementById('preapp-id').value = "";
        document.getElementById('preapp-start-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('preapp-end-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('preapp-places').value = "";
        document.getElementById('preapp-purpose').value = "";
        document.getElementById('preapp-budget').value = "";
        document.getElementById('preapp-extension-reason').value = "";
        
        // Populate employee select
        var emps = window.RevOpsStore.getCollection('employees') || [];
        var empSelect = document.getElementById('preapp-emp-id');
        if (empSelect) {
          empSelect.innerHTML = `<option value="">-- Select Employee --</option>`;
          emps.forEach(function(e) {
            var opt = document.createElement('option');
            opt.value = e.employeeId || e.id;
            opt.innerText = (e.fullName || e.name || 'Employee') + " (" + (e.employeeId || e.id) + ")";
            empSelect.appendChild(opt);
          });
          var myEmpId = localStorage.getItem('employeeId');
          if (myEmpId && emps.some(function(e){ return (e.employeeId || e.id) === myEmpId; })) {
            empSelect.value = myEmpId;
          } else if (emps.length > 0) {
            empSelect.value = emps[0].employeeId || emps[0].id;
          }
        }

        // Populate client select
        var clients = window.RevOpsStore.getCollection('leads') || [];
        var clientSelect = document.getElementById('preapp-existing-client');
        if (clientSelect) {
          clientSelect.innerHTML = `<option value="">-- Select Existing Client --</option>`;
          clients.forEach(function(c) {
            var opt = document.createElement('option');
            opt.value = c.companyName || c.name || c.id;
            opt.innerText = (c.companyName || c.name) + (c.city ? (" - " + c.city) : "");
            clientSelect.appendChild(opt);
          });
        }

        // Mode reset
        var modeRadios = document.getElementsByName('preapp-mode');
        if (modeRadios[0]) modeRadios[0].checked = true;
        togglePreAppMode();

        document.getElementById('modal-pre-approval').classList.remove('hidden');
      }

      function openPreApprovalModalForExtension(refId) {
        openPreApprovalModal();
        var modeRadios = document.getElementsByName('preapp-mode');
        if (modeRadios[1]) modeRadios[1].checked = true;
        togglePreAppMode();

        var refSelect = document.getElementById('preapp-ref-id');
        if (refSelect) refSelect.value = refId;
        populateExtensionRefDetails();
      }

      function closePreApprovalModal() {
        document.getElementById('modal-pre-approval').classList.add('hidden');
      }

      function togglePreAppMode() {
        var isExtend = document.querySelector('input[name="preapp-mode"]:checked').value === 'extend';
        var selectorBox = document.getElementById('preapp-extend-selector');
        var reasonBox = document.getElementById('preapp-extend-reason-box');

        if (isExtend) {
          selectorBox.classList.remove('hidden');

          reasonBox.classList.remove('hidden');
          populateRefSelectDropdown();
        } else {
          selectorBox.classList.add('hidden');
          reasonBox.classList.add('hidden');
        }
      }

      function populateRefSelectDropdown() {
        var preApps = window.RevOpsStore.getCollection('travelApprovals') || [];
        var refSelect = document.getElementById('preapp-ref-id');
        refSelect.innerHTML = `<option value="">-- Select Approved Travel to Extend --</option>`;
        preApps.forEach(function(a) {
          if (a.status === 'Approved') {
            var opt = document.createElement('option');
            opt.value = a.id;
            opt.innerText = a.id + ": " + a.employeeName + " (" + a.places + " | " + a.startDate + ")";
            refSelect.appendChild(opt);
          }
        });
      }

      function populateExtensionRefDetails() {
        var refId = document.getElementById('preapp-ref-id').value;
        if (!refId) return;
        var preApps = window.RevOpsStore.getCollection('travelApprovals') || [];
        var ref = preApps.find(function(a) { return a.id === refId; });
        if (!ref) return;

        document.getElementById('preapp-emp-id').value = ref.empId;
        document.getElementById('preapp-start-date').value = ref.startDate;
        document.getElementById('preapp-end-date').value = ref.endDate;
        document.getElementById('preapp-places').value = ref.places;
        document.getElementById('preapp-purpose').value = ref.purpose;
        document.getElementById('preapp-budget').value = ref.estimatedBudget;
      }

      function toggleClientType() {
        var cType = document.getElementById('preapp-client-type').value;
        if (cType === 'new') {
          document.getElementById('client-existing-box').classList.add('hidden');
          document.getElementById('client-new-box').classList.remove('hidden');
        } else {
          document.getElementById('client-existing-box').classList.remove('hidden');
          document.getElementById('client-new-box').classList.add('hidden');
        }
      }

      function handleSavePreApproval(evt) {
        evt.preventDefault();
        var isExtend = document.querySelector('input[name="preapp-mode"]:checked').value === 'extend';
        var empId = document.getElementById('preapp-emp-id').value;
        var startDate = document.getElementById('preapp-start-date').value;
        var endDate = document.getElementById('preapp-end-date').value;
        var places = document.getElementById('preapp-places').value;
        var purpose = document.getElementById('preapp-purpose').value;
        var budget = Number(document.getElementById('preapp-budget').value);

        var cType = document.getElementById('preapp-client-type').value;
        var clientName = "";
        var contactPerson = "";

        if (cType === 'new') {
          clientName = document.getElementById('preapp-new-client-name').value;
          contactPerson = document.getElementById('preapp-new-contact-person').value;
        } else {
          clientName = document.getElementById('preapp-existing-client').value || 'Existing Client';
          contactPerson = document.getElementById('preapp-contact-person').value;
        }

        var emps = window.RevOpsStore.getCollection('employees') || [];
        var emp = emps.find(function(e) { return e.employeeId === empId; });
        var empName = emp ? emp.fullName : empId;
        var vert = emp ? emp.vertical : 'Sales';

        var appCount = (window.RevOpsStore.getCollection('travelApprovals') || []).length + 101;
        var appId = isExtend ? ('TRV-EXT-' + appCount) : ('TRV-APP-' + appCount);

        var newPreApp = {
          id: appId,
          empId: empId,
          employeeName: empName,
          vertical: vert,
          startDate: startDate,
          endDate: endDate,
          places: places,
          purpose: purpose,
          clientType: cType,
          clientName: clientName,
          contactPerson: contactPerson,
          estimatedBudget: budget,
          isExtension: isExtend,
          refId: isExtend ? document.getElementById('preapp-ref-id').value : '',
          status: 'Pending Manager Approval',
          appliedDate: new Date().toISOString().split('T')[0],
          extensionReason: isExtend ? document.getElementById('preapp-extension-reason').value : ''
        };

        window.RevOpsStore.addItem('travelApprovals', newPreApp);
        closePreApprovalModal();
        renderTravelApprovals();
        alert("Travel Authorization Request " + newPreApp.id + " submitted and routed for Reporting Manager Approval!");
      }

      /* COMPREHENSIVE MULTI-PAGE TRAVEL CLAIM WIZARD LOGIC */
      function openTravelClaimModal() {
        currentClaimPage = 1;
        claimItemsStore = [
          { date: new Date().toISOString().split('T')[0], category: 'Hotel Accommodation', desc: 'Hotel room stay', amount: 3000, receiptBase64: '' },
          { date: new Date().toISOString().split('T')[0], category: 'Daily Allowance (Food)', desc: 'Breakfast & dinner DA', amount: 1000, receiptBase64: '' }
        ];

        // Populate employee select
        var emps = window.RevOpsStore.getCollection('employees') || [];
        var empSelect = document.getElementById('travel-emp-id');
        if (empSelect) {
          empSelect.innerHTML = `<option value="">-- Select Claimant Employee --</option>`;
          emps.forEach(function(e) {
            var opt = document.createElement('option');
            opt.value = e.employeeId || e.id;
            opt.innerText = (e.fullName || e.name || 'Employee') + " (" + (e.employeeId || e.id) + ")";
            empSelect.appendChild(opt);
          });
          var myEmpId = localStorage.getItem('employeeId');
          if (myEmpId && emps.some(function(e){ return (e.employeeId || e.id) === myEmpId; })) {
            empSelect.value = myEmpId;
          } else if (emps.length > 0) {
            empSelect.value = emps[0].employeeId || emps[0].id;
          }
        }

        // Populate pre-app dropdown in claim
        var preApps = window.RevOpsStore.getCollection('travelApprovals') || [];
        var preLinkSelect = document.getElementById('trv-preapp-link');
        preLinkSelect.innerHTML = `<option value="">-- Direct Travel Claim (No Pre-Approval) --</option>`;
        preApps.forEach(function(a) {
          if (a.status === 'Approved') {
            var opt = document.createElement('option');
            opt.value = a.id;
            opt.innerText = a.id + " (" + a.employeeName + " - " + a.places + ")";
            preLinkSelect.appendChild(opt);
          }
        });

        document.getElementById('trv-start-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('trv-end-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('trv-places').value = "";
        document.getElementById('trv-purpose').value = "";
        document.getElementById('trv-client-name').value = "";
        document.getElementById('trv-client-contact').value = "";
        document.getElementById('trv-client-phone').value = "";
        document.getElementById('trv-client-location').value = "";

        showClaimPage(1);
        document.getElementById('modal-travel').classList.remove('hidden');
      }

      function openTravelClaimForApprovedPreApp(appId) {
        openTravelClaimModal();
        var preLinkSelect = document.getElementById('trv-preapp-link');
        if (preLinkSelect) {
          preLinkSelect.value = appId;
          populatePreAppDetailsIntoClaim();
        }
      }

      function closeTravelClaimModal() {
        document.getElementById('modal-travel').classList.add('hidden');
      }

      function populatePreAppDetailsIntoClaim() {
        var appId = document.getElementById('trv-preapp-link').value;
        if (!appId) return;
        var preApps = window.RevOpsStore.getCollection('travelApprovals') || [];
        var app = preApps.find(function(a) { return a.id === appId; });
        if (!app) return;

        document.getElementById('travel-emp-id').value = app.empId;
        document.getElementById('trv-start-date').value = app.startDate;
        document.getElementById('trv-end-date').value = app.endDate;
        document.getElementById('trv-places').value = app.places;
        document.getElementById('trv-purpose').value = app.purpose;
        document.getElementById('trv-client-name').value = app.clientName;
        document.getElementById('trv-client-contact').value = app.contactPerson || '';
        if (app.isExtension) {
          document.getElementById('trv-is-extended').value = 'yes';
        }
      }

      function showClaimPage(pg) {
        currentClaimPage = pg;
        if (pg === 1) {
          document.getElementById('claim-page-1').classList.remove('hidden');
          document.getElementById('claim-page-2').classList.add('hidden');
          document.getElementById('step-badge-1').className = "px-2 py-0.5 bg-emerald-500 text-white rounded-full font-bold";
          document.getElementById('step-badge-2').className = "px-2 py-0.5 bg-emerald-800 text-emerald-300 rounded-full";
        } else {
          document.getElementById('claim-page-1').classList.add('hidden');
          document.getElementById('claim-page-2').classList.remove('hidden');
          document.getElementById('step-badge-1').className = "px-2 py-0.5 bg-emerald-800 text-emerald-300 rounded-full";
          document.getElementById('step-badge-2').className = "px-2 py-0.5 bg-emerald-500 text-white rounded-full font-bold";
          renderClaimItemRows();
          calcTravelClaimTotalsAndAudit();
        }
      }

      function goToClaimPage1() { showClaimPage(1); }
      function goToClaimPage2() {
        var empId = document.getElementById('travel-emp-id').value;
        var startDate = document.getElementById('trv-start-date').value;
        var endDate = document.getElementById('trv-end-date').value;
        var places = (document.getElementById('trv-places').value || '').trim();
        var purpose = (document.getElementById('trv-purpose').value || '').trim();
        var clientName = (document.getElementById('trv-client-name').value || '').trim();

        if (!empId) { alert("Please select the Claimant Employee."); document.getElementById('travel-emp-id').focus(); return; }
        if (!startDate) { alert("Please select the Trip Start Date."); document.getElementById('trv-start-date').focus(); return; }
        if (!endDate) { alert("Please select the Trip End Date."); document.getElementById('trv-end-date').focus(); return; }
        if (!places) { alert("Please enter Places Visited / Route Covered."); document.getElementById('trv-places').focus(); return; }
        if (!purpose) { alert("Please enter Purpose of Visit."); document.getElementById('trv-purpose').focus(); return; }
        if (!clientName) { alert("Please enter Client / Company Name Visited."); document.getElementById('trv-client-name').focus(); return; }

        showClaimPage(2);
      }

      function renderClaimItemRows() {
        var tbody = document.getElementById('trv-items-tbody');
        tbody.innerHTML = "";

        claimItemsStore.forEach(function(item, idx) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50";
          tr.innerHTML = `
            <td class="py-2 px-3">
              <input type="date" value="${item.date}" onchange="updateClaimItem(${idx}, 'date', this.value)" class="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold" />
            </td>
            <td class="py-2 px-3">
              <select onchange="updateClaimItem(${idx}, 'category', this.value)" class="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                <option value="Hotel Accommodation" ${item.category === 'Hotel Accommodation' ? 'selected' : ''}>Hotel Accommodation</option>
                <option value="Daily Allowance (Food)" ${item.category === 'Daily Allowance (Food)' ? 'selected' : ''}>Daily Allowance (Food)</option>
                <option value="Local Conveyance / Taxi" ${item.category === 'Local Conveyance / Taxi' ? 'selected' : ''}>Local Conveyance / Taxi</option>
                <option value="Flight/Train Ticket" ${item.category === 'Flight/Train Ticket' ? 'selected' : ''}>Flight/Train Ticket</option>
                <option value="Client Entertainment" ${item.category === 'Client Entertainment' ? 'selected' : ''}>Client Entertainment</option>
              </select>
            </td>
            <td class="py-2 px-3">
              <input type="text" value="${item.desc}" placeholder="Bill details..." onchange="updateClaimItem(${idx}, 'desc', this.value)" class="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
            </td>
            <td class="py-2 px-3 text-right">
              <input type="number" value="${item.amount}" min="0" oninput="updateClaimItem(${idx}, 'amount', this.value)" class="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right text-emerald-800" />
            </td>
            <td class="py-2 px-3 text-center">
              <input type="file" accept="image/*" onchange="uploadClaimReceipt(${idx}, event)" class="text-[10px] w-36" />
            </td>
            <td class="py-2 px-3 text-center">
              <button type="button" onclick="removeExpenseItemRow(${idx})" class="text-rose-600 hover:text-rose-800 font-bold text-sm cursor-pointer">&times;</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function addExpenseItemRow() {
        claimItemsStore.push({
          date: document.getElementById('trv-start-date').value || new Date().toISOString().split('T')[0],
          category: 'Hotel Accommodation',
          desc: 'Expense description',
          amount: 1000,
          receiptBase64: ''
        });
        renderClaimItemRows();
        calcTravelClaimTotalsAndAudit();
      }

      function removeExpenseItemRow(idx) {
        if (claimItemsStore.length <= 1) {
          alert("Travel claim must have at least one date-wise expense item.");
          return;
        }
        claimItemsStore.splice(idx, 1);
        renderClaimItemRows();
        calcTravelClaimTotalsAndAudit();
      }

      function updateClaimItem(idx, key, val) {
        if (key === 'amount') val = Number(val) || 0;
        claimItemsStore[idx][key] = val;
        calcTravelClaimTotalsAndAudit();
      }

      function uploadClaimReceipt(idx, evt) {
        var file = evt.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
          claimItemsStore[idx].receiptBase64 = e.target.result;
        };
        reader.readAsDataURL(file);
      }

      function calcTravelClaimTotalsAndAudit() {
        var total = 0;
        var hotelSum = 0, daSum = 0, localSum = 0, flightSum = 0, clientSum = 0;

        claimItemsStore.forEach(function(item) {
          var amt = Number(item.amount) || 0;
          total += amt;
          if (item.category === 'Hotel Accommodation') hotelSum += amt;
          if (item.category === 'Daily Allowance (Food)') daSum += amt;
          if (item.category === 'Local Conveyance / Taxi') localSum += amt;
          if (item.category === 'Flight/Train Ticket') flightSum += amt;
          if (item.category === 'Client Entertainment') clientSum += amt;
        });

        document.getElementById('trv-grand-total-display').innerText = formatINR(total);

        // Fetch selected employee's Grade
        var empIdSelect = document.getElementById('travel-emp-id');
        var empId = empIdSelect ? empIdSelect.value : '';
        var emps = window.RevOpsStore.getCollection('employees') || [];
        var emp = emps.find(function(e) { return (e.employeeId === empId || e.id === empId); });
        var empGrade = emp ? (emp.grade || 'M3') : 'M3';

        // Check policy limits for employee's grade
        var policies = window.RevOpsStore.getCollection('travelPolicyMaster') || [];
        var policy = policies.find(function(p) { return p.gradeCode === empGrade; });
        
        if (!policy) {
          policy = policies[0] || { gradeCode: 'Default', gradeName: 'Standard Policy', hotelLimitPerDay: 3500, daLimitPerDay: 1200, localConveyancePerDay: 1500, flightLimitPerTrip: 10000, clientEntertainmentLimit: 5000 };
        }

        var exceededReasons = [];

        if (policy.hotelLimitPerDay > 0 && hotelSum > policy.hotelLimitPerDay) {
          exceededReasons.push("Hotel spend (₹" + hotelSum + ") exceeds Grade " + empGrade + " daily limit (₹" + policy.hotelLimitPerDay + ")");
        }
        if (policy.daLimitPerDay > 0 && daSum > policy.daLimitPerDay) {
          exceededReasons.push("Food/DA spend (₹" + daSum + ") exceeds Grade " + empGrade + " daily limit (₹" + policy.daLimitPerDay + ")");
        }
        if (policy.localConveyancePerDay > 0 && localSum > policy.localConveyancePerDay) {
          exceededReasons.push("Local conveyance (₹" + localSum + ") exceeds Grade " + empGrade + " daily limit (₹" + policy.localConveyancePerDay + ")");
        }
        if (flightSum > 0) {
          if (policy.flightLimitPerTrip === 0) {
            exceededReasons.push("Flight travel is not permitted under Grade " + empGrade + " policy (Train/Bus only)");
          } else if (flightSum > policy.flightLimitPerTrip) {
            exceededReasons.push("Flight spend (₹" + flightSum + ") exceeds Grade " + empGrade + " trip limit (₹" + policy.flightLimitPerTrip + ")");
          }
        }
        if (clientSum > 0 && clientSum > policy.clientEntertainmentLimit) {
          exceededReasons.push("Client entertainment (₹" + clientSum + ") exceeds Grade " + empGrade + " limit (₹" + policy.clientEntertainmentLimit + ")");
        }

        var badge = document.getElementById('trv-audit-status-badge');
        var notes = document.getElementById('trv-audit-notes');

        var gradeInfoStr = `<div class="text-[11px] font-bold text-indigo-900 mb-1">Grade Audit Policy applied: <span class="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded font-mono font-extrabold">${empGrade}</span> - ${escapeHtml(policy.gradeName || 'Grade Policy')} (Hotel: ₹${policy.hotelLimitPerDay}/day | DA: ₹${policy.daLimitPerDay}/day | Local: ₹${policy.localConveyancePerDay}/day | Flight: ₹${policy.flightLimitPerTrip || '0'})</div>`;

        if (exceededReasons.length > 0) {
          badge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300";
          badge.innerText = "EXCEEDS GRADE " + empGrade + " POLICY LIMIT - REQUIRES MANAGER APPROVAL";
          notes.innerHTML = gradeInfoStr + `<span class="text-rose-700 font-bold">Policy Violations:</span> ` + exceededReasons.join(" | ");
        } else {
          badge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300";
          badge.innerText = "Within Grade " + empGrade + " Policy Limits";
          notes.innerHTML = gradeInfoStr + `<span class="text-emerald-700 font-semibold">All itemized daily expenses conform strictly to Grade ${empGrade} Master Policy Limits.</span>`;
        }
      }

      function handleSaveTravelClaim(evt) {
        if (evt) evt.preventDefault();

        var empId = document.getElementById('travel-emp-id').value;
        var startDate = document.getElementById('trv-start-date').value;
        var endDate = document.getElementById('trv-end-date').value;
        var places = (document.getElementById('trv-places').value || '').trim();
        var purpose = (document.getElementById('trv-purpose').value || '').trim();
        var clientName = (document.getElementById('trv-client-name').value || '').trim();
        var preAppLink = document.getElementById('trv-preapp-link').value;
        var isExtended = document.getElementById('trv-is-extended').value === 'yes';

        if (!empId || !startDate || !endDate || !places || !purpose || !clientName) {
          alert("Please fill in all mandatory fields on Page 1 (Claimant Employee, Start/End Dates, Places Visited, Purpose, and Client Name).");
          showClaimPage(1);
          return;
        }

        if (!claimItemsStore || claimItemsStore.length === 0) {
          alert("Please add at least one daily expense line item.");
          return;
        }

        var grandTotal = 0;
        claimItemsStore.forEach(function(i) { grandTotal += Number(i.amount) || 0; });

        if (grandTotal <= 0) {
          alert("Grand total travel claim amount must be greater than Rs.0.");
          return;
        }

        var emps = window.RevOpsStore.getCollection('employees') || [];
        var emp = emps.find(function(e) { return e.employeeId === empId; });
        var empName = emp ? emp.fullName : empId;
        var vert = emp ? emp.vertical : 'Sales';

        var policy = (window.RevOpsStore.getCollection('travelPolicyMaster') || [])[0] || { hotelLimitPerDay: 3500, daLimitPerDay: 1200 };
        var isPolicyExceeded = grandTotal > 15000 || isExtended;

        var vCount = (window.RevOpsStore.getCollection('expenses') || []).length + 1001;
        var claimStatus = isPolicyExceeded ? 'Pending Manager Approval' : 'Approved';

        var newClaim = {
          voucherNo: 'TRV-' + vCount,
          date: new Date().toISOString().split('T')[0],
          category: 'Travelling',
          payee: empName,
          employeeId: empId,
          amount: grandTotal,
          vertical: vert,
          projectId: '',
          paymentMode: 'Bank Transfer',
          remarks: 'Travel Claim: ' + places + ' (' + startDate + ' to ' + endDate + ') - Client: ' + clientName + ' [Purpose: ' + purpose + ']',
          status: claimStatus,
          policyExceeded: isPolicyExceeded,
          preAppRefId: preAppLink,
          clientName: clientName,
          items: claimItemsStore
        };

        var savedItem = window.RevOpsStore.addItem('expenses', newClaim);

        if (window.db && typeof window.db.collection === 'function') {
          var docId = (savedItem && savedItem.id) ? savedItem.id : ('exp_' + Date.now());
          window.db.collection('expenses').doc(docId).set(newClaim, { merge: true }).catch(function(err) {
            console.warn("Firestore save error for travel claim:", err);
          });
        }

        closeTravelClaimModal();
        renderExpensesTable();
        renderBudgets();

        if (isPolicyExceeded) {
          alert("✅ Travel Expense Claim Voucher " + newClaim.voucherNo + " created!\n\nNote: Amount or extended travel exceeds threshold and has been submitted for Reporting Manager Approval.");
        } else {
          alert("✅ Travel Expense Claim Voucher " + newClaim.voucherNo + " for " + formatINR(grandTotal) + " successfully processed and approved!");
        }
      }

      function approveExpenseVoucher(expId) {
        window.RevOpsStore.updateItem('expenses', expId, { status: 'Approved' });
        renderExpensesTable();
        alert("Expense Voucher " + expId + " approved by Reporting Manager.");
      }

      function renderExpensesTable() {
        var rawExpenses = window.RevOpsStore.getCollection('expenses') || [];
        var userRole = localStorage.getItem('userRole');
        var userName = localStorage.getItem('userName') || '';
        var myEmpId = localStorage.getItem('employeeId') || '';
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var myEmp = employees.find(function(emp) { return emp.employeeId === myEmpId; });

        var expenses = rawExpenses;
        if (userRole === 'staff') {
          expenses = rawExpenses.filter(function(e) {
            return (e.employeeId && e.employeeId === myEmpId) || 
                   (e.payee && e.payee.toLowerCase() === userName.toLowerCase()) ||
                   (e.payee && userName && e.payee.toLowerCase().includes(userName.toLowerCase()));
          });
        } else if (userRole === 'manager') {
          var directReportIds = employees.filter(function(emp) { return emp.reportsTo === myEmpId; }).map(function(emp) { return emp.employeeId; });
          var directReportNames = employees.filter(function(emp) { return emp.reportsTo === myEmpId; }).map(function(emp) { return emp.fullName || emp.name; });
          expenses = rawExpenses.filter(function(e) {
            return (e.employeeId && e.employeeId === myEmpId) ||
                   (e.payee && e.payee.toLowerCase() === userName.toLowerCase()) ||
                   directReportIds.includes(e.employeeId) ||
                   (e.payee && directReportNames.some(function(n) { return n && e.payee.toLowerCase().includes(n.toLowerCase()); })) ||
                   (myEmp && myEmp.vertical && e.vertical === myEmp.vertical);
          });
        }

        var catFilter = document.getElementById('flt-category').value;
        var vertFilter = document.getElementById('flt-vertical').value;
        var search = document.getElementById('flt-search').value.toLowerCase();

        var totalExp = 0, travelExp = 0, salaryExp = 0, projExp = 0;
        var travelCount = 0;

        expenses.forEach(function(e) {
          var amt = Number(e.amount) || 0;
          totalExp += amt;
          if (e.category === 'Travelling') { travelExp += amt; travelCount++; }
          if (e.category === 'Salary' || e.category === 'Salary Advance' || e.category === 'Loan to Employee') salaryExp += amt;
          if (e.category === 'Project Expenses') projExp += amt;
        });

        document.getElementById('stat-total-expenses').innerText = formatINR(totalExp);
        document.getElementById('stat-expense-count').innerText = expenses.length + " Transactions";
        document.getElementById('stat-travel-expenses').innerText = formatINR(travelExp);
        document.getElementById('stat-travel-count').innerText = travelCount + " Travel Claims";
        document.getElementById('stat-salary-advances').innerText = formatINR(salaryExp);
        document.getElementById('stat-project-expenses').innerText = formatINR(projExp);

        var filtered = expenses.filter(function(e) {
          if (catFilter !== 'All' && e.category !== catFilter) return false;
          if (vertFilter !== 'All' && e.vertical !== vertFilter) return false;
          if (search && !( (e.payee||'').toLowerCase().includes(search) || (e.voucherNo||'').toLowerCase().includes(search) || (e.remarks||'').toLowerCase().includes(search) || (e.clientName||'').toLowerCase().includes(search) )) return false;
          return true;
        });

        var tbody = document.getElementById('expenses-tbody');
        tbody.innerHTML = "";

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400">No matching expense vouchers logged.</td></tr>`;
          return;
        }

        filtered.forEach(function(exp) {
          var hasReceipt = (exp.receiptBase64 && exp.receiptBase64.length > 50) || (exp.items && exp.items.some(function(i){ return i.receiptBase64; }));
          var receiptHtml = hasReceipt 
            ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-md border border-emerald-300">Bill Attached</span>`
            : `<span class="text-slate-400 text-[10px]">No Bill</span>`;

          var statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
          if (exp.status === 'Pending Manager Approval') statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';

          var approveBtn = (exp.status === 'Pending Manager Approval')
            ? `<button onclick="approveExpenseVoucher('${exp.id}')" class="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded transition-colors cursor-pointer">Approve</button>`
            : '';

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-slate-900">
              <div class="font-bold text-slate-900">${escapeHtml(exp.voucherNo || 'VOUCH-SYS')}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(exp.date)}</div>
            </td>
            <td class="py-3 px-4 text-slate-700">
              <div class="font-bold text-indigo-700">${escapeHtml(exp.category)}</div>
              <div class="text-[11px] text-slate-600 font-semibold">${escapeHtml(exp.payee)}</div>
            </td>
            <td class="py-3 px-4 text-slate-600">
              <div class="font-medium text-slate-800">${escapeHtml(exp.vertical)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${exp.projectId ? ('Proj: ' + escapeHtml(exp.projectId)) : 'General Overhead'}</div>
            </td>
            <td class="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">
              ${formatINR(exp.amount)}
            </td>
            <td class="py-3 px-4 text-center text-slate-600 font-medium">
              ${escapeHtml(exp.paymentMode || 'Bank Transfer')}
            </td>
            <td class="py-3 px-4 text-center">
              ${receiptHtml}
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusBadge}">${exp.status || 'Approved'}</span>
            </td>
            <td class="py-3 px-4 text-center space-x-1">
              ${approveBtn}
              <button onclick="previewVoucher('${exp.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer border border-indigo-200">
                Print Voucher
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function renderProjectProfitability() {
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var expenses = window.RevOpsStore.getCollection('expenses') || [];
        var vertFilter = document.getElementById('flt-project-vertical').value;

        var totalRev = 0, totalExp = 0, totalProfit = 0;
        var tbody = document.getElementById('profit-tbody');
        tbody.innerHTML = "";

        var projectRows = [];

        orders.forEach(function(ord) {
          if (ord.status !== 'Won' && ord.status !== 'Closed') return;
          var vert = ord.vertical || 'Projects';
          if (vertFilter !== 'All' && vert !== vertFilter) return;

          var rev = Number(ord.orderValue) || 0;
          var ordId = ord.id || ord.orderId;

          // Sum matching project expenses
          var projExpenses = expenses.filter(function(e) {
            return e.projectId === ordId || e.projectId === ord.orderId || (e.remarks && e.remarks.indexOf(ord.customerName) !== -1);
          });

          var expSum = 0;
          projExpenses.forEach(function(pe) { expSum += Number(pe.amount) || 0; });

          // If no direct logged expense, estimate baseline direct costs (65% typical industry baseline for turnkey projects)
          if (expSum === 0 && vert === 'Projects') {
            expSum = Math.round(rev * 0.65);
          }

          var profit = rev - expSum;
          var marginPct = rev > 0 ? Math.round((profit / rev) * 100) : 0;

          totalRev += rev;
          totalExp += expSum;
          totalProfit += profit;

          projectRows.push({
            id: ordId,
            customer: ord.customerName || 'Project Client',
            vertical: vert,
            revenue: rev,
            expense: expSum,
            profit: profit,
            margin: marginPct
          });
        });

        document.getElementById('prof-total-rev').innerText = formatINR(totalRev);
        document.getElementById('prof-total-exp').innerText = formatINR(totalExp);
        document.getElementById('prof-total-profit').innerText = formatINR(totalProfit);
        var overallMargin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0;
        document.getElementById('prof-avg-margin').innerText = overallMargin + "%";

        if (projectRows.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">No project orders found for analysis.</td></tr>`;
          return;
        }

        projectRows.forEach(function(p) {
          var marginBadge = p.margin >= 30 
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
            : (p.margin >= 15 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300');

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-slate-900">
              <div>${p.customer}</div>
              <div class="text-[10px] text-slate-400 font-mono">${p.id}</div>
            </td>
            <td class="py-3 px-4 font-semibold text-slate-700">${p.vertical}</td>
            <td class="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">${formatINR(p.revenue)}</td>
            <td class="py-3 px-4 text-right font-bold text-rose-600">${formatINR(p.expense)}</td>
            <td class="py-3 px-4 text-right font-extrabold text-emerald-600 text-sm">${formatINR(p.profit)}</td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-1 rounded-full text-xs font-black border ${marginBadge}">${p.margin}% Gross Margin</span>
            </td>
            <td class="py-3 px-4 text-center font-semibold text-slate-600">
              ${p.profit > 0 ? 'Profitable' : 'Break-Even'}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function renderBudgets() {
        var budgets = window.RevOpsStore.getCollection('budgets') || [];
        var expenses = window.RevOpsStore.getCollection('expenses') || [];
        var container = document.getElementById('budget-cards-container');
        container.innerHTML = "";

        if (budgets.length === 0) {
          container.innerHTML = `<div class="col-span-3 py-6 text-center text-slate-400">No budget limits defined yet. Click above to add budget allocations.</div>`;
          return;
        }

        budgets.forEach(function(b) {
          // Sum actual spend for category and vertical
          var actualSpent = 0;
          expenses.forEach(function(e) {
            if (e.vertical === b.vertical && e.category === b.category) {
              actualSpent += Number(e.amount) || 0;
            }
          });

          var limit = Number(b.monthlyLimit) || 1;
          var utilPct = Math.min(100, Math.round((actualSpent / limit) * 100));
          var remaining = limit - actualSpent;

          var barColor = "bg-emerald-500";
          var statusText = "Healthy";
          var statusBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";

          if (utilPct >= 85 && utilPct < 100) {
            barColor = "bg-amber-500";
            statusText = "Near Budget Limit";
            statusBadge = "bg-amber-100 text-amber-800 border-amber-300";
          } else if (actualSpent > limit) {
            barColor = "bg-rose-500";
            statusText = "Over Budget Exceeded";
            statusBadge = "bg-rose-100 text-rose-800 border-rose-300";
          }

          var card = document.createElement('div');
          card.className = "bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4";
          card.innerHTML = `
            <div class="flex items-center justify-between">
              <div>
                <span class="text-[10px] uppercase font-extrabold text-indigo-600 tracking-wider block">${b.vertical} Vertical</span>
                <h3 class="text-base font-bold text-slate-900">${b.category}</h3>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadge}">${statusText}</span>
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500">Actual Spend: <strong class="text-slate-900">${formatINR(actualSpent)}</strong></span>
                <span class="text-slate-500">Budget Limit: <strong class="text-slate-900">${formatINR(limit)}</strong></span>
              </div>
              <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full ${barColor} transition-all duration-300" style="width: ${utilPct}%"></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs font-semibold pt-2 border-t border-slate-200">
              <span class="text-slate-600">Utilization: <strong class="text-slate-900">${utilPct}%</strong></span>
              <span class="${remaining >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${remaining >= 0 ? ('Remaining: ' + formatINR(remaining)) : ('Exceeded by: ' + formatINR(Math.abs(remaining)))}</span>
            </div>
          `;
          container.appendChild(card);
        });
      }

      function openExpenseModal() {
        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('exp-payee').value = "";
        document.getElementById('exp-amount').value = "";
        document.getElementById('exp-remarks').value = "";
        document.getElementById('exp-receipt-base64').value = "";
        document.getElementById('exp-file').value = "";
        document.getElementById('modal-expense').classList.remove('hidden');
      }

      function closeExpenseModal() {
        document.getElementById('modal-expense').classList.add('hidden');
      }

      function handleExpenseCategoryChange() {
        var cat = document.getElementById('exp-category').value;
        if (cat === 'Project Expenses') {
          document.getElementById('exp-vertical').value = 'Projects';
        }
      }

      function handleFileSelected(evt) {
        var file = evt.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
          document.getElementById('exp-receipt-base64').value = e.target.result;
        };
        reader.readAsDataURL(file);
      }

      function handleSaveExpense(evt) {
        evt.preventDefault();
        var date = document.getElementById('exp-date').value;
        var category = document.getElementById('exp-category').value;
        var payee = document.getElementById('exp-payee').value;
        var amount = Number(document.getElementById('exp-amount').value);
        var vertical = document.getElementById('exp-vertical').value;
        var projectId = document.getElementById('exp-project-id').value;
        var paymentMode = document.getElementById('exp-mode').value;
        var remarks = document.getElementById('exp-remarks').value;
        var receiptBase64 = document.getElementById('exp-receipt-base64').value;
        var splitMode = document.getElementById('exp-split-mode').value;

        var vCount = (window.RevOpsStore.getCollection('expenses') || []).length + 1001;
        var voucherNo = 'VOUCH-' + vCount;

        var newExp = {
          voucherNo: voucherNo,
          date: date,
          category: category,
          payee: payee,
          amount: amount,
          vertical: vertical,
          projectId: projectId,
          paymentMode: paymentMode,
          remarks: remarks,
          status: 'Approved',
          receiptBase64: receiptBase64,
          splitMode: splitMode
        };

        var savedExp = window.RevOpsStore.addItem('expenses', newExp);

        var expId = savedExp ? savedExp.id : voucherNo;

        // Save Multi-Project Splits if enabled
        if (splitMode !== 'direct') {
          var checkedCbs = Array.from(document.querySelectorAll('#exp-form-projects-container input:checked'));
          var selectedCodes = checkedCbs.map(function(cb) { return cb.value; });

          var pctInputs = Array.from(document.querySelectorAll('.exp-split-pct-input'));
          var amtInputs = Array.from(document.querySelectorAll('.exp-split-amt-input'));

          selectedCodes.forEach(function(pCode, i) {
            var pct = Number(pctInputs[i] ? pctInputs[i].value : 0) || 0;
            var allocAmt = Number(amtInputs[i] ? amtInputs[i].value : 0) || 0;

            window.RevOpsStore.addItem('expenseSplits', {
              splitId: 'SPL-' + Date.now() + '-' + i,
              expenseId: expId,
              voucherNo: voucherNo,
              projectCode: pCode,
              allocationMode: splitMode,
              allocatedPercentage: pct,
              allocatedAmount: allocAmt,
              expenseClassification: 'Allocated Shared'
            });
          });
        } else if (projectId) {
          // Direct Allocation
          window.RevOpsStore.addItem('expenseSplits', {
            splitId: 'SPL-' + Date.now(),
            expenseId: expId,
            voucherNo: voucherNo,
            projectCode: projectId,
            allocationMode: 'direct',
            allocatedPercentage: 100,
            allocatedAmount: amount,
            expenseClassification: 'Direct Allocation'
          });
        }

        closeExpenseModal();
        renderExpensesTable();
        renderProjectProfitability();
        renderProjectRevenueAndSplitSection();
        renderBudgets();
        alert("Expense Voucher " + voucherNo + " successfully logged with " + splitMode.toUpperCase() + " allocation!");
      }

