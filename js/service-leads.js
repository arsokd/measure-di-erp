var activeServiceLeads = [];

      var serviceStagesList = [
        "Inquiry Ingestion",
        "Site Inspection Scheduled",
        "Scope & Pricing Evaluated",
        "Quotation Submitted",
        "Commercial Negotiation",
        "Contract Won / Confirmed"
      ];

      document.addEventListener('DOMContentLoaded', function() {
        renderServiceFunnelBar();
        renderServiceLeadsTable();

        if (window.RevOpsStore && typeof window.RevOpsStore.subscribeRealtimeSync === 'function') {
          window.RevOpsStore.subscribeRealtimeSync('serviceLeads', function() {
            renderServiceFunnelBar();
            renderServiceLeadsTable();
          });
        }
      });

      function getServiceLeadsList() {
        var list = window.RevOpsStore ? (window.RevOpsStore.getCollection('serviceLeads') || []) : [];
        
        // Seed default dataset if empty or missing new categories
        var hasSpareParts = list.some(function(l) { return l.serviceType === 'Spare Parts Lead' || l.serviceType === 'Spare Parts Supply'; });
        var hasPaidService = list.some(function(l) { return l.serviceType === 'Paid Service Lead' || l.serviceType === 'Paid Service'; });

        if (list.length === 0 || !hasSpareParts || !hasPaidService) {
          var defaultLeads = [
            {
              id: "srv_lead_001",
              leadNumber: "SRV-LD-2026-001",
              customerName: "JSW Steel Limited",
              serviceType: "AMC Comprehensive",
              leadSource: "AMC Warranty Expiry Conversion",
              equipmentModel: "Wireless Crane Scale 50T (CS-50W)",
              serialNumbers: "CS-50T-2024-088, CS-50T-2024-089",
              estimatedValue: 240000,
              stage: "Quotation Submitted",
              status: "Quotation Submitted",
              targetDate: "2026-09-15",
              contactPerson: "Mr. Ramesh Kulkarni",
              contactPhone: "9845012345",
              contactEmail: "ramesh.kulkarni@jsw.in",
              createdDate: "12/08/2026",
              financialYear: "2026-27",
              employeeId: "E-004",
              employeeName: "Priya Sharma",
              notes: "Expiring 12-month warranty converted into Comprehensive AMC proposal with 4 quarterly audits."
            },
            {
              id: "srv_lead_002",
              leadNumber: "SRV-LD-2026-002",
              customerName: "Tata Steel Limited",
              serviceType: "AMC Renewal",
              leadSource: "Annual AMC Renewal",
              equipmentModel: "Dynamic In-Motion Train Weigher (IMW-500)",
              serialNumbers: "IMW-500-2023-014",
              estimatedValue: 380000,
              stage: "Commercial Negotiation",
              status: "Commercial Negotiation",
              targetDate: "2026-08-30",
              contactPerson: "Dr. Arvind Patnaik",
              contactPhone: "9437098765",
              contactEmail: "arvind.patnaik@tatasteel.com",
              createdDate: "05/08/2026",
              financialYear: "2026-27",
              employeeId: "E-006",
              employeeName: "Senthil Nathan",
              notes: "Multi-year AMC renewal for blast furnace track weighing automation."
            },
            {
              id: "srv_lead_003",
              leadNumber: "SRV-LD-2026-003",
              customerName: "UltraTech Cement",
              serviceType: "Spare Parts Lead",
              leadSource: "Spare Parts Replacement Inquiry",
              equipmentModel: "Onboard Tipper Scale (OTW-30T)",
              serialNumbers: "OTW-30T-2024-041",
              estimatedValue: 135000,
              stage: "Scope & Pricing Evaluated",
              status: "Scope & Pricing Evaluated",
              targetDate: "2026-09-10",
              contactPerson: "Mr. Suresh Gokhale",
              contactPhone: "9822054321",
              contactEmail: "suresh.gokhale@adityabirla.com",
              createdDate: "15/08/2026",
              financialYear: "2026-27",
              employeeId: "E-006",
              employeeName: "Senthil Nathan",
              notes: "Requirement for 3 spare shear beam transducers, digital display indicator, and 2 armored cable harnesses."
            },
            {
              id: "srv_lead_004",
              leadNumber: "SRV-LD-2026-004",
              customerName: "Vedanta Aluminium",
              serviceType: "Calibration & Certification",
              leadSource: "Periodic Calibration Reminder",
              equipmentModel: "Electronic Static Pitless Weighbridge (WB-100T)",
              serialNumbers: "WB-100T-2024-003",
              estimatedValue: 70000,
              stage: "Site Inspection Scheduled",
              status: "Site Inspection Scheduled",
              targetDate: "2026-08-28",
              contactPerson: "Mr. Debabrata Jena",
              contactPhone: "9777011223",
              contactEmail: "debabrata.jena@vedanta.co.in",
              createdDate: "16/08/2026",
              financialYear: "2026-27",
              employeeId: "E-004",
              employeeName: "Priya Sharma",
              notes: "Annual NABL weight verification and stamping assistance for plant weighbridge."
            },
            {
              id: "srv_lead_005",
              leadNumber: "SRV-LD-2026-005",
              customerName: "Hindalco Industries",
              serviceType: "Paid Service Lead",
              leadSource: "Paid Service Request",
              equipmentModel: "High-Temperature Ladle Turret Weigher (LTW-150T)",
              serialNumbers: "LTW-150T-2022-019",
              estimatedValue: 85000,
              stage: "Quotation Submitted",
              status: "Quotation Submitted",
              targetDate: "2026-09-05",
              contactPerson: "Mr. Alok Mukherjee",
              contactPhone: "9830045678",
              contactEmail: "alok.mukherjee@adityabirla.com",
              createdDate: "18/08/2026",
              financialYear: "2026-27",
              employeeId: "E-006",
              employeeName: "Senthil Nathan",
              notes: "Urgent paid on-site diagnostic & load cell recalibration visit after lightning storm transient surge."
            },
            {
              id: "srv_lead_006",
              leadNumber: "SRV-LD-2026-006",
              customerName: "BHEL Thermal Power",
              serviceType: "Spare Parts Lead",
              leadSource: "Spare Parts Replacement Inquiry",
              equipmentModel: "Belt Weigher Conveyor Totalizer (BW-800)",
              serialNumbers: "BW-800-2023-055",
              estimatedValue: 195000,
              stage: "Inquiry Ingestion",
              status: "Inquiry Ingestion",
              targetDate: "2026-09-22",
              contactPerson: "Mr. K. V. Ramanathan",
              contactPhone: "9444019283",
              contactEmail: "ramanathan.kv@bhel.in",
              createdDate: "19/08/2026",
              financialYear: "2026-27",
              employeeId: "E-004",
              employeeName: "Priya Sharma",
              notes: "Direct RFQ for 4 IP68 S-type load cells, optical speed encoders, and stainless steel summing box."
            },
            {
              id: "srv_lead_007",
              leadNumber: "SRV-LD-2026-007",
              customerName: "Dalmia Bharat Cement",
              serviceType: "Paid Service Lead",
              leadSource: "Emergency Breakdown Call",
              equipmentModel: "Raw Material Hopper Dosing Scale (HDS-40T)",
              serialNumbers: "HDS-40T-2021-012",
              estimatedValue: 60000,
              stage: "Site Inspection Scheduled",
              status: "Site Inspection Scheduled",
              targetDate: "2026-08-26",
              contactPerson: "Mr. Saravanan K",
              contactPhone: "9841122334",
              contactEmail: "saravanan.k@dalmiabharat.com",
              createdDate: "20/08/2026",
              financialYear: "2026-27",
              employeeId: "E-006",
              employeeName: "Senthil Nathan",
              notes: "Paid on-site emergency callout for weighing hopper zero-shift calibration and sensor mechanical leveling."
            }
          ];

          if (list.length === 0) {
            list = defaultLeads;
          } else {
            // Append missing new categories so existing state benefits
            defaultLeads.forEach(function(dl) {
              if (!list.some(function(ex) { return ex.leadNumber === dl.leadNumber || ex.id === dl.id; })) {
                list.push(dl);
              }
            });
          }

          if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
            window.RevOpsStore.saveCollection('serviceLeads', list);
          }
        }
        return list;
      }

      function getServiceTypeBadge(type) {
        var t = type || '';
        if (t === 'Spare Parts Lead' || t === 'Spare Parts Supply') {
          return {
            cls: 'bg-emerald-950 text-emerald-300 border-emerald-700/60',
            icon: '<i class="fa-solid fa-gears mr-1 text-emerald-400"></i>'
          };
        } else if (t === 'Paid Service Lead' || t === 'Paid Service') {
          return {
            cls: 'bg-sky-950 text-sky-300 border-sky-700/60',
            icon: '<i class="fa-solid fa-screwdriver-wrench mr-1 text-sky-400"></i>'
          };
        } else if (t === 'AMC Comprehensive') {
          return {
            cls: 'bg-indigo-950 text-indigo-300 border-indigo-700/60',
            icon: '<i class="fa-solid fa-shield-halved mr-1 text-indigo-400"></i>'
          };
        } else if (t === 'AMC Renewal') {
          return {
            cls: 'bg-amber-950 text-amber-300 border-amber-800/60',
            icon: '<i class="fa-solid fa-repeat mr-1 text-amber-400"></i>'
          };
        } else if (t === 'Calibration & Certification') {
          return {
            cls: 'bg-purple-950 text-purple-300 border-purple-700/60',
            icon: '<i class="fa-solid fa-certificate mr-1 text-purple-400"></i>'
          };
        } else if (t === 'Breakdown Repair') {
          return {
            cls: 'bg-rose-950 text-rose-300 border-rose-700/60',
            icon: '<i class="fa-solid fa-triangle-exclamation mr-1 text-rose-400"></i>'
          };
        }
        return {
          cls: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: '<i class="fa-solid fa-wrench mr-1 text-slate-400"></i>'
        };
      }

      function renderServiceFunnelBar() {
        var leads = getServiceLeadsList();
        var container = document.getElementById('service-funnel-bar');
        if (!container) return;

        var counts = {};
        serviceStagesList.forEach(function(s) { counts[s] = 0; });
        leads.forEach(function(l) {
          var st = l.stage || l.status;
          if (counts[st] !== undefined) counts[st]++;
        });

        container.innerHTML = '';
        serviceStagesList.forEach(function(st, idx) {
          var c = counts[st] || 0;
          var div = document.createElement('div');
          div.className = "bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-center relative overflow-hidden flex flex-col justify-between";
          div.innerHTML = `
            <div class="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Stage ${idx + 1}</div>
            <div class="text-lg font-black text-white">${c}</div>
            <div class="text-[9px] font-bold text-amber-300 truncate mt-1" title="${st}">${st}</div>
          `;
          container.appendChild(div);
        });
      }

      function renderServiceLeadsTable() {
        var leads = getServiceLeadsList();
        activeServiceLeads = leads;

        var searchQuery = (document.getElementById('service-lead-search')?.value || '').toLowerCase();
        var typeFilter = document.getElementById('service-type-filter')?.value || 'All';
        var stageFilter = document.getElementById('service-stage-filter')?.value || 'All';
        var fyFilter = document.getElementById('service-fy-filter')?.value || 'All';

        var filtered = leads.filter(function(l) {
          if (fyFilter !== 'All' && l.financialYear !== fyFilter) return false;
          if (typeFilter !== 'All') {
            if (typeFilter === 'Spare Parts Lead') {
              if (l.serviceType !== 'Spare Parts Lead' && l.serviceType !== 'Spare Parts Supply') return false;
            } else if (typeFilter === 'Paid Service Lead') {
              if (l.serviceType !== 'Paid Service Lead' && l.serviceType !== 'Paid Service') return false;
            } else if (l.serviceType !== typeFilter) {
              return false;
            }
          }
          if (stageFilter !== 'All' && (l.stage || l.status) !== stageFilter) return false;

          var q = searchQuery;
          var textMatch = (l.leadNumber || '').toLowerCase().includes(q) ||
                          (l.customerName || '').toLowerCase().includes(q) ||
                          (l.serviceType || '').toLowerCase().includes(q) ||
                          (l.equipmentModel || '').toLowerCase().includes(q) ||
                          (l.serialNumbers || '').toLowerCase().includes(q) ||
                          (l.contactPerson || '').toLowerCase().includes(q);
          return textMatch;
        });

        // Compute KPIs
        var totalPipelineVal = 0;
        var openCount = 0;
        var amcRenewalsCount = 0;
        var amcRenewalsVal = 0;
        var wonCount = 0;

        leads.forEach(function(l) {
          var val = Number(l.estimatedValue) || 0;
          var st = l.stage || l.status || '';

          if (st !== 'Lost') {
            totalPipelineVal += val;
            openCount++;
          }
          if (st === 'Contract Won / Confirmed' || st === 'Won') {
            wonCount++;
          }
          if ((l.serviceType || '').includes('AMC') || (l.serviceType || '').includes('Renewal')) {
            amcRenewalsCount++;
            amcRenewalsVal += val;
          }
        });

        var avgVal = openCount > 0 ? Math.round(totalPipelineVal / openCount) : 0;
        var winRate = openCount > 0 ? Math.round((wonCount / openCount) * 100) : 0;

        document.getElementById('stat-service-pipeline-val').textContent = '₹' + (totalPipelineVal >= 100000 ? (totalPipelineVal / 100000).toFixed(2) + ' L' : totalPipelineVal.toLocaleString('en-IN'));
        document.getElementById('stat-service-leads-count').textContent = openCount + ' Open Inquiries';
        document.getElementById('stat-amc-renewals-count').textContent = amcRenewalsCount;
        document.getElementById('stat-amc-renewals-val').textContent = 'Value: ₹' + (amcRenewalsVal / 100000).toFixed(2) + ' L';
        document.getElementById('stat-avg-ticket').textContent = '₹' + (avgVal >= 100000 ? (avgVal / 100000).toFixed(2) + ' L' : avgVal.toLocaleString('en-IN'));
        document.getElementById('stat-win-rate').textContent = winRate + '%';
        document.getElementById('stat-won-count').textContent = wonCount + ' Contracts Confirmed';
        document.getElementById('service-lead-count-badge').textContent = filtered.length + ' leads';

        var tbody = document.getElementById('service-leads-tbody');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No Service, Spares or AMC leads found matching filters.</td></tr>`;
          return;
        }

        filtered.forEach(function(l) {
          var val = Number(l.estimatedValue) || 0;
          var st = l.stage || l.status || 'Inquiry Ingestion';

          var stageBadge = "bg-slate-800 text-slate-300 border-slate-700";
          if (st === "Contract Won / Confirmed" || st === "Won") stageBadge = "bg-emerald-950 text-emerald-300 border-emerald-700/60";
          else if (st === "Quotation Submitted" || st === "Scope & Pricing Evaluated") stageBadge = "bg-blue-950 text-blue-300 border-blue-700/60";
          else if (st === "Site Inspection Scheduled") stageBadge = "bg-purple-950 text-purple-300 border-purple-700/60";
          else if (st === "Commercial Negotiation") stageBadge = "bg-amber-950 text-amber-300 border-amber-700/60";
          else if (st === "Lost") stageBadge = "bg-rose-950 text-rose-400 border-rose-700/60";

          var badgeInfo = getServiceTypeBadge(l.serviceType);

          // Construct Contextual Action Buttons
          var actionButtonsHtml = `
            <button onclick="editServiceLead('${l.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer" title="Edit Lead">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
          `;

          if (l.serviceType === 'Spare Parts Lead' || l.serviceType === 'Spare Parts Supply') {
            actionButtonsHtml += `
              <a href="parts-sales.html" class="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 hover:text-white rounded-lg transition-colors border border-emerald-800/60 cursor-pointer" title="Open Spare Parts Hub">
                <i class="fa-solid fa-gears text-xs"></i>
              </a>
              <a href="quotations.html?quoteType=Parts&prefillCustomer=${encodeURIComponent(l.customerName)}&prefillModel=${encodeURIComponent(l.equipmentModel)}" class="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded-lg transition-colors border border-indigo-800/60 cursor-pointer" title="Generate Spare Parts Quotation">
                <i class="fa-solid fa-file-invoice text-xs"></i>
              </a>
            `;
          } else if (l.serviceType === 'Paid Service Lead' || l.serviceType === 'Breakdown Repair') {
            actionButtonsHtml += `
              <a href="service-tickets.html?prefillCustomer=${encodeURIComponent(l.customerName)}&prefillModel=${encodeURIComponent(l.equipmentModel)}" class="p-1.5 bg-sky-950 hover:bg-sky-900 text-sky-300 hover:text-white rounded-lg transition-colors border border-sky-800/60 cursor-pointer" title="Raise Paid Service Ticket">
                <i class="fa-solid fa-screwdriver-wrench text-xs"></i>
              </a>
              <a href="quotations.html?quoteType=Service&prefillCustomer=${encodeURIComponent(l.customerName)}&prefillModel=${encodeURIComponent(l.equipmentModel)}" class="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded-lg transition-colors border border-indigo-800/60 cursor-pointer" title="Generate Paid Service Quotation">
                <i class="fa-solid fa-file-invoice text-xs"></i>
              </a>
            `;
          } else {
            actionButtonsHtml += `
              <a href="quotations.html?quoteType=AMC&prefillCustomer=${encodeURIComponent(l.customerName)}&prefillModel=${encodeURIComponent(l.equipmentModel)}" class="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded-lg transition-colors border border-indigo-800/60 cursor-pointer" title="Generate AMC Quotation">
                <i class="fa-solid fa-file-invoice text-xs"></i>
              </a>
              <a href="amc-contracts.html" class="p-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 hover:text-white rounded-lg transition-colors border border-amber-800/60 cursor-pointer" title="Register to AMC Contracts">
                <i class="fa-solid fa-calendar-check text-xs"></i>
              </a>
            `;
          }

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-black text-amber-400 font-mono">${escapeHtml(l.leadNumber)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(l.createdDate || getFormattedToday())}</div>
              <span class="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(l.leadSource || 'Direct')}</span>
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-white text-xs">${escapeHtml(l.customerName)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Owner: <span class="text-indigo-300 font-semibold">${escapeHtml(l.employeeName || 'Priya Sharma')}</span></div>
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badgeInfo.cls}">
                ${badgeInfo.icon}<span>${escapeHtml(l.serviceType)}</span>
              </span>
              <div class="text-[10px] text-slate-400 mt-1 line-clamp-1" title="${escapeHtml(l.notes || '')}">${escapeHtml(l.notes || 'Service requirement')}</div>
            </td>
            <td class="py-3 px-4">
              <div class="font-semibold text-slate-200 text-xs">${escapeHtml(l.equipmentModel)}</div>
              <div class="text-[10px] text-amber-300 font-mono mt-0.5">${escapeHtml(l.serialNumbers || 'S/N: N/A')}</div>
            </td>
            <td class="py-3 px-4">
              <div class="font-semibold text-white text-xs">${escapeHtml(l.contactPerson || 'Customer Contact')}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(l.contactPhone || '')}</div>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="font-black text-white">₹${val.toLocaleString('en-IN')}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Target: ${escapeHtml(l.targetDate || 'N/A')}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${stageBadge}">${escapeHtml(st)}</span>
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center space-x-1.5">
                ${actionButtonsHtml}
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function openServiceLeadModal() {
        var form = document.getElementById('service-lead-form');
        form.reset();
        document.getElementById('service-lead-doc-id').value = '';
        document.getElementById('service-lead-modal-title').textContent = "Record Service / AMC Lead";
        
        var today = new Date();
        today.setDate(today.getDate() + 30);
        var yyyy = today.getFullYear();
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('inp-srv-target-date').value = yyyy + '-' + mm + '-' + dd;

        document.getElementById('service-lead-modal').classList.remove('hidden');
      }

      function closeServiceLeadModal() {
        document.getElementById('service-lead-modal').classList.add('hidden');
      }

      function editServiceLead(id) {
        var leads = getServiceLeadsList();
        var l = leads.find(function(item) { return item.id === id; });
        if (!l) return;

        document.getElementById('service-lead-doc-id').value = l.id;
        document.getElementById('service-lead-modal-title').textContent = "Edit Service Lead (" + l.leadNumber + ")";
        document.getElementById('inp-srv-customer').value = l.customerName || '';
        document.getElementById('inp-srv-source').value = l.leadSource || 'AMC Warranty Expiry Conversion';
        document.getElementById('inp-srv-type').value = l.serviceType || 'AMC Comprehensive';
        document.getElementById('inp-srv-model').value = l.equipmentModel || '';
        document.getElementById('inp-srv-serial').value = l.serialNumbers || '';
        document.getElementById('inp-srv-value').value = l.estimatedValue || 180000;
        document.getElementById('inp-srv-stage').value = l.stage || 'Inquiry Ingestion';
        document.getElementById('inp-srv-target-date').value = l.targetDate || '';
        document.getElementById('inp-srv-contact-name').value = l.contactPerson || '';
        document.getElementById('inp-srv-contact-phone').value = l.contactPhone || '';
        document.getElementById('inp-srv-contact-email').value = l.contactEmail || '';
        document.getElementById('inp-srv-notes').value = l.notes || '';

        document.getElementById('service-lead-modal').classList.remove('hidden');
      }

      function handleSaveServiceLead(e) {
        e.preventDefault();
        var docId = document.getElementById('service-lead-doc-id').value;
        var leads = getServiceLeadsList();
        var existing = docId ? leads.find(function(l) { return l.id === docId; }) : null;

        var myEmpId = localStorage.getItem('employeeId') || 'E-004';
        var myEmpName = localStorage.getItem('userName') || 'Priya Sharma';

        var nextLeadNum = existing ? existing.leadNumber : ('SRV-LD-' + (new Date().getFullYear()) + '-' + String(leads.length + 1).padStart(3, '0'));

        var newLead = {
          id: docId || ('srv_lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          leadNumber: nextLeadNum,
          customerName: document.getElementById('inp-srv-customer').value.trim(),
          leadSource: document.getElementById('inp-srv-source').value,
          serviceType: document.getElementById('inp-srv-type').value,
          equipmentModel: document.getElementById('inp-srv-model').value.trim(),
          serialNumbers: document.getElementById('inp-srv-serial').value.trim(),
          estimatedValue: Number(document.getElementById('inp-srv-value').value) || 0,
          stage: document.getElementById('inp-srv-stage').value,
          status: document.getElementById('inp-srv-stage').value,
          targetDate: document.getElementById('inp-srv-target-date').value,
          contactPerson: document.getElementById('inp-srv-contact-name').value.trim(),
          contactPhone: document.getElementById('inp-srv-contact-phone').value.trim(),
          contactEmail: document.getElementById('inp-srv-contact-email').value.trim(),
          notes: document.getElementById('inp-srv-notes').value.trim(),
          employeeId: existing ? existing.employeeId : myEmpId,
          employeeName: existing ? existing.employeeName : myEmpName,
          createdDate: existing ? existing.createdDate : getFormattedToday(),
          financialYear: typeof getFinancialYear === 'function' ? getFinancialYear(document.getElementById('inp-srv-target-date').value) : '2026-27',
          updatedAt: new Date().toISOString()
        };

        if (existing) {
          var idx = leads.findIndex(function(l) { return l.id === docId; });
          if (idx !== -1) leads[idx] = newLead;
        } else {
          leads.unshift(newLead);
        }

        if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
          window.RevOpsStore.saveCollection('serviceLeads', leads);
          if (window.RevOpsStore.logAudit) {
            window.RevOpsStore.logAudit('Service Leads', newLead.leadNumber, existing ? 'UPDATE' : 'CREATE', (existing ? 'Updated service lead ' : 'Created new service lead ') + newLead.leadNumber + ' - ' + newLead.customerName + ' (' + newLead.serviceType + ')', existing, newLead);
          }
        }

        closeServiceLeadModal();
        renderServiceFunnelBar();
        renderServiceLeadsTable();
      }

      function exportServiceLeadsCSV() {
        var leads = activeServiceLeads || [];
        if (leads.length === 0) {
          alert("No service leads to export.");
          return;
        }

        var headers = ["LeadNumber", "CustomerName", "ServiceType", "LeadSource", "EquipmentModel", "SerialNumbers", "EstimatedValue_INR", "Stage", "TargetDate", "ContactPerson", "ContactPhone", "ContactEmail", "Owner", "Notes"];
        var rows = leads.map(function(l) {
          return [
            l.leadNumber,
            '"' + (l.customerName || '').replace(/"/g, '""') + '"',
            l.serviceType,
            l.leadSource,
            '"' + (l.equipmentModel || '').replace(/"/g, '""') + '"',
            '"' + (l.serialNumbers || '').replace(/"/g, '""') + '"',
            l.estimatedValue || 0,
            l.stage,
            l.targetDate,
            '"' + (l.contactPerson || '').replace(/"/g, '""') + '"',
            l.contactPhone || '',
            l.contactEmail || '',
            '"' + (l.employeeName || '').replace(/"/g, '""') + '"',
            '"' + (l.notes || '').replace(/"/g, '""') + '"'
          ].join(',');
        });

        var csv = headers.join(',') + '\n' + rows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "MeasureDI_Service_AMC_Leads_" + new Date().toISOString().slice(0, 10) + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
