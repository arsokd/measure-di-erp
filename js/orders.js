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

        // Arriving from Quotations ("🚀 Book Order" link) — open the Book
        // Order form pre-loaded with that quotation and its customer.
        var urlParams = new URLSearchParams(window.location.search);
        var bookFromQuote = urlParams.get('bookFromQuote');
        if (bookFromQuote) {
          openOrderModal(null, bookFromQuote);
          // Clean the URL so a page refresh doesn't reopen the modal.
          window.history.replaceState({}, '', 'orders.html');
        }
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

      // Populates the locked Valuation/Tax/Advance section (and the
      // read-only quoted items list) straight from the selected, approved
      // Quotation — nothing here is user-editable. If the customer's real
      // PO doesn't match, the fix is to correct the Quotation itself (or
      // get the PO corrected), never to type a different number here.
      function applyQuoteLockToOrderForm(q) {
        var noQuoteNotice = document.getElementById('no-quote-notice');
        var lockedFields = document.getElementById('quote-locked-fields');

        if (!q) {
          noQuoteNotice.classList.remove('hidden');
          lockedFields.classList.add('hidden');
          return;
        }

        noQuoteNotice.classList.add('hidden');
        lockedFields.classList.remove('hidden');

        var netVal = Math.round(q.netSubtotal || q.netTaxableAmount || 0);
        var taxAmt = Number(q.taxAmount) || 0;
        var gstPct = netVal > 0 ? Math.round((taxAmt / netVal) * 100) : 18;
        var total = netVal + taxAmt;
        var advPct = q.advancePercent !== undefined ? Number(q.advancePercent) : 50;
        var advAmt = Math.round(netVal * (advPct / 100));

        document.getElementById('inp-ord-value').value = '₹' + netVal.toLocaleString('en-IN');
        document.getElementById('inp-ord-gstpct').value = gstPct + '% GST';
        document.getElementById('disp-ord-total').value = '₹' + Math.round(total).toLocaleString('en-IN');
        document.getElementById('inp-ord-adv-pct').value = advPct + '%';
        document.getElementById('inp-ord-adv-amt').value = '₹' + advAmt.toLocaleString('en-IN');

        var itemsBox = document.getElementById('quote-items-readonly');
        var items = q.items || [];
        itemsBox.innerHTML = items.length === 0 ? `<div class="p-2.5 text-slate-500">No line items on this quotation.</div>` : items.map(function(it) {
          return `
            <div class="p-2.5 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="font-semibold text-white truncate">${escapeHtml(it.description || '')}</div>
                <div class="text-slate-500">HSN ${escapeHtml(it.hsnCode || '-')} • Qty ${it.qty || 1}</div>
              </div>
              <div class="font-bold text-emerald-400 whitespace-nowrap">₹${Number(it.unitPrice || 0).toLocaleString('en-IN')}</div>
            </div>
          `;
        }).join('');
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
        var excludeOrderId = document.getElementById('ord-doc-id').value || null;
        populateCustomerQuotes(customer, null, excludeOrderId);
      }

      // A quote is already "claimed" by a live order if some order (other
      // than the one currently being edited) points at it and hasn't been
      // rejected — that quote must not be selectable for a second order.
      function isQuoteAlreadyOrdered(q, excludeOrderId) {
        if (q.convertedOrderId && q.convertedOrderId !== excludeOrderId) return true;
        var orders = window.RevOpsStore.getCollection('orders') || [];
        return orders.some(function(o) {
          return o.quotationId === q.id && o.status !== 'Rejected' && o.id !== excludeOrderId;
        });
      }

      // Only a customer's APPROVED (and not-yet-booked-into-another-order)
      // quotations are offered here — never a free-text/manual entry, and
      // never a Pending/Rejected/Draft one. This is deliberately strict:
      // the Order pulls its valuation, tax and advance terms straight from
      // whichever quote is picked, so only a properly signed-off quote
      // should be eligible.
      function populateCustomerQuotes(customerName, selectedQuoteId, excludeOrderId) {
        var quoteSelect = document.getElementById('inp-ord-quote');
        quoteSelect.innerHTML = '<option value="">-- Select Approved Quotation for ' + (customerName || 'Customer') + ' --</option>';

        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var filteredQuotes = quotes.filter(function(q) {
          if (customerName && (q.customerName || '').trim().toLowerCase() !== customerName.trim().toLowerCase()) return false;
          if (q.id === selectedQuoteId) return true; // always keep the currently-linked quote visible/selectable
          if (q.status !== 'Approved' && q.status !== 'Sent to Customer') return false;
          if (isQuoteAlreadyOrdered(q, excludeOrderId)) return false;
          return true;
        });

        if (filteredQuotes.length === 0) {
          var opt = document.createElement('option');
          opt.value = "";
          opt.innerText = "(No approved, unbooked quotations for " + customerName + " — approve one on the Quotations page first)";
          quoteSelect.appendChild(opt);
          activeSelectedQuote = null;
          applyQuoteLockToOrderForm(null);
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

        if (selectedQuoteId) {
          handleQuoteSelectForOrder();
        } else if (filteredQuotes.length === 1) {
          // If only 1 eligible quote exists for this customer, auto-select it.
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
          applyQuoteLockToOrderForm(null);
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
          document.getElementById('ord-lead-id').value = q.leadId || '';

          // Populate linkage details
          var netVal = q.netSubtotal || q.netTaxableAmount || 0;
          infoBox.classList.remove('hidden');
          document.getElementById('disp-link-lead-no').innerText = q.leadId || 'Direct Quote';
          document.getElementById('disp-link-contact').innerText = q.contactPerson || q.customerEmail || q.customerName;
          document.getElementById('disp-link-quote-val').innerText = '₹' + Number(netVal).toLocaleString('en-IN');
          document.getElementById('disp-link-quote-status').innerText = q.status || 'Approved';

          applyQuoteLockToOrderForm(q);
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

      function openOrderModal(orderData, bookFromQuoteId) {
        currentSplits = [];
        activeSelectedQuote = null;
        var modal = document.getElementById('order-modal');
        var form = document.getElementById('order-form');
        form.reset();
        removePOImageAttachment();
        document.getElementById('linkage-info-box').classList.add('hidden');
        applyQuoteLockToOrderForm(null);

        if (orderData) {
          document.getElementById('order-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-purple-400"></i> <span>Edit Commercial Order (${orderData.poNumber || orderData.id})</span>`;
          document.getElementById('ord-doc-id').value = orderData.id;
          populateCustomerOptions(orderData.customerName);
          document.getElementById('inp-ord-customer').value = orderData.customerName || '';
          // Valuation/tax/advance and quoted items are (re-)locked from
          // the linked quotation by populateCustomerQuotes -> handleQuoteSelectForOrder.
          populateCustomerQuotes(orderData.customerName, orderData.quotationId, orderData.id);

          document.getElementById('inp-ord-ponum').value = orderData.poNumber || '';
          document.getElementById('inp-ord-podate').value = orderData.poDate || '';
          document.getElementById('inp-ord-vertical').value = orderData.vertical || 'Projects';
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

          var prefillQuote = null;
          if (bookFromQuoteId) {
            var quotes = window.RevOpsStore.getCollection('quotations') || [];
            prefillQuote = quotes.find(function(q) { return q.id === bookFromQuoteId; });
          }

          populateCustomerOptions(prefillQuote ? prefillQuote.customerName : null);
          if (prefillQuote) document.getElementById('inp-ord-customer').value = prefillQuote.customerName || '';
          populateCustomerQuotes(prefillQuote ? prefillQuote.customerName : null, bookFromQuoteId || null);

          var myEmpId = localStorage.getItem('employeeId') || 'E-002';
          currentSplits = [{ employeeId: myEmpId, percent: 100 }];
          toggleBgFields();
          toggleRetentionFields();
        }

        renderSplitRows();
        modal.classList.remove('hidden');
      }

      function closeOrderModal() {
        document.getElementById('order-modal').classList.add('hidden');
      }

      // An order that's already been invoiced is done — hide it from the
      // everyday list by default so already-processed POs don't pile up;
      // it's still reachable by searching or via "Show already-invoiced".
      function computeInvoicedOrderIds() {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        return new Set(invoices.map(function(inv) { return inv.orderId; }).filter(Boolean));
      }

      function renderOrdersTable() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var searchQuery = (document.getElementById('order-search-input').value || '').toLowerCase();
        var selectedFy = document.getElementById('order-fy-filter').value;
        var showInvoiced = document.getElementById('chk-show-invoiced-orders') ? document.getElementById('chk-show-invoiced-orders').checked : false;

        var selectedFilterEmp = "All";
        var filterElem = document.getElementById('order-emp-filter');
        if (filterElem && filterElem.value) selectedFilterEmp = filterElem.value;

        var orders = window.RevOpsStore.getCollection('orders') || [];
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var invoicedOrderIds = computeInvoicedOrderIds();

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
          if (!textMatch) return false;

          if (!searchQuery && !showInvoiced && invoicedOrderIds.has(o.id)) return false;

          return true;
        });

        var invoicedHiddenCount = orders.filter(function(o) { return invoicedOrderIds.has(o.id); }).length;
        var invoicedHint = document.getElementById('invoiced-orders-hint');
        if (invoicedHint) {
          invoicedHint.innerText = invoicedHiddenCount > 0 && !showInvoiced && !searchQuery
            ? (invoicedHiddenCount + ' already-invoiced order(s) hidden — search or check "Show already-invoiced" to see them.')
            : '';
        }

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
              ${o.status === 'Booked' ? `
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700/60">Booked</span>
                ${o.directorRatificationStatus === 'Ratified' ?
                  `<div class="text-[9px] text-purple-300 font-bold mt-0.5">👑 Ratified</div>` :
                  `<div class="text-[9px] text-amber-300 font-semibold mt-0.5">Pending Ratification</div>`}
              ` : o.status === 'Rejected' ? `
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-rose-950 text-rose-300 border border-rose-700/60">Rejected</span>
              ` : `
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-amber-950 text-amber-300 border border-amber-700/60 animate-pulse">Pending Approval</span>
              `}
            </td>
            <td class="py-3 px-4 text-center space-y-1">
              ${o.status === 'Pending Primary Approval' && hasApprovalAuthority('isPrimaryApprover') ? `
                <div class="flex items-center justify-center gap-1">
                  <button onclick="approveOrderDirect('${o.id}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold cursor-pointer">✅ Approve</button>
                  <button onclick="rejectOrderDirect('${o.id}')" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold cursor-pointer">❌ Reject</button>
                </div>
              ` : ''}
              ${o.status === 'Booked' && o.directorRatificationStatus === 'Pending' && localStorage.getItem('isDirector') === 'true' ? `
                <button onclick="ratifyOrderDirect('${o.id}')" class="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-md text-[10px] font-bold cursor-pointer">👑 Ratify</button>
              ` : ''}
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

        // Valuation, tax and advance terms are never typed in here — they
        // must come straight from the selected, approved Quotation. No
        // quote selected means no order: this is what makes mismatched
        // values impossible rather than just discouraged.
        if (!activeSelectedQuote) {
          alert("Cannot Save Order:\n\nSelect the customer's approved Quotation first — Order Value, GST and Advance terms are pulled from it automatically and cannot be typed in manually.");
          return;
        }

        var docId = document.getElementById('ord-doc-id').value;
        var existingOrder = docId ? (window.RevOpsStore.getCollection('orders') || []).find(function(o) { return o.id === docId; }) : null;

        var poNum = document.getElementById('inp-ord-ponum').value.trim();
        var poDate = document.getElementById('inp-ord-podate').value;
        var customerName = (document.getElementById('inp-ord-customer-select').value || document.getElementById('inp-ord-customer').value).trim();
        var vertical = document.getElementById('inp-ord-vertical').value;

        var val = Math.round(activeSelectedQuote.netSubtotal || activeSelectedQuote.netTaxableAmount || 0);
        var taxAmt = Number(activeSelectedQuote.taxAmount) || 0;
        var gstPct = val > 0 ? Math.round((taxAmt / val) * 100) : 18;
        var gstAmount = val * (gstPct / 100);
        var advPct = activeSelectedQuote.advancePercent !== undefined ? Number(activeSelectedQuote.advancePercent) : 50;
        var advAmt = Math.round(val * (advPct / 100));

        var bgReq = document.getElementById('inp-ord-bgreq').value;
        var retReq = document.getElementById('inp-ord-retreq').value;
        var quoteId = document.getElementById('inp-ord-quote').value;
        var leadId = document.getElementById('ord-lead-id').value;

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
          // Order confirmation (which reconciles the linked quotation/lead
          // and books it) requires the Primary Approver's sign-off — see
          // approveOrderDirect(). Saving here only records the raw PO entry.
          status: existingOrder && (existingOrder.status === 'Booked' || existingOrder.status === 'Rejected') ? existingOrder.status : 'Pending Primary Approval',
          createdDate: existingOrder ? existingOrder.createdDate : getFormattedToday(),
          createdAt: existingOrder ? existingOrder.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        window.RevOpsStore.saveRecord('orders', newOrder);

        // LOG AUDIT ENTRY FOR ORDER
        if (window.RevOpsStore.logAudit) {
          window.RevOpsStore.logAudit(
            'Orders',
            newOrder.poNumber,
            existingOrder ? 'UPDATE' : 'CREATE',
            (existingOrder ? 'Updated commercial order ' : 'Raised new commercial order (pending approval) ') + newOrder.customerName + ' (PO #' + poNum + ', ₹' + val.toLocaleString('en-IN') + ', 1st Advance: ₹' + advAmt.toLocaleString('en-IN') + ')',
            existingOrder,
            newOrder
          );
        }

        closeOrderModal();
        renderOrdersTable();

        if (newOrder.status === 'Pending Primary Approval') {
          alert("Order saved and submitted for approval. It will not be booked (and the linked quotation/lead will not update) until the Primary Approver signs off.");
        }
      }

      function approveOrderDirect(orderId) {
        if (!hasApprovalAuthority('isPrimaryApprover')) {
          alert("Only the designated Primary Approver can confirm orders. Ask your admin to assign this on the Employees page if this is incorrect.");
          return;
        }

        var orders = window.RevOpsStore.getCollection('orders') || [];
        var o = orders.find(function(it) { return it.id === orderId; });
        if (!o || o.status !== 'Pending Primary Approval') return;

        var remarks = prompt("Enter approval remarks / signoff notes:", "Approved for order confirmation.");
        if (remarks === null) return;

        var myName = localStorage.getItem('userName') || 'Primary Approver';
        var myEmpId = localStorage.getItem('employeeId') || '';
        var val = Number(o.orderValue) || Number(o.value) || 0;

        o.status = 'Booked';
        window.RevOpsStore.approvePrimaryStage(o, myName, myEmpId, remarks);

        // MARK LINKED QUOTATION AS BOOKED — its valuation/tax/advance were
        // already the single source of truth for this order (locked at
        // creation), so there's nothing to reconcile numerically here;
        // just close the loop so the quote can't be booked into a second
        // order and shows up as invoiced once this order is.
        if (o.quotationId) {
          var quotes = window.RevOpsStore.getCollection('quotations') || [];
          var q = quotes.find(function(it) { return it.id === o.quotationId; });
          if (q) {
            var oldQuoteState = JSON.parse(JSON.stringify(q));
            q.status = 'Order Booked / Won';
            q.poNumber = o.poNumber;
            q.poDate = o.poDate;
            q.convertedOrderId = o.id;
            q.updatedAt = new Date().toISOString();

            window.RevOpsStore.saveRecord('quotations', q);
            if (!o.leadId && q.leadId) o.leadId = q.leadId;

            if (window.RevOpsStore.logAudit) {
              window.RevOpsStore.logAudit(
                'Quotations',
                q.quoteNumber || q.id,
                'UPDATE',
                'Quotation booked into PO ' + o.poNumber + ' (Valuation: ₹' + val.toLocaleString('en-IN') + ')',
                oldQuoteState,
                q
              );
            }
          }
        }

        // RECONCILE & UPDATE LINKED CRM LEAD
        if (o.leadId) {
          var leads = window.RevOpsStore.getCollection('leads') || [];
          var l = leads.find(function(it) { return it.id === o.leadId; });
          if (l) {
            var oldLeadState = JSON.parse(JSON.stringify(l));
            l.stage = 'Order Confirmed';
            l.status = 'Order Confirmed';
            l.poNumber = o.poNumber;
            l.poDate = o.poDate;
            l.estimatedValue = val;
            l.updatedAt = new Date().toISOString();
            window.RevOpsStore.saveRecord('leads', l);

            if (window.RevOpsStore.logAudit) {
              window.RevOpsStore.logAudit(
                'Leads',
                l.id,
                'UPDATE',
                'Advanced CRM Lead to "Order Confirmed" and updated value to approved PO ' + o.poNumber + ' (₹' + val.toLocaleString('en-IN') + ')',
                oldLeadState,
                l
              );
            }
          }
        }

        window.RevOpsStore.saveRecord('orders', o);
        renderOrdersTable();
        alert("Order " + (o.poNumber || o.id) + " approved and booked! (Director ratification is still pending, but does not block anything.)");
      }

      function rejectOrderDirect(orderId) {
        if (!hasApprovalAuthority('isPrimaryApprover')) {
          alert("Only the designated Primary Approver can reject orders.");
          return;
        }
        var reason = prompt("Enter reason for rejecting this order:", "");
        if (reason === null) return;

        var orders = window.RevOpsStore.getCollection('orders') || [];
        var o = orders.find(function(it) { return it.id === orderId; });
        if (!o || o.status !== 'Pending Primary Approval') return;

        o.status = 'Rejected';
        o.rejectionReason = reason;
        window.RevOpsStore.saveRecord('orders', o);
        renderOrdersTable();
        alert("Order " + (o.poNumber || o.id) + " rejected.");
      }

      function ratifyOrderDirect(orderId) {
        if (localStorage.getItem('isDirector') !== 'true') {
          alert("Only the designated Director can ratify order approvals.");
          return;
        }
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var o = orders.find(function(it) { return it.id === orderId; });
        if (!o || o.status !== 'Booked' || o.directorRatificationStatus !== 'Pending') {
          alert("This order isn't awaiting director ratification.");
          return;
        }
        var remarks = prompt("Enter ratification remarks (optional):", "Ratified.");
        if (remarks === null) return;

        var myName = localStorage.getItem('userName') || 'Director';
        var myEmpId = localStorage.getItem('employeeId') || '';
        window.RevOpsStore.ratifyByDirector(o, myName, myEmpId, remarks);
        window.RevOpsStore.saveRecord('orders', o);
        renderOrdersTable();
        alert("Order " + (o.poNumber || o.id) + " ratified by Director.");
      }
