var activeAmcContracts = [];
      var clientEquipmentRegistry = [];

      document.addEventListener('DOMContentLoaded', function() {
        populateEngineersList();
        populateCustomerRoster();
        populateAmcMasterDropdowns();
        renderAmcTable();

        // Subscribe to real-time updates if Firestore active
        if (window.RevOpsStore && typeof window.RevOpsStore.subscribeRealtimeSync === 'function') {
          window.RevOpsStore.subscribeRealtimeSync('amcContracts', function() {
            renderAmcTable();
          });
        }
      });

      // Contract Tier, Invoicing Milestone, SLA Breakdown Response and PM
      // Visit Frequency all come from Master Data now — Tier/PM Frequency
      // are shared with AMC Quotes, and SLA is shared with Service
      // Tickets too, so all three modules describe the same terms
      // consistently instead of three separately hardcoded lists.
      function populateAmcMasterDropdowns() {
        fillMasterSelect('amc-inp-tier', 'amcContractTierMaster');
        fillMasterSelect('amc-inp-billing', 'amcInvoicingMilestoneMaster');
        fillMasterSelect('amc-inp-pm-freq', 'pmVisitFrequencyMaster');

        var slaSelect = document.getElementById('amc-inp-sla');
        if (slaSelect) {
          var tiers = (window.RevOpsStore.getCollection('slaResponseTierMaster') || []).filter(function(t) { return t.isActive !== false; });
          var currentVal = slaSelect.value;
          slaSelect.innerHTML = tiers.map(function(t) {
            var win = t.slaWindow || ((t.slaHours || 24) + ' Hours');
            return '<option value="' + escapeHtml(win) + '">' + escapeHtml(t.name) + ' — ' + escapeHtml(win) + '</option>';
          }).join('');
          if (currentVal && tiers.some(function(t) { return (t.slaWindow || '') === currentVal; })) {
            slaSelect.value = currentVal;
          }
        }
      }

      function fillMasterSelect(selectId, collectionName) {
        var select = document.getElementById(selectId);
        if (!select) return;
        var items = (window.RevOpsStore.getCollection(collectionName) || []).filter(function(it) { return it.isActive !== false; });
        var currentVal = select.value;
        select.innerHTML = items.map(function(it) {
          return '<option value="' + escapeHtml(it.name) + '">' + escapeHtml(it.name) + '</option>';
        }).join('');
        if (currentVal && items.some(function(it) { return it.name === currentVal; })) {
          select.value = currentVal;
        }
      }

      function populateEngineersList() {
        var employees = window.RevOpsStore ? (window.RevOpsStore.getCollection('employees') || []) : [];
        var engSelects = [document.getElementById('amc-inp-engineer'), document.getElementById('pm-attending-engineer')];
        
        engSelects.forEach(function(sel) {
          if (!sel) return;
          sel.innerHTML = '<option value="">Select Field Engineer / Rep...</option>';
          employees.forEach(function(e) {
            var opt = document.createElement('option');
            opt.value = e.employeeId;
            opt.textContent = e.fullName + ' (' + e.employeeId + ' - ' + (e.designation || e.vertical) + ')';
            sel.appendChild(opt);
          });
        });
      }

      function populateCustomerRoster() {
        var clients = window.RevOpsStore ? (window.RevOpsStore.getCollection('clientsMaster') || []) : [];
        var orders = window.RevOpsStore ? (window.RevOpsStore.getCollection('orders') || []) : [];
        var custSelect = document.getElementById('amc-inp-customer');
        if (!custSelect) return;

        var uniqueClients = {};
        clients.forEach(function(c) {
          if (c && c.clientName) uniqueClients[c.clientName] = c;
        });
        orders.forEach(function(o) {
          if (o && o.customerName && !uniqueClients[o.customerName]) {
            uniqueClients[o.customerName] = { clientName: o.customerName };
          }
        });

        // Add standard enterprises if empty
        if (Object.keys(uniqueClients).length === 0) {
          uniqueClients["JSW Steel Limited"] = { clientName: "JSW Steel Limited" };
          uniqueClients["Tata Steel Limited"] = { clientName: "Tata Steel Limited" };
          uniqueClients["Vedanta Aluminium"] = { clientName: "Vedanta Aluminium" };
          uniqueClients["Hindalco Industries"] = { clientName: "Hindalco Industries" };
          uniqueClients["UltraTech Cement"] = { clientName: "UltraTech Cement" };
        }

        custSelect.innerHTML = '<option value="">Select Customer Company...</option>';
        Object.keys(uniqueClients).sort().forEach(function(name) {
          var opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          custSelect.appendChild(opt);
        });
      }

      function handleAmcCustomerChange(custName) {
        var modelSelect = document.getElementById('amc-inp-model');
        if (!modelSelect) return;

        var models = [
          "Dynamic In-Motion Train Weigher (IMW-500)",
          "Wireless Crane Scale 50T (CS-50W)",
          "Automated Slag Yard Scale (ASW-2000)",
          "Onboard Tipper Scale (OTW-30T)",
          "Ladle Turret Weighing System (LTW-350)",
          "Electronic Static Pitless Weighbridge (WB-100T)"
        ];

        modelSelect.innerHTML = '<option value="">Select Equipment Model...</option>';
        models.forEach(function(m) {
          var opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          modelSelect.appendChild(opt);
        });
      }

      function handleAmcModelChange(modelName) {
        var serialInput = document.getElementById('amc-inp-serial');
        if (serialInput && !serialInput.value) {
          var prefix = modelName.includes('Crane') ? 'CS-50T-2025-' : (modelName.includes('Train') ? 'IMW-500-2025-' : 'WB-100T-2025-');
          serialInput.value = prefix + Math.floor(100 + Math.random() * 900);
        }
      }

      function getAmcContractsList() {
        var list = window.RevOpsStore ? (window.RevOpsStore.getCollection('amcContracts') || []) : [];
        if (list.length === 0) {
          // Initialize default rich AMC contracts dataset
          list = [
            {
              id: "amc_001",
              contractNumber: "AMC-2026-001",
              customerName: "JSW Steel Limited",
              location: "Toranagallu Slag Yard, Ballari, Karnataka",
              equipmentModel: "Wireless Crane Scale 50T (CS-50W)",
              serialNumbers: "CS-50T-2024-088, CS-50T-2024-089",
              contractTier: "Comprehensive",
              annualValue: 240000,
              invoicingMilestone: "25% Quarterly Advance",
              startDate: "2026-04-01",
              endDate: "2027-03-31",
              financialYear: "2026-27",
              slaResponse: "4 Hours Emergency",
              assignedEngineerId: "E-004",
              assignedEngineerName: "Priya Sharma",
              pmFrequency: "Quarterly (4 Visits/Year)",
              pmVisits: {
                Q1: { status: "Completed", date: "2026-05-10", engineerName: "Priya Sharma", result: "Passed - Within 0.1% Metrology Tolerance" },
                Q2: { status: "Completed", date: "2026-08-04", engineerName: "Priya Sharma", result: "Adjusted - Span & Zero Calibrated" },
                Q3: { status: "Scheduled", date: "2026-11-15", engineerName: "Priya Sharma" },
                Q4: { status: "Scheduled", date: "2027-02-15", engineerName: "Priya Sharma" }
              },
              invoicedAmount: 120000,
              collectedAmount: 120000,
              notes: "Full comprehensive coverage including load cell replacements and quarterly calibration certification."
            },
            {
              id: "amc_002",
              contractNumber: "AMC-2026-002",
              customerName: "Tata Steel Limited",
              location: "Kalinganagar Blast Furnace Bay 2, Odisha",
              equipmentModel: "Dynamic In-Motion Train Weigher (IMW-500)",
              serialNumbers: "IMW-500-2023-014",
              contractTier: "High-Temp Crane Scale",
              annualValue: 380000,
              invoicingMilestone: "50% Semi-Annual Advance",
              startDate: "2026-04-01",
              endDate: "2027-03-31",
              financialYear: "2026-27",
              slaResponse: "4 Hours Emergency",
              assignedEngineerId: "E-006",
              assignedEngineerName: "Senthil Nathan",
              pmFrequency: "Quarterly (4 Visits/Year)",
              pmVisits: {
                Q1: { status: "Completed", date: "2026-05-20", engineerName: "Senthil Nathan", result: "Passed" },
                Q2: { status: "Scheduled", date: "2026-08-25", engineerName: "Senthil Nathan" },
                Q3: { status: "Scheduled", date: "2026-11-20", engineerName: "Senthil Nathan" },
                Q4: { status: "Scheduled", date: "2027-02-20", engineerName: "Senthil Nathan" }
              },
              invoicedAmount: 190000,
              collectedAmount: 190000,
              notes: "Critical train track optical encoders and shear beam transducers maintenance."
            },
            {
              id: "amc_003",
              contractNumber: "AMC-2026-003",
              customerName: "Vedanta Aluminium",
              location: "Jharsuguda Smelter Plant, Odisha",
              equipmentModel: "Electronic Static Pitless Weighbridge (WB-100T)",
              serialNumbers: "WB-100T-2024-003",
              contractTier: "Weighbridge Bi-Annual",
              annualValue: 120000,
              invoicingMilestone: "100% 1st Quarter Advance",
              startDate: "2025-09-01",
              endDate: "2026-08-31",
              financialYear: "2026-27",
              slaResponse: "8 Hours Same Day",
              assignedEngineerId: "E-004",
              assignedEngineerName: "Priya Sharma",
              pmFrequency: "Bi-Annual (2 Visits/Year)",
              pmVisits: {
                Q1: { status: "Completed", date: "2025-11-12", engineerName: "Priya Sharma", result: "Passed" },
                Q2: { status: "Completed", date: "2026-05-18", engineerName: "Priya Sharma", result: "Passed" }
              },
              invoicedAmount: 120000,
              collectedAmount: 120000,
              notes: "Bi-annual test weights calibration and Legal Metrology stamping assistance."
            },
            {
              id: "amc_004",
              contractNumber: "AMC-2026-004",
              customerName: "UltraTech Cement",
              location: "Awarpur Cement Works, Maharashtra",
              equipmentModel: "Onboard Tipper Scale (OTW-30T)",
              serialNumbers: "OTW-30T-2024-041, OTW-30T-2024-042",
              contractTier: "Non-Comprehensive",
              annualValue: 150000,
              invoicingMilestone: "25% Quarterly Advance",
              startDate: "2026-01-01",
              endDate: "2026-12-31",
              financialYear: "2026-27",
              slaResponse: "24 Hours Next Business Day",
              assignedEngineerId: "E-006",
              assignedEngineerName: "Senthil Nathan",
              pmFrequency: "Quarterly (4 Visits/Year)",
              pmVisits: {
                Q1: { status: "Completed", date: "2026-03-15", engineerName: "Senthil Nathan", result: "Passed" },
                Q2: { status: "Completed", date: "2026-06-20", engineerName: "Senthil Nathan", result: "Passed" },
                Q3: { status: "Scheduled", date: "2026-09-15", engineerName: "Senthil Nathan" },
                Q4: { status: "Scheduled", date: "2026-12-10", engineerName: "Senthil Nathan" }
              },
              invoicedAmount: 75000,
              collectedAmount: 75000,
              notes: "Hydraulic pressure sensor calibration and CAN-Bus harness inspection."
            }
          ];
          if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
            window.RevOpsStore.saveCollection('amcContracts', list);
          }
        }
        return list;
      }

      function computeAmcStatus(c) {
        var today = new Date();
        var end = new Date(c.endDate);
        var diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          return { status: "Expired", badgeClass: "bg-rose-950 text-rose-300 border-rose-700/60", days: diffDays, label: "Expired (" + Math.abs(diffDays) + "d ago)" };
        } else if (diffDays <= 60) {
          return { status: "Expiring Soon", badgeClass: "bg-amber-950 text-amber-300 border-amber-700/60", days: diffDays, label: "Expires in " + diffDays + " days" };
        } else {
          return { status: "Active", badgeClass: "bg-emerald-950 text-emerald-300 border-emerald-700/60", days: diffDays, label: "Active (" + diffDays + "d remaining)" };
        }
      }

      function renderAmcTable() {
        var contracts = getAmcContractsList();
        activeAmcContracts = contracts;

        var searchQuery = (document.getElementById('amc-search-input')?.value || '').toLowerCase();
        var statusFilter = document.getElementById('amc-status-filter')?.value || 'All';
        var tierFilter = document.getElementById('amc-tier-filter')?.value || 'All';
        var fyFilter = document.getElementById('amc-fy-filter')?.value || 'All';

        var filtered = contracts.filter(function(c) {
          if (fyFilter !== 'All' && c.financialYear !== fyFilter) return false;
          if (tierFilter !== 'All' && c.contractTier !== tierFilter) return false;

          var st = computeAmcStatus(c);
          if (statusFilter !== 'All' && st.status !== statusFilter) return false;

          var q = searchQuery;
          var textMatch = (c.contractNumber || '').toLowerCase().includes(q) ||
                          (c.customerName || '').toLowerCase().includes(q) ||
                          (c.equipmentModel || '').toLowerCase().includes(q) ||
                          (c.serialNumbers || '').toLowerCase().includes(q) ||
                          (c.location || '').toLowerCase().includes(q);
          return textMatch;
        });

        // Compute KPIs across all active contracts
        var totalActiveAcv = 0;
        var activeCount = 0;
        var expiringCount = 0;
        var expiringVal = 0;
        var totalPmScheduled = 0;
        var totalPmDone = 0;
        var totalInvoiced = 0;
        var totalAcvAll = 0;

        contracts.forEach(function(c) {
          var st = computeAmcStatus(c);
          var acv = Number(c.annualValue) || 0;
          totalAcvAll += acv;
          totalInvoiced += (Number(c.invoicedAmount) || 0);

          if (st.status === 'Active') {
            totalActiveAcv += acv;
            activeCount++;
          }
          if (st.status === 'Expiring Soon') {
            expiringCount++;
            expiringVal += acv;
          }

          if (c.pmVisits) {
            Object.keys(c.pmVisits).forEach(function(qKey) {
              totalPmScheduled++;
              if (c.pmVisits[qKey].status === 'Completed') totalPmDone++;
            });
          }
        });

        document.getElementById('stat-active-acv').textContent = '₹' + (totalActiveAcv >= 100000 ? (totalActiveAcv / 100000).toFixed(2) + ' L' : totalActiveAcv.toLocaleString('en-IN'));
        document.getElementById('stat-active-count').textContent = activeCount + ' Active Contracts';
        document.getElementById('stat-expiring-count').textContent = expiringCount;
        document.getElementById('stat-expiring-value').textContent = 'Renewal Value: ₹' + (expiringVal / 100000).toFixed(2) + ' L';
        
        var pmPct = totalPmScheduled > 0 ? Math.round((totalPmDone / totalPmScheduled) * 100) : 100;
        document.getElementById('stat-pm-compliance').textContent = pmPct + '%';
        document.getElementById('stat-pm-counts').textContent = totalPmDone + ' Done / ' + totalPmScheduled + ' Scheduled';

        var billedPct = totalAcvAll > 0 ? Math.round((totalInvoiced / totalAcvAll) * 100) : 0;
        document.getElementById('stat-billed-pct').textContent = billedPct + '%';
        document.getElementById('stat-billed-amounts').textContent = '₹' + (totalInvoiced / 100000).toFixed(1) + 'L / ₹' + (totalAcvAll / 100000).toFixed(1) + 'L ACV';
        document.getElementById('amc-count-badge').textContent = filtered.length + ' contracts';

        var tbody = document.getElementById('amc-contracts-tbody');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No AMC contracts found matching filters.</td></tr>`;
          return;
        }

        filtered.forEach(function(c) {
          var st = computeAmcStatus(c);
          var acv = Number(c.annualValue) || 0;

          // Render PM visits pills
          var pmHtml = '';
          var qKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
          if (c.pmVisits) {
            pmHtml = `<div class="flex items-center justify-center gap-1.5">`;
            qKeys.forEach(function(qk) {
              var v = c.pmVisits[qk];
              if (!v) return;
              if (v.status === 'Completed') {
                pmHtml += `<button onclick="openPmVisitModal('${c.id}', '${qk}')" title="${qk}: Completed on ${v.date} by ${v.engineerName || 'Engineer'}" class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono font-bold text-[10px] hover:bg-emerald-900 cursor-pointer">${qk} ✓</button>`;
              } else {
                pmHtml += `<button onclick="openPmVisitModal('${c.id}', '${qk}')" title="${qk}: Due on ${v.date || 'Pending'} - Click to complete" class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono font-bold text-[10px] hover:bg-slate-700 hover:text-white cursor-pointer">${qk} ⏳</button>`;
              }
            });
            pmHtml += `</div>`;
          } else {
            pmHtml = `<span class="text-slate-500 text-[10px]">No PM schedule</span>`;
          }

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-black text-amber-400">${escapeHtml(c.contractNumber)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(c.startDate)} to ${escapeHtml(c.endDate)}</div>
              <span class="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(c.financialYear || '2026-27')}</span>
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-white">${escapeHtml(c.customerName)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5 line-clamp-1" title="${escapeHtml(c.location || '')}">${escapeHtml(c.location || 'Client Facility')}</div>
              <div class="text-[10px] text-indigo-300 mt-0.5">Rep: <span class="text-slate-300 font-semibold">${escapeHtml(c.assignedEngineerName || 'Priya Sharma')}</span></div>
            </td>
            <td class="py-3 px-4">
              <div class="font-semibold text-slate-200">${escapeHtml(c.equipmentModel)}</div>
              <div class="text-[10px] text-slate-400 font-mono mt-0.5">S/N: <span class="text-amber-300 font-bold">${escapeHtml(c.serialNumbers || 'N/A')}</span></div>
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60">${escapeHtml(c.contractTier)}</span>
              <div class="text-[10px] text-slate-400 mt-1">SLA: <span class="text-slate-200 font-bold">${escapeHtml(c.slaResponse || '8 Hrs')}</span></div>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="font-black text-white">₹${acv.toLocaleString('en-IN')}</div>
              <div class="text-[10px] text-emerald-400 mt-0.5 font-semibold">Invoiced: ₹${(Number(c.invoicedAmount) || 0).toLocaleString('en-IN')}</div>
              <div class="text-[9px] text-slate-400">${escapeHtml(c.invoicingMilestone || 'Quarterly')}</div>
            </td>
            <td class="py-3 px-4 text-center">
              ${pmHtml}
              <div class="text-[9px] text-slate-400 mt-1">${escapeHtml(c.pmFrequency || 'Quarterly')}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${st.badgeClass}">${escapeHtml(st.status)}</span>
              <div class="text-[10px] text-slate-400 mt-1 font-semibold">${escapeHtml(st.label)}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center space-x-1.5">
                <button onclick="editAmcContract('${c.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer" title="Edit AMC Details">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <a href="quotations.html?quoteType=AMC&prefillCustomer=${encodeURIComponent(c.customerName)}&contractRef=${encodeURIComponent(c.contractNumber)}" class="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded-lg transition-colors border border-indigo-800/60 cursor-pointer" title="Generate Renewal Quotation">
                  <i class="fa-solid fa-repeat text-xs"></i>
                </a>
                <a href="invoices.html?invoiceType=AMC&customerName=${encodeURIComponent(c.customerName)}&contractRef=${encodeURIComponent(c.contractNumber)}" class="p-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 hover:text-white rounded-lg transition-colors border border-amber-800/60 cursor-pointer" title="Raise AMC Milestone Invoice">
                  <i class="fa-solid fa-receipt text-xs"></i>
                </a>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function openNewAmcModal() {
        var form = document.getElementById('amc-form');
        form.reset();
        document.getElementById('amc-doc-id').value = '';
        document.getElementById('amc-modal-title').textContent = "Register New AMC Contract";
        
        var today = new Date();
        var yyyy = today.getFullYear();
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('amc-inp-start-date').value = yyyy + '-' + mm + '-' + dd;
        
        var nextYear = new Date(today);
        nextYear.setFullYear(today.getFullYear() + 1);
        var yyyyNext = nextYear.getFullYear();
        var mmNext = String(nextYear.getMonth() + 1).padStart(2, '0');
        var ddNext = String(nextYear.getDate()).padStart(2, '0');
        document.getElementById('amc-inp-end-date').value = yyyyNext + '-' + mmNext + '-' + ddNext;

        document.getElementById('amc-modal').classList.remove('hidden');
      }

      function closeAmcModal() {
        document.getElementById('amc-modal').classList.add('hidden');
      }

      function editAmcContract(id) {
        var contracts = getAmcContractsList();
        var c = contracts.find(function(item) { return item.id === id; });
        if (!c) return;

        document.getElementById('amc-doc-id').value = c.id;
        document.getElementById('amc-modal-title').textContent = "Edit AMC Contract (" + c.contractNumber + ")";
        document.getElementById('amc-inp-customer').value = c.customerName || '';
        handleAmcCustomerChange(c.customerName);
        document.getElementById('amc-inp-model').value = c.equipmentModel || '';
        document.getElementById('amc-inp-serial').value = c.serialNumbers || '';
        document.getElementById('amc-inp-tier').value = c.contractTier || 'Non-Comprehensive';
        document.getElementById('amc-inp-acv').value = c.annualValue || 180000;
        document.getElementById('amc-inp-billing').value = c.invoicingMilestone || '25% Quarterly Advance';
        document.getElementById('amc-inp-start-date').value = c.startDate || '';
        document.getElementById('amc-inp-end-date').value = c.endDate || '';
        document.getElementById('amc-inp-sla').value = c.slaResponse || '8 Hours Same Day';
        document.getElementById('amc-inp-engineer').value = c.assignedEngineerId || '';
        document.getElementById('amc-inp-pm-freq').value = c.pmFrequency || 'Quarterly (4 Visits/Year)';
        document.getElementById('amc-inp-notes').value = c.notes || '';

        document.getElementById('amc-modal').classList.remove('hidden');
      }

      function handleSaveAmcContract(e) {
        e.preventDefault();
        var docId = document.getElementById('amc-doc-id').value;
        var contracts = getAmcContractsList();
        var existing = docId ? contracts.find(function(c) { return c.id === docId; }) : null;

        var empSelect = document.getElementById('amc-inp-engineer');
        var engName = empSelect.options[empSelect.selectedIndex] ? empSelect.options[empSelect.selectedIndex].text.split(' (')[0] : 'Priya Sharma';

        var startDate = document.getElementById('amc-inp-start-date').value;
        var nextContractNum = existing ? existing.contractNumber : ('AMC-' + (new Date().getFullYear()) + '-' + String(contracts.length + 1).padStart(3, '0'));

        var newContract = {
          id: docId || ('amc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          contractNumber: nextContractNum,
          customerName: document.getElementById('amc-inp-customer').value,
          equipmentModel: document.getElementById('amc-inp-model').value,
          serialNumbers: document.getElementById('amc-inp-serial').value,
          contractTier: document.getElementById('amc-inp-tier').value,
          annualValue: Number(document.getElementById('amc-inp-acv').value) || 0,
          invoicingMilestone: document.getElementById('amc-inp-billing').value,
          startDate: startDate,
          endDate: document.getElementById('amc-inp-end-date').value,
          financialYear: typeof getFinancialYear === 'function' ? getFinancialYear(startDate) : '2026-27',
          slaResponse: document.getElementById('amc-inp-sla').value,
          assignedEngineerId: empSelect.value || 'E-004',
          assignedEngineerName: engName,
          pmFrequency: document.getElementById('amc-inp-pm-freq').value,
          pmVisits: existing ? existing.pmVisits : {
            Q1: { status: "Scheduled", date: startDate },
            Q2: { status: "Scheduled", date: "" },
            Q3: { status: "Scheduled", date: "" },
            Q4: { status: "Scheduled", date: "" }
          },
          invoicedAmount: existing ? existing.invoicedAmount : 0,
          collectedAmount: existing ? existing.collectedAmount : 0,
          notes: document.getElementById('amc-inp-notes').value,
          updatedAt: new Date().toISOString()
        };

        if (existing) {
          var idx = contracts.findIndex(function(c) { return c.id === docId; });
          if (idx !== -1) contracts[idx] = newContract;
        } else {
          contracts.unshift(newContract);
        }

        if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
          window.RevOpsStore.saveCollection('amcContracts', contracts);
          if (window.RevOpsStore.logAudit) {
            window.RevOpsStore.logAudit('AMC Contracts', newContract.contractNumber, existing ? 'UPDATE' : 'CREATE', (existing ? 'Updated AMC ' : 'Registered new AMC ') + newContract.contractNumber + ' for ' + newContract.customerName, existing, newContract);
          }
        }

        closeAmcModal();
        renderAmcTable();
      }

      function openPmVisitModal(contractId, quarterKey) {
        var contracts = getAmcContractsList();
        var c = contracts.find(function(item) { return item.id === contractId; });
        if (!c || !c.pmVisits || !c.pmVisits[quarterKey]) return;

        var v = c.pmVisits[quarterKey];
        document.getElementById('pm-contract-id').value = contractId;
        document.getElementById('pm-quarter-key').value = quarterKey;
        document.getElementById('pm-quarter-label').value = quarterKey + ' - ' + (c.contractNumber || '');
        document.getElementById('pm-modal-subtitle').textContent = c.customerName + ' • ' + c.equipmentModel;

        var today = new Date().toISOString().slice(0, 10);
        document.getElementById('pm-visit-date').value = v.date || today;
        document.getElementById('pm-attending-engineer').value = c.assignedEngineerId || 'E-004';
        document.getElementById('pm-calibration-result').value = v.result || "Passed - Within 0.1% Standard Metrology Tolerance";
        document.getElementById('pm-checklist-notes').value = v.notes || "";

        document.getElementById('pm-visit-modal').classList.remove('hidden');
      }

      function closePmVisitModal() {
        document.getElementById('pm-visit-modal').classList.add('hidden');
      }

      function handleSavePmVisit(e) {
        e.preventDefault();
        var contractId = document.getElementById('pm-contract-id').value;
        var qk = document.getElementById('pm-quarter-key').value;
        var contracts = getAmcContractsList();
        var c = contracts.find(function(item) { return item.id === contractId; });
        if (!c || !c.pmVisits) return;

        var engSelect = document.getElementById('pm-attending-engineer');
        var engName = engSelect.options[engSelect.selectedIndex] ? engSelect.options[engSelect.selectedIndex].text.split(' (')[0] : 'Priya Sharma';

        c.pmVisits[qk] = {
          status: "Completed",
          date: document.getElementById('pm-visit-date').value,
          engineerId: engSelect.value,
          engineerName: engName,
          result: document.getElementById('pm-calibration-result').value,
          notes: document.getElementById('pm-checklist-notes').value,
          completedAt: new Date().toISOString()
        };

        if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
          window.RevOpsStore.saveCollection('amcContracts', contracts);
          if (window.RevOpsStore.logAudit) {
            window.RevOpsStore.logAudit('AMC PM Visits', c.contractNumber, 'COMPLETE_PM', 'Completed PM visit ' + qk + ' for ' + c.customerName + ' (' + c.contractNumber + ') by ' + engName, null, c.pmVisits[qk]);
          }
        }

        closePmVisitModal();
        renderAmcTable();
      }

      function exportAmcCSV() {
        var contracts = activeAmcContracts || [];
        if (contracts.length === 0) {
          alert("No AMC contracts to export.");
          return;
        }

        var headers = ["ContractNumber", "CustomerName", "Location", "EquipmentModel", "SerialNumbers", "Tier", "ACV_INR", "BillingMilestone", "StartDate", "EndDate", "FY", "SLA", "AssignedEngineer", "Invoiced_INR", "Notes"];
        var rows = contracts.map(function(c) {
          return [
            c.contractNumber,
            '"' + (c.customerName || '').replace(/"/g, '""') + '"',
            '"' + (c.location || '').replace(/"/g, '""') + '"',
            '"' + (c.equipmentModel || '').replace(/"/g, '""') + '"',
            '"' + (c.serialNumbers || '').replace(/"/g, '""') + '"',
            c.contractTier,
            c.annualValue,
            '"' + (c.invoicingMilestone || '').replace(/"/g, '""') + '"',
            c.startDate,
            c.endDate,
            c.financialYear,
            c.slaResponse,
            '"' + (c.assignedEngineerName || '').replace(/"/g, '""') + '"',
            c.invoicedAmount || 0,
            '"' + (c.notes || '').replace(/"/g, '""') + '"'
          ].join(',');
        });

        var csv = headers.join(',') + '\n' + rows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "MeasureDI_AMC_Contracts_" + new Date().toISOString().slice(0, 10) + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
