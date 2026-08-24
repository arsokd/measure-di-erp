var currentSplits = [];
      var activeSelectedQuote = null;

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initOrdersPage();
        }
      });

      function initOrdersPage() {
        var userRole = localStorage.getItem('userRole');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var wrapper = document.getElementById('order-filter-wrapper');
          var select = document.getElementById('order-emp-filter');
          if (wrapper && select) {
            wrapper.classList.remove('hidden');
            select.innerHTML = `<option value="All">All Order Contributors</option>`;
            employees.forEach(function(e) {
              var opt = document.createElement('option');
              opt.value = e.employeeId;
              opt.innerText = e.fullName + " (" + e.employeeId + ")";
              select.appendChild(opt);
            });
          }
        }

        renderOrdersTable();
      }

      function toggleBgFields() {
        var req = document.getElementById('inp-ord-bgreq').value;
        var amtBox = document.getElementById('bg-amount-box');
        var expBox = document.getElementById('bg-expiry-box');
        if (req === 'Yes') {
          amtBox.classList.remove('hidden');
          expBox.classList.remove('hidden');
        } else {
          amtBox.classList.add('hidden');
          expBox.classList.add('hidden');
        }
      }

      function toggleRetentionFields() {
        var req = document.getElementById('inp-ord-retreq').value;
        var amtBox = document.getElementById('ret-amount-box');
        var perBox = document.getElementById('ret-period-box');
        if (req === 'Yes') {
          amtBox.classList.remove('hidden');
          perBox.classList.remove('hidden');
        } else {
          amtBox.classList.add('hidden');
          perBox.classList.add('hidden');
        }
      }

      function recalculateOrderTotals() {
        var val = Number(document.getElementById('inp-ord-value').value) || 0;
        var gstPct = Number(document.getElementById('inp-ord-gstpct').value) || 0;
        var total = val + (val * (gstPct / 100));
        document.getElementById('disp-ord-total').value = '₹' + Math.round(total).toLocaleString('en-IN');

        // Auto calculate advance amount based on percentage
        var advPct = Number(document.getElementById('inp-ord-adv-pct').value) || 0;
        if (advPct > 0) {
          var advAmt = Math.round(val * (advPct / 100));
          document.getElementById('inp-ord-adv-amt').value = advAmt;
        }

        checkValuationDiscrepancy(val);
      }

      function onAdvancePctChanged() {
        var val = Number(document.getElementById('inp-ord-value').value) || 0;
        var pct = Number(document.getElementById('inp-ord-adv-pct').value) || 0;
        var amt = Math.round(val * (pct / 100));
        document.getElementById('inp-ord-adv-amt').value = amt;
      }

      function onAdvanceAmtChanged() {
        var val = Number(document.getElementById('inp-ord-value').value) || 0;
        var amt = Number(document.getElementById('inp-ord-adv-amt').value) || 0;
        if (val > 0) {
          var pct = (amt / val) * 100;
          document.getElementById('inp-ord-adv-pct').value = parseFloat(pct.toFixed(2));
        }
      }

      function checkValuationDiscrepancy(currentOrderVal) {
        var alertBox = document.getElementById('discrepancy-alert');
        var titleEl = document.getElementById('discrepancy-title');
        var descEl = document.getElementById('discrepancy-desc');

        if (!activeSelectedQuote) {
          alertBox.classList.add('hidden');
          return;
        }

        var quoteVal = Math.round(activeSelectedQuote.netTaxableAmount || activeSelectedQuote.grandTotal || 0);
        var orderVal = Math.round(currentOrderVal);

        if (orderVal > 0 && Math.abs(orderVal - quoteVal) > 10) {
          var diff = orderVal - quoteVal;
          var sign = diff > 0 ? '+' : '';
          titleEl.innerHTML = `⚠️ Quotation & PO Discrepancy Detected (Variance: ${sign}₹${Math.abs(diff).toLocaleString('en-IN')})`;
          descEl.innerHTML = `Approved Quotation Value is <strong>₹${quoteVal.toLocaleString('en-IN')}</strong> vs Final PO Value is <strong>₹${orderVal.toLocaleString('en-IN')}</strong>. Enabling the option below will auto-correct and align the Quotation and CRM Lead to match the final PO.`;
          alertBox.classList.remove('hidden');
        } else {
          alertBox.classList.add('hidden');
        }
      }

      function addSplitRow(existing) {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var defaultEmp = employees[0] ? employees[0].employeeId : 'E-002';
        
        var currentTotal = currentSplits.reduce(function(acc, s) { return acc + (parseFloat(s.percent) || 0); }, 0);
        var remaining = Math.max(0, Math.round((100 - currentTotal) * 100) / 100);

        var split = existing || {
          employeeId: defaultEmp,
          percent: remaining > 0 ? remaining : 0
        };

        currentSplits.push(split);
        renderSplitRows();
      }

      function autoBalanceSplits() {
        if (currentSplits.length === 0) {
          var myEmpId = localStorage.getItem('employeeId') || 'E-002';
          currentSplits = [{ employeeId: myEmpId, percent: 100 }];
          renderSplitRows();
          return;
        }

        if (currentSplits.length === 1) {
          currentSplits[0].percent = 100;
          renderSplitRows();
          return;
        }

        var count = currentSplits.length;
        var base = Math.floor(100 / count);
        var remainder = 100 - (base * count);

        for (var i = 0; i < count; i++) {
          currentSplits[i].percent = base + (i === 0 ? remainder : 0);
        }

        renderSplitRows();
      }

      function removeSplitRow(idx) {
        if (currentSplits.length <= 1) {
          alert("Order must have at least one sales contributor with 100% split.");
          return;
        }
        currentSplits.splice(idx, 1);
        renderSplitRows();
      }

      function renderSplitRows() {
        var container = document.getElementById('splits-container');
        container.innerHTML = '';
        var employees = window.RevOpsStore.getCollection('employees') || [];

        currentSplits.forEach(function(s, i) {
          var row = document.createElement('div');
          row.className = "bg-slate-900 p-2.5 rounded-xl border border-slate-750 grid grid-cols-12 gap-2 items-center text-xs";
          
          var empOptions = employees.map(function(e) {
            return `<option value="${e.employeeId}" ${e.employeeId === s.employeeId ? 'selected' : ''}>${escapeHtml(e.fullName)} (${e.employeeId})</option>`;
          }).join('');

          row.innerHTML = `
            <div class="col-span-7 sm:col-span-8">
              <select onchange="currentSplits[${i}].employeeId = this.value" class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold">
                ${empOptions}
              </select>
            </div>
            <div class="col-span-4 sm:col-span-3">
              <div class="flex items-center space-x-1">
                <input type="number" min="0" max="100" step="0.5" value="${s.percent}" oninput="currentSplits[${i}].percent = parseFloat(this.value) || 0; updateSplitTotal();" class="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-bold text-center" />
                <span class="text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div class="col-span-1 text-right">
              ${currentSplits.length > 1 ? `
                <button type="button" onclick="removeSplitRow(${i})" class="text-rose-400 hover:text-rose-300 font-bold p-1 cursor-pointer" title="Remove contributor">&times;</button>
              ` : ''}
            </div>
          `;
          container.appendChild(row);
        });

        updateSplitTotal();
      }

      function updateSplitTotal() {
        var total = 0;
        currentSplits.forEach(function(s) { total += parseFloat(s.percent) || 0; });
        total = Math.round(total * 100) / 100;

        var badge = document.getElementById('total-split-badge');
        var alertBox = document.getElementById('split-validation-alert');

        if (total === 100) {
          if (badge) {
            badge.innerText = '100% (Valid ✓)';
            badge.className = "px-2.5 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 font-black text-xs";
          }
          if (alertBox) {
            alertBox.className = "p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 text-emerald-300";
            alertBox.innerHTML = `
              <div class="flex items-center space-x-2">
                <i class="fa-solid fa-circle-check text-emerald-400"></i>
                <span>Contribution split equals exactly <strong>100.00%</strong>. Order can be saved.</span>
              </div>
            `;
          }
        } else if (total < 100) {
          var deficit = Math.round((100 - total) * 100) / 100;
          if (badge) {
            badge.innerText = total + '% (Deficit: -' + deficit + '%)';
            badge.className = "px-2.5 py-0.5 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-500/40 font-black text-xs animate-pulse";
          }
          if (alertBox) {
            alertBox.className = "p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between bg-amber-950/50 border border-amber-500/50 text-amber-300";
            alertBox.innerHTML = `
              <div class="flex items-center space-x-2">
                <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
                <span>Total is <strong>${total}%</strong> (Lesser than 100%). Remaining to allocate: <strong>${deficit}%</strong>.</span>
              </div>
              <button type="button" onclick="autoBalanceSplits()" class="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold cursor-pointer">Fix to 100%</button>
            `;
          }
        } else {
          var excess = Math.round((total - 100) * 100) / 100;
          if (badge) {
            badge.innerText = total + '% (Exceeds: +' + excess + '%)';
            badge.className = "px-2.5 py-0.5 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-500/40 font-black text-xs animate-pulse";
          }
          if (alertBox) {
            alertBox.className = "p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between bg-rose-950/50 border border-rose-500/50 text-rose-300";
            alertBox.innerHTML = `
              <div class="flex items-center space-x-2">
                <i class="fa-solid fa-circle-xmark text-rose-400"></i>
                <span>Total is <strong>${total}%</strong> (Higher than 100%). Exceeds by <strong>+${excess}%</strong>. Reduce by ${excess}%.</span>
              </div>
              <button type="button" onclick="autoBalanceSplits()" class="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer">Fix to 100%</button>
            `;
          }
        }
      }

      function populateCustomerOptions(selectedCustomer) {
        var custSelect = document.getElementById('inp-ord-customer-select');
        custSelect.innerHTML = '<option value="">-- Select Customer Account --</option>';

        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var leads = window.RevOpsStore.getCollection('leads') || [];

        var customerSet = {};
        quotes.forEach(function(q) { if (q.customerName) customerSet[q.customerName.trim()] = true; });
        leads.forEach(function(l) { if (l.customerName) customerSet[l.customerName.trim()] = true; });

        var sortedCustomers = Object.keys(customerSet).sort();
        sortedCustomers.forEach(function(cust) {
          var opt = document.createElement('option');
          opt.value = cust;
          opt.innerText = cust;
          if (selectedCustomer && selectedCustomer.trim().toLowerCase() === cust.toLowerCase()) {
            opt.selected = true;
          }
          custSelect.appendChild(opt);
        });
      }

      function onCustomerSelectedForOrder() {
        var customer = document.getElementById('inp-ord-customer-select').value;
        document.getElementById('inp-ord-customer').value = customer;
        populateCustomerQuotes(customer, null);
      }

      function populateCustomerQuotes(customerName, selectedQuoteId) {
        var quoteSelect = document.getElementById('inp-ord-quote');
        quoteSelect.innerHTML = '<option value="">-- Select Pending Quotation for ' + (customerName || 'Customer') + ' --</option>';

        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var filteredQuotes = quotes;

        if (customerName) {
          filteredQuotes = quotes.filter(function(q) {
            return (q.customerName || '').trim().toLowerCase() === customerName.trim().toLowerCase();
          });
        }

        if (filteredQuotes.length === 0) {
          var opt = document.createElement('option');
          opt.value = "";
          opt.innerText = "(No pending quotations for " + customerName + " - Create Quote first)";
          quoteSelect.appendChild(opt);
          return;
        }

        filteredQuotes.forEach(function(q) {
          var opt = document.createElement('option');
          opt.value = q.id;
          opt.innerText = (q.quoteNumber || q.id) + " - ₹" + Number(q.grandTotal || q.netTaxableAmount || 0).toLocaleString('en-IN') + " (" + (q.status || 'Approved') + ")";
          if (selectedQuoteId && selectedQuoteId === q.id) {
            opt.selected = true;
          }
          quoteSelect.appendChild(opt);
        });

        // If only 1 quote exists for this customer, auto-select it!
        if (filteredQuotes.length === 1 && !selectedQuoteId) {
          quoteSelect.value = filteredQuotes[0].id;
          handleQuoteSelectForOrder();
        }
      }

      function handleQuoteSelectForOrder() {
        var quoteId = document.getElementById('inp-ord-quote').value;
        var infoBox = document.getElementById('linkage-info-box');
        
        if (!quoteId) {
          activeSelectedQuote = null;
          infoBox.classList.add('hidden');
          document.getElementById('discrepancy-alert').classList.add('hidden');
          return;
        }

        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var q = quotes.find(function(item) { return item.id === quoteId; });
        activeSelectedQuote = q;

        if (q) {
          document.getElementById('inp-ord-customer').value = q.customerName || '';
          if (q.customerName) {
            document.getElementById('inp-ord-customer-select').value = q.customerName.trim();
          }
          if (q.vertical) document.getElementById('inp-ord-vertical').value = q.vertical;
          var netVal = q.netTaxableAmount || q.grandTotal || 0;
          document.getElementById('inp-ord-value').value = Math.round(netVal);
          document.getElementById('ord-lead-id').value = q.leadId || '';

          // Populate linkage details
          infoBox.classList.remove('hidden');
          document.getElementById('disp-link-lead-no').innerText = q.leadId || 'Direct Quote';
          document.getElementById('disp-link-contact').innerText = q.contactPerson || q.customerEmail || q.customerName;
          document.getElementById('disp-link-quote-val').innerText = '₹' + Number(netVal).toLocaleString('en-IN');
          document.getElementById('disp-link-quote-status').innerText = q.status || 'Approved';

          recalculateOrderTotals();
        }
      }

      function handlePOFileSelected(event) {
        var file = event.target.files[0];
        if (!file) return;

        document.getElementById('ord-po-file-name').value = file.name;
        var previewContainer = document.getElementById('po-image-preview-container');
        var thumbnail = document.getElementById('po-image-thumbnail');
        var label = document.getElementById('po-image-file-label');

        label.innerText = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

        if (file.type.startsWith('image/')) {
          var reader = new FileReader();
          reader.onload = function(e) {
            document.getElementById('ord-po-file-data').value = e.target.result;
            thumbnail.src = e.target.result;
            thumbnail.classList.remove('hidden');
            previewContainer.classList.remove('hidden');
          };
          reader.readAsDataURL(file);
        } else {
          document.getElementById('ord-po-file-data').value = 'doc:' + file.name;
          thumbnail.src = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';
          previewContainer.classList.remove('hidden');
        }
      }

      function removePOImageAttachment() {
        document.getElementById('inp-ord-pofile').value = '';
        document.getElementById('ord-po-file-data').value = '';
        document.getElementById('ord-po-file-name').value = '';
        document.getElementById('po-image-preview-container').classList.add('hidden');
      }

      function viewPOImageFromPreview() {
        var data = document.getElementById('ord-po-file-data').value;
        var fileName = document.getElementById('ord-po-file-name').value || 'PO Copy';
        showPOViewer(data, fileName);
      }

      function showPOViewer(fileData, fileName) {
        var modal = document.getElementById('po-viewer-modal');
        var img = document.getElementById('po-viewer-image');
        var fallback = document.getElementById('po-viewer-doc-fallback');
        var title = document.getElementById('po-viewer-title');

        title.innerText = 'PO Copy: ' + (fileName || 'Document');

        if (fileData && fileData.startsWith('data:image')) {
          img.src = fileData;
          img.classList.remove('hidden');
          fallback.classList.add('hidden');
        } else {
          img.classList.add('hidden');
          fallback.classList.remove('hidden');
          document.getElementById('po-viewer-doc-name').innerText = fileName || 'PO_Attachment.pdf';
        }

        modal.classList.remove('hidden');
      }

      function closePOViewerModal() {
        document.getElementById('po-viewer-modal').classList.add('hidden');
      }

      function openOrderModal(orderData) {
        currentSplits = [];
        activeSelectedQuote = null;
        var modal = document.getElementById('order-modal');
        var form = document.getElementById('order-form');
        form.reset();
        removePOImageAttachment();
        document.getElementById('discrepancy-alert').classList.add('hidden');
        document.getElementById('linkage-info-box').classList.add('hidden');

        if (orderData) {
          document.getElementById('order-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-purple-400"></i> <span>Edit Commercial Order (${orderData.poNumber || orderData.id})</span>`;
          document.getElementById('ord-doc-id').value = orderData.id;
          populateCustomerOptions(orderData.customerName);
          document.getElementById('inp-ord-customer').value = orderData.customerName || '';
          populateCustomerQuotes(orderData.customerName, orderData.quotationId);

          document.getElementById('inp-ord-ponum').value = orderData.poNumber || '';
          document.getElementById('inp-ord-podate').value = orderData.poDate || '';
          document.getElementById('inp-ord-vertical').value = orderData.vertical || 'Projects';
          document.getElementById('inp-ord-value').value = orderData.orderValue || orderData.value || 0;
          document.getElementById('inp-ord-gstpct').value = orderData.gstPercent || 18;
          document.getElementById('inp-ord-adv-pct').value = orderData.advancePercent || 50;
          document.getElementById('inp-ord-adv-amt').value = orderData.expectedAdvanceAmount || Math.round((orderData.orderValue || 0) * 0.5);
          document.getElementById('ord-lead-id').value = orderData.leadId || '';

          if (orderData.poFileData) {
            document.getElementById('ord-po-file-data').value = orderData.poFileData;
            document.getElementById('ord-po-file-name').value = orderData.poFileName || 'PO_Scan.jpg';
            document.getElementById('po-image-file-label').innerText = orderData.poFileName || 'PO_Scan.jpg';
            document.getElementById('po-image-preview-container').classList.remove('hidden');
            if (orderData.poFileData.startsWith('data:image')) {
              document.getElementById('po-image-thumbnail').src = orderData.poFileData;
            }
          }

          recalculateOrderTotals();

          if (orderData.bgRequired === 'Yes') {
            document.getElementById('inp-ord-bgreq').value = 'Yes';
            document.getElementById('inp-ord-bgamt').value = orderData.bgAmount || '';
            document.getElementById('inp-ord-bgdate').value = orderData.bgExpiryDate || '';
          }
          toggleBgFields();

          if (orderData.retentionRequired === 'Yes') {
            document.getElementById('inp-ord-retreq').value = 'Yes';
            document.getElementById('inp-ord-retamt').value = orderData.retentionAmount || '';
            document.getElementById('inp-ord-retperiod').value = orderData.retentionPeriod || '12 Months from Commissioning';
          }
          toggleRetentionFields();

          if (orderData.splits && Array.isArray(orderData.splits)) {
            currentSplits = JSON.parse(JSON.stringify(orderData.splits));
          } else {
            currentSplits = [{ employeeId: orderData.employeeId || 'E-002', percent: 100 }];
          }
        } else {
          document.getElementById('order-modal-title').innerHTML = `<i class="fa-solid fa-file-contract text-purple-400"></i> <span>Book Commercial Order / PO</span>`;
          document.getElementById('ord-doc-id').value = '';
          document.getElementById('inp-ord-podate').value = new Date().toISOString().slice(0, 10);
          populateCustomerOptions(null);
          populateCustomerQuotes(null, null);

          var myEmpId = localStorage.getItem('employeeId') || 'E-002';
          currentSplits = [{ employeeId: myEmpId, percent: 100 }];
          document.getElementById('inp-ord-adv-pct').value = '50';
          toggleBgFields();
          toggleRetentionFields();
        }

        renderSplitRows();
        modal.classList.remove('hidden');
      }

      function closeOrderModal() {
        document.getElementById('order-modal').classList.add('hidden');
      }

      function renderOrdersTable() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var searchQuery = (document.getElementById('order-search-input').value || '').toLowerCase();
        var selectedFy = document.getElementById('order-fy-filter').value;

        var selectedFilterEmp = "All";
        var filterElem = document.getElementById('order-emp-filter');
        if (filterElem && filterElem.value) selectedFilterEmp = filterElem.value;

        var orders = window.RevOpsStore.getCollection('orders') || [];
        var employees = window.RevOpsStore.getCollection('employees') || [];

        var filtered = orders.filter(function(o) {
          if (selectedFy !== 'All') {
            var ordFy = typeof getFinancialYear === 'function' ? getFinancialYear(o.poDate || o.orderDate || o.createdAt) : '2026-27';
            if (ordFy !== selectedFy) return false;
          }

          if (userRole === 'staff') {
            var isContributor = o.employeeId === myEmpId || (o.splits && o.splits.some(function(s){ return s.employeeId === myEmpId; }));
            if (!isContributor) return false;
          }

          if (selectedFilterEmp !== 'All') {
            var matchesEmp = o.employeeId === selectedFilterEmp || (o.splits && o.splits.some(function(s){ return s.employeeId === selectedFilterEmp; }));
            if (!matchesEmp) return false;
          }

          var textMatch = (o.customerName || '').toLowerCase().includes(searchQuery) ||
                          (o.poNumber || '').toLowerCase().includes(searchQuery) ||
                          (o.vertical || '').toLowerCase().includes(searchQuery);
          return textMatch;
        });

        var totalWon = filtered.length;
        var totalVal = 0;
        var totalAdv = 0;
        filtered.forEach(function(o) {
          var v = Number(o.orderValue) || Number(o.value) || 0;
          totalVal += v;
          totalAdv += Number(o.expectedAdvanceAmount) || Math.round(v * 0.5);
        });
        var avgVal = totalWon > 0 ? (totalVal / totalWon) : 0;

        document.getElementById('stat-won-count').innerText = totalWon;
        document.getElementById('stat-total-value').innerText = formatINR(totalVal);
        document.getElementById('stat-advance-total').innerText = formatINR(totalAdv);
        document.getElementById('stat-avg-value').innerText = formatINR(avgVal);
        document.getElementById('order-count-badge').innerText = totalWon + ' orders';

        var tbody = document.getElementById('orders-tbody');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-500">No commercial orders found matching the filter.</td></tr>`;
          return;
        }

        filtered.forEach(function(o) {
          var val = Number(o.orderValue) || Number(o.value) || 0;
          var advVal = Number(o.expectedAdvanceAmount) || Math.round(val * 0.5);
          var advPct = o.advancePercent || 50;
          var splits = o.splits || [{ employeeId: o.employeeId || 'E-002', percent: 100 }];

          var splitsHtml = splits.map(function(s) {
            var empObj = employees.find(function(e) { return e.employeeId === s.employeeId; });
            var name = empObj ? empObj.fullName : s.employeeId;
            return `<div class="text-[10px]"><span class="font-bold text-white">${escapeHtml(name)}:</span> <span class="text-emerald-400 font-extrabold">${s.percent}%</span></div>`;
          }).join('');

          var poFileHtml = o.poFileData ? `
            <button onclick="showPOViewer('${escapeHtml(o.poFileData)}', '${escapeHtml(o.poFileName || 'PO Copy')}')" class="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer">
              <i class="fa-solid fa-camera text-indigo-400"></i>
              <span>View PO Copy</span>
            </button>
          ` : `<span class="text-slate-500 text-[10px]">No file</span>`;

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-black text-indigo-400 font-mono">${escapeHtml(o.poNumber || o.id)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(o.poDate || o.orderDate || getFormattedToday())}</div>
              ${o.quotationId ? `<div class="text-[9px] text-purple-400 font-semibold font-mono mt-0.5">Ref Quote: ${escapeHtml(o.quotationId)}</div>` : ''}
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-white">${escapeHtml(o.customerName)}</div>
              <span class="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60">${escapeHtml(o.vertical || 'Projects')}</span>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="font-black text-white">₹${Number(val).toLocaleString('en-IN')}</div>
              <div class="text-[10px] text-slate-400">+18% GST</div>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="font-black text-amber-300">₹${Number(advVal).toLocaleString('en-IN')}</div>
              <div class="text-[10px] text-slate-400">${advPct}% 1st Advance</div>
            </td>
            <td class="py-3 px-4 space-y-0.5">
              ${splitsHtml}
            </td>
            <td class="py-3 px-4">
              ${poFileHtml}
            </td>
            <td class="py-3 px-4">
              ${o.bgRequired === 'Yes' ? `
                <div class="text-[10px] font-bold text-amber-300">BG: ₹${Number(o.bgAmount || 0).toLocaleString('en-IN')}</div>
                <div class="text-[9px] text-slate-400">Exp: ${escapeHtml(o.bgExpiryDate || 'N/A')}</div>
              ` : ''}
              ${o.retentionRequired === 'Yes' ? `
                <div class="text-[10px] font-bold text-purple-300">Ret: ₹${Number(o.retentionAmount || 0).toLocaleString('en-IN')}</div>
                <div class="text-[9px] text-slate-400">${escapeHtml(o.retentionPeriod || 'Post-Warranty')}</div>
              ` : ''}
              ${o.bgRequired !== 'Yes' && o.retentionRequired !== 'Yes' ? `<span class="text-slate-500 text-[11px]">Standard Terms</span>` : ''}
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                Booked
              </span>
            </td>
            <td class="py-3 px-4 text-center">
              <button onclick="editOrder('${o.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer" title="Edit Order Details">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function editOrder(id) {
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var o = orders.find(function(item) { return item.id === id; });
        if (o) {
          openOrderModal(o);
        }
      }

      function handleSaveOrder(e) {
        e.preventDefault();

        // Validate splits total strictly equals 100%
        var totalSplit = 0;
        currentSplits.forEach(function(s) { totalSplit += parseFloat(s.percent) || 0; });
        totalSplit = Math.round(totalSplit * 100) / 100;

        if (totalSplit < 100) {
          var remaining = Math.round((100 - totalSplit) * 100) / 100;
          alert("Cannot Save Order:\n\nSales contribution total is " + totalSplit + "% (lesser than 100%).\n\nYou must allocate the remaining " + remaining + "% before this order can be saved.");
          var container = document.getElementById('splits-container');
          if (container) container.scrollIntoView({ behavior: 'smooth' });
          return;
        }

        if (totalSplit > 100) {
          var excess = Math.round((totalSplit - 100) * 100) / 100;
          alert("Cannot Save Order:\n\nSales contribution total is " + totalSplit + "% (higher than 100%).\n\nYou must reduce the split by " + excess + "% so it equals exactly 100% before saving.");
          var container = document.getElementById('splits-container');
          if (container) container.scrollIntoView({ behavior: 'smooth' });
          return;
        }

        var docId = document.getElementById('ord-doc-id').value;
        var existingOrder = docId ? (window.RevOpsStore.getCollection('orders') || []).find(function(o) { return o.id === docId; }) : null;

        var poNum = document.getElementById('inp-ord-ponum').value.trim();
        var poDate = document.getElementById('inp-ord-podate').value;
        var customerName = (document.getElementById('inp-ord-customer-select').value || document.getElementById('inp-ord-customer').value).trim();
        var vertical = document.getElementById('inp-ord-vertical').value;
        var val = Number(document.getElementById('inp-ord-value').value) || 0;
        var gstPct = Number(document.getElementById('inp-ord-gstpct').value) || 18;
        var gstAmount = val * (gstPct / 100);
        var advPct = Number(document.getElementById('inp-ord-adv-pct').value) || 50;
        var advAmt = Number(document.getElementById('inp-ord-adv-amt').value) || Math.round(val * (advPct / 100));

        var bgReq = document.getElementById('inp-ord-bgreq').value;
        var retReq = document.getElementById('inp-ord-retreq').value;
        var quoteId = document.getElementById('inp-ord-quote').value;
        var leadId = document.getElementById('ord-lead-id').value;
        var autoReconcile = document.getElementById('chk-auto-reconcile') ? document.getElementById('chk-auto-reconcile').checked : true;

        var poFileData = document.getElementById('ord-po-file-data').value || (existingOrder ? existingOrder.poFileData : '');
        var poFileName = document.getElementById('ord-po-file-name').value || (existingOrder ? existingOrder.poFileName : '');

        var newOrder = {
          id: docId || ('ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          quotationId: quoteId,
          leadId: leadId,
          poNumber: poNum,
          poDate: poDate,
          customerName: customerName,
          vertical: vertical,
          orderValue: val,
          value: val,
          gstPercent: gstPct,
          gstAmount: gstAmount,
          totalWithGst: val + gstAmount,
          advancePercent: advPct,
          expectedAdvanceAmount: advAmt,
          splits: currentSplits,
          employeeId: currentSplits[0].employeeId,
          employeeName: 'Sales Team',
          bgRequired: bgReq,
          bgAmount: bgReq === 'Yes' ? Number(document.getElementById('inp-ord-bgamt').value) : 0,
          bgExpiryDate: bgReq === 'Yes' ? document.getElementById('inp-ord-bgdate').value : '',
          retentionRequired: retReq,
          retentionAmount: retReq === 'Yes' ? Number(document.getElementById('inp-ord-retamt').value) : 0,
          retentionPeriod: retReq === 'Yes' ? document.getElementById('inp-ord-retperiod').value : '',
          factoryDocAttached: !document.getElementById('inp-no-fac-doc').checked,
          poFileData: poFileData,
          poFileName: poFileName,
          status: 'Booked',
          createdDate: existingOrder ? existingOrder.createdDate : getFormattedToday(),
          createdAt: existingOrder ? existingOrder.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        window.RevOpsStore.saveRecord('orders', newOrder);

        // 1. RECONCILE & UPDATE LINKED QUOTATION
        if (quoteId && autoReconcile) {
          var quotes = window.RevOpsStore.getCollection('quotations') || [];
          var q = quotes.find(function(it) { return it.id === quoteId; });
          if (q) {
            var oldQuoteState = JSON.parse(JSON.stringify(q));
            q.status = 'Order Booked / Won';
            q.poNumber = poNum;
            q.poDate = poDate;
            q.netTaxableAmount = val;
            q.grandTotal = Math.round(val + gstAmount);
            q.expectedAdvanceAmount = advAmt;
            q.updatedAt = new Date().toISOString();
            
            if (q.items && q.items.length === 1) {
              q.items[0].unitPrice = val;
            }

            window.RevOpsStore.saveRecord('quotations', q);

            if (!leadId && q.leadId) leadId = q.leadId;

            if (window.RevOpsStore.logAudit) {
              window.RevOpsStore.logAudit(
                'Quotations',
                q.quoteNumber || q.id,
                'UPDATE',
                'Auto-reconciled quotation details to match final PO ' + poNum + ' (Valuation: ₹' + val.toLocaleString('en-IN') + ', 1st Advance: ₹' + advAmt.toLocaleString('en-IN') + ')',
                oldQuoteState,
                q
              );
            }
          }
        }

        // 2. RECONCILE & UPDATE LINKED CRM LEAD
        if (leadId && autoReconcile) {
          var leads = window.RevOpsStore.getCollection('leads') || [];
          var l = leads.find(function(it) { return it.id === leadId; });
          if (l) {
            var oldLeadState = JSON.parse(JSON.stringify(l));
            l.stage = 'Order Confirmed';
            l.status = 'Order Confirmed';
            l.poNumber = poNum;
            l.poDate = poDate;
            l.estimatedValue = val;
            l.updatedAt = new Date().toISOString();
            window.RevOpsStore.saveRecord('leads', l);

            if (window.RevOpsStore.logAudit) {
              window.RevOpsStore.logAudit(
                'Leads',
                l.id,
                'UPDATE',
                'Advanced CRM Lead to "Order Confirmed" and updated value to final PO ' + poNum + ' (₹' + val.toLocaleString('en-IN') + ')',
                oldLeadState,
                l
              );
            }
          }
        }

        // 3. LOG AUDIT ENTRY FOR ORDER
        if (window.RevOpsStore.logAudit) {
          window.RevOpsStore.logAudit(
            'Orders',
            newOrder.poNumber,
            existingOrder ? 'UPDATE' : 'CREATE',
            (existingOrder ? 'Updated commercial order ' : 'Booked new commercial order ') + newOrder.customerName + ' (PO #' + poNum + ', ₹' + val.toLocaleString('en-IN') + ', 1st Advance: ₹' + advAmt.toLocaleString('en-IN') + ')',
            existingOrder,
            newOrder
          );
        }

        closeOrderModal();
        renderOrdersTable();
      }
