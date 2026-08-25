var currentTab = 'All';
      var pendingReviewInvoiceId = null;
      var currentInvoiceAttachments = [];

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initInvoicesPage();
        }
      });

      function initInvoicesPage() {
        var userRole = localStorage.getItem('userRole');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        // Role Governance: Finance/Accounts vs Sales Staff
        var raiseBtn = document.getElementById('btn-raise-invoice');
        var financeNotice = document.getElementById('finance-role-notice');
        if (userRole === 'staff') {
          // Sales staff can view invoices but creation is restricted to Finance/Admin
          if (financeNotice) financeNotice.classList.remove('hidden');
          if (raiseBtn) {
            raiseBtn.classList.add('opacity-50', 'cursor-not-allowed');
            raiseBtn.title = "Commercial Invoices can only be raised by Finance & Accounting Department";
            raiseBtn.onclick = function() {
              alert("🔒 Access Restricted: Commercial Invoices must be raised exclusively by Finance & Accounts department per company policy.");
            };
          }
        }

        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var wrapper = document.getElementById('invoice-emp-filter-wrapper');
          var select = document.getElementById('invoice-emp-filter');
          if (wrapper && select) {
            wrapper.classList.remove('hidden');
            select.innerHTML = `<option value="All">All Sales Representatives</option>`;
            employees.forEach(function(e) {
              var opt = document.createElement('option');
              opt.value = e.employeeId;
              opt.innerText = e.fullName + " (" + e.employeeId + ")";
              select.appendChild(opt);
            });
          }
        }

        populateBankDropdown();
        populateQuoteAndOrderSources();
        renderInvoicesTable();
      }

      function populateBankDropdown() {
        var bankSelect = document.getElementById('inp-inv-bank');
        if (!bankSelect) return;

        var banks = window.RevOpsStore.getCollection('bankDetailsMaster') || [];
        if (banks.length === 0) {
          // Default fallbacks
          banks = [
            { id: 'bank-1', bankName: 'HDFC Bank', accountNumber: '50200049283719', ifscCode: 'HDFC0000123', branchName: 'Guindy, Chennai', isDefault: true },
            { id: 'bank-2', bankName: 'State Bank of India', accountNumber: '39281726351', ifscCode: 'SBIN0001824', branchName: 'Industrial Estate, Chennai', isDefault: false },
            { id: 'bank-3', bankName: 'ICICI Bank', accountNumber: '001105029384', ifscCode: 'ICIC0000011', branchName: 'Nandanam, Chennai', isDefault: false }
          ];
        }

        bankSelect.innerHTML = "";
        banks.forEach(function(b) {
          var opt = document.createElement('option');
          opt.value = b.bankName + ' - Current A/c: ' + b.accountNumber + ' (IFSC: ' + b.ifscCode + ', ' + (b.branchName || '') + ')';
          opt.innerText = b.bankName + ' - ' + b.accountNumber + ' (' + (b.branchName || 'Primary') + ')';
          if (b.isDefault) opt.selected = true;
          bankSelect.appendChild(opt);
        });
      }

      function populateQuoteAndOrderSources() {
        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var invoices = window.RevOpsStore.getCollection('invoices') || [];

        // Track order IDs and quote numbers that already have an issued Tax invoice
        var invoicedOrderIds = {};
        var invoicedPoRefs = {};
        invoices.forEach(function(inv) {
          if (inv.status !== 'Cancelled') {
            if (inv.orderId) invoicedOrderIds[inv.orderId] = true;
            if (inv.poRef) invoicedPoRefs[inv.poRef] = true;
          }
        });

        // Filter orders: only show pending orders that are not yet invoiced
        var pendingOrders = orders.filter(function(ord) {
          if (ord.invoicedStatus === 'Invoiced') return false;
          if (invoicedOrderIds[ord.id] || invoicedOrderIds[ord.orderId]) return false;
          if (ord.poNumber && invoicedPoRefs[ord.poNumber]) return false;
          return true;
        });

        var orderSelect = document.getElementById('inp-inv-order-source');
        var countLabel = document.getElementById('pending-po-count-label');
        if (countLabel) {
          countLabel.innerText = pendingOrders.length + " pending un-invoiced PO(s) available";
        }

        if (orderSelect) {
          orderSelect.innerHTML = `<option value="">-- Select Pending Purchase Order (${pendingOrders.length} Pending) --</option>`;
          pendingOrders.forEach(function(ord) {
            var opt = document.createElement('option');
            opt.value = ord.id;
            var poNum = ord.poNumber || ord.orderId || 'PO-';
            var val = formatINR(ord.orderValue || 0);
            opt.innerText = `${poNum} - ${ord.customerName} (${val}) [Un-invoiced]`;
            orderSelect.appendChild(opt);
          });
        }

        var quoteSelect = document.getElementById('inp-inv-quote-source');
        if (quoteSelect) {
          quoteSelect.innerHTML = `<option value="">-- Custom Invoice (No Quote) --</option>`;
          quotes.forEach(function(q) {
            var opt = document.createElement('option');
            opt.value = q.id;
            opt.innerText = (q.quoteNumber || 'Q-') + ' - ' + q.customerName + ' (' + formatINR(q.grandTotal) + ')';
            quoteSelect.appendChild(opt);
          });
        }
      }

      function toggleInvoiceBgFields() {
        var req = document.getElementById('inp-inv-bgreq').value;
        var box = document.getElementById('inv-bg-fields');
        if (req === 'Yes') box.classList.remove('hidden');
        else box.classList.add('hidden');
      }

      function toggleInvoiceRetFields() {
        var req = document.getElementById('inp-inv-retreq').value;
        var box = document.getElementById('inv-ret-fields');
        if (req === 'Yes') box.classList.remove('hidden');
        else box.classList.add('hidden');
      }

      function handleInvoiceFileUpload(e) {
        var files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (currentInvoiceAttachments.length + files.length > 10) {
          alert("Maximum 10 supporting files allowed per commercial invoice.");
          return;
        }

        // Calculate aggregate size
        var existingBytes = currentInvoiceAttachments.reduce(function(acc, f) { return acc + (f.size || 0); }, 0);
        var newBytes = files.reduce(function(acc, f) { return acc + f.size; }, 0);
        var totalMB = (existingBytes + newBytes) / (1024 * 1024);

        if (totalMB > 100) {
          alert("Total attachments exceed 100 MB aggregate size limit (" + totalMB.toFixed(1) + " MB). Please select smaller files.");
          return;
        }

        files.forEach(function(file) {
          var reader = new FileReader();
          reader.onload = function(evt) {
            currentInvoiceAttachments.push({
              name: file.name,
              size: file.size,
              type: file.type,
              data: evt.target.result,
              uploadedAt: new Date().toISOString()
            });
            renderInvoiceAttachments();
          };
          reader.readAsDataURL(file);
        });

        // Reset input
        e.target.value = "";
      }

      function removeInvoiceAttachment(index) {
        currentInvoiceAttachments.splice(index, 1);
        renderInvoiceAttachments();
      }

      function renderInvoiceAttachments() {
        var container = document.getElementById('inv-attachments-container');
        var badge = document.getElementById('inv-attachments-count-badge');
        if (!container || !badge) return;

        var totalBytes = currentInvoiceAttachments.reduce(function(acc, f) { return acc + (f.size || 0); }, 0);
        var totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        badge.innerText = `${currentInvoiceAttachments.length} / 10 Files (${totalMB} MB)`;

        if (currentInvoiceAttachments.length === 0) {
          container.innerHTML = `<div class="col-span-2 text-center text-slate-400 text-xs py-2 italic">No companion files attached yet.</div>`;
          return;
        }

        container.innerHTML = currentInvoiceAttachments.map(function(att, idx) {
          var sizeKb = Math.round((att.size || 0) / 1024);
          var isPo = att.isClientPo ? '⭐ Client PO' : 'Doc';
          return `
            <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs">
              <div class="flex items-center space-x-2 truncate">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-black ${att.isClientPo ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}">${isPo}</span>
                <span class="font-semibold text-slate-800 truncate" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
                <span class="text-[10px] text-slate-400 font-mono">(${sizeKb} KB)</span>
              </div>
              <button type="button" onclick="removeInvoiceAttachment(${idx})" class="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5">&times;</button>
            </div>
          `;
        }).join('');
      }

      function filterByTab(tabName) {
        currentTab = tabName;
        document.querySelectorAll('#invoice-tabs .tab-btn').forEach(function(btn) {
          if (btn.getAttribute('data-tab') === tabName) {
            btn.className = 'tab-btn px-3.5 py-1.5 font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200';
          } else {
            btn.className = 'tab-btn px-3.5 py-1.5 font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200';
          }
        });
        renderInvoicesTable();
      }

      function renderInvoicesTable() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var searchQuery = (document.getElementById('invoice-search-input').value || '').toLowerCase();
        var selectedFy = document.getElementById('invoice-fy-filter').value;
        var selectedType = document.getElementById('invoice-type-filter').value;
        
        var selectedEmp = "All";
        var empElem = document.getElementById('invoice-emp-filter');
        if (empElem && empElem.value) selectedEmp = empElem.value;

        var invoices = window.RevOpsStore.getCollection('invoices') || [];

        // Tab Counts & Stats
        var countAll = 0, countProforma = 0, countPending = 0, countApproved = 0, countPartial = 0, countPaid = 0, countOverdue = 0;
        var totalInvoiced = 0, totalCollected = 0, totalOutstanding = 0, totalOverdueAmt = 0, overdueCount = 0;

        var today = new Date();
        today.setHours(0,0,0,0);

        invoices.forEach(function(inv) {
          // Automatic overdue detection
          if (inv.status !== 'Draft' && inv.status !== 'Pending Senior Approval' && inv.status !== 'Fully Paid' && inv.status !== 'Cancelled') {
            if (inv.dueDate) {
              var due = parseDateDDMMYYYY(inv.dueDate);
              if (due < today && (Number(inv.balanceDue) || 0) > 1) {
                inv.status = 'Overdue';
              }
            }
          }

          var grand = Number(inv.grandTotal) || 0;
          var paid = Number(inv.paidAmount) || 0;
          var tds = Number(inv.tdsDeducted) || 0;
          var bal = Math.max(0, grand - (paid + tds));
          inv.balanceDue = bal;

          totalInvoiced += grand;
          totalCollected += (paid + tds);
          totalOutstanding += bal;

          countAll++;
          if (inv.invoiceType === 'Proforma Invoice') countProforma++;
          if (inv.status === 'Pending Senior Approval') countPending++;
          if (inv.status === 'Approved' || inv.status === 'Issued') countApproved++;
          if (inv.status === 'Partially Paid') countPartial++;
          if (inv.status === 'Fully Paid') countPaid++;
          if (inv.status === 'Overdue') {
            countOverdue++;
            totalOverdueAmt += bal;
            overdueCount++;
          }
        });

        // Update counts and summary cards
        document.getElementById('stat-total-invoiced').innerText = formatINR(totalInvoiced);
        document.getElementById('stat-total-collected').innerText = formatINR(totalCollected);
        document.getElementById('stat-total-outstanding').innerText = formatINR(totalOutstanding);
        document.getElementById('stat-total-overdue').innerText = formatINR(totalOverdueAmt);
        document.getElementById('stat-overdue-count').innerText = overdueCount + " Invoices Passed Due Date";

        document.getElementById('count-tab-all').innerText = countAll;
        if (document.getElementById('count-tab-proforma')) document.getElementById('count-tab-proforma').innerText = countProforma;
        document.getElementById('count-tab-pending').innerText = countPending;
        document.getElementById('count-tab-approved').innerText = countApproved;
        document.getElementById('count-tab-partial').innerText = countPartial;
        document.getElementById('count-tab-paid').innerText = countPaid;
        document.getElementById('count-tab-overdue').innerText = countOverdue;

        // Senior Approval alert banner
        var alertBanner = document.getElementById('senior-approval-alert');
        if (countPending > 0 && localStorage.getItem('isPrimaryApprover') === 'true') {
          alertBanner.classList.remove('hidden');
          document.getElementById('pending-approval-count').innerText = countPending;
        } else {
          alertBanner.classList.add('hidden');
        }

        // Filter Rows
        var filtered = invoices.filter(function(inv) {
          if (selectedFy !== 'All') {
            var invFy = typeof getFinancialYear === 'function' ? getFinancialYear(inv.invoiceDate, inv.invoiceNumber) : '2026-27';
            if (invFy !== selectedFy) return false;
          }
          if (selectedType !== 'All' && inv.invoiceType !== selectedType) return false;
          if (userRole === 'staff' && inv.employeeId !== myEmpId) return false;
          if (selectedEmp !== 'All' && inv.employeeId !== selectedEmp) return false;

          if (currentTab === 'Proforma Invoice' && inv.invoiceType !== 'Proforma Invoice') return false;
          if (currentTab === 'Pending Senior Approval' && inv.status !== 'Pending Senior Approval') return false;
          if (currentTab === 'Approved' && (inv.status !== 'Approved' && inv.status !== 'Issued')) return false;
          if (currentTab === 'Partially Paid' && inv.status !== 'Partially Paid') return false;
          if (currentTab === 'Fully Paid' && inv.status !== 'Fully Paid') return false;
          if (currentTab === 'Overdue' && inv.status !== 'Overdue') return false;

          var textMatch = (inv.invoiceNumber || '').toLowerCase().includes(searchQuery) ||
                          (inv.customerName || '').toLowerCase().includes(searchQuery) ||
                          (inv.customerGstin || '').toLowerCase().includes(searchQuery) ||
                          (inv.poRef || '').toLowerCase().includes(searchQuery) ||
                          (inv.employeeName || '').toLowerCase().includes(searchQuery);
          return textMatch;
        });

        var tbody = document.getElementById('invoices-tbody');
        tbody.innerHTML = "";

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No invoices matching the selected criteria.</td></tr>`;
          return;
        }

        filtered.forEach(function(inv) {
          var statusPill = "bg-slate-100 text-slate-800";
          if (inv.status === 'Fully Paid') statusPill = "bg-emerald-100 text-emerald-800 font-black";
          else if (inv.status === 'Partially Paid') statusPill = "bg-sky-100 text-sky-800 font-bold";
          else if (inv.status === 'Pending Senior Approval') statusPill = "bg-amber-100 text-amber-800 font-black animate-pulse";
          else if (inv.status === 'Approved') statusPill = "bg-teal-100 text-teal-800 font-bold";
          else if (inv.status === 'Issued') statusPill = "bg-indigo-100 text-indigo-800 font-bold";
          else if (inv.status === 'Converted to Tax Invoice') statusPill = "bg-purple-100 text-purple-800 font-bold";
          else if (inv.status === 'Overdue') statusPill = "bg-rose-100 text-rose-800 font-black";

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          
          var approvalCell = `<span class="text-slate-400 text-[11px]">--</span>`;
          if (inv.status === 'Pending Senior Approval') {
            if (localStorage.getItem('isPrimaryApprover') === 'true') {
              approvalCell = `<button onclick="openSeniorReviewModal('${escapeHtml(inv.id)}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[10px] font-black shadow-xs cursor-pointer">Review & Sign</button>`;
            } else {
              approvalCell = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Awaiting Approver</span>`;
            }
          } else if (inv.approvalInfo && inv.approvalInfo.approvedBy) {
            approvalCell = `<div class="text-[10px] text-emerald-700 font-semibold">✓ ${escapeHtml(inv.approvalInfo.approvedBy)}</div>`;
            if (inv.directorRatificationStatus === 'Ratified') {
              approvalCell += `<div class="text-[9px] text-purple-700 font-bold">👑 Ratified by ${escapeHtml(inv.directorRatifiedBy || 'Director')}</div>`;
            } else if (inv.directorRatificationStatus === 'Pending' && localStorage.getItem('isDirector') === 'true') {
              approvalCell += `<button onclick="ratifyInvoiceDirect('${escapeHtml(inv.id)}')" class="mt-1 px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-[9px] font-bold cursor-pointer">👑 Ratify</button>`;
            } else if (inv.directorRatificationStatus === 'Pending') {
              approvalCell += `<div class="text-[9px] text-amber-600 font-semibold">Pending Ratification</div>`;
            }
          }

          var progressPercent = inv.grandTotal > 0 ? Math.min(100, Math.round(((inv.paidAmount || 0) + (inv.tdsDeducted || 0)) / inv.grandTotal * 100)) : 0;

          var proformaAction = '';
          if (inv.invoiceType === 'Proforma Invoice') {
            if (inv.status === 'Converted to Tax Invoice') {
              proformaAction = `<span class="p-1 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[10px] font-bold" title="Converted to ${inv.convertedTaxInvoiceNumber}">✓ ${escapeHtml(inv.convertedTaxInvoiceNumber || 'Tax Inv')}</span>`;
            } else {
              proformaAction = `<button onclick="convertProformaPrompt('${escapeHtml(inv.id)}')" class="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold cursor-pointer" title="Convert Proforma to Official Tax Invoice">🔄 Convert</button>`;
            }
          }

          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                <span>${escapeHtml(inv.invoiceNumber)}</span>
              </div>
              <span class="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${inv.invoiceType === 'Proforma Invoice' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}">
                ${escapeHtml(inv.invoiceType || 'Tax Invoice')}
              </span>
              ${inv.proformaReference ? `<div class="text-[10px] text-purple-700 font-medium">Ref: ${escapeHtml(inv.proformaReference)}</div>` : ''}
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${escapeHtml(inv.customerName)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(inv.vertical || 'Sales')} • ${escapeHtml(inv.employeeName || 'Measure DI Team')}</div>
            </td>
            <td class="py-3 px-4 text-right font-black text-slate-900">${formatINR(inv.grandTotal)}</td>
            <td class="py-3 px-4 text-right">
              <div class="font-bold text-emerald-600">${formatINR((inv.paidAmount || 0) + (inv.tdsDeducted || 0))}</div>
              <div class="text-[10px] text-slate-400 font-semibold">${progressPercent}% Settled</div>
            </td>
            <td class="py-3 px-4 text-right font-black ${inv.balanceDue > 0 ? 'text-amber-600' : 'text-slate-400'}">
              ${formatINR(inv.balanceDue)}
            </td>
            <td class="py-3 px-4 text-center font-mono text-slate-600 text-[11px]">
              ${escapeHtml(inv.dueDate || inv.invoiceDate || '--')}
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] uppercase ${statusPill}">${escapeHtml(inv.status)}</span>
            </td>
            <td class="py-3 px-4 text-center">
              ${approvalCell}
            </td>
            <td class="py-3 px-4 text-center space-x-1.5 whitespace-nowrap">
              ${proformaAction}
              <button onclick="viewPrintableInvoice('${escapeHtml(inv.id)}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer" title="View / Print Tax Invoice PDF">👁️ View</button>
              <button onclick="openSendInvoiceModal('${escapeHtml(inv.id)}')" class="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer" title="Email Invoice to Client">✉️ Send</button>
              ${inv.balanceDue > 0 ? `
                <button onclick="recordInvoicePaymentRedirect('${escapeHtml(inv.id)}')" class="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold cursor-pointer" title="Record Partial or Full Payment">💳 Pay</button>
                <button onclick="requestInvoiceAdjustmentRedirect('${escapeHtml(inv.id)}')" class="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold cursor-pointer" title="Request Goodwill Discount or Bad Debt Write-Off">⚖️ Adjust</button>
              ` : ''}
              <button onclick="editInvoice('${escapeHtml(inv.id)}')" class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline">Edit</button>
              <button onclick="deleteInvoice('${escapeHtml(inv.id)}')" class="text-rose-600 hover:text-rose-800 font-bold hover:underline">Delete</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function convertProformaPrompt(proformaId) {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var proforma = invoices.find(function(i) { return i.id === proformaId; });
        if (!proforma) return;

        var nextTaxNum = window.RevOpsStore.generateNextInvoiceNumber(false);
        var msg = "Are you sure you want to convert Proforma Invoice " + proforma.invoiceNumber + " into official GST Tax Invoice " + nextTaxNum + "?\n\nThis will clone itemization, apply senior approval gate and link the proforma reference.";
        
        if (confirm(msg)) {
          var res = window.RevOpsStore.convertProformaToTaxInvoice(proformaId, userRole, userName);
          if (res && res.success) {
            alert("✅ Successfully generated Tax Invoice: " + res.taxInvoice.invoiceNumber + "\nProforma Invoice " + proforma.invoiceNumber + " marked as Converted.");
            renderInvoicesTable();
          } else {
            alert("Failed to convert: " + (res.error || "Unknown error"));
          }
        }
      }

      function openInvoiceModal() {
        document.getElementById('inv-doc-id').value = "";
        document.getElementById('invoice-modal-title').innerText = "Raise Commercial Invoice";
        document.getElementById('inv-modal-badge').innerText = "GST Tax Invoice";

        document.getElementById('inp-inv-number').value = window.RevOpsStore.generateNextInvoiceNumber(false);
        document.getElementById('inp-inv-type').value = "Tax Invoice";
        document.getElementById('inp-inv-vertical').value = "Sales";
        document.getElementById('inp-inv-customer').value = "";
        document.getElementById('inp-inv-gstin').value = "";
        document.getElementById('inp-inv-email').value = "";
        document.getElementById('inp-inv-contact').value = "";
        document.getElementById('inp-inv-poref').value = "";
        document.getElementById('inp-inv-date').value = getFormattedToday();
        
        // Due date = today + 30 days
        var now = new Date();
        now.setDate(now.getDate() + 30);
        var dd = String(now.getDate()).padStart(2, '0');
        var mm = String(now.getMonth() + 1).padStart(2, '0');
        var yyyy = now.getFullYear();
        document.getElementById('inp-inv-duedate').value = dd + '/' + mm + '/' + yyyy;

        document.getElementById('inp-inv-milestone').value = "Standard Commercial Milestone";
        document.getElementById('inp-inv-interstate').checked = false;

        // Reset PG and Retention
        document.getElementById('inp-inv-bgreq').value = "No";
        document.getElementById('inp-inv-bgamt').value = "";
        document.getElementById('inp-inv-bgdate').value = "";
        toggleInvoiceBgFields();

        document.getElementById('inp-inv-retreq').value = "No";
        document.getElementById('inp-inv-retamt').value = "";
        document.getElementById('inp-inv-retperiod').value = "";
        toggleInvoiceRetFields();

        // Reset attachments
        currentInvoiceAttachments = [];
        renderInvoiceAttachments();

        // Initialize line items
        var tbody = document.getElementById('invoice-items-tbody');
        tbody.innerHTML = "";
        addInvoiceLineItem("Industrial Coordinate Measuring & Quality Scanning System", "90318000", 1, 1500000, 5, 18);

        calculateInvoiceTotals();
        document.getElementById('invoice-modal').classList.remove('hidden');
      }

      function closeInvoiceModal() {
        document.getElementById('invoice-modal').classList.add('hidden');
      }

      function addInvoiceLineItem(desc, hsn, qty, rate, disc, gst) {
        var tbody = document.getElementById('invoice-items-tbody');
        var row = document.createElement('tr');
        row.className = "hover:bg-white transition-colors";
        row.innerHTML = `
          <td class="p-1.5"><input type="text" value="${escapeHtml(desc || '')}" placeholder="Item description" required class="item-desc w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs" /></td>
          <td class="p-1.5"><input type="text" value="${escapeHtml(hsn || '90318000')}" placeholder="HSN" class="item-hsn w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono" /></td>
          <td class="p-1.5"><input type="number" value="${qty || 1}" min="1" oninput="calculateInvoiceTotals()" class="item-qty w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-right font-mono" /></td>
          <td class="p-1.5"><input type="number" value="${rate || 100000}" min="0" oninput="calculateInvoiceTotals()" class="item-rate w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-right font-mono" /></td>
          <td class="p-1.5"><input type="number" value="${disc || 0}" min="0" max="100" oninput="calculateInvoiceTotals()" class="item-disc w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-right font-mono" /></td>
          <td class="p-1.5">
            <select onchange="calculateInvoiceTotals()" class="item-gst w-full px-1 py-1 bg-white border border-slate-200 rounded text-xs font-mono">
              <option value="18" ${gst == 18 ? 'selected' : ''}>18%</option>
              <option value="12" ${gst == 12 ? 'selected' : ''}>12%</option>
              <option value="5" ${gst == 5 ? 'selected' : ''}>5%</option>
              <option value="0" ${gst == 0 ? 'selected' : ''}>0%</option>
            </select>
          </td>
          <td class="p-1.5 text-right font-mono font-bold text-slate-700 item-taxable">Rs.0</td>
          <td class="p-1.5 text-right font-mono font-black text-slate-900 item-total">Rs.0</td>
          <td class="p-1.5 text-center"><button type="button" onclick="this.closest('tr').remove(); calculateInvoiceTotals();" class="text-rose-500 hover:text-rose-700 font-bold">&times;</button></td>
        `;
        tbody.appendChild(row);
        calculateInvoiceTotals();
      }

      function calculateInvoiceTotals() {
        var rows = document.querySelectorAll('#invoice-items-tbody tr');
        var grossTaxable = 0;
        var totalTax = 0;
        var isInterstate = document.getElementById('inp-inv-interstate').checked;

        rows.forEach(function(row) {
          var qty = Number(row.querySelector('.item-qty').value) || 0;
          var rate = Number(row.querySelector('.item-rate').value) || 0;
          var disc = Number(row.querySelector('.item-disc').value) || 0;
          var gstRate = Number(row.querySelector('.item-gst').value) || 0;

          var base = qty * rate;
          var discAmt = base * (disc / 100);
          var taxable = base - discAmt;
          var tax = taxable * (gstRate / 100);
          var total = taxable + tax;

          row.querySelector('.item-taxable').innerText = formatINR(taxable);
          row.querySelector('.item-total').innerText = formatINR(total);

          grossTaxable += taxable;
          totalTax += tax;
        });

        var grandTotal = grossTaxable + totalTax;
        document.getElementById('calc-taxable-val').innerText = formatINR(grossTaxable);
        document.getElementById('calc-tax-val').innerText = formatINR(totalTax);
        document.getElementById('calc-grand-total').innerText = formatINR(grandTotal);

        var taxLabel = isInterstate ? 'IGST (' + (totalTax > 0 ? '18%' : '0%') + '):' : 'CGST (9%) + SGST (9%):';
        document.getElementById('label-tax-breakdown').innerText = taxLabel;
      }

      function updateInvoiceTypeUI() {
        var type = document.getElementById('inp-inv-type').value;
        var docId = document.getElementById('inv-doc-id').value;
        if (!docId) {
          document.getElementById('inp-inv-number').value = window.RevOpsStore.generateNextInvoiceNumber(type === 'Proforma Invoice');
        }
        document.getElementById('inv-modal-badge').innerText = type === 'Proforma Invoice' ? 'Proforma Invoice (PI)' : 'GST Tax Invoice';
      }

      function autoPopulateFromQuote(quoteId) {
        if (!quoteId) return;
        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var q = quotes.find(function(item) { return item.id === quoteId; });
        if (!q) return;

        document.getElementById('inp-inv-customer').value = q.customerName || '';
        document.getElementById('inp-inv-gstin').value = q.customerGstin || '';
        document.getElementById('inp-inv-email').value = q.customerEmail || '';
        document.getElementById('inp-inv-contact').value = (q.customerContactPerson || '') + (q.customerPhone ? ' / ' + q.customerPhone : '');
        document.getElementById('inp-inv-vertical').value = q.vertical || 'Sales';
        
        var tbody = document.getElementById('invoice-items-tbody');
        tbody.innerHTML = "";
        if (q.items && q.items.length > 0) {
          q.items.forEach(function(it) {
            addInvoiceLineItem(it.description, it.hsnCode || '90318000', it.quantity || 1, it.unitPrice || 0, it.lineDiscountPercent || 0, it.taxPercent || 18);
          });
        } else {
          addInvoiceLineItem("Quotation Reference: " + (q.quoteNumber || ''), "90318000", 1, q.grandTotal || 100000, 0, 18);
        }
        calculateInvoiceTotals();
      }

      function autoPopulateFromOrder(orderId) {
        if (!orderId) return;
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var leads = window.RevOpsStore.getCollection('leads') || [];

        var ord = orders.find(function(item) { return item.id === orderId; });
        if (!ord) return;

        // Auto fill basic customer & commercial data
        document.getElementById('inp-inv-customer').value = ord.customerName || '';
        document.getElementById('inp-inv-gstin').value = ord.customerGstin || '';
        document.getElementById('inp-inv-email').value = ord.customerEmail || (ord.contactEmail || '');
        document.getElementById('inp-inv-contact').value = (ord.contactPerson || '') + (ord.contactPhone ? ' / ' + ord.contactPhone : '');
        document.getElementById('inp-inv-vertical').value = ord.vertical || 'Sales';
        
        var poRefStr = (ord.poNumber || ord.orderId || '') + (ord.poDate ? ' dt. ' + ord.poDate : '');
        document.getElementById('inp-inv-poref').value = poRefStr;
        
        if (ord.advancePercent) {
          document.getElementById('inp-inv-milestone').value = ord.advancePercent + '% Advance on PO / Order Acceptance';
        }

        // Auto-fill PG / BG terms
        if (ord.bgRequired === 'Yes') {
          document.getElementById('inp-inv-bgreq').value = 'Yes';
          document.getElementById('inp-inv-bgamt').value = ord.bgAmount || '';
          document.getElementById('inp-inv-bgdate').value = ord.bgExpiryDate || '';
          toggleInvoiceBgFields();
        } else {
          document.getElementById('inp-inv-bgreq').value = 'No';
          toggleInvoiceBgFields();
        }

        // Auto-fill Retention terms
        if (ord.retentionRequired === 'Yes') {
          document.getElementById('inp-inv-retreq').value = 'Yes';
          document.getElementById('inp-inv-retamt').value = ord.retentionAmount || '';
          document.getElementById('inp-inv-retperiod').value = ord.retentionPeriod || '';
          toggleInvoiceRetFields();
        } else {
          document.getElementById('inp-inv-retreq').value = 'No';
          toggleInvoiceRetFields();
        }

        // Auto-attach Client PO Copy if present in Order
        currentInvoiceAttachments = [];
        if (ord.poFileData) {
          currentInvoiceAttachments.push({
            name: ord.poFileName || (ord.poNumber ? ord.poNumber + '_PO_Copy.jpg' : 'Client_Purchase_Order.jpg'),
            size: ord.poFileSize || 150000,
            type: 'image/jpeg',
            data: ord.poFileData,
            isClientPo: true,
            uploadedAt: new Date().toISOString()
          });
        }
        renderInvoiceAttachments();

        // 3-way Line Items Extraction: Pull line items from linked Quote or Lead
        var linkedQuote = null;
        if (ord.quotationId) {
          linkedQuote = quotes.find(function(q) { return q.id === ord.quotationId || q.quoteNumber === ord.quotationId; });
        }
        if (!linkedQuote && ord.quoteNumber) {
          linkedQuote = quotes.find(function(q) { return q.quoteNumber === ord.quoteNumber; });
        }


        var tbody = document.getElementById('invoice-items-tbody');
        tbody.innerHTML = "";

        if (linkedQuote && linkedQuote.items && linkedQuote.items.length > 0) {
          linkedQuote.items.forEach(function(it) {
            addInvoiceLineItem(
              it.description || it.productName || 'Equipment Item',
              it.hsnCode || '90318000',
              it.quantity || 1,
              it.unitPrice || 0,
              it.lineDiscountPercent || 0,
              it.taxPercent || 18
            );
          });
        } else if (ord.items && ord.items.length > 0) {
          ord.items.forEach(function(it) {
            addInvoiceLineItem(
              it.description || it.productName || 'Order Item',
              it.hsnCode || '90318000',
              it.quantity || 1,
              it.unitPrice || 0,
              it.lineDiscountPercent || 0,
              it.taxPercent || 18
            );
          });
        } else {
          var desc = "Fulfillment of Commercial Purchase Order: " + (ord.poNumber || ord.orderId) + " - " + ord.customerName;
          addInvoiceLineItem(desc, "90318000", 1, ord.orderValue || 100000, 0, 18);
        }

        calculateInvoiceTotals();
      }

      function handleSaveInvoice(e) {
        e.preventDefault();
        var docId = document.getElementById('inv-doc-id').value;
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var myName = localStorage.getItem('userName');

        // Extract line items
        var rows = document.querySelectorAll('#invoice-items-tbody tr');
        var items = [];
        var taxableTotal = 0;
        var taxTotal = 0;

        rows.forEach(function(row) {
          var desc = row.querySelector('.item-desc').value.trim();
          var hsn = row.querySelector('.item-hsn').value.trim();
          var qty = Number(row.querySelector('.item-qty').value) || 1;
          var rate = Number(row.querySelector('.item-rate').value) || 0;
          var disc = Number(row.querySelector('.item-disc').value) || 0;
          var gst = Number(row.querySelector('.item-gst').value) || 18;

          var base = qty * rate;
          var discAmt = base * (disc / 100);
          var taxVal = base - discAmt;
          var tax = taxVal * (gst / 100);

          items.push({
            description: desc,
            hsnCode: hsn,
            quantity: qty,
            unitPrice: rate,
            discountPercent: disc,
            taxPercent: gst,
            taxableAmount: taxVal,
            taxAmount: tax,
            totalAmount: taxVal + tax
          });

          taxableTotal += taxVal;
          taxTotal += tax;
        });

        var grandTotal = taxableTotal + taxTotal;
        var isInterstate = document.getElementById('inp-inv-interstate').checked;
        var selectedOrderId = document.getElementById('inp-inv-order-source').value;

        // Every invoice requires the Primary Approver's sign-off before it can
        // be dispatched to the client — there is no auto-approve shortcut for
        // any role, including admin/super_admin.
        var initialStatus = 'Pending Senior Approval';
        var approvalInfo = null;

        var invData = {
          invoiceNumber: document.getElementById('inp-inv-number').value.trim(),
          invoiceType: document.getElementById('inp-inv-type').value,
          vertical: document.getElementById('inp-inv-vertical').value,
          customerName: document.getElementById('inp-inv-customer').value.trim(),
          customerGstin: document.getElementById('inp-inv-gstin').value.trim(),
          customerEmail: document.getElementById('inp-inv-email').value.trim(),
          contactPerson: document.getElementById('inp-inv-contact').value.trim(),
          poRef: document.getElementById('inp-inv-poref').value.trim(),
          orderId: selectedOrderId || null,
          invoiceDate: document.getElementById('inp-inv-date').value.trim(),
          dueDate: document.getElementById('inp-inv-duedate').value.trim(),
          milestoneTag: document.getElementById('inp-inv-milestone').value.trim(),
          bgRequired: document.getElementById('inp-inv-bgreq').value,
          bgAmount: Number(document.getElementById('inp-inv-bgamt').value) || 0,
          bgExpiryDate: document.getElementById('inp-inv-bgdate').value.trim(),
          retentionRequired: document.getElementById('inp-inv-retreq').value,
          retentionAmount: Number(document.getElementById('inp-inv-retamt').value) || 0,
          retentionPeriod: document.getElementById('inp-inv-retperiod').value.trim(),
          bankDetails: document.getElementById('inp-inv-bank').value,
          terms: document.getElementById('inp-inv-terms').value.trim(),
          attachments: currentInvoiceAttachments,
          isInterstate: isInterstate,
          items: items,
          taxableValue: taxableTotal,
          taxAmount: taxTotal,
          grandTotal: grandTotal,
          paidAmount: 0,
          tdsDeducted: 0,
          balanceDue: grandTotal,
          status: initialStatus,
          approvalInfo: approvalInfo,
          employeeId: myEmpId,
          employeeName: myName,
          updatedAt: new Date().toISOString()
        };

        if (docId) {
          // Preserve existing paid amounts on edit
          var existing = (window.RevOpsStore.getCollection('invoices') || []).find(function(it) { return it.id === docId; });
          if (existing) {
            invData.paidAmount = existing.paidAmount || 0;
            invData.tdsDeducted = existing.tdsDeducted || 0;
            invData.balanceDue = Math.max(0, grandTotal - (invData.paidAmount + invData.tdsDeducted));
            invData.status = existing.status || initialStatus;
            invData.approvalInfo = existing.approvalInfo || approvalInfo;
          }
          window.RevOpsStore.updateItem('invoices', docId, invData);
        } else {
          invData.createdAt = new Date().toISOString();
          invData.emailDispatchHistory = [];
          window.RevOpsStore.addItem('invoices', invData);

          // If linked to an order, mark the order as Invoiced so it is filtered out next time
          if (selectedOrderId) {
            window.RevOpsStore.updateItem('orders', selectedOrderId, {
              invoicedStatus: 'Invoiced',
              invoiceNumber: invData.invoiceNumber,
              invoiceDate: invData.invoiceDate
            });
          }
        }

        closeInvoiceModal();
        populateQuoteAndOrderSources();
        renderInvoicesTable();
        alert(initialStatus === 'Approved' ? "✅ Commercial Invoice created & approved successfully!" : "📋 Commercial Invoice submitted for Senior Authorization.");
      }

      function editInvoice(docId) {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var inv = invoices.find(function(item) { return item.id === docId; });
        if (!inv) return;

        document.getElementById('inv-doc-id').value = inv.id;
        document.getElementById('invoice-modal-title').innerText = "Edit Commercial Invoice";
        document.getElementById('inp-inv-number').value = inv.invoiceNumber;
        document.getElementById('inp-inv-type').value = inv.invoiceType || 'Tax Invoice';
        document.getElementById('inp-inv-vertical').value = inv.vertical || 'Sales';
        document.getElementById('inp-inv-customer').value = inv.customerName;
        document.getElementById('inp-inv-gstin').value = inv.customerGstin || '';
        document.getElementById('inp-inv-email').value = inv.customerEmail || '';
        document.getElementById('inp-inv-contact').value = inv.contactPerson || '';
        document.getElementById('inp-inv-poref').value = inv.poRef || '';
        document.getElementById('inp-inv-date').value = inv.invoiceDate;
        document.getElementById('inp-inv-duedate').value = inv.dueDate || '';
        document.getElementById('inp-inv-milestone').value = inv.milestoneTag || '';
        document.getElementById('inp-inv-interstate').checked = !!inv.isInterstate;

        // PG / BG
        document.getElementById('inp-inv-bgreq').value = inv.bgRequired || 'No';
        document.getElementById('inp-inv-bgamt').value = inv.bgAmount || '';
        document.getElementById('inp-inv-bgdate').value = inv.bgExpiryDate || '';
        toggleInvoiceBgFields();

        // Retention
        document.getElementById('inp-inv-retreq').value = inv.retentionRequired || 'No';
        document.getElementById('inp-inv-retamt').value = inv.retentionAmount || '';
        document.getElementById('inp-inv-retperiod').value = inv.retentionPeriod || '';
        toggleInvoiceRetFields();

        // Attachments
        currentInvoiceAttachments = inv.attachments || [];
        renderInvoiceAttachments();

        var tbody = document.getElementById('invoice-items-tbody');
        tbody.innerHTML = "";
        if (inv.items && inv.items.length > 0) {
          inv.items.forEach(function(it) {
            addInvoiceLineItem(it.description, it.hsnCode, it.quantity, it.unitPrice, it.discountPercent, it.taxPercent);
          });
        }

        calculateInvoiceTotals();
        document.getElementById('invoice-modal').classList.remove('hidden');
      }

      function deleteInvoice(docId) {
        if (confirm("Are you sure you want to delete this invoice? Linked payments may be affected.")) {
          window.RevOpsStore.deleteItem('invoices', docId);
          renderInvoicesTable();
        }
      }

      // Senior Approval Functions
      function openSeniorReviewModal(invId) {
        pendingReviewInvoiceId = invId;
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var inv = invoices.find(function(it) { return it.id === invId; });
        if (!inv) return;

        var content = document.getElementById('senior-review-content');
        content.innerHTML = `
          <div class="flex justify-between border-b border-slate-200 pb-2">
            <div>
              <span class="font-mono font-bold text-slate-900 text-sm">${escapeHtml(inv.invoiceNumber)}</span>
              <span class="block text-slate-500 font-semibold">${escapeHtml(inv.customerName)}</span>
            </div>
            <div class="text-right">
              <span class="font-black text-indigo-600 text-sm">${formatINR(inv.grandTotal)}</span>
              <span class="block text-[10px] text-slate-400">Due: ${escapeHtml(inv.dueDate || '--')}</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div><strong>Raised By:</strong> ${escapeHtml(inv.employeeName || 'Staff')}</div>
            <div><strong>Vertical:</strong> ${escapeHtml(inv.vertical || 'Sales')}</div>
            <div><strong>Customer GSTIN:</strong> <span class="font-mono">${escapeHtml(inv.customerGstin || 'Unregistered')}</span></div>
            <div><strong>Milestone:</strong> ${escapeHtml(inv.milestoneTag || 'Standard')}</div>
          </div>
          <div class="p-2 bg-emerald-50 rounded text-emerald-800 text-[10px] font-semibold">
            ✓ Commercial verification: Taxable ${formatINR(inv.taxableValue)} + GST ${formatINR(inv.taxAmount)} = ${formatINR(inv.grandTotal)}
          </div>
        `;
        document.getElementById('inp-senior-remarks').value = "Verified line items, GST calculations, and payment terms. Approved for client dispatch.";
        document.getElementById('senior-review-modal').classList.remove('hidden');
      }

      function closeSeniorReviewModal() {
        document.getElementById('senior-review-modal').classList.add('hidden');
        pendingReviewInvoiceId = null;
      }

      function executeSeniorApproval(decision) {
        if (!pendingReviewInvoiceId) return;
        if (localStorage.getItem('isPrimaryApprover') !== 'true') {
          alert("Only the designated Primary Approver can approve invoices. Ask your admin to assign this on the Employees page if this is incorrect.");
          return;
        }
        var myName = localStorage.getItem('userName');
        var myEmpId = localStorage.getItem('employeeId');
        var remarks = document.getElementById('inp-senior-remarks').value.trim();

        var updates = {
          status: decision === 'Approved' ? 'Approved' : 'Rejected',
          approvalInfo: {
            approvedBy: myName + ' (' + myEmpId + ')',
            action: decision,
            approvedDate: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            seniorRemarks: remarks
          }
        };
        if (decision === 'Approved') {
          window.RevOpsStore.approvePrimaryStage(updates, myName, myEmpId, remarks);
        }

        window.RevOpsStore.updateItem('invoices', pendingReviewInvoiceId, updates);
        closeSeniorReviewModal();
        renderInvoicesTable();
        alert(decision === 'Approved' ? "✅ Invoice approved! Ready to dispatch to client. (Director ratification is still pending, but does not block dispatch.)" : "❌ Invoice marked as Rejected.");
      }

      function ratifyInvoiceDirect(invId) {
        if (localStorage.getItem('isDirector') !== 'true') {
          alert("Only the designated Director can ratify invoice approvals.");
          return;
        }
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var inv = invoices.find(function(it) { return it.id === invId; });
        if (!inv || (inv.status !== 'Approved' && inv.status !== 'Issued') || inv.directorRatificationStatus !== 'Pending') {
          alert("This invoice isn't awaiting director ratification.");
          return;
        }
        var remarks = prompt("Enter ratification remarks (optional):", "Ratified.");
        if (remarks === null) return;

        var myName = localStorage.getItem('userName') || 'Director';
        var myEmpId = localStorage.getItem('employeeId') || '';
        var updates = {};
        window.RevOpsStore.ratifyByDirector(updates, myName, myEmpId, remarks);
        window.RevOpsStore.updateItem('invoices', invId, updates);
        renderInvoicesTable();
        alert("Invoice " + inv.invoiceNumber + " ratified by Director.");
      }

      // Email Client Dispatch Modal Functions
      function openSendInvoiceModal(invId) {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var inv = invoices.find(function(it) { return it.id === invId; });
        if (!inv) return;

        if (inv.status === 'Pending Senior Approval' || inv.status === 'Rejected') {
          alert("This invoice cannot be dispatched to the client yet — it still needs Primary Approver sign-off before it can be sent.");
          return;
        }

        document.getElementById('send-inv-id').value = inv.id;
        document.getElementById('inp-send-to').value = inv.customerEmail || 'accounts@client.com';
        
        // CC Logic: Auto-populate CC from Quotation / Order details + Accounts
        var ccList = ['measuredichennai@gmail.com'];
        if (inv.orderId) {
          var ord = orders.find(function(o) { return o.id === inv.orderId; });
          if (ord) {
            if (ord.ccEmails) {
              ord.ccEmails.split(',').forEach(function(em) { if (em.trim() && !ccList.includes(em.trim())) ccList.push(em.trim()); });
            }
            if (ord.quotationId) {
              var q = quotes.find(function(item) { return item.id === ord.quotationId || item.quoteNumber === ord.quotationId; });
              if (q && q.ccEmails) {
                q.ccEmails.split(',').forEach(function(em) { if (em.trim() && !ccList.includes(em.trim())) ccList.push(em.trim()); });
              }
            }
          }
        }
        document.getElementById('inp-send-cc').value = ccList.join(', ');

        // Render Attached Files For Dispatch
        var attachList = document.getElementById('send-attachments-list');
        if (attachList) {
          var invPdfName = (inv.invoiceNumber.replace(/\//g, '_')) + '.pdf';
          var html = `
            <div class="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center justify-between text-xs">
              <span class="truncate">📄 ${invPdfName}</span>
              <span class="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded font-black">TAX INVOICE PDF</span>
            </div>
          `;
          if (inv.attachments && inv.attachments.length > 0) {
            inv.attachments.forEach(function(att) {
              var badge = att.isClientPo ? '⭐ CLIENT PO' : 'DOC';
              var bgClass = att.isClientPo ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-800 border-slate-200';
              html += `
                <div class="px-2.5 py-1.5 ${bgClass} border rounded-lg font-semibold flex items-center justify-between text-xs">
                  <span class="truncate" title="${escapeHtml(att.name)}">📎 ${escapeHtml(att.name)}</span>
                  <span class="text-[10px] bg-white text-slate-700 px-1.5 py-0.5 rounded font-bold border border-slate-200">${badge}</span>
                </div>
              `;
            });
          }
          attachList.innerHTML = html;
        }
        
        var subject = `[Measure DI Technologies] ${inv.invoiceType || 'Tax Invoice'} ${inv.invoiceNumber} - ${inv.customerName}`;
        document.getElementById('inp-send-subject').value = subject;

        var body = `Dear ${inv.contactPerson || inv.customerName} Team,

Greetings from Measure DI Technologies Private Limited.

Please find attached our official ${inv.invoiceType || 'Tax Invoice'} Ref: ${inv.invoiceNumber} dated ${inv.invoiceDate} for the total amount of ${formatINR(inv.grandTotal)}.

Invoice Summary:
- Invoice Ref: ${inv.invoiceNumber}
- Customer: ${inv.customerName}
- Total Amount Payable: ${formatINR(inv.grandTotal)}
- Payment Due Date: ${inv.dueDate || 'Immediate'}
- Milestone / Purpose: ${inv.milestoneTag || 'Commercial Supply / Services'}
${inv.bgRequired === 'Yes' ? `- Bank Guarantee / PG: ${formatINR(inv.bgAmount)} (Exp: ${inv.bgExpiryDate || '--'})\n` : ''}${inv.retentionRequired === 'Yes' ? `- Retention Clause: ${formatINR(inv.retentionAmount)} (${inv.retentionPeriod || '--'})\n` : ''}
Remittance Bank Details:
- Account Name: Measure DI Technologies Private Limited
- Bank: ${inv.bankDetails || 'HDFC Bank - Current A/c No: 50200049283719, IFSC: HDFC0000123'}

Kindly process the payment within the agreed credit terms and share the UTR / transaction remittance advice to measuredichennai@gmail.com for receipt issuance.

Warm regards,
${inv.employeeName || 'Accounts & Finance Team'}
Measure DI Technologies Pvt Ltd
Mobile: +91 98406 29928 | Web: www.measuredi.com`;

        document.getElementById('inp-send-body').value = body;

        // Dispatch History
        var histBox = document.getElementById('inv-dispatch-history-box');
        var histList = document.getElementById('inv-dispatch-history-list');
        if (inv.emailDispatchHistory && inv.emailDispatchHistory.length > 0) {
          histBox.classList.remove('hidden');
          histList.innerHTML = inv.emailDispatchHistory.map(function(h) {
            return `<div>• ${h.timestamp} - Sent to <strong>${escapeHtml(h.to)}</strong> by ${escapeHtml(h.senderName)} (${h.status})</div>`;
          }).join('');
        } else {
          histBox.classList.add('hidden');
        }

        document.getElementById('send-invoice-modal').classList.remove('hidden');
      }

      function closeSendInvoiceModal() {
        document.getElementById('send-invoice-modal').classList.add('hidden');
      }

      async function executeSendInvoiceEmail() {
        var invId = document.getElementById('send-inv-id').value;
        var toEmail = document.getElementById('inp-send-to').value.trim();
        var ccEmail = document.getElementById('inp-send-cc').value.trim();
        var subject = document.getElementById('inp-send-subject').value.trim();
        var body = document.getElementById('inp-send-body')?.value?.trim() || '';
        var myName = localStorage.getItem('userName') || 'Finance Manager';

        if (!toEmail) {
          alert("Please specify the recipient client email address.");
          return;
        }

        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var inv = invoices.find(function(it) { return it.id === invId; });
        if (!inv) return;

        var btn = event?.target?.closest('button');
        var originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span>⏳ Dispatching Invoice via Brevo...</span>';
        }

        try {
          if (!window.BrevoMailer || typeof window.BrevoMailer.sendInvoiceEmail !== 'function') {
            throw new Error('Email service failed to load. Please refresh the page and try again.');
          }
          var res = await window.BrevoMailer.sendInvoiceEmail(inv, {
            to: toEmail,
            cc: ccEmail,
            subject: subject,
            body: body
          });

          var history = inv.emailDispatchHistory || [];
          history.push({
            timestamp: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            to: toEmail,
            cc: ccEmail,
            subject: subject,
            senderName: myName,
            status: 'Delivered (Brevo)',
            messageId: res ? res.messageId : ''
          });

          var updates = {
            emailDispatchHistory: history,
            status: inv.status === 'Draft' || inv.status === 'Approved' ? 'Issued' : inv.status
          };

          window.RevOpsStore.updateItem('invoices', inv.id, updates);
          closeSendInvoiceModal();
          renderInvoicesTable();
          alert("✅ SUCCESS!\n\nOfficial Invoice " + inv.invoiceNumber + " has been dispatched directly to " + toEmail + " via Brevo!\n\n• Sender: Measure DI Systems (measuredichennai@gmail.com)\n• Status: Delivered & Issued\n• Communication logged in audit ledger");
        } catch (err) {
          console.error('Send invoice error:', err);
          var fallback = confirm("Notice during invoice email dispatch:\n" + (err.message || err) + "\n\nWould you like to launch your local email client instead?");
          if (fallback) {
            openInvoiceInMailClient();
          }
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
          }
        }
      }

      function openInvoiceInMailClient() {
        var toEmail = document.getElementById('inp-send-to').value.trim();
        var ccEmail = document.getElementById('inp-send-cc').value.trim();
        var subject = encodeURIComponent(document.getElementById('inp-send-subject').value.trim());
        var body = encodeURIComponent(document.getElementById('inp-send-body').value.trim());
        window.location.href = `mailto:${toEmail}?cc=${ccEmail}&subject=${subject}&body=${body}`;
      }

      // Printable PDF Document Viewer
      function viewPrintableInvoice(invId) {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var inv = invoices.find(function(it) { return it.id === invId; });
        if (!inv) return;

        document.getElementById('view-modal-title').innerText = `${inv.invoiceType || 'Tax Invoice'} - ${inv.invoiceNumber}`;
        var wrapper = document.getElementById('printable-invoice-wrapper');

        var itemsHtml = '';
        if (inv.items && inv.items.length > 0) {
          inv.items.forEach(function(it, idx) {
            itemsHtml += `
              <tr class="border-b border-slate-200 text-xs">
                <td class="py-2.5 px-3 text-center">${idx + 1}</td>
                <td class="py-2.5 px-3 font-semibold text-slate-900">${escapeHtml(it.description)}</td>
                <td class="py-2.5 px-3 text-center font-mono">${escapeHtml(it.hsnCode || '90318000')}</td>
                <td class="py-2.5 px-3 text-right font-mono">${it.quantity || 1}</td>
                <td class="py-2.5 px-3 text-right font-mono">${formatINR(it.unitPrice)}</td>
                <td class="py-2.5 px-3 text-right font-mono">${it.discountPercent || 0}%</td>
                <td class="py-2.5 px-3 text-right font-mono font-bold">${formatINR(it.taxableAmount)}</td>
                <td class="py-2.5 px-3 text-right font-mono">${it.taxPercent || 18}%</td>
                <td class="py-2.5 px-3 text-right font-mono font-black">${formatINR(it.totalAmount)}</td>
              </tr>
            `;
          });
        }

        // PG / BG & Retention block
        var guaranteeBlock = '';
        if (inv.bgRequired === 'Yes' || inv.retentionRequired === 'Yes') {
          guaranteeBlock = `
            <div class="mt-4 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1.5">
              <span class="font-bold text-amber-900 uppercase block text-[11px]">Commercial Guarantees & Retention Terms:</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 text-[11px]">
                ${inv.bgRequired === 'Yes' ? `<div><strong>Bank Guarantee (BG/PG):</strong> <span class="font-mono font-bold text-amber-900">${formatINR(inv.bgAmount)}</span> (Validity: ${escapeHtml(inv.bgExpiryDate || 'As per PO')})</div>` : ''}
                ${inv.retentionRequired === 'Yes' ? `<div><strong>Retention Amount:</strong> <span class="font-mono font-bold text-amber-900">${formatINR(inv.retentionAmount)}</span> (Period: ${escapeHtml(inv.retentionPeriod || '12 Months Warranty')})</div>` : ''}
              </div>
            </div>
          `;
        }

        // Attached Files List in print view
        var attachmentsBadgeHtml = '';
        if (inv.attachments && inv.attachments.length > 0) {
          attachmentsBadgeHtml = `
            <div class="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span class="font-bold text-slate-700 uppercase block text-[10px] mb-1">Attached Companion Documents (${inv.attachments.length}):</span>
              <div class="flex flex-wrap gap-1.5">
                ${inv.attachments.map(function(a) {
                  return `<span class="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200 text-[10px] font-medium">${a.isClientPo ? '⭐ ' : '📎 '}${escapeHtml(a.name)}</span>`;
                }).join('')}
              </div>
            </div>
          `;
        }

        wrapper.innerHTML = `
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-2xl font-black text-indigo-950 tracking-tight">MEASURE DI TECHNOLOGIES</span>
                <span class="px-2 py-0.5 rounded bg-indigo-900 text-white text-[10px] font-black uppercase">PVT LTD</span>
              </div>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                Plot No. 42, SIDCO Industrial Estate, Guindy, Chennai - 600032, Tamil Nadu, India<br>
                <strong>GSTIN:</strong> 33AAACM4209L1ZT | <strong>CIN:</strong> U72900TN2020PTC135890<br>
                <strong>Email:</strong> measuredichennai@gmail.com | <strong>Phone:</strong> +91 98406 29928
              </p>
            </div>
            <div class="text-right">
              <h2 class="text-xl font-black text-slate-900 uppercase tracking-wide">${escapeHtml(inv.invoiceType || 'TAX INVOICE')}</h2>
              <div class="text-xs font-mono font-bold text-indigo-700 mt-1">${escapeHtml(inv.invoiceNumber)}</div>
              <div class="text-xs text-slate-500 font-mono mt-0.5">Date: ${escapeHtml(inv.invoiceDate)}</div>
              <div class="text-xs text-rose-600 font-mono font-bold">Due Date: ${escapeHtml(inv.dueDate || '--')}</div>
            </div>
          </div>

          <!-- Bill To / Ship To Grid -->
          <div class="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Billed To (Customer):</span>
              <div class="font-bold text-slate-900 text-sm">${escapeHtml(inv.customerName)}</div>
              <div class="text-slate-600 mt-0.5"><strong>GSTIN:</strong> <span class="font-mono font-bold">${escapeHtml(inv.customerGstin || 'Unregistered')}</span></div>
              <div class="text-slate-600"><strong>Attn:</strong> ${escapeHtml(inv.contactPerson || 'Procurement Department')}</div>
              <div class="text-slate-600"><strong>Email:</strong> ${escapeHtml(inv.customerEmail || '--')}</div>
            </div>
            <div>
              <span class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Commercial & Dispatch Reference:</span>
              <div class="text-slate-700"><strong>PO Reference:</strong> <span class="font-mono font-bold">${escapeHtml(inv.poRef || 'As per Contract')}</span></div>
              <div class="text-slate-700"><strong>Vertical / Division:</strong> ${escapeHtml(inv.vertical || 'Sales')}</div>
              <div class="text-slate-700"><strong>Milestone:</strong> ${escapeHtml(inv.milestoneTag || 'Commercial Billing')}</div>
              <div class="text-slate-700"><strong>Place of Supply:</strong> ${inv.isInterstate ? 'Inter-State Supply (IGST)' : 'Tamil Nadu (State Code: 33 - CGST/SGST)'}</div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-700">
                  <th class="py-2.5 px-3 text-center w-10">#</th>
                  <th class="py-2.5 px-3">Item Description</th>
                  <th class="py-2.5 px-3 text-center w-20">HSN</th>
                  <th class="py-2.5 px-3 text-right w-14">Qty</th>
                  <th class="py-2.5 px-3 text-right w-24">Rate (Rs.)</th>
                  <th class="py-2.5 px-3 text-right w-16">Disc</th>
                  <th class="py-2.5 px-3 text-right w-24">Taxable</th>
                  <th class="py-2.5 px-3 text-right w-16">GST</th>
                  <th class="py-2.5 px-3 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          ${guaranteeBlock}
          ${attachmentsBadgeHtml}

          <!-- Totals Breakdown & Bank Details -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <span class="font-bold text-slate-800 uppercase block text-[11px]">Bank Remittance Instructions:</span>
              <p class="text-slate-600 leading-relaxed font-mono text-[11px]">
                <strong>Account Name:</strong> Measure DI Technologies Pvt Ltd<br>
                <strong>Bank & Branch:</strong> ${escapeHtml(inv.bankDetails || 'HDFC Bank, Current A/c No: 50200049283719, IFSC: HDFC0000123')}<br>
                <strong>Payment Mode:</strong> RTGS / NEFT / IMPS<br>
                <strong>Terms:</strong> ${escapeHtml(inv.terms || 'Payment within 30 days')}
              </p>
            </div>

            <div class="space-y-1.5 text-xs text-right bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div class="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span class="font-bold text-slate-900 font-mono">${formatINR(inv.taxableValue)}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>${inv.isInterstate ? 'Integrated GST (IGST 18%):' : 'CGST (9%) + SGST (9%):'}</span>
                <span class="font-bold text-indigo-700 font-mono">${formatINR(inv.taxAmount)}</span>
              </div>
              <div class="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-2">
                <span>Total Invoice Value:</span>
                <span class="text-indigo-600 font-mono text-base">${formatINR(inv.grandTotal)}</span>
              </div>
              <div class="flex justify-between text-xs text-emerald-700 pt-1">
                <span>Cleared Payments + TDS:</span>
                <span class="font-bold font-mono">${formatINR((inv.paidAmount || 0) + (inv.tdsDeducted || 0))}</span>
              </div>
              ${((inv.adjustmentAmount || 0) + (inv.writeOffAmount || 0)) > 0 ? `
                <div class="flex justify-between text-xs text-purple-800 pt-0.5">
                  <span>Director Adjustments / Write-Off:</span>
                  <span class="font-bold font-mono">-${formatINR((inv.adjustmentAmount || 0) + (inv.writeOffAmount || 0))}</span>
                </div>
              ` : ''}
              <div class="flex justify-between text-xs font-black text-amber-700 border-t border-dashed border-slate-300 pt-1">
                <span>Net Balance Due:</span>
                <span class="font-mono">${formatINR(inv.balanceDue)}</span>
              </div>
            </div>
          </div>

          <!-- Signatures & Authorization -->
          <div class="flex justify-between items-end border-t border-slate-200 pt-6 text-xs">
            <div class="text-[11px] text-slate-500 max-w-sm">
              This is a system generated commercial invoice authenticated under Digital Signature Protocol.
              ${inv.approvalInfo ? `<br><strong class="text-emerald-700">Senior Authorization:</strong> ${escapeHtml(inv.approvalInfo.approvedBy)} on ${escapeHtml(inv.approvalInfo.approvedDate)}` : ''}
            </div>
            <div class="text-center">
              <div class="w-48 py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg mx-auto flex flex-col items-center justify-center">
                <span class="text-[10px] font-serif italic text-indigo-950 font-bold tracking-wider">M. Ravichandran</span>
                <span class="text-[9px] text-emerald-700 font-mono font-bold">✓ Digitally Signed</span>
                <span class="text-[8px] text-slate-400 font-mono">Cert: DSC-MDI-2026-98406</span>
              </div>
              <span class="font-bold text-slate-900 block mt-1.5 text-xs">For MEASURE DI TECHNOLOGIES PVT LTD</span>
              <span class="text-[10px] text-slate-600 font-semibold">M. Ravichandran, Managing Director & CEO</span>
            </div>
          </div>
        `;

        document.getElementById('invoice-view-modal').classList.remove('hidden');
      }

      function closeInvoiceViewModal() {
        document.getElementById('invoice-view-modal').classList.add('hidden');
      }

      function printInvoiceDoc() {
        window.print();
      }

      function recordInvoicePaymentRedirect(invId) {
        window.location.href = `payments.html?invoiceId=${encodeURIComponent(invId)}`;
      }

      function requestInvoiceAdjustmentRedirect(invId) {
        window.location.href = `payments.html?action=adjustment&invoiceId=${encodeURIComponent(invId)}`;
      }

