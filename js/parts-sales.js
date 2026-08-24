var activeSpareParts = [];

      document.addEventListener('DOMContentLoaded', function() {
        renderPartsTable();

        if (window.RevOpsStore && typeof window.RevOpsStore.subscribeRealtimeSync === 'function') {
          window.RevOpsStore.subscribeRealtimeSync('sparePartsMaster', function() {
            renderPartsTable();
          });
        }
      });

      function getSparePartsList() {
        var list = window.RevOpsStore ? (window.RevOpsStore.getCollection('sparePartsMaster') || []) : [];
        if (list.length === 0) {
          list = [
            {
              id: "sp_001",
              partNumber: "SP-LC-50T",
              partName: "50-Ton Shear Beam Class C3 Stainless Steel Load Cell",
              category: "Load Cells",
              compatibleModel: "Crane Scale CS-50W / CS-50HT",
              hsnCode: "90318000",
              costPrice: 24000,
              unitPrice: 45000,
              gstPercent: 18,
              stockQty: 18,
              minReorderLevel: 5,
              leadTimeDays: 7
            },
            {
              id: "sp_002",
              partNumber: "SP-IND-MDI9000",
              partName: "MDI-9000 High Precision Stainless Steel IP68 Weight Indicator",
              category: "Digital Indicators",
              compatibleModel: "Pitless Weighbridge WB-100T / Slag Yard ASW-2000",
              hsnCode: "84239020",
              costPrice: 38000,
              unitPrice: 72000,
              gstPercent: 18,
              stockQty: 12,
              minReorderLevel: 4,
              leadTimeDays: 10
            },
            {
              id: "sp_003",
              partNumber: "SP-JB-04IP",
              partName: "IP68 Stainless Steel 4-Channel Trimming Summing Junction Box",
              category: "Junction Boxes",
              compatibleModel: "Weighbridges & Heavy Platform Scales",
              hsnCode: "85369090",
              costPrice: 3200,
              unitPrice: 6500,
              gstPercent: 18,
              stockQty: 25,
              minReorderLevel: 8,
              leadTimeDays: 5
            },
            {
              id: "sp_004",
              partNumber: "SP-TEL-RF433",
              partName: "433MHz Industrial Wireless RF Telemetry Transmitter & Handheld Receiver",
              category: "Wireless & Telemetry",
              compatibleModel: "Wireless Crane Scale CS-50W",
              hsnCode: "85176290",
              costPrice: 16500,
              unitPrice: 32000,
              gstPercent: 18,
              stockQty: 8,
              minReorderLevel: 3,
              leadTimeDays: 14
            },
            {
              id: "sp_005",
              partNumber: "SP-ENC-1000",
              partName: "Optical High-Resolution Rotary Encoder 1000 PPR Heavy Duty",
              category: "Cables & Hardware",
              compatibleModel: "In-Motion Train Weigher IMW-500",
              hsnCode: "90319000",
              costPrice: 9500,
              unitPrice: 18500,
              gstPercent: 18,
              stockQty: 3,
              minReorderLevel: 5,
              leadTimeDays: 12
            },
            {
              id: "sp_006",
              partNumber: "SP-CBL-HT20M",
              partName: "20-Meter High-Temperature Armored Silicone Load Cell Cable Harness",
              category: "Cables & Hardware",
              compatibleModel: "Ladle Turret LTW-350 / Smelter Scales",
              hsnCode: "85444990",
              costPrice: 4200,
              unitPrice: 8500,
              gstPercent: 18,
              stockQty: 15,
              minReorderLevel: 6,
              leadTimeDays: 4
            }
          ];
          if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
            window.RevOpsStore.saveCollection('sparePartsMaster', list);
          }
        }
        return list;
      }

      function updateMarginPreview() {
        var cost = Number(document.getElementById('inp-part-cost')?.value) || 0;
        var price = Number(document.getElementById('inp-part-price')?.value) || 0;
        var preview = document.getElementById('preview-part-margin');
        if (!preview) return;

        if (price > 0 && cost > 0) {
          var profit = price - cost;
          var marginPct = (profit / price) * 100;
          preview.innerHTML = `<span>${marginPct.toFixed(1)}% Margin</span> <span class="text-[9px] text-slate-300 font-normal">Profit: ₹${profit.toLocaleString('en-IN')}</span>`;
        } else {
          preview.innerHTML = `<span>0.0%</span> <span class="text-[9px] text-slate-400">Profit: ₹0</span>`;
        }
      }

      function renderPartsTable() {
        var parts = getSparePartsList();
        activeSpareParts = parts;

        var searchQuery = (document.getElementById('part-search-input')?.value || '').toLowerCase();
        var catFilter = document.getElementById('part-cat-filter')?.value || 'All';
        var stockFilter = document.getElementById('part-stock-filter')?.value || 'All';

        var filtered = parts.filter(function(p) {
          if (catFilter !== 'All' && p.category !== catFilter) return false;
          var isLow = (p.stockQty || 0) <= (p.minReorderLevel || 0);
          if (stockFilter === 'Low Stock' && !isLow) return false;
          if (stockFilter === 'In Stock' && isLow) return false;

          var q = searchQuery;
          var textMatch = (p.partNumber || '').toLowerCase().includes(q) ||
                          (p.partName || '').toLowerCase().includes(q) ||
                          (p.compatibleModel || '').toLowerCase().includes(q) ||
                          (p.hsnCode || '').toLowerCase().includes(q);
          return textMatch;
        });

        // Compute KPIs
        var orders = window.RevOpsStore ? (window.RevOpsStore.getCollection('orders') || []) : [];
        var partsRevenue = 0;
        var partsOrderCount = 0;
        orders.forEach(function(o) {
          if (o.vertical === 'Service and Parts' || o.vertical === 'Service/Parts' || o.orderType === 'Spare Parts') {
            partsRevenue += (Number(o.amount) || Number(o.orderValue) || 0);
            partsOrderCount++;
          }
        });
        if (partsRevenue === 0) partsRevenue = 1450000; // Realistic RevOps seed benchmark

        var totalValuation = 0;
        var lowStockCount = 0;
        var totalMarginAcc = 0;

        parts.forEach(function(p) {
          var cost = p.costPrice || (p.unitPrice * 0.55);
          var price = p.unitPrice || 0;
          var qty = p.stockQty || 0;
          totalValuation += (qty * price);
          if (qty <= (p.minReorderLevel || 0)) lowStockCount++;
          if (price > 0) {
            totalMarginAcc += ((price - cost) / price);
          }
        });

        var avgMarginPct = parts.length > 0 ? (totalMarginAcc / parts.length) * 100 : 45;

        document.getElementById('stat-parts-revenue').textContent = '₹' + (partsRevenue >= 100000 ? (partsRevenue / 100000).toFixed(2) + ' L' : partsRevenue.toLocaleString('en-IN'));
        document.getElementById('stat-parts-orders-count').textContent = partsOrderCount + ' Dispatched Orders';
        document.getElementById('stat-avg-margin').textContent = avgMarginPct.toFixed(1) + '%';
        document.getElementById('stat-stock-valuation').textContent = '₹' + (totalValuation / 100000).toFixed(2) + ' L';
        document.getElementById('stat-total-skus').textContent = parts.length + ' Active Catalog SKUs';
        document.getElementById('stat-low-stock-count').textContent = lowStockCount;
        document.getElementById('part-count-badge').textContent = filtered.length + ' parts';

        var tbody = document.getElementById('parts-tbody');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-500">No spare parts found matching the criteria.</td></tr>`;
          return;
        }

        filtered.forEach(function(p) {
          var cost = p.costPrice || Math.round(p.unitPrice * 0.55);
          var price = p.unitPrice || 0;
          var margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0.0';
          var isLow = (p.stockQty || 0) <= (p.minReorderLevel || 0);

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-black text-emerald-400 font-mono">${escapeHtml(p.partNumber)}</div>
              <span class="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(p.category)}</span>
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-white text-xs">${escapeHtml(p.partName)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Lead Time: <span class="text-slate-300 font-semibold">${p.leadTimeDays || 7} Days</span></div>
            </td>
            <td class="py-3 px-4">
              <div class="text-slate-300 font-medium text-xs">${escapeHtml(p.compatibleModel || 'Universal Metrology')}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <div class="font-mono text-slate-300 font-bold">${escapeHtml(p.hsnCode || '90318000')}</div>
              <div class="text-[10px] text-slate-400">${p.gstPercent || 18}% GST</div>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="text-slate-400 font-mono">₹${cost.toLocaleString('en-IN')}</div>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="font-black text-white">₹${price.toLocaleString('en-IN')}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${Number(margin) >= 40 ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-amber-950 text-amber-300 border border-amber-700/60'}">${margin}%</span>
            </td>
            <td class="py-3 px-4 text-center">
              <div class="font-bold ${isLow ? 'text-rose-400 font-black' : 'text-slate-200'}">${p.stockQty || 0} Nos</div>
              <div class="text-[10px] text-slate-400">Min: ${p.minReorderLevel || 4} ${isLow ? '<span class="text-rose-400 font-bold">⚠️ Reorder</span>' : ''}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center space-x-1.5">
                <button onclick="editPart('${p.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer" title="Edit Spare Part">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <a href="quotations.html?quoteType=Parts&prefillPart=${encodeURIComponent(p.partNumber)}&partPrice=${p.unitPrice}" class="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 hover:text-white rounded-lg transition-colors border border-emerald-800/60 cursor-pointer" title="Generate Parts Quotation">
                  <i class="fa-solid fa-file-invoice text-xs"></i>
                </a>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function openNewPartModal() {
        var form = document.getElementById('part-form');
        form.reset();
        document.getElementById('part-doc-id').value = '';
        document.getElementById('part-modal-title').textContent = "Add Spare Part Catalog Item";
        updateMarginPreview();
        document.getElementById('part-modal').classList.remove('hidden');
      }

      function closePartModal() {
        document.getElementById('part-modal').classList.add('hidden');
      }

      function editPart(id) {
        var parts = getSparePartsList();
        var p = parts.find(function(item) { return item.id === id; });
        if (!p) return;

        document.getElementById('part-doc-id').value = p.id;
        document.getElementById('part-modal-title').textContent = "Edit Spare Part (" + p.partNumber + ")";
        document.getElementById('inp-part-number').value = p.partNumber || '';
        document.getElementById('inp-part-name').value = p.partName || '';
        document.getElementById('inp-part-category').value = p.category || 'Load Cells';
        document.getElementById('inp-part-compat').value = p.compatibleModel || '';
        document.getElementById('inp-part-cost').value = p.costPrice || '';
        document.getElementById('inp-part-price').value = p.unitPrice || '';
        document.getElementById('inp-part-hsn').value = p.hsnCode || '90318000';
        document.getElementById('inp-part-gst').value = p.gstPercent || 18;
        document.getElementById('inp-part-stock').value = p.stockQty || 0;
        document.getElementById('inp-part-min').value = p.minReorderLevel || 4;

        updateMarginPreview();
        document.getElementById('part-modal').classList.remove('hidden');
      }

      function handleSavePart(e) {
        e.preventDefault();
        var docId = document.getElementById('part-doc-id').value;
        var parts = getSparePartsList();
        var existing = docId ? parts.find(function(p) { return p.id === docId; }) : null;

        var newPart = {
          id: docId || ('sp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          partNumber: document.getElementById('inp-part-number').value.trim().toUpperCase(),
          partName: document.getElementById('inp-part-name').value.trim(),
          category: document.getElementById('inp-part-category').value,
          compatibleModel: document.getElementById('inp-part-compat').value.trim(),
          costPrice: Number(document.getElementById('inp-part-cost').value) || 0,
          unitPrice: Number(document.getElementById('inp-part-price').value) || 0,
          hsnCode: document.getElementById('inp-part-hsn').value.trim(),
          gstPercent: Number(document.getElementById('inp-part-gst').value) || 18,
          stockQty: Number(document.getElementById('inp-part-stock').value) || 0,
          minReorderLevel: Number(document.getElementById('inp-part-min').value) || 0,
          leadTimeDays: existing ? (existing.leadTimeDays || 7) : 7,
          updatedAt: new Date().toISOString()
        };

        if (existing) {
          var idx = parts.findIndex(function(p) { return p.id === docId; });
          if (idx !== -1) parts[idx] = newPart;
        } else {
          parts.unshift(newPart);
        }

        if (window.RevOpsStore && window.RevOpsStore.saveCollection) {
          window.RevOpsStore.saveCollection('sparePartsMaster', parts);
          if (window.RevOpsStore.logAudit) {
            window.RevOpsStore.logAudit('Spare Parts', newPart.partNumber, existing ? 'UPDATE' : 'CREATE', (existing ? 'Updated part ' : 'Added new catalog item ') + newPart.partNumber + ' - ' + newPart.partName, existing, newPart);
          }
        }

        closePartModal();
        renderPartsTable();
      }

      function exportPartsCSV() {
        var parts = activeSpareParts || [];
        if (parts.length === 0) {
          alert("No spare parts to export.");
          return;
        }

        var headers = ["PartNumber", "PartName", "Category", "CompatibleModel", "HSN", "CostPrice", "SellingPrice", "GrossMarginPct", "GST_Percent", "StockQty", "MinReorderLevel", "LeadTimeDays"];
        var rows = parts.map(function(p) {
          var cost = p.costPrice || Math.round(p.unitPrice * 0.55);
          var price = p.unitPrice || 0;
          var margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0.0';
          return [
            p.partNumber,
            '"' + (p.partName || '').replace(/"/g, '""') + '"',
            p.category,
            '"' + (p.compatibleModel || '').replace(/"/g, '""') + '"',
            p.hsnCode,
            cost,
            price,
            margin + '%',
            p.gstPercent || 18,
            p.stockQty || 0,
            p.minReorderLevel || 0,
            p.leadTimeDays || 7
          ].join(',');
        });

        var csv = headers.join(',') + '\n' + rows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "MeasureDI_Spare_Parts_Revenue_Model_" + new Date().toISOString().slice(0, 10) + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
