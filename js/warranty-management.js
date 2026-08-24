var activeWarranties = [];

      document.addEventListener('DOMContentLoaded', function() {
        renderWarrantyTable();

        if (window.RevOpsStore && typeof window.RevOpsStore.subscribeRealtimeSync === 'function') {
          window.RevOpsStore.subscribeRealtimeSync('clientEquipmentMaster', function() {
            renderWarrantyTable();
          });
        }
      });

      function getWarrantiesList() {
        var list = window.RevOpsStore ? (window.RevOpsStore.getCollection('clientEquipmentMaster') || []) : [];
        if (list.length === 0) {
          list = [
            {
              id: "warr_001",
              serialNumber: "CS-50T-2025-001",
              customerName: "JSW Steel Limited",
              location: "Toranagallu Slag Yard, Ballari, Karnataka",
              equipmentModel: "Wireless Crane Scale 50T (CS-50W)",
              vertical: "Crane",
              orderRef: "ORD-2025-012",
              commissioningDate: "2025-09-15",
              warrantyTier: "Standard 12-Month OEM",
              expiryDate: "2026-09-14",
              claims: [],
              statusOverride: null
            },
            {
              id: "warr_002",
              serialNumber: "IMW-500-2025-004",
              customerName: "Tata Steel Limited",
              location: "Kalinganagar Blast Furnace Bay 2, Odisha",
              equipmentModel: "Dynamic In-Motion Train Weigher (IMW-500)",
              vertical: "Projects",
              orderRef: "ORD-2025-018",
              commissioningDate: "2025-07-10",
              warrantyTier: "Extended 24-Month Premium",
              expiryDate: "2027-07-09",
              claims: [
                { rmaNumber: "RMA-2026-01", date: "2026-02-14", component: "Optical Axle Detector", rca: "Moisture Ingress / Corrosion", replacementSn: "OPT-2026-88" }
              ],
              statusOverride: null
            },
            {
              id: "warr_003",
              serialNumber: "OTW-30T-2025-088",
              customerName: "UltraTech Cement",
              location: "Awarpur Cement Works, Maharashtra",
              equipmentModel: "Onboard Tipper Scale (OTW-30T)",
              vertical: "Onboard",
              orderRef: "ORD-2025-029",
              commissioningDate: "2025-08-01",
              warrantyTier: "Standard 12-Month OEM",
              expiryDate: "2026-07-31",
              claims: [],
              statusOverride: null
            },
            {
              id: "warr_004",
              serialNumber: "LTW-350-2025-002",
              customerName: "Vedanta Aluminium",
              location: "Jharsuguda Smelter Plant, Odisha",
              equipmentModel: "Ladle Turret Weighing System (LTW-350)",
              vertical: "Projects",
              orderRef: "ORD-2025-034",
              commissioningDate: "2025-10-20",
              warrantyTier: "Standard 12-Month OEM",
              expiryDate: "2026-10-19",
              claims: [],
              statusOverride: null
            },
            {
              id: "warr_005",
              serialNumber: "WB-100T-2024-001",
              customerName: "Hindalco Industries",
              location: "Mahan Aluminium Project, MP",
              equipmentModel: "Electronic Static Pitless Weighbridge (WB-100T)",
              vertical: "Projects",
              orderRef: "ORD-2024-009",
              commissioningDate: "2024-06-01",
              warrantyTier: "Standard 12-Month OEM",
              expiryDate: "2025-05-31",
              claims: [],
              statusOverride: "Converted to AMC"
            }
          ];
          if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
            window.RevOpsStore.saveCollection('clientEquipmentMaster', list);
          }
        }
        return list;
      }

      function computeWarrantyStatus(w) {
        if (w.statusOverride === 'Converted to AMC') {
          return { status: "Converted to AMC", badgeClass: "bg-indigo-950 text-indigo-300 border-indigo-700/60", days: 0, label: "Converted to AMC Contract" };
        }

        var today = new Date();
        var exp = new Date(w.expiryDate);
        var diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          return { status: "Expired", badgeClass: "bg-rose-950 text-rose-300 border-rose-700/60", days: diffDays, label: "Expired (" + Math.abs(diffDays) + "d ago)" };
        } else if (diffDays <= 45) {
          return { status: "Expiring Soon", badgeClass: "bg-amber-950 text-amber-300 border-amber-700/60", days: diffDays, label: "Expires in " + diffDays + " days" };
        } else {
          return { status: "Active", badgeClass: "bg-emerald-950 text-emerald-300 border-emerald-700/60", days: diffDays, label: "Active (" + diffDays + "d left)" };
        }
      }

      function calculateWarrantyExpiryDate() {
        var commDateStr = document.getElementById('inp-warr-comm-date')?.value;
        var tier = document.getElementById('inp-warr-tier')?.value || 'Standard 12-Month OEM';
        var expInput = document.getElementById('inp-warr-expiry-date');
        if (!commDateStr || !expInput) return;

        var d = new Date(commDateStr);
        if (tier.includes('24-Month')) {
          d.setFullYear(d.getFullYear() + 2);
        } else if (tier.includes('6-Month')) {
          d.setMonth(d.getMonth() + 6);
        } else {
          d.setFullYear(d.getFullYear() + 1);
        }
        d.setDate(d.getDate() - 1);

        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        expInput.value = yyyy + '-' + mm + '-' + dd;
      }

      function renderWarrantyTable() {
        var items = getWarrantiesList();
        activeWarranties = items;

        var searchQuery = (document.getElementById('warranty-search-input')?.value || '').toLowerCase();
        var statusFilter = document.getElementById('warranty-status-filter')?.value || 'All';
        var typeFilter = document.getElementById('warranty-type-filter')?.value || 'All';

        var filtered = items.filter(function(w) {
          if (typeFilter !== 'All' && w.warrantyTier !== typeFilter) return false;
          var st = computeWarrantyStatus(w);
          if (statusFilter !== 'All' && st.status !== statusFilter) return false;

          var q = searchQuery;
          var textMatch = (w.serialNumber || '').toLowerCase().includes(q) ||
                          (w.customerName || '').toLowerCase().includes(q) ||
                          (w.equipmentModel || '').toLowerCase().includes(q) ||
                          (w.orderRef || '').toLowerCase().includes(q) ||
                          (w.location || '').toLowerCase().includes(q);
          return textMatch;
        });

        // Compute KPIs
        var activeCount = 0;
        var expiringCount = 0;
        var totalClaims = 0;
        var convertedCount = 0;
        var expiredCount = 0;

        items.forEach(function(w) {
          var st = computeWarrantyStatus(w);
          if (st.status === 'Active') activeCount++;
          if (st.status === 'Expiring Soon') expiringCount++;
          if (st.status === 'Converted to AMC') convertedCount++;
          if (st.status === 'Expired') expiredCount++;
          if (w.claims && Array.isArray(w.claims)) {
            totalClaims += w.claims.length;
          }
        });

        var conversionRate = (convertedCount + expiredCount > 0) ? ((convertedCount / (convertedCount + expiredCount)) * 100).toFixed(1) : '72.4';
        var claimsRate = items.length > 0 ? ((totalClaims / items.length) * 100).toFixed(1) : '2.1';

        document.getElementById('stat-active-warranties').textContent = activeCount;
        document.getElementById('stat-installed-base').textContent = 'Total Base: ' + items.length + ' Units';
        document.getElementById('stat-expiring-warranties').textContent = expiringCount;
        document.getElementById('stat-amc-conversion-rate').textContent = conversionRate + '%';
        document.getElementById('stat-claims-rate').textContent = claimsRate + '%';
        document.getElementById('stat-claims-count').textContent = totalClaims + ' RMA Claims Logged';
        document.getElementById('warranty-count-badge').textContent = filtered.length + ' units';

        var tbody = document.getElementById('warranty-tbody');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No equipment warranty records found matching filters.</td></tr>`;
          return;
        }

        filtered.forEach(function(w) {
          var st = computeWarrantyStatus(w);
          var claimsCount = (w.claims && Array.isArray(w.claims)) ? w.claims.length : 0;

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-black text-amber-400 font-mono">${escapeHtml(w.serialNumber)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(w.orderRef || 'PO Ref: N/A')}</div>
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-white text-xs">${escapeHtml(w.customerName)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(w.location || 'Client Facility')}</div>
            </td>
            <td class="py-3 px-4">
              <div class="font-semibold text-slate-200 text-xs">${escapeHtml(w.equipmentModel)}</div>
              <span class="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(w.vertical || 'Crane')}</span>
            </td>
            <td class="py-3 px-4">
              <div class="text-[11px] text-slate-300">Comm: <span class="font-semibold text-white">${escapeHtml(w.commissioningDate)}</span></div>
              <div class="text-[10px] text-amber-300 mt-0.5">Exp: <span class="font-bold">${escapeHtml(w.expiryDate)}</span></div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-800/60">${escapeHtml(w.warrantyTier || '12-Month OEM')}</span>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${st.badgeClass}">${escapeHtml(st.status)}</span>
              <div class="text-[10px] text-slate-400 mt-1 font-semibold">${escapeHtml(st.label)}</div>
            </td>
            <td class="py-3 px-4 text-center">
              ${claimsCount > 0 ? `<button onclick="openClaimModal('${w.id}')" class="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 font-bold text-[10px] hover:bg-rose-900 cursor-pointer">${claimsCount} Claim(s)</button>` : `<span class="text-slate-500 text-[10px]">0 Claims</span>`}
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center space-x-1.5">
                <button onclick="openClaimModal('${w.id}')" class="p-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-white rounded-lg transition-colors border border-rose-800/60 cursor-pointer" title="Log Warranty Claim / RMA">
                  <i class="fa-solid fa-clipboard-check text-xs"></i>
                </button>
                <a href="amc-quotes.html?prefillCustomer=${encodeURIComponent(w.customerName)}&prefillModel=${encodeURIComponent(w.equipmentModel)}&prefillSerial=${encodeURIComponent(w.serialNumber)}" class="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 hover:text-white rounded-lg transition-colors border border-emerald-800/60 cursor-pointer" title="Convert to AMC Quote">
                  <i class="fa-solid fa-arrows-spin text-xs"></i>
                </a>
                <button onclick="editWarranty('${w.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer" title="Edit Warranty Details">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function openNewWarrantyModal() {
        var form = document.getElementById('warranty-form');
        form.reset();
        document.getElementById('warranty-doc-id').value = '';
        document.getElementById('warranty-modal-title').textContent = "Register Equipment Warranty";
        
        var today = new Date().toISOString().slice(0, 10);
        document.getElementById('inp-warr-comm-date').value = today;
        calculateWarrantyExpiryDate();

        document.getElementById('warranty-modal').classList.remove('hidden');
      }

      function closeWarrantyModal() {
        document.getElementById('warranty-modal').classList.add('hidden');
      }

      function editWarranty(id) {
        var items = getWarrantiesList();
        var w = items.find(function(item) { return item.id === id; });
        if (!w) return;

        document.getElementById('warranty-doc-id').value = w.id;
        document.getElementById('warranty-modal-title').textContent = "Edit Equipment Warranty (" + w.serialNumber + ")";
        document.getElementById('inp-warr-customer').value = w.customerName || '';
        document.getElementById('inp-warr-order').value = w.orderRef || '';
        document.getElementById('inp-warr-model').value = w.equipmentModel || '';
        document.getElementById('inp-warr-serial').value = w.serialNumber || '';
        document.getElementById('inp-warr-comm-date').value = w.commissioningDate || '';
        document.getElementById('inp-warr-tier').value = w.warrantyTier || 'Standard 12-Month OEM';
        document.getElementById('inp-warr-expiry-date').value = w.expiryDate || '';
        document.getElementById('inp-warr-location').value = w.location || '';
        document.getElementById('inp-warr-vertical').value = w.vertical || 'Crane';

        document.getElementById('warranty-modal').classList.remove('hidden');
      }

      function handleSaveWarranty(e) {
        e.preventDefault();
        var docId = document.getElementById('warranty-doc-id').value;
        var items = getWarrantiesList();
        var existing = docId ? items.find(function(w) { return w.id === docId; }) : null;

        var newWarr = {
          id: docId || ('warr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          serialNumber: document.getElementById('inp-warr-serial').value.trim(),
          customerName: document.getElementById('inp-warr-customer').value.trim(),
          orderRef: document.getElementById('inp-warr-order').value.trim(),
          equipmentModel: document.getElementById('inp-warr-model').value.trim(),
          commissioningDate: document.getElementById('inp-warr-comm-date').value,
          warrantyTier: document.getElementById('inp-warr-tier').value,
          expiryDate: document.getElementById('inp-warr-expiry-date').value,
          location: document.getElementById('inp-warr-location').value.trim(),
          vertical: document.getElementById('inp-warr-vertical').value,
          claims: existing ? existing.claims : [],
          statusOverride: existing ? existing.statusOverride : null,
          updatedAt: new Date().toISOString()
        };

        if (existing) {
          var idx = items.findIndex(function(w) { return w.id === docId; });
          if (idx !== -1) items[idx] = newWarr;
        } else {
          items.unshift(newWarr);
        }

        if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
          window.RevOpsStore.saveCollection('clientEquipmentMaster', items);
          if (window.RevOpsStore.logAudit) {
            window.RevOpsStore.logAudit('Warranty Master', newWarr.serialNumber, existing ? 'UPDATE' : 'CREATE', (existing ? 'Updated warranty for ' : 'Registered new warranty for ') + newWarr.equipmentModel + ' (S/N: ' + newWarr.serialNumber + ') - ' + newWarr.customerName, existing, newWarr);
          }
        }

        closeWarrantyModal();
        renderWarrantyTable();
      }

      function openClaimModal(warrId) {
        var items = getWarrantiesList();
        var w = items.find(function(item) { return item.id === warrId; });
        if (!w) return;

        document.getElementById('claim-warr-id').value = warrId;
        document.getElementById('claim-rma-num').value = 'RMA-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
        document.getElementById('claim-modal-subtitle').textContent = w.customerName + ' • ' + w.equipmentModel + ' (' + w.serialNumber + ')';
        document.getElementById('claim-date').value = new Date().toISOString().slice(0, 10);
        document.getElementById('claim-component').value = '';
        document.getElementById('claim-replacement-sn').value = '';
        document.getElementById('claim-findings').value = '';

        document.getElementById('claim-modal').classList.remove('hidden');
      }

      function closeClaimModal() {
        document.getElementById('claim-modal').classList.add('hidden');
      }

      function handleSaveClaim(e) {
        e.preventDefault();
        var warrId = document.getElementById('claim-warr-id').value;
        var items = getWarrantiesList();
        var w = items.find(function(item) { return item.id === warrId; });
        if (!w) return;

        var claim = {
          rmaNumber: document.getElementById('claim-rma-num').value,
          date: document.getElementById('claim-date').value,
          component: document.getElementById('claim-component').value,
          rca: document.getElementById('claim-rca').value,
          replacementSn: document.getElementById('claim-replacement-sn').value,
          findings: document.getElementById('claim-findings').value,
          recordedAt: new Date().toISOString()
        };

        if (!w.claims) w.claims = [];
        w.claims.push(claim);

        if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
          window.RevOpsStore.saveCollection('clientEquipmentMaster', items);
          if (window.RevOpsStore.logAudit) {
            window.RevOpsStore.logAudit('Warranty Claims RMA', claim.rmaNumber, 'LOG_CLAIM', 'Logged warranty claim ' + claim.rmaNumber + ' for ' + w.equipmentModel + ' (S/N: ' + w.serialNumber + ') - ' + w.customerName, null, claim);
          }
        }

        closeClaimModal();
        renderWarrantyTable();
      }

      function exportWarrantyCSV() {
        var items = activeWarranties || [];
        if (items.length === 0) {
          alert("No warranty records to export.");
          return;
        }

        var headers = ["SerialNumber", "CustomerName", "Location", "EquipmentModel", "Vertical", "OrderRef", "CommissioningDate", "WarrantyTier", "ExpiryDate", "ClaimsCount", "Status"];
        var rows = items.map(function(w) {
          var st = computeWarrantyStatus(w);
          var claimsCount = (w.claims && Array.isArray(w.claims)) ? w.claims.length : 0;
          return [
            w.serialNumber,
            '"' + (w.customerName || '').replace(/"/g, '""') + '"',
            '"' + (w.location || '').replace(/"/g, '""') + '"',
            '"' + (w.equipmentModel || '').replace(/"/g, '""') + '"',
            w.vertical || 'Crane',
            w.orderRef || '',
            w.commissioningDate,
            w.warrantyTier,
            w.expiryDate,
            claimsCount,
            st.status
          ].join(',');
        });

        var csv = headers.join(',') + '\n' + rows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "MeasureDI_Equipment_Warranty_Master_" + new Date().toISOString().slice(0, 10) + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
