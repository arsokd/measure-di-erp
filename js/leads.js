var currentLeadContacts = [];
      var currentLeadProducts = [];

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initLeadsPage();
        }
      });

      function initLeadsPage() {
        var userRole = localStorage.getItem('userRole');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var wrapper = document.getElementById('lead-filter-wrapper');
          var select = document.getElementById('lead-emp-filter');
          if (wrapper && select) {
            wrapper.classList.remove('hidden');
            select.innerHTML = `<option value="All">All Lead Owners</option>`;
            employees.forEach(function(e) {
              var opt = document.createElement('option');
              opt.value = e.employeeId;
              opt.innerText = e.fullName + " (" + e.employeeId + ")";
              select.appendChild(opt);
            });
          }
        }

        renderFunnelBar();
        renderLeadsTable();
      }

      // Populates the Lead Source / Industry Vertical / Project Sector /
      // Vertical Classification / Currency dropdowns from their master
      // lists (Master Data page), preserving the current selection if it's
      // still a valid option after refresh.
      function populateLeadMasterDropdowns() {
        function fillSelect(selectId, collectionName) {
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

        fillSelect('inp-lead-source', 'leadSourceMaster');
        fillSelect('inp-lead-industry', 'industryVerticalMaster');
        fillSelect('inp-project-sector', 'projectSectorMaster');
        fillSelect('inp-lead-vertical', 'verticalClassificationMaster');

        var curSelect = document.getElementById('inp-lead-currency');
        if (curSelect) {
          var currencies = (window.RevOpsStore.getCollection('currencyMaster') || []).filter(function(it) { return it.isActive !== false; });
          var currentCur = curSelect.value;
          curSelect.innerHTML = currencies.map(function(c) {
            return '<option value="' + escapeHtml(c.code) + '">' + escapeHtml(c.code) + ' - ' + escapeHtml(c.name) + ' (' + escapeHtml(c.symbol) + ')</option>';
          }).join('');
          if (currentCur && currencies.some(function(c) { return c.code === currentCur; })) {
            curSelect.value = currentCur;
          } else {
            var inr = currencies.find(function(c) { return c.code === 'INR'; });
            if (inr) curSelect.value = 'INR';
          }
        }
      }

      // Product Name cascades by Industry Vertical + Project Sector (master
      // data tagged on each productsMaster record). Falls back to filtering
      // by Vertical Classification alone if nothing is tagged yet for that
      // specific combination, so the dropdown is never left empty while the
      // catalog is still being tagged.
      function getProductsForLeadCascade(industryVertical, projectSector, vertical) {
        var masterProducts = window.RevOpsStore.getCollection('productsMaster') || [];
        if (masterProducts.length === 0) {
          return getProductsByVertical(vertical);
        }

        var matched = masterProducts.filter(function(p) {
          var industryOk = !p.industryVertical || p.industryVertical === industryVertical;
          var sectorOk = !p.projectSector || p.projectSector === projectSector;
          return industryOk && sectorOk;
        });

        if (matched.length > 0) return matched;
        return masterProducts.filter(function(p) { return p.vertical === vertical; });
      }

      function getCurrentLeadCascadeValues() {
        return {
          industryVertical: (document.getElementById('inp-lead-industry') || {}).value || '',
          projectSector: (document.getElementById('inp-project-sector') || {}).value || '',
          vertical: (document.getElementById('inp-lead-vertical') || {}).value || 'Projects'
        };
      }

      function getProductsByVertical(vertical) {
        var masterProducts = window.RevOpsStore.getCollection('productsMaster') || [];
        if (masterProducts.length === 0) {
          // Default fallbacks by vertical
          var defaults = {
            'Projects': [
              { name: 'Dynamic In-Motion Train Weigher (IMW-500)', spec: '200T Capacity, High-Speed Pitless, Accuracy 0.2%', hsn: '90318000', price: 4500000 },
              { name: 'Automated Slag Yard Weighing & Tracking (ASW-2000)', spec: 'Heavy Duty Heat Resistant RFID Automation', hsn: '84238900', price: 2800000 },
              { name: 'Ladle Turret Weighing System (LTW-350)', spec: '350-Ton High Temperature Metrology Grade', hsn: '90318000', price: 3850000 },
              { name: 'Blast Furnace Automatic Hopper Scale (BFH-100)', spec: 'Batch Dosing +/-0.1% Repeatability', hsn: '84238900', price: 3200000 },
              { name: 'Surface Laser Profiling Scanner (SLS-4K)', spec: '4K Laser Triangulation 0.01mm resolution', hsn: '90314900', price: 2200000 }
            ],
            'Onboard': [
              { name: 'Onboard Tipper Weighing Scale (OTW-30T)', spec: 'Wireless Axle Load & Gross Weigher for Heavy Tippers', hsn: '84238900', price: 480000 },
              { name: 'Excavator / Wheel Loader Dynamic Payload Scale (PLS-PRO)', spec: 'Real-time hydraulic lift pressure telemetry', hsn: '84238900', price: 395000 },
              { name: 'Dumper Truck Onboard Telematics Weigher (DTW-100)', spec: 'CAN-Bus J1939 telemetry with overload buzzer', hsn: '84238900', price: 550000 },
              { name: 'Garbage Compactor Bin Lifter Weigher (GCW-10)', spec: 'Solar-ready dynamic bin metrology', hsn: '84238900', price: 320000 }
            ],
            'Crane': [
              { name: 'Wireless Crane Scale 50T (CS-50W)', spec: 'Heavy Duty Cast Alloy IP67 with Handheld RF Terminal', hsn: '84238900', price: 240000 },
              { name: 'Overhead EOT Crane Load Limiter & Indicator (EOT-LL)', spec: 'Dual rope tension cell with display', hsn: '90318000', price: 185000 },
              { name: 'Digital Crane Scale 20T High Temp Shielded (CS-20HT)', spec: 'Heat radiation deflector for Foundry / Smelter', hsn: '84238900', price: 310000 },
              { name: 'Crane Boom Angle & Load Moment Indicator (LMI-500)', spec: 'Full color screen with anti-two-block sensor', hsn: '90318000', price: 650000 }
            ],
            'Service and Parts': [
              { name: '50-Ton Shear Beam Load Cell (SP-LC-50T)', spec: 'Stainless Steel IP68 3mV/V Class C3', hsn: '90318000', price: 45000 },
              { name: 'Optical Rotary Encoder 1000 PPR (SP-ENC-1000)', spec: 'Stainless Steel 10-30V DC Line Driver', hsn: '90319000', price: 18500 },
              { name: 'High-Brightness 6-Digit LED Scoreboard (SP-DISP-7S)', spec: '4-inch Red LED RS485/Modbus IP65', hsn: '85285900', price: 28000 },
              { name: 'IP68 Stainless Steel 4-Channel Junction Box (SP-JB-04IP)', spec: 'Surge protected with trim pots', hsn: '85369090', price: 6500 },
              { name: 'Annual Maintenance Contract (AMC) - Comprehensive', spec: '4 Quarterly PM Visits + 24/7 Breakdown Coverage + Spares', hsn: '998717', price: 180000 },
              { name: 'Annual Maintenance Contract (AMC) - Non-Comprehensive', spec: '4 Preventive Visits + Breakdown Labor Only', hsn: '998717', price: 75000 },
              { name: 'Emergency On-Site Calibration & Certification', spec: 'NABL Traceable weights calibration up to 100T', hsn: '998717', price: 35000 }
            ]
          };
          return defaults[vertical] || defaults['Projects'];
        }
        return masterProducts.filter(function(p) { return p.vertical === vertical; });
      }

      function handleVerticalChange() {
        var cascade = getCurrentLeadCascadeValues();
        var prods = getProductsForLeadCascade(cascade.industryVertical, cascade.projectSector, cascade.vertical);

        // Update any product rows that don't match the new vertical
        if (currentLeadProducts.length === 0) {
          addProductRow();
        } else {
          // Re-populate product options for all rows
          currentLeadProducts.forEach(function(p, i) {
            var exists = prods.some(function(mp) { return (mp.name || mp.productName) === p.name; });
            if (!exists && prods.length > 0) {
              var first = prods[0];
              p.name = first.name || first.productName;
              p.spec = first.spec || first.technicalSpec || '';
              p.hsn = first.hsn || first.hsnCode || '90318000';
              p.unitPrice = first.price || first.unitPrice || 0;
            }
          });
          renderLeadProducts();
        }
      }

      function addProductRow(existing) {
        var cascade = getCurrentLeadCascadeValues();
        var prods = getProductsForLeadCascade(cascade.industryVertical, cascade.projectSector, cascade.vertical);
        var first = prods.length > 0 ? prods[0] : { name: 'Standard Unit', spec: '', hsn: '90318000', price: 0 };

        var prod = existing || {
          name: first.name || first.productName,
          spec: first.spec || first.technicalSpec || '',
          hsn: first.hsn || first.hsnCode || '90318000',
          quantity: 1,
          unitPrice: first.price || first.unitPrice || 0
        };

        currentLeadProducts.push(prod);
        renderLeadProducts();
      }

      function removeProductRow(idx) {
        if (currentLeadProducts.length <= 1) {
          alert("A lead must contain at least one product line item.");
          return;
        }
        currentLeadProducts.splice(idx, 1);
        renderLeadProducts();
      }

      function renderLeadProducts() {
        var container = document.getElementById('lead-products-container');
        if (!container) return;
        container.innerHTML = '';

        var cascade = getCurrentLeadCascadeValues();
        var availableProducts = getProductsForLeadCascade(cascade.industryVertical, cascade.projectSector, cascade.vertical);
        var cascadeLabel = [cascade.industryVertical, cascade.projectSector].filter(Boolean).join(' / ') || cascade.vertical;

        currentLeadProducts.forEach(function(prod, i) {
          var card = document.createElement('div');
          card.className = "bg-slate-900/90 p-3 rounded-xl border border-slate-700 space-y-2.5 relative";

          var optionsHtml = availableProducts.map(function(p) {
            var pName = p.name || p.productName;
            var isSel = pName === prod.name ? 'selected' : '';
            return `<option value="${escapeHtml(pName)}" ${isSel}>${escapeHtml(pName)}</option>`;
          }).join('');

          card.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-extrabold uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                <i class="fa-solid fa-cube"></i> Product Item #${i + 1}
              </span>
              ${currentLeadProducts.length > 1 ? `
                <button type="button" onclick="removeProductRow(${i})" class="text-rose-400 hover:text-rose-300 font-bold text-xs p-1 cursor-pointer flex items-center gap-1">
                  <i class="fa-solid fa-trash-can"></i> <span>Remove</span>
                </button>
              ` : ''}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div class="sm:col-span-8">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Product Name (Filtered by ${escapeHtml(cascadeLabel)}) *</label>
                <select onchange="onLeadProductSelected(${i}, this.value)" class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-semibold focus:outline-none focus:border-indigo-500">
                  ${optionsHtml}
                </select>
              </div>
              <div class="sm:col-span-4">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">HSN Code (from master)</label>
                <input type="text" value="${escapeHtml(prod.hsn || '')}" readonly class="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 cursor-not-allowed" />
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Technical Specification / Unique Specs (from master)</label>
              <input type="text" value="${escapeHtml(prod.spec || '')}" readonly class="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 cursor-not-allowed" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Quantity *</label>
                <input type="number" min="1" value="${prod.quantity || 1}" oninput="updateLeadProductField(${i}, 'quantity', this.value, this)" class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold text-center focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unit Price (₹, from master)</label>
                <input type="number" value="${prod.unitPrice || 0}" readonly class="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 font-bold text-right cursor-not-allowed" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Line Total (₹)</label>
                <div class="lead-line-total-display px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-emerald-400 font-black text-right">
                  ₹${((Number(prod.quantity) || 1) * (Number(prod.unitPrice) || 0)).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          `;

          container.appendChild(card);
        });

        updateLeadProductsTotal();
      }

      function updateLeadProductField(idx, field, val, inputEl) {
        if (!currentLeadProducts[idx]) return;
        currentLeadProducts[idx][field] = Number(val) || 0;
        
        var card = inputEl ? inputEl.closest('.bg-slate-900\\/90') || inputEl.closest('div.relative') : null;
        if (card) {
          var lineTotalDisplay = card.querySelector('.lead-line-total-display');
          if (lineTotalDisplay) {
            var q = Number(currentLeadProducts[idx].quantity) || 1;
            var u = Number(currentLeadProducts[idx].unitPrice) || 0;
            lineTotalDisplay.innerText = '₹' + (q * u).toLocaleString('en-IN');
          }
        }
        updateLeadProductsTotal();
      }

      function onLeadProductSelected(idx, prodName) {
        var cascade = getCurrentLeadCascadeValues();
        var prods = getProductsForLeadCascade(cascade.industryVertical, cascade.projectSector, cascade.vertical);
        var found = prods.find(function(p) { return (p.name || p.productName) === prodName; });

        if (found && currentLeadProducts[idx]) {
          currentLeadProducts[idx].name = prodName;
          currentLeadProducts[idx].spec = found.spec || found.technicalSpec || '';
          currentLeadProducts[idx].hsn = found.hsn || found.hsnCode || '90318000';
          currentLeadProducts[idx].unitPrice = found.price || found.unitPrice || 0;
          renderLeadProducts();
        }
      }

      function updateLeadProductsTotal() {
        var total = 0;
        currentLeadProducts.forEach(function(p) {
          var q = Number(p.quantity) || 1;
          var u = Number(p.unitPrice) || 0;
          total += (q * u);
        });

        var valInput = document.getElementById('inp-lead-value');
        if (valInput && total > 0) {
          valInput.value = Math.round(total);
        }
      }

      function handleIndustryChange() {
        var ind = document.getElementById('inp-lead-industry').value;
        var sectorBox = document.getElementById('project-sector-box');
        if (ind === 'Project') {
          sectorBox.classList.remove('hidden');
        } else {
          sectorBox.classList.add('hidden');
        }

        // Suggest default vertical match
        var vertSelect = document.getElementById('inp-lead-vertical');
        if (ind === 'Project') vertSelect.value = 'Projects';
        else if (ind === 'Onboard') vertSelect.value = 'Onboard';
        else if (ind === 'Crane') vertSelect.value = 'Crane';
        else if (ind === 'Spare/Service') vertSelect.value = 'Service and Parts';
        handleVerticalChange();
      }

      function handleProjectSectorChange() {
        var sector = document.getElementById('inp-project-sector').value;
        var otherInput = document.getElementById('inp-other-sector');
        if (sector === 'Other Industries') {
          otherInput.classList.remove('hidden');
        } else {
          otherInput.classList.add('hidden');
        }
        // Product Name is also filtered by Project Sector — refresh it.
        handleVerticalChange();
      }

      function addContactRow(existingContact) {
        if (currentLeadContacts.length >= 5) {
          alert("Maximum 5 contacts allowed per lead.");
          return;
        }

        var contact = existingContact || {
          name: '',
          designation: '',
          phone: '',
          email: '',
          autoCc: true
        };

        var index = currentLeadContacts.length;
        currentLeadContacts.push(contact);
        renderContactRows();
      }

      function removeContactRow(idx) {
        if (currentLeadContacts.length <= 1) {
          alert("At least 1 primary contact is required.");
          return;
        }
        currentLeadContacts.splice(idx, 1);
        renderContactRows();
      }

      function renderContactRows() {
        var container = document.getElementById('contacts-container');
        container.innerHTML = '';

        currentLeadContacts.forEach(function(c, i) {
          var row = document.createElement('div');
          row.className = "bg-slate-900 p-3 rounded-xl border border-slate-750 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs";
          row.innerHTML = `
            <div class="sm:col-span-3">
              <input type="text" placeholder="Contact Name *" value="${escapeHtml(c.name)}" oninput="currentLeadContacts[${i}].name = this.value" required class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white" />
            </div>
            <div class="sm:col-span-2">
              <input type="text" placeholder="Designation" value="${escapeHtml(c.designation || '')}" oninput="currentLeadContacts[${i}].designation = this.value" class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white" />
            </div>
            <div class="sm:col-span-3">
              <input type="text" placeholder="Mobile / Phone *" value="${escapeHtml(c.phone)}" oninput="currentLeadContacts[${i}].phone = this.value" required class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white" />
            </div>
            <div class="sm:col-span-3">
              <input type="email" placeholder="Email Address" value="${escapeHtml(c.email || '')}" oninput="currentLeadContacts[${i}].email = this.value" class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white" />
            </div>
            <div class="sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
              <label class="inline-flex items-center cursor-pointer" title="Auto-CC on client emails">
                <input type="checkbox" ${c.autoCc !== false ? 'checked' : ''} onchange="currentLeadContacts[${i}].autoCc = this.checked" class="rounded text-indigo-500" />
                <span class="ml-1 text-[10px] text-slate-400 font-bold">CC</span>
              </label>
              ${currentLeadContacts.length > 1 ? `
                <button type="button" onclick="removeContactRow(${i})" class="text-rose-400 hover:text-rose-300 font-bold p-1">&times;</button>
              ` : ''}
            </div>
          `;
          container.appendChild(row);
        });
      }

      var stagesList = [
        "Customer Contacted / Contact Attempted",
        "Follow-Up Scheduled",
        "Site Visit Completed",
        "Technical Evaluation in Progress",
        "Commercial Offer Submitted",
        "Pre-Qualification Completed",
        "Lead Qualified",
        "Order Confirmed"
      ];

      function renderFunnelBar() {
        var leads = window.RevOpsStore.getCollection('leads') || [];
        var funnelContainer = document.getElementById('funnel-stages-bar');
        if (!funnelContainer) return;

        var stageCounts = {};
        stagesList.forEach(function(s) { stageCounts[s] = 0; });
        leads.forEach(function(l) {
          var st = l.stage || l.status;
          if (stageCounts[st] !== undefined) stageCounts[st]++;
        });

        funnelContainer.innerHTML = '';
        stagesList.forEach(function(st, idx) {
          var count = stageCounts[st] || 0;
          var stageCard = document.createElement('div');
          stageCard.className = "bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-center relative overflow-hidden flex flex-col justify-between";
          stageCard.innerHTML = `
            <div class="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Stage ${idx + 1}</div>
            <div class="text-lg font-black text-white">${count}</div>
            <div class="text-[9px] font-bold text-indigo-300 truncate mt-1" title="${st}">${st.split(' ')[0]} ${st.split(' ')[1] || ''}</div>
          `;
          funnelContainer.appendChild(stageCard);
        });
      }

      function renderLeadsTable() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var searchQuery = (document.getElementById('lead-search-input').value || '').toLowerCase();
        
        var vertFilter = document.getElementById('lead-vertical-filter').value;
        var stageFilter = document.getElementById('lead-stage-filter').value;
        var selectedFy = document.getElementById('lead-fy-filter').value;

        var selectedFilterEmp = "All";
        var filterElem = document.getElementById('lead-emp-filter');
        if (filterElem && filterElem.value) selectedFilterEmp = filterElem.value;

        var leads = window.RevOpsStore.getCollection('leads') || [];

        var filtered = leads.filter(function(l) {
          if (selectedFy !== 'All') {
            var leadFy = typeof getFinancialYear === 'function' ? getFinancialYear(l.createdDate || l.createdAt) : '2026-27';
            if (leadFy !== selectedFy) return false;
          }
          if (userRole === 'staff' && l.employeeId !== myEmpId) return false;
          if (selectedFilterEmp !== 'All' && l.employeeId !== selectedFilterEmp) return false;
          if (vertFilter !== 'All' && l.vertical !== vertFilter) return false;
          if (stageFilter !== 'All' && (l.stage || l.status) !== stageFilter) return false;

          var textMatch = (l.customerName || '').toLowerCase().includes(searchQuery) ||
                          (l.leadNumber || '').toLowerCase().includes(searchQuery) ||
                          (l.productName || '').toLowerCase().includes(searchQuery) ||
                          (l.productSpec || '').toLowerCase().includes(searchQuery) ||
                          (l.contactPerson || '').toLowerCase().includes(searchQuery);
          return textMatch;
        });

        // Metrics computation
        var totalVal = 0;
        var qualifiedCount = 0;
        var wonCount = 0;

        filtered.forEach(function(l) {
          var val = Number(l.estimatedValue) || Number(l.expectedValue) || Number(l.dealValue) || 0;
          var st = l.stage || l.status || '';
          totalVal += val;
          if (st === 'Pre-Qualification Completed' || st === 'Lead Qualified') qualifiedCount++;
          if (st === 'Order Confirmed' || st === 'Won') wonCount++;
        });

        document.getElementById('stat-lead-count').innerText = filtered.length;
        document.getElementById('stat-lead-value').innerText = formatINR(totalVal);
        document.getElementById('stat-lead-qualified').innerText = qualifiedCount;
        document.getElementById('stat-lead-won').innerText = wonCount;
        document.getElementById('filtered-lead-count-badge').innerText = filtered.length + ' leads';

        var tbody = document.getElementById('leads-tbody');
        tbody.innerHTML = "";

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No commercial leads found matching the filters.</td></tr>`;
          return;
        }

        filtered.forEach(function(l) {
          var val = Number(l.estimatedValue) || Number(l.expectedValue) || Number(l.dealValue) || 0;
          var currency = l.currency || 'INR';
          var currSymbol = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '₹');
          var st = l.stage || l.status || 'Customer Contacted / Contact Attempted';

          var stageBadge = "bg-slate-800 text-slate-300 border-slate-700";
          if (st.indexOf("Order Confirmed") !== -1 || st === "Won") stageBadge = "bg-emerald-950/80 text-emerald-300 border-emerald-700/60";
          else if (st.indexOf("Lead Qualified") !== -1 || st.indexOf("Pre-Qualification") !== -1) stageBadge = "bg-purple-950/80 text-purple-300 border-purple-700/60";
          else if (st.indexOf("Commercial Offer") !== -1) stageBadge = "bg-blue-950/80 text-blue-300 border-blue-700/60";
          else if (st.indexOf("Technical") !== -1 || st.indexOf("Site Visit") !== -1) stageBadge = "bg-amber-950/80 text-amber-300 border-amber-700/60";
          else if (st.indexOf("Lost") !== -1) stageBadge = "bg-rose-950/80 text-rose-400 border-rose-700/60";

          var contacts = l.contacts || [];
          if (contacts.length === 0 && l.contactPerson) {
            contacts.push({ name: l.contactPerson, phone: l.contactPhone || l.phone, email: l.contactEmail || l.email, designation: '' });
          }

          var contactsHtml = contacts.map(function(c) {
            return `<div class="text-[11px] leading-tight"><span class="font-bold text-white">${escapeHtml(c.name)}</span> <span class="text-slate-400">(${escapeHtml(c.phone || 'No phone')})</span></div>`;
          }).join('');

          var prodsList = (l.products && Array.isArray(l.products) && l.products.length > 0) ? l.products : [
            { name: l.productName || 'Equipment', spec: l.productSpec || '', quantity: 1, unitPrice: val }
          ];

          var prodsHtml = prodsList.map(function(p, pIdx) {
            return `<div class="text-[11px] font-semibold text-slate-200">${pIdx + 1}. ${escapeHtml(p.name)} ${p.quantity > 1 ? '<span class="text-indigo-400 font-bold">(' + p.quantity + ' Nos)</span>' : ''}</div>
                    <div class="text-[10px] text-slate-400 line-clamp-1 mb-0.5" title="${escapeHtml(p.spec || '')}">Spec: ${escapeHtml(p.spec || 'Standard')}</div>`;
          }).join('');

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-black text-indigo-400">${escapeHtml(l.leadNumber || l.id)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(l.createdDate || getFormattedToday())}</div>
              <span class="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(l.leadSource || 'Direct')}</span>
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-white">${escapeHtml(l.customerName)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                <span class="text-amber-400">${escapeHtml(l.industry || 'Project')}</span>
                ${l.projectSector ? `<span class="text-slate-500">&bull;</span> <span>${escapeHtml(l.projectSector)}</span>` : ''}
              </div>
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60">${escapeHtml(l.vertical || 'Projects')}</span>
                ${prodsList.length > 1 ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300">${prodsList.length} items</span>` : ''}
              </div>
              ${prodsHtml}
            </td>
            <td class="py-3 px-4 space-y-1">
              ${contactsHtml || '<span class="text-slate-500">No contacts</span>'}
            </td>
            <td class="py-3 px-4 text-right">
              <div class="font-black text-white">${currSymbol} ${Number(val).toLocaleString('en-IN')}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(currency)}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${stageBadge}">
                ${escapeHtml(st)}
              </span>
            </td>
            <td class="py-3 px-4">
              <div class="font-semibold text-slate-200">${escapeHtml(l.employeeName || 'Staff')}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(l.employeeId || '')}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center space-x-1.5">
                <button onclick="editLead('${l.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer" title="Edit Lead Details">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <button onclick="createQuoteFromLead('${l.id}')" class="p-1.5 bg-[#982B68]/30 hover:bg-[#982B68] text-[#E283BD] hover:text-white rounded-lg transition-colors border border-[#982B68]/50 cursor-pointer" title="Generate Quotation with Bi-directional Sync">
                  <i class="fa-solid fa-file-invoice text-xs"></i>
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function openLeadModal(leadData) {
        currentLeadContacts = [];
        currentLeadProducts = [];
        var modal = document.getElementById('lead-modal');
        var form = document.getElementById('lead-form');
        form.reset();
        populateLeadMasterDropdowns();

        // Lead Owner is always automatic — the current logged-in user's
        // name on a new lead, or whoever already owns it on an edit.
        document.getElementById('disp-lead-owner').value = leadData ? (leadData.employeeName || localStorage.getItem('userName') || '') : (localStorage.getItem('userName') || '');

        if (leadData) {
          document.getElementById('lead-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-[#E283BD]"></i> <span>Edit Commercial Lead (${leadData.leadNumber || leadData.id})</span>`;
          document.getElementById('lead-doc-id').value = leadData.id;
          document.getElementById('inp-lead-customer').value = leadData.customerName || '';
          document.getElementById('inp-lead-source').value = leadData.leadSource || 'Direct Customer Approach';
          document.getElementById('inp-lead-industry').value = leadData.industry || 'Project';
          
          handleIndustryChange();
          if (leadData.projectSector) {
            var sectSelect = document.getElementById('inp-project-sector');
            sectSelect.value = leadData.projectSector;
            if (sectSelect.value !== leadData.projectSector) {
              sectSelect.value = 'Other Industries';
              document.getElementById('inp-other-sector').value = leadData.projectSector;
              document.getElementById('inp-other-sector').classList.remove('hidden');
            }
          }

          document.getElementById('inp-lead-vertical').value = leadData.vertical || 'Projects';

          // Load products
          if (leadData.products && Array.isArray(leadData.products) && leadData.products.length > 0) {
            currentLeadProducts = JSON.parse(JSON.stringify(leadData.products));
          } else if (leadData.productName) {
            currentLeadProducts = [{
              name: leadData.productName,
              spec: leadData.productSpec || '',
              hsn: leadData.hsnCode || '90318000',
              quantity: 1,
              unitPrice: Number(leadData.estimatedValue) || 0
            }];
          } else {
            addProductRow();
          }

          document.getElementById('inp-lead-currency').value = leadData.currency || 'INR';
          document.getElementById('inp-lead-value').value = leadData.estimatedValue || leadData.expectedValue || 0;
          document.getElementById('inp-lead-target-date').value = leadData.targetDate || '';
          document.getElementById('inp-lead-stage').value = leadData.stage || leadData.status || 'Customer Contacted / Contact Attempted';
          document.getElementById('inp-lead-notes').value = leadData.notes || '';

          if (leadData.contacts && Array.isArray(leadData.contacts)) {
            currentLeadContacts = JSON.parse(JSON.stringify(leadData.contacts));
          } else if (leadData.contactPerson) {
            currentLeadContacts.push({
              name: leadData.contactPerson,
              phone: leadData.contactPhone || leadData.phone || '',
              email: leadData.contactEmail || leadData.email || '',
              designation: '',
              autoCc: true
            });
          }
        } else {
          document.getElementById('lead-modal-title').innerHTML = `<i class="fa-solid fa-file-signature text-[#E283BD]"></i> <span>Add New Commercial Lead</span>`;
          document.getElementById('lead-doc-id').value = '';
          document.getElementById('inp-lead-industry').value = 'Project';
          handleIndustryChange();
          document.getElementById('inp-lead-vertical').value = 'Projects';
          currentLeadProducts = [];
          addProductRow();
          currentLeadContacts = [{ name: '', designation: '', phone: '', email: '', autoCc: true }];
        }

        renderLeadProducts();
        renderContactRows();
        modal.classList.remove('hidden');
      }

      function closeLeadModal() {
        document.getElementById('lead-modal').classList.add('hidden');
      }

      function editLead(id) {
        var leads = window.RevOpsStore.getCollection('leads') || [];
        var lead = leads.find(function(l) { return l.id === id; });
        if (lead) {
          openLeadModal(lead);
        }
      }

      function createQuoteFromLead(leadId) {
        var leads = window.RevOpsStore.getCollection('leads') || [];
        var lead = leads.find(function(l) { return l.id === leadId; });
        if (!lead) return;

        // Redirect to quotations.html pre-filling lead info
        sessionStorage.setItem('prefill_quote_lead', JSON.stringify(lead));
        window.location.href = 'quotations.html?action=new&leadId=' + encodeURIComponent(lead.id);
      }

      function handleSaveLead(e) {
        e.preventDefault();
        var docId = document.getElementById('lead-doc-id').value;
        var existingLead = docId ? (window.RevOpsStore.getCollection('leads') || []).find(function(l) { return l.id === docId; }) : null;

        var myEmpId = localStorage.getItem('employeeId') || 'E-001';
        var myEmpName = localStorage.getItem('userName') || 'System User';

        var sector = document.getElementById('inp-project-sector').value;
        if (sector === 'Other Industries') {
          sector = document.getElementById('inp-other-sector').value || 'Other Industries';
        }

        var nextLeadNum = existingLead ? existingLead.leadNumber : ('LD-2026-' + Math.floor(1000 + Math.random() * 9000));

        var validContacts = currentLeadContacts.filter(function(c) { return c.name.trim() !== ''; });
        var primaryContact = validContacts[0] || { name: 'Customer Contact', phone: '', email: '' };

        var validProducts = currentLeadProducts.filter(function(p) { return (p.name || '').trim() !== ''; });
        if (validProducts.length === 0) {
          alert("Please add at least one valid product for this lead.");
          return;
        }

        var primaryProd = validProducts[0];
        var productNamesSummary = validProducts.map(function(p) { return p.name; }).join(', ');
        var productSpecsSummary = validProducts.map(function(p) { return p.name + ': ' + (p.spec || ''); }).join(' | ');

        var newLead = {
          id: docId || ('lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          leadNumber: nextLeadNum,
          customerName: document.getElementById('inp-lead-customer').value.trim(),
          leadSource: document.getElementById('inp-lead-source').value,
          industry: document.getElementById('inp-lead-industry').value,
          projectSector: sector,
          vertical: document.getElementById('inp-lead-vertical').value,
          products: validProducts,
          productName: productNamesSummary,
          productSpec: productSpecsSummary,
          hsnCode: primaryProd.hsn || '90318000',
          currency: document.getElementById('inp-lead-currency').value,
          estimatedValue: Number(document.getElementById('inp-lead-value').value) || 0,
          expectedValue: Number(document.getElementById('inp-lead-value').value) || 0,
          targetDate: document.getElementById('inp-lead-target-date').value,
          stage: document.getElementById('inp-lead-stage').value,
          status: document.getElementById('inp-lead-stage').value,
          contacts: validContacts,
          contactPerson: primaryContact.name,
          contactPhone: primaryContact.phone,
          contactEmail: primaryContact.email,
          notes: document.getElementById('inp-lead-notes').value.trim(),
          employeeId: existingLead ? existingLead.employeeId : myEmpId,
          employeeName: existingLead ? existingLead.employeeName : myEmpName,
          createdDate: existingLead ? existingLead.createdDate : getFormattedToday(),
          createdAt: existingLead ? existingLead.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        window.RevOpsStore.saveRecord('leads', newLead);
        
        // Log to Universal Audit Trail
        if (window.RevOpsStore.logAudit) {
          window.RevOpsStore.logAudit(
            'Leads',
            newLead.leadNumber,
            existingLead ? 'UPDATE' : 'CREATE',
            (existingLead ? 'Updated lead ' : 'Created new lead ') + newLead.customerName + ' (' + newLead.vertical + ')',
            existingLead,
            newLead
          );
        }

        closeLeadModal();
        renderFunnelBar();
        renderLeadsTable();
      }
